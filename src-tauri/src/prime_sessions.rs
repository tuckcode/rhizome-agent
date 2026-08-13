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
    files.sort_by_key(|path| std::cmp::Reverse(mtime_ms(path)));
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
    fn bare_string_content_still_yields_a_title() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"message","message":{"role":"user","content":"plain string"}}"#,
        ]));

        assert_eq!(summary.title.as_deref(), Some("plain string"));
    }
}
