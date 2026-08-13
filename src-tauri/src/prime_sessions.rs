//! Reading Prime's on-disk session logs.
//!
//! Prime writes one JSONL event log per session under
//! `~/.prime/agent/sessions/<uuid>.jsonl`. This module owns *finding* those
//! files and *summarising* one cheaply. Reading a full transcript is slice 2.
//!
//! Two callers, two jobs: Mycelium bridges a session into Mindwalk, the
//! session list resumes a conversation. They share this read path so a second
//! scanner cannot drift from the first — see
//! `docs/plans/2026-08-13-prime-session-list-spec.md`.
//!
//! **We do not own this format.** It is another tool's private directory, so
//! every field is treated as optional and a malformed line is skipped rather
//! than failing the scan. Parsing is contained here so a format drift breaks
//! one module's tests instead of leaking through the app.

use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// How many leading lines to inspect when summarising a session.
///
/// A real session ran 2.4 MB and 2500+ lines, the great majority of them
/// `agent_status` noise. Everything a summary needs — the `session` header and
/// the opening user message — sits at the top, so the scan stops early. This
/// is the difference between a list that opens instantly and one that reads
/// tens of megabytes to draw a few rows.
const SUMMARY_SCAN_LINE_LIMIT: usize = 400;

/// Longest derived title we keep. Titles come from a whole first message, and
/// an essay is not a list row.
const MAX_TITLE_CHARS: usize = 80;

/// What a session list row needs, without reading the whole log.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeSessionSummary {
    /// Prime's session id. Falls back to the file stem, which is the same uuid.
    pub id: String,
    pub path: String,
    /// Derived from the first user message. `None` when the session has none.
    ///
    /// Prime's `session` line carries no name field, so there is nothing
    /// authoritative to prefer over this. The filename is a uuid and names
    /// nothing to a human — never show it as the primary label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Working directory the session ran in. Lets the list group by project.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    /// ISO-8601 timestamp from the `session` header line.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    /// Git branch recorded at session start, when the cwd was a repo.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,
    /// File mtime — what "last active" sorts on.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mtime_ms: Option<u64>,
}

fn sessions_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".prime").join("agent").join("sessions"))
}

fn mtime_ms(path: &Path) -> Option<u64> {
    let modified = std::fs::metadata(path).ok()?.modified().ok()?;
    let since_epoch = modified.duration_since(SystemTime::UNIX_EPOCH).ok()?;
    Some(since_epoch.as_millis() as u64)
}

/// Is this a real session log, rather than an artifact beside one?
///
/// Mycelium writes `*.mindwalk-bridge.*` files into the same directory. They
/// are our own output and must never appear as sessions.
fn is_session_log(name: &str) -> bool {
    name.ends_with(".jsonl") && !name.contains(".mindwalk-bridge.")
}

/// Every session log on disk, newest first.
///
/// Returns an empty list when Prime has never run — that is a fresh install,
/// not an error the UI should report.
pub fn session_files() -> Result<Vec<PathBuf>, String> {
    let dir = sessions_dir().ok_or_else(|| "Could not resolve home directory".to_string())?;
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("read sessions dir: {e}"))?;
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(is_session_log)
        })
        .collect();
    // `sort_by_key` would call this key O(n log n) times, and each call is a
    // filesystem `metadata()` syscall — hundreds of them to draw one list.
    // `sort_by_cached_key` computes each key exactly once.
    files.sort_by_cached_key(|path| std::cmp::Reverse(mtime_ms(path)));
    Ok(files)
}

/// Flatten the `text` blocks of a message content payload into one line.
///
/// Newlines collapse to spaces: this becomes a single-line list row, and a
/// multi-line first message must not break the layout.
fn preview_text(content: &serde_json::Value) -> String {
    let blocks = match content {
        serde_json::Value::String(text) => return normalize_whitespace(text),
        serde_json::Value::Array(blocks) => blocks,
        _ => return String::new(),
    };
    let joined = blocks
        .iter()
        .filter(|block| block["type"].as_str() == Some("text"))
        .filter_map(|block| block["text"].as_str())
        .collect::<Vec<_>>()
        .join(" ");
    normalize_whitespace(&joined)
}

fn normalize_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate_title(text: &str) -> String {
    if text.chars().count() <= MAX_TITLE_CHARS {
        return text.to_string();
    }
    let kept: String = text.chars().take(MAX_TITLE_CHARS).collect();
    format!("{}…", kept.trim_end())
}

/// Build a summary from a session log's leading lines.
///
/// Pure so it can be tested without touching disk. Stops as soon as it has the
/// header and a title, and never looks past `SUMMARY_SCAN_LINE_LIMIT`.
fn summarize_lines<I: Iterator<Item = String>>(lines: I) -> PrimeSessionSummary {
    let mut summary = PrimeSessionSummary::default();
    let mut have_header = false;

    for line in lines.take(SUMMARY_SCAN_LINE_LIMIT) {
        let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue; // Not ours to validate — skip and keep going.
        };
        match event["type"].as_str().unwrap_or_default() {
            "session" => {
                summary.id = event["id"].as_str().unwrap_or_default().to_string();
                summary.started_at = event["timestamp"].as_str().map(str::to_string);
                summary.cwd = event["cwd"].as_str().map(str::to_string);
                summary.git_branch = event["git"]["branch"].as_str().map(str::to_string);
                have_header = true;
            }
            "message" if summary.title.is_none() => {
                let message = &event["message"];
                if message["role"].as_str() != Some("user") {
                    continue;
                }
                let preview = preview_text(&message["content"]);
                if !preview.is_empty() {
                    summary.title = Some(truncate_title(&preview));
                }
            }
            _ => {}
        }
        if have_header && summary.title.is_some() {
            break;
        }
    }
    summary
}

/// Summarise one session log, reading only its head.
pub fn summarize_file(path: &Path) -> Result<PrimeSessionSummary, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("open session log: {e}"))?;
    let lines = BufReader::new(file).lines().map_while(Result::ok);
    let mut summary = summarize_lines(lines);

    summary.path = path.to_string_lossy().into_owned();
    if summary.id.is_empty() {
        // A log with no readable header still has to be addressable, and the
        // filename is Prime's own uuid.
        summary.id = path
            .file_stem()
            .map(|stem| stem.to_string_lossy().into_owned())
            .unwrap_or_default();
    }
    summary.mtime_ms = mtime_ms(path);
    Ok(summary)
}

/// Every session, newest first, summarised for a list.
///
/// A log that cannot be read is skipped rather than failing the whole list:
/// one unreadable file must not hide every other session.
pub fn list_sessions() -> Result<Vec<PrimeSessionSummary>, String> {
    Ok(session_files()?
        .iter()
        .filter_map(|path| summarize_file(path).ok())
        .collect())
}

/// One item in a replayed conversation, in the order it happened.
///
/// Compaction and model changes are items rather than metadata because they
/// explain discontinuities. Without them a transcript shows the model losing
/// the thread or changing voice for no visible reason, and the reader blames
/// the model for what the harness did.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PrimeTranscriptItem {
    #[serde(rename_all = "camelCase")]
    Message {
        /// Entry id. `fork` addresses entries by this, so it must survive.
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        /// Parent entry. The log is a tree, not a list — forks share a prefix.
        #[serde(skip_serializing_if = "Option::is_none")]
        parent_id: Option<String>,
        message: crate::prime_session_host::PrimeMessage,
    },
    #[serde(rename_all = "camelCase")]
    Compaction {
        #[serde(skip_serializing_if = "Option::is_none")]
        timestamp: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    ModelChange {
        #[serde(skip_serializing_if = "Option::is_none")]
        timestamp: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        model: Option<String>,
    },
}

/// Replay a session log into an ordered transcript.
///
/// Pure, so it is tested without disk. `agent_status` dominates these files
/// (2125 of ~2500 lines in one real session) and is dropped first — it is
/// progress spinner state, not conversation.
fn transcript_from_lines<I: Iterator<Item = String>>(lines: I) -> Vec<PrimeTranscriptItem> {
    let mut items = Vec::new();
    for line in lines {
        let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue;
        };
        match event["type"].as_str().unwrap_or_default() {
            "message" => {
                let message = &event["message"];
                if !message.is_object() {
                    continue;
                }
                items.push(PrimeTranscriptItem::Message {
                    id: event["id"].as_str().map(str::to_string),
                    parent_id: event["parentId"].as_str().map(str::to_string),
                    message: crate::prime_session_host::PrimeMessage::from_value(message),
                });
            }
            "compaction" => items.push(PrimeTranscriptItem::Compaction {
                timestamp: event["timestamp"].as_str().map(str::to_string),
            }),
            "model_change" => items.push(PrimeTranscriptItem::ModelChange {
                timestamp: event["timestamp"].as_str().map(str::to_string),
                model: event["model"]["name"]
                    .as_str()
                    .or_else(|| event["model"]["id"].as_str())
                    .or_else(|| event["model"].as_str())
                    .map(str::to_string),
            }),
            _ => {}
        }
    }
    items
}

/// Read one session's full transcript from disk.
///
/// Unbounded by design, unlike `summarize_file`: the caller asked for this
/// specific conversation, so the whole file is the point.
pub fn read_transcript(path: &Path) -> Result<Vec<PrimeTranscriptItem>, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("open session log: {e}"))?;
    let lines = BufReader::new(file).lines().map_while(Result::ok);
    Ok(transcript_from_lines(lines))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(raw: &[&str]) -> std::vec::IntoIter<String> {
        raw.iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>()
            .into_iter()
    }

    #[test]
    fn summary_reads_header_and_first_user_message() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"session","version":3,"id":"abc-123","timestamp":"2026-08-09T11:21:12.442Z","cwd":"/Users/dtc/code","git":{"branch":"main","commit":"22c426f"}}"#,
            r#"{"type":"agent_status","status":"thinking"}"#,
            r#"{"type":"message","id":"m1","message":{"role":"user","content":[{"type":"text","text":"rhiz-agent - sesh2"}]}}"#,
        ]));

        assert_eq!(summary.id, "abc-123");
        assert_eq!(summary.title.as_deref(), Some("rhiz-agent - sesh2"));
        assert_eq!(summary.cwd.as_deref(), Some("/Users/dtc/code"));
        assert_eq!(summary.git_branch.as_deref(), Some("main"));
        assert_eq!(
            summary.started_at.as_deref(),
            Some("2026-08-09T11:21:12.442Z")
        );
    }

    /// The assistant speaks first in some sessions. A title taken from its
    /// reply would describe the answer, not the conversation.
    #[test]
    fn title_comes_from_the_user_not_the_assistant() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"message","message":{"role":"assistant","content":[{"type":"text","text":"Hello, how can I help?"}]}}"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"the real question"}]}}"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"a later message"}]}}"#,
        ]));

        assert_eq!(summary.title.as_deref(), Some("the real question"));
    }

    /// Thinking blocks are not speech. A title built from them would leak the
    /// model's reasoning into the list.
    #[test]
    fn title_ignores_non_text_blocks_and_collapses_newlines() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"message","message":{"role":"user","content":[{"type":"thinking","thinking":"hidden"},{"type":"text","text":"line one\n\nline two"}]}}"#,
        ]));

        assert_eq!(summary.title.as_deref(), Some("line one line two"));
    }

    #[test]
    fn long_titles_are_truncated_with_an_ellipsis() {
        let long = "x".repeat(200);
        let summary = summarize_lines(lines(&[&format!(
            r#"{{"type":"message","message":{{"role":"user","content":[{{"type":"text","text":"{long}"}}]}}}}"#
        )]));

        let title = summary.title.expect("title");
        assert_eq!(title.chars().count(), MAX_TITLE_CHARS + 1, "{title}");
        assert!(title.ends_with('…'));
    }

    /// We do not own this format. A corrupt line must cost us that line only.
    #[test]
    fn malformed_lines_are_skipped_rather_than_failing_the_summary() {
        let summary = summarize_lines(lines(&[
            "not json at all",
            "",
            r#"{"type":"session","id":"abc-123"}"#,
            r#"{"broken":"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"still found"}]}}"#,
        ]));

        assert_eq!(summary.id, "abc-123");
        assert_eq!(summary.title.as_deref(), Some("still found"));
    }

    /// An empty or header-only session is normal — a session created and never
    /// used. It must summarise, not error, and must not invent a title.
    #[test]
    fn a_session_with_no_user_message_has_no_title() {
        let summary = summarize_lines(lines(&[r#"{"type":"session","id":"abc-123"}"#]));

        assert_eq!(summary.id, "abc-123");
        assert_eq!(summary.title, None);
    }

    /// The scan is bounded. A title buried past the limit is given up on
    /// rather than read into — a slow list is worse than an unnamed row.
    #[test]
    fn scanning_stops_at_the_line_limit() {
        let mut raw = vec![r#"{"type":"agent_status"}"#.to_string(); SUMMARY_SCAN_LINE_LIMIT + 50];
        raw.push(
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"too deep"}]}}"#
                .to_string(),
        );

        assert_eq!(summarize_lines(raw.into_iter()).title, None);
    }

    #[test]
    fn bridge_artifacts_are_not_sessions() {
        assert!(is_session_log("019fe641.jsonl"));
        assert!(!is_session_log("019fe641.mindwalk-bridge.jsonl"));
        assert!(!is_session_log("notes.md"));
    }

    #[test]
    fn transcript_keeps_messages_in_order_with_their_entry_ids() {
        let items = transcript_from_lines(lines(&[
            r#"{"type":"session","id":"s1"}"#,
            r#"{"type":"message","id":"m1","message":{"role":"user","content":[{"type":"text","text":"first"}]}}"#,
            r#"{"type":"message","id":"m2","parentId":"m1","message":{"role":"assistant","content":[{"type":"text","text":"second"}]}}"#,
        ]));

        assert_eq!(
            items.len(),
            2,
            "the session header is not a transcript item"
        );
        match &items[0] {
            PrimeTranscriptItem::Message {
                id,
                parent_id,
                message,
            } => {
                assert_eq!(id.as_deref(), Some("m1"));
                assert_eq!(parent_id.as_deref(), None);
                assert_eq!(message.text, "first");
                assert_eq!(message.role, "user");
            }
            other => panic!("expected a message, got {other:?}"),
        }
        // parentId is what makes this a tree; fork depends on it surviving.
        match &items[1] {
            PrimeTranscriptItem::Message { parent_id, .. } => {
                assert_eq!(parent_id.as_deref(), Some("m1"))
            }
            other => panic!("expected a message, got {other:?}"),
        }
    }

    /// `agent_status` is 2125 of ~2500 lines in a real session. It is spinner
    /// state, not conversation, and must never reach the transcript.
    #[test]
    fn transcript_drops_agent_status_noise() {
        let items = transcript_from_lines(lines(&[
            r#"{"type":"agent_status","status":"thinking"}"#,
            r#"{"type":"session_state","x":1}"#,
            r#"{"type":"custom","x":1}"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"kept"}]}}"#,
        ]));

        assert_eq!(items.len(), 1);
    }

    /// A compaction mid-transcript is why the model appears to forget. Showing
    /// the conversation without it makes the harness's work look like the
    /// model's failure.
    #[test]
    fn compaction_and_model_change_are_items_in_place_not_dropped() {
        let items = transcript_from_lines(lines(&[
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"before"}]}}"#,
            r#"{"type":"compaction","timestamp":"2026-08-09T11:00:00Z"}"#,
            r#"{"type":"model_change","timestamp":"2026-08-09T11:05:00Z","model":{"id":"deepseek-v4-pro","name":"DeepSeek V4 Pro"}}"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"after"}]}}"#,
        ]));

        assert_eq!(items.len(), 4, "markers keep their position in the order");
        assert_eq!(
            items[1],
            PrimeTranscriptItem::Compaction {
                timestamp: Some("2026-08-09T11:00:00Z".into())
            }
        );
        match &items[2] {
            PrimeTranscriptItem::ModelChange { model, .. } => {
                assert_eq!(
                    model.as_deref(),
                    Some("DeepSeek V4 Pro"),
                    "prefer the display name"
                )
            }
            other => panic!("expected a model change, got {other:?}"),
        }
    }

    /// Tool and thinking blocks must survive replay — a transcript that keeps
    /// only prose loses what the assistant actually did.
    #[test]
    fn transcript_preserves_tool_and_thinking_blocks() {
        let items = transcript_from_lines(lines(&[
            r#"{"type":"message","message":{"role":"assistant","content":[{"type":"thinking","thinking":"hm"},{"type":"text","text":"reading"},{"type":"tool_use","name":"read","input":{"path":"a.md"}}]}}"#,
        ]));

        match &items[0] {
            PrimeTranscriptItem::Message { message, .. } => {
                assert_eq!(message.text, "reading");
                let blocks = message.content.as_array().expect("blocks");
                assert_eq!(blocks.len(), 3, "no block dropped on replay");
                assert_eq!(blocks[2]["name"], "read");
            }
            other => panic!("expected a message, got {other:?}"),
        }
    }

    /// A truncated final line is normal for a log still being written to.
    #[test]
    fn transcript_survives_a_malformed_or_empty_message_line() {
        let items = transcript_from_lines(lines(&[
            r#"{"type":"message","message":null}"#,
            r#"{"type":"message"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"ok"}]}}"#,
        ]));

        assert_eq!(items.len(), 1);
    }

    #[test]
    fn bare_string_content_still_yields_a_title() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"message","message":{"role":"user","content":"plain string"}}"#,
        ]));

        assert_eq!(summary.title.as_deref(), Some("plain string"));
    }
}
