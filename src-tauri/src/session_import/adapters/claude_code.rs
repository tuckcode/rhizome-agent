//! Reads Claude Code's own session logs into import candidates.
//!
//! Format verified against 23,380 messages across 60 real session files in
//! `~/.claude/projects/<slug>/<session-uuid>.jsonl` on 2026-09-05 — not from
//! documentation. What that survey established:
//!
//! - One JSON object per line, of many `type`s. Conversation lives only in
//!   `user` and `assistant` records; the rest are session metadata
//!   (`custom-title`, `mode`, `cost-state`, `file-history-snapshot`, …).
//! - `user.message.content` is a string **or** a block list; `assistant`'s is
//!   always a block list.
//! - Observed block types: `text`, `tool_use`, `tool_result`, `thinking`,
//!   `image`.
//! - `timestamp` is ISO-8601 with a `Z` suffix.
//! - Only 14 of 60 sessions carried a `custom-title`, so a title has to be
//!   derived for most of them.

use chrono::{DateTime, Utc};

use crate::session_import::dedup::{ImportCandidate, Provenance};
use crate::session_import::fingerprint::{DateSpan, ImportedMessage};

pub const SOURCE_APP: &str = "claude_code";

/// Longest derived title, in characters, before it is cut at a word boundary.
const DERIVED_TITLE_LIMIT: usize = 60;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedSession {
    pub source_session_id: String,
    pub title: String,
    pub messages: Vec<ImportedMessage>,
    pub date_span: Option<DateSpan>,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
}

impl ParsedSession {
    pub fn into_candidate(self) -> ImportCandidate {
        ImportCandidate {
            source_app: SOURCE_APP.to_string(),
            source_session_id: self.source_session_id,
            messages: self.messages,
            date_span: self.date_span,
            // Claude Code logs its own conversations; nothing in the format
            // claims a thread was imported from elsewhere, so a copy that
            // originated in another app is caught by fingerprint, not here.
            provenance: Provenance::default(),
        }
    }
}

/// Parse one session log. Returns `None` when it holds no conversation.
///
/// Every failure mode here is "skip the line and keep going": these files are
/// appended to live, so the last line can be a partial write, and unknown
/// record types appear whenever Claude Code adds a feature. Refusing a whole
/// session because one line is unfamiliar would lose real history.
pub fn parse_session_jsonl(contents: &str) -> Option<ParsedSession> {
    let mut messages = Vec::new();
    let mut session_id: Option<String> = None;
    let mut custom_title: Option<String> = None;
    let mut cwd: Option<String> = None;
    let mut git_branch: Option<String> = None;
    let mut first_day: Option<i64> = None;
    let mut last_day: Option<i64> = None;

    for line in contents.lines() {
        let Ok(record) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let record_type = record
            .get("type")
            .and_then(|value| value.as_str())
            .unwrap_or_default();

        if session_id.is_none() {
            session_id = string_field(&record, "sessionId");
        }
        if record_type == "custom-title" {
            custom_title = string_field(&record, "customTitle");
            continue;
        }
        if record_type != "user" && record_type != "assistant" {
            continue;
        }
        // Sidechains are subagent side conversations, not the thread the user
        // had. Importing them would show one session as several.
        if record.get("isSidechain").and_then(|value| value.as_bool()) == Some(true) {
            continue;
        }

        let Some(text) = message_text(&record) else {
            continue;
        };
        if cwd.is_none() {
            cwd = string_field(&record, "cwd");
        }
        if git_branch.is_none() {
            git_branch = string_field(&record, "gitBranch").filter(|branch| !branch.is_empty());
        }
        if let Some(day) = record_day(&record) {
            first_day = Some(first_day.map_or(day, |current: i64| current.min(day)));
            last_day = Some(last_day.map_or(day, |current: i64| current.max(day)));
        }
        messages.push(ImportedMessage::new(record_type, text));
    }

    if messages.is_empty() {
        return None;
    }

    let date_span = first_day.zip(last_day).map(|(first, last)| DateSpan {
        first_day: first,
        last_day: last,
    });

    Some(ParsedSession {
        source_session_id: session_id?,
        title: custom_title
            .filter(|title| !title.trim().is_empty())
            .unwrap_or_else(|| derived_title(&messages)),
        messages,
        date_span,
        cwd,
        git_branch,
    })
}

fn string_field(record: &serde_json::Value, key: &str) -> Option<String> {
    record
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::to_string)
}

/// The conversational text of a record, or `None` when it carries none.
///
/// **Text blocks only, deliberately.** `thinking` is internal reasoning rather
/// than what was said; `tool_use` and `tool_result` are the highest-risk place
/// for credentials to appear (the plan requires redaction before fingerprinting)
/// and they also make two exports of one conversation hash differently. `image`
/// has no text to contribute.
fn message_text(record: &serde_json::Value) -> Option<String> {
    let content = record.get("message")?.get("content")?;
    if let Some(text) = content.as_str() {
        return non_empty(text.to_string());
    }
    let blocks = content.as_array()?;
    let text = blocks
        .iter()
        .filter(|block| block.get("type").and_then(|value| value.as_str()) == Some("text"))
        .filter_map(|block| block.get("text").and_then(|value| value.as_str()))
        .collect::<Vec<_>>()
        .join("\n");
    non_empty(text)
}

fn non_empty(text: String) -> Option<String> {
    (!text.trim().is_empty()).then_some(text)
}

/// Days since the Unix epoch, so a fingerprint ignores time-of-day and zone.
fn record_day(record: &serde_json::Value) -> Option<i64> {
    let timestamp = record.get("timestamp")?.as_str()?;
    let parsed = DateTime::parse_from_rfc3339(timestamp).ok()?;
    Some(parsed.with_timezone(&Utc).timestamp().div_euclid(86_400))
}

/// A title from the first thing the user said, for the 3-in-4 sessions that
/// carry no `custom-title`. Cut on a word boundary so it does not end mid-word.
fn derived_title(messages: &[ImportedMessage]) -> String {
    let Some(first_user) = messages.iter().find(|message| message.role == "user") else {
        return "Untitled session".to_string();
    };
    let flattened = first_user
        .content
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if flattened.chars().count() <= DERIVED_TITLE_LIMIT {
        return flattened;
    }
    let truncated: String = flattened.chars().take(DERIVED_TITLE_LIMIT).collect();
    let cut = truncated.rfind(' ').unwrap_or(truncated.len());
    format!("{}…", truncated[..cut].trim_end())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Shapes below mirror the real records surveyed on 2026-09-05; see the
    /// module docs for what that survey covered.
    fn user_line(session: &str, text: &str, timestamp: &str) -> String {
        serde_json::json!({
            "type": "user",
            "sessionId": session,
            "timestamp": timestamp,
            "cwd": "/Users/jdoe/code/projects/rhizome-agent",
            "gitBranch": "main",
            "isSidechain": false,
            "message": { "role": "user", "content": text },
        })
        .to_string()
    }

    fn assistant_line(session: &str, blocks: serde_json::Value, timestamp: &str) -> String {
        serde_json::json!({
            "type": "assistant",
            "sessionId": session,
            "timestamp": timestamp,
            "isSidechain": false,
            "message": { "role": "assistant", "content": blocks },
        })
        .to_string()
    }

    #[test]
    fn reads_a_plain_exchange() {
        let log = [
            user_line("s-1", "How do wikilinks work?", "2026-08-30T14:56:14.799Z"),
            assistant_line(
                "s-1",
                serde_json::json!([{ "type": "text", "text": "They link notes by title." }]),
                "2026-08-30T14:56:20.000Z",
            ),
        ]
        .join("\n");

        let session = parse_session_jsonl(&log).expect("a session");

        assert_eq!(session.source_session_id, "s-1");
        assert_eq!(
            session.messages,
            vec![
                ImportedMessage::new("user", "How do wikilinks work?"),
                ImportedMessage::new("assistant", "They link notes by title."),
            ],
        );
        assert_eq!(
            session.cwd.as_deref(),
            Some("/Users/jdoe/code/projects/rhizome-agent")
        );
        assert_eq!(session.git_branch.as_deref(), Some("main"));
    }

    /// Tool traffic is where credentials leak and where two exports of one
    /// conversation diverge, so it must not reach the fingerprint.
    #[test]
    fn keeps_text_blocks_and_drops_thinking_tools_and_images() {
        let log = assistant_line(
            "s-1",
            serde_json::json!([
                { "type": "thinking", "thinking": "internal reasoning" },
                { "type": "text", "text": "Here is the answer." },
                { "type": "tool_use", "name": "Bash", "input": { "command": "echo $API_KEY" } },
                { "type": "image", "source": { "data": "…" } },
            ]),
            "2026-08-30T14:56:20.000Z",
        );

        let session = parse_session_jsonl(&log).expect("a session");

        assert_eq!(
            session.messages,
            vec![ImportedMessage::new("assistant", "Here is the answer.")],
        );
    }

    #[test]
    fn skips_records_that_carry_no_text() {
        let log = [
            user_line("s-1", "hello", "2026-08-30T14:56:14.799Z"),
            // A user record whose content is only a tool result.
            serde_json::json!({
                "type": "user",
                "sessionId": "s-1",
                "timestamp": "2026-08-30T14:56:15.000Z",
                "isSidechain": false,
                "message": { "role": "user", "content": [{ "type": "tool_result", "content": "output" }] },
            })
            .to_string(),
        ]
        .join("\n");

        let session = parse_session_jsonl(&log).expect("a session");

        assert_eq!(
            session.messages,
            vec![ImportedMessage::new("user", "hello")]
        );
    }

    /// Subagent side conversations would otherwise show one session as several.
    #[test]
    fn skips_sidechain_records() {
        let mut sidechain: serde_json::Value = serde_json::from_str(&user_line(
            "s-1",
            "subagent chatter",
            "2026-08-30T14:56:16.000Z",
        ))
        .unwrap();
        sidechain["isSidechain"] = serde_json::json!(true);

        let log = [
            user_line("s-1", "main thread", "2026-08-30T14:56:14.799Z"),
            sidechain.to_string(),
        ]
        .join("\n");

        let session = parse_session_jsonl(&log).expect("a session");

        assert_eq!(
            session.messages,
            vec![ImportedMessage::new("user", "main thread")]
        );
    }

    /// These logs are appended to live, so the last line can be a half-written
    /// record — and unknown record types appear whenever Claude Code ships a
    /// feature. Neither may cost the user a whole session.
    #[test]
    fn survives_partial_lines_and_unknown_record_types() {
        let log = [
            r#"{"type":"mode","sessionId":"s-1","mode":"default"}"#.to_string(),
            r#"{"type":"cost-state","sessionId":"s-1","totalCostUSD":0.1}"#.to_string(),
            user_line("s-1", "still counted", "2026-08-30T14:56:14.799Z"),
            r#"{"type":"assistant","message":{"content":[{"type":"tex"#.to_string(),
        ]
        .join("\n");

        let session = parse_session_jsonl(&log).expect("a session");

        assert_eq!(
            session.messages,
            vec![ImportedMessage::new("user", "still counted")]
        );
    }

    #[test]
    fn prefers_a_custom_title_when_the_session_has_one() {
        let log = [
            r#"{"type":"custom-title","sessionId":"s-1","customTitle":"Wikilink research"}"#
                .to_string(),
            user_line("s-1", "How do wikilinks work?", "2026-08-30T14:56:14.799Z"),
        ]
        .join("\n");

        assert_eq!(
            parse_session_jsonl(&log).unwrap().title,
            "Wikilink research"
        );
    }

    /// Three in four real sessions carry no custom title.
    #[test]
    fn derives_a_title_from_the_first_user_message() {
        let log = user_line(
            "s-1",
            "How do  wikilinks\nwork?",
            "2026-08-30T14:56:14.799Z",
        );

        assert_eq!(
            parse_session_jsonl(&log).unwrap().title,
            "How do wikilinks work?"
        );
    }

    #[test]
    fn cuts_a_long_derived_title_on_a_word_boundary() {
        let long = "This is a considerably longer opening message that will certainly need cutting";
        let log = user_line("s-1", long, "2026-08-30T14:56:14.799Z");

        let title = parse_session_jsonl(&log).unwrap().title;

        assert!(title.ends_with('…'), "expected an ellipsis, got {title:?}");
        assert!(title.chars().count() <= DERIVED_TITLE_LIMIT + 1);
        assert!(!title.contains("  "));
        // Cut between words, not through one.
        assert!(long.starts_with(title.trim_end_matches('…').trim_end()));
    }

    #[test]
    fn records_the_day_span_the_conversation_covers() {
        let log = [
            user_line("s-1", "day one", "2026-08-30T23:59:00.000Z"),
            assistant_line(
                "s-1",
                serde_json::json!([{ "type": "text", "text": "day two" }]),
                "2026-08-31T00:01:00.000Z",
            ),
        ]
        .join("\n");

        let span = parse_session_jsonl(&log)
            .unwrap()
            .date_span
            .expect("a span");

        assert_eq!(span.last_day - span.first_day, 1);
    }

    #[test]
    fn returns_nothing_for_a_log_with_no_conversation() {
        let metadata_only = [
            r#"{"type":"mode","sessionId":"s-1","mode":"default"}"#,
            r#"{"type":"cost-state","sessionId":"s-1"}"#,
        ]
        .join("\n");

        assert_eq!(parse_session_jsonl(&metadata_only), None);
        assert_eq!(parse_session_jsonl(""), None);
    }

    #[test]
    fn converts_into_a_candidate_tagged_with_this_source() {
        let log = user_line("s-1", "hello", "2026-08-30T14:56:14.799Z");

        let candidate = parse_session_jsonl(&log).unwrap().into_candidate();

        assert_eq!(candidate.source_app, SOURCE_APP);
        assert_eq!(candidate.source_session_id, "s-1");
        assert_eq!(candidate.provenance, Provenance::default());
        assert!(!candidate.content_fingerprint().is_empty());
    }
}

/// Opt-in check against this machine's real Claude Code logs.
///
/// Ignored by default: it depends on `~/.claude/projects` existing and on
/// whatever conversations happen to be there, so it is a probe, not a gate.
/// Run with `cargo test --lib real_claude_code_logs -- --ignored --nocapture`.
#[cfg(test)]
mod real_logs {
    use super::*;

    #[test]
    #[ignore = "reads the developer's own ~/.claude/projects"]
    fn real_claude_code_logs_parse_into_candidates() {
        let Some(home) = std::env::var_os("HOME") else {
            return;
        };
        let root = std::path::Path::new(&home).join(".claude/projects");
        let mut files = 0;
        let mut parsed = 0;
        let mut messages = 0;
        let mut titled = 0;

        let Ok(projects) = std::fs::read_dir(&root) else {
            return;
        };
        for project in projects.flatten() {
            let Ok(entries) = std::fs::read_dir(project.path()) else {
                continue;
            };
            for entry in entries.flatten() {
                if entry.path().extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
                    continue;
                }
                let Ok(contents) = std::fs::read_to_string(entry.path()) else {
                    continue;
                };
                files += 1;
                if let Some(session) = parse_session_jsonl(&contents) {
                    assert!(!session.source_session_id.is_empty());
                    assert!(!session.title.is_empty());
                    assert!(!session.messages.is_empty());
                    if session.date_span.is_some() {
                        titled += 1;
                    }
                    messages += session.messages.len();
                    parsed += 1;
                }
            }
        }

        println!("files={files} parsed={parsed} messages={messages} with_date_span={titled}");
        assert!(files > 0, "no session logs found to check");
        assert!(parsed > 0, "parsed none of {files} session logs");
    }
}
