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
    /// Whether the log holds any message at all, of any role.
    ///
    /// Separate from `title` because the two answer different questions: a
    /// session can be a real conversation with nothing quotable to name it
    /// (agent-started, heartbeat-driven), and an unused draft has neither.
    /// `list_sessions` drops the drafts — see #28.
    #[serde(default)]
    pub has_conversation: bool,
    /// Whether the user has archived this session out of the main list.
    ///
    /// Rhizome's own state, kept in its settings — **never** a change to the
    /// log on disk. `~/.prime/agent/sessions` belongs to Prime and is shared
    /// with the `prime-agent` CLI and any other client on the machine; moving
    /// or deleting a file there would silently change what *they* see. Same
    /// principle as ADR-0163: the daemon is not ours to stop, and its files
    /// are not ours to move. Archiving is a view, and it is reversible.
    #[serde(default)]
    pub archived: bool,
}

/// The log a session id writes to.
///
/// The daemon only reports `sessionFile` on some state payloads, so a live
/// session can have an id and no path — which silently disabled `/export`.
/// Prime names each log after the session id, so the id is enough.
pub(crate) fn log_path_for_session(session_id: &str, dir: &Path) -> Option<PathBuf> {
    let id = session_id.trim();
    // Guard the id before it becomes a path: it arrives over the wire.
    if id.is_empty() || id.contains(['/', '\\']) || id.starts_with('.') {
        return None;
    }
    Some(dir.join(format!("{id}.jsonl")))
}

/// Same, resolved against Prime's real sessions directory.
pub fn session_log_path(session_id: &str) -> Option<String> {
    let dir = sessions_dir()?;
    let path = log_path_for_session(session_id, &dir)?;
    path.exists().then(|| path.to_string_lossy().into_owned())
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

/// The text blocks of a message, joined but **not** whitespace-normalised.
///
/// Raw on purpose. The composed-prompt markers this feeds are newline-
/// delimited, so normalising first would turn `\n\nUser request:\n` into
/// single spaces and the split would silently stop matching — a no-op that
/// still passes its tests. Strip the system block first, normalise second;
/// `normalize_whitespace` is what flattens the result into a one-line row.
fn joined_text(content: &serde_json::Value) -> String {
    match content {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Array(blocks) => blocks
            .iter()
            .filter(|block| block["type"].as_str() == Some("text"))
            .filter_map(|block| block["text"].as_str())
            .collect::<Vec<_>>()
            .join(" "),
        _ => String::new(),
    }
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
    let mut agent_opening: Option<String> = None;
    let mut session_name: Option<String> = None;

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
            // A name someone deliberately set — `prime-agent rename`, the
            // daemon's `set_session_name`, or Rhizome at creation. Prime
            // appends one of these per rename and the last wins, so this
            // overwrites rather than taking the first.
            "session_info" => {
                let name = normalize_whitespace(event["name"].as_str().unwrap_or_default());
                if !name.is_empty() {
                    session_name = Some(truncate_title(&name));
                }
            }
            "message" if summary.title.is_none() => {
                summary.has_conversation = true;
                let message = &event["message"];
                let role = message["role"].as_str();
                if role != Some("user") {
                    // No user turn to quote yet. Remember the agent's first
                    // words so a session it started is not left nameless, but
                    // keep scanning: a later user turn still wins (see
                    // `title_comes_from_the_user_not_the_assistant`).
                    if role == Some("assistant") && agent_opening.is_none() {
                        let preview = normalize_whitespace(&joined_text(&message["content"]));
                        if !preview.is_empty() {
                            agent_opening = Some(truncate_title(&preview));
                        }
                    }
                    continue;
                }
                // A user turn is stored as Rhizome composed it, so the raw
                // first message begins with the system-instruction block.
                // Naming a session after that gives every session in the list
                // the same title (C26) — the user's own words are the title.
                let raw = joined_text(&message["content"]);
                let request =
                    crate::cli_agent_runtime::user_request_from_prompt(&raw).unwrap_or(&raw);
                let preview = normalize_whitespace(request);
                if !preview.is_empty() {
                    summary.title = Some(truncate_title(&preview));
                }
            }
            "message" => summary.has_conversation = true,
            _ => {}
        }
        // Not `summary.title.is_some()`: a `session_info` entry can appear
        // after the first user message, so stopping the moment a title exists
        // would miss a rename. Scanning on costs nothing — the 400-line cap
        // still bounds it.
        if have_header && summary.title.is_some() && session_name.is_some() {
            break;
        }
    }
    // A deliberate name beats a derived one. Someone who renamed a session
    // chose that label over whatever its first message happened to say.
    if let Some(name) = session_name {
        summary.title = Some(name);
    }
    if summary.title.is_none() {
        summary.title = agent_opening;
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

/// Drop the sessions that were created and never used.
///
/// Rhizome opens a session when it attaches to a vault, so every launch nobody
/// types into leaves a five-line log behind. Measured on a real store
/// (2026-08-20): **41 of 91 logs held no message at all**, and they rendered as
/// half a history list of "Untitled session" rows that open onto nothing. #28.
///
/// Split out from `list_sessions` because that function reads the user's home
/// directory and cannot be exercised in a test; this is where the decision
/// lives, and it is pure.
fn worth_listing(summaries: Vec<PrimeSessionSummary>) -> Vec<PrimeSessionSummary> {
    summaries
        .into_iter()
        .filter(|summary| summary.has_conversation)
        .collect()
}

/// Mark the sessions the user has archived.
///
/// Pure, and split from the command layer for the same reason `worth_listing`
/// is split from `list_sessions`: the decision is worth testing and the
/// settings read is not. Archived sessions stay *in* the list rather than
/// being dropped from it — the UI shows them under a disclosure, so it needs
/// them present and flagged, not missing.
pub fn mark_archived(
    summaries: Vec<PrimeSessionSummary>,
    archived_ids: &[String],
) -> Vec<PrimeSessionSummary> {
    if archived_ids.is_empty() {
        return summaries;
    }
    let archived: std::collections::HashSet<&str> =
        archived_ids.iter().map(String::as_str).collect();
    summaries
        .into_iter()
        .map(|mut summary| {
            summary.archived = archived.contains(summary.id.as_str());
            summary
        })
        .collect()
}

/// Every session that holds a conversation, newest first, summarised for a list.
///
/// A log that cannot be read is skipped rather than failing the whole list:
/// one unreadable file must not hide every other session.
pub fn list_sessions() -> Result<Vec<PrimeSessionSummary>, String> {
    Ok(worth_listing(
        session_files()?
            .iter()
            .filter_map(|path| summarize_file(path).ok())
            .collect(),
    ))
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
        /// Tool calls, already unwrapped from any shell wrapper.
        ///
        /// Computed here rather than in the frontend so the live stream and a
        /// replay name a tool the same way — they share
        /// `prime_tool_unwrap`. `content` above stays verbatim.
        #[serde(skip_serializing_if = "Vec::is_empty")]
        tools: Vec<PrimeTranscriptTool>,
    },
    #[serde(rename_all = "camelCase")]
    Compaction {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        parent_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        timestamp: Option<String>,
        /// What replaced the compacted turns. This *is* the conversation for
        /// everything above it — a compaction rendered as a bare divider hides
        /// the only remaining record of what was said.
        #[serde(skip_serializing_if = "Option::is_none")]
        summary: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tokens_before: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    ModelChange {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        parent_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        timestamp: Option<String>,
        /// Provider and model id as the log records them (`xai`, `grok-4.5`).
        /// There is no display name on disk — do not invent one here.
        #[serde(skip_serializing_if = "Option::is_none")]
        provider: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        model_id: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    BranchSummary {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        parent_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        from_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        summary: Option<String>,
    },
}

/// One tool call on a replayed message, named as the user should see it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeTranscriptTool {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// Pull tool calls out of a message's content blocks.
///
/// Real logs write `toolCall` with `arguments`; `tool_use` with `input` is
/// accepted too because that is the shape the live Anthropic-style stream uses
/// and neither is ours to guarantee.
fn tools_from_message(content: &serde_json::Value) -> Vec<PrimeTranscriptTool> {
    let Some(blocks) = content.as_array() else {
        return Vec::new();
    };
    blocks
        .iter()
        .filter(|block| matches!(block["type"].as_str(), Some("toolCall") | Some("tool_use")))
        .map(|block| {
            let name = block["name"].as_str().unwrap_or_default();
            let args = block
                .get("arguments")
                .or_else(|| block.get("input"))
                .cloned()
                .unwrap_or(serde_json::Value::Null);
            let unwrapped = crate::prime_tool_unwrap::unwrap_tool(name, &args);
            PrimeTranscriptTool {
                id: block["id"].as_str().map(str::to_string),
                tool: unwrapped.tool,
                path: unwrapped.path,
            }
        })
        .collect()
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
                    tools: tools_from_message(&message["content"]),
                    message: crate::prime_session_host::PrimeMessage::from_value(message),
                });
            }
            "compaction" => items.push(PrimeTranscriptItem::Compaction {
                id: event["id"].as_str().map(str::to_string),
                parent_id: event["parentId"].as_str().map(str::to_string),
                timestamp: event["timestamp"].as_str().map(str::to_string),
                summary: event["summary"].as_str().map(str::to_string),
                tokens_before: event["tokensBefore"].as_u64(),
            }),
            "model_change" => items.push(PrimeTranscriptItem::ModelChange {
                id: event["id"].as_str().map(str::to_string),
                parent_id: event["parentId"].as_str().map(str::to_string),
                timestamp: event["timestamp"].as_str().map(str::to_string),
                provider: event["provider"].as_str().map(str::to_string),
                model_id: event["modelId"].as_str().map(str::to_string),
            }),
            "branch_summary" => items.push(PrimeTranscriptItem::BranchSummary {
                id: event["id"].as_str().map(str::to_string),
                parent_id: event["parentId"].as_str().map(str::to_string),
                from_id: event["fromId"].as_str().map(str::to_string),
                summary: event["summary"].as_str().map(str::to_string),
            }),
            _ => {}
        }
    }
    items
}

/// Reject any path that is not a session log inside Prime's sessions directory.
///
/// This path arrives from the frontend, so without the check `read_transcript`
/// is an arbitrary-file read: anything on disk whose lines happen to be JSON
/// would come back through the IPC boundary. Both ends are canonicalised so
/// `..` segments and symlinks cannot walk out of the directory.
pub(crate) fn ensure_inside_sessions_dir(path: &Path) -> Result<(), String> {
    let dir = sessions_dir().ok_or_else(|| "Could not resolve home directory".to_string())?;
    let dir = std::fs::canonicalize(&dir).map_err(|e| format!("resolve sessions dir: {e}"))?;
    let resolved = std::fs::canonicalize(path).map_err(|e| format!("resolve session log: {e}"))?;

    if !resolved.starts_with(&dir) {
        return Err("Not a Prime session log".into());
    }
    let is_log = resolved
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(is_session_log);
    if !is_log {
        return Err("Not a Prime session log".into());
    }
    Ok(())
}

/// Read one session's full transcript from disk.
///
/// Unbounded by design, unlike `summarize_file`: the caller asked for this
/// specific conversation, so the whole file is the point.
pub fn read_transcript(path: &Path) -> Result<Vec<PrimeTranscriptItem>, String> {
    ensure_inside_sessions_dir(path)?;
    let file = std::fs::File::open(path).map_err(|e| format!("open session log: {e}"))?;
    let lines = BufReader::new(file).lines().map_while(Result::ok);
    Ok(transcript_from_lines(lines))
}

/// Where an exported session lands when the caller doesn't name a file.
///
/// Named after the session log's own stem so exporting twice from different
/// sessions cannot silently overwrite one file.
pub(crate) fn default_export_path(session_path: &Path, dir: &Path) -> PathBuf {
    let stem = session_path
        .file_stem()
        .and_then(|name| name.to_str())
        // A dotfile-shaped log ("`.jsonl`") reports the whole name as its
        // stem, which would render as `prime-session-.jsonl.html`.
        .filter(|name| !name.is_empty() && !name.starts_with('.'))
        .unwrap_or("session");
    dir.join(format!("prime-session-{stem}.html"))
}

/// Export a saved session to a standalone HTML file.
///
/// **This is a CLI operation, not a daemon one.** `export` is absent from the
/// daemon's `serverCapabilities`; Prime exposes it only as
/// `prime-agent session export <file> [output]` over a file on disk. So this
/// lives here with the other session-file readers rather than beside
/// `fork`/`compact` in `prime_session_host`, which are protocol calls on the
/// live connection.
pub fn export_session(session_path: &str, output_path: Option<String>) -> Result<String, String> {
    let path = Path::new(session_path);
    ensure_inside_sessions_dir(path)?;

    let binary = crate::prime_discovery::find_binary()?;
    let output = match output_path {
        Some(chosen) => PathBuf::from(chosen),
        None => {
            let dir = dirs::download_dir()
                .or_else(dirs::home_dir)
                .ok_or_else(|| "Could not resolve a folder to export into".to_string())?;
            default_export_path(path, &dir)
        }
    };

    let result = std::process::Command::new(&binary)
        .arg("session")
        .arg("export")
        .arg(path)
        .arg(&output)
        .output()
        .map_err(|e| format!("Could not run prime-agent: {e}"))?;

    if !result.status.success() {
        // Prefer Prime's own wording so the user sees what it actually said.
        let stderr = String::from_utf8_lossy(&result.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Export failed".to_string()
        } else {
            stderr
        });
    }

    Ok(output.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A live session can carry an id with no path, because the daemon sends
    /// `sessionFile` on only some state payloads. The id names the log.
    #[test]
    fn a_session_id_resolves_to_its_log() {
        assert_eq!(
            log_path_for_session(
                "01a009fc-98f1-7219-858e-5bd22e766bc1",
                Path::new("/Users/dtc/.prime/agent/sessions")
            ),
            Some(PathBuf::from(
                "/Users/dtc/.prime/agent/sessions/01a009fc-98f1-7219-858e-5bd22e766bc1.jsonl"
            ))
        );
    }

    /// The id crosses the wire, so it must not be able to walk out of the
    /// sessions directory before it reaches the exporter.
    #[test]
    fn a_session_id_cannot_escape_the_sessions_directory() {
        for hostile in ["", "  ", "../../etc/passwd", "a/b", "a\\b", ".hidden"] {
            assert_eq!(
                log_path_for_session(hostile, Path::new("/sessions")),
                None,
                "{hostile:?} should be refused"
            );
        }
    }

    /// The default name carries the session's own id, so exporting two
    /// different sessions cannot land on the same file.
    #[test]
    fn an_exported_session_is_named_after_its_log() {
        let out = default_export_path(
            Path::new("/Users/dtc/.prime/agent/sessions/019fe2e7-e9dd-701f.jsonl"),
            Path::new("/Users/dtc/Downloads"),
        );
        assert_eq!(
            out,
            PathBuf::from("/Users/dtc/Downloads/prime-session-019fe2e7-e9dd-701f.html")
        );

        let other = default_export_path(
            Path::new("/Users/dtc/.prime/agent/sessions/aaaabbbb-1111.jsonl"),
            Path::new("/Users/dtc/Downloads"),
        );
        assert_ne!(out, other);
    }

    #[test]
    fn an_unnamed_log_still_produces_a_usable_export_name() {
        assert_eq!(
            default_export_path(Path::new(".jsonl"), Path::new("/tmp")),
            PathBuf::from("/tmp/prime-session-session.html")
        );
    }

    /// Export shells out to another tool with a caller-supplied path, so the
    /// sessions-dir guard has to hold before anything is spawned.
    #[test]
    fn exporting_something_outside_the_sessions_dir_is_refused() {
        let dir = tempfile::tempdir().expect("tempdir");
        let outsider = dir.path().join("not-a-session.jsonl");
        std::fs::write(&outsider, "{}").expect("write");

        let error = export_session(outsider.to_str().expect("utf8"), None)
            .expect_err("a file outside the sessions dir must be refused");
        assert!(
            error.contains("Not a Prime session log") || error.contains("resolve"),
            "unexpected error: {error}"
        );
    }

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

    fn summary(id: &str) -> PrimeSessionSummary {
        PrimeSessionSummary {
            id: id.into(),
            has_conversation: true,
            ..Default::default()
        }
    }

    /// Archiving is a *view*, so an archived session stays in the payload and
    /// carries a flag. Dropping it here would leave the UI unable to show the
    /// archive at all, and would make "restore" impossible without a second
    /// round trip.
    #[test]
    fn archived_sessions_are_flagged_rather_than_removed() {
        let listed = mark_archived(
            vec![summary("kept"), summary("filed"), summary("also-kept")],
            &["filed".to_string()],
        );

        assert_eq!(
            listed.len(),
            3,
            "archiving hides a row, it does not delete one"
        );
        assert!(!listed[0].archived);
        assert!(listed[1].archived, "the one the user filed");
        assert!(!listed[2].archived);
    }

    #[test]
    fn nothing_archived_leaves_every_session_alone() {
        let listed = mark_archived(vec![summary("a"), summary("b")], &[]);

        assert!(listed.iter().all(|session| !session.archived));
    }

    /// An id in settings with no log behind it is the normal end state of
    /// archiving something and later deleting it in Prime. It must not throw
    /// away the rest of the list.
    #[test]
    fn an_archived_id_with_no_session_left_is_ignored() {
        let listed = mark_archived(vec![summary("still-here")], &["long-gone".to_string()]);

        assert_eq!(listed.len(), 1);
        assert!(!listed[0].archived);
    }

    /// Prime writes a `session_info` entry whenever a session is named —
    /// `prime-agent rename`, the daemon's `set_session_name`, or Rhizome at
    /// creation. Probed against installed 0.7.4: `appendSessionInfo` writes
    /// `{"type":"session_info","name":…}` into the log, which is why the disk
    /// reader can see a name at all.
    #[test]
    fn a_named_session_is_listed_under_its_name() {
        let log = [
            r#"{"type":"session","id":"s1","timestamp":"2026-08-22T00:00:00Z","cwd":"/vault"}"#,
            r#"{"type":"session_info","name":"Release notes for 0.8"}"#,
        ];

        let summary = summarize_lines(log.iter().map(|line| line.to_string()));

        assert_eq!(summary.title.as_deref(), Some("Release notes for 0.8"));
    }

    /// A name is a choice; a title from the first message is a derivation.
    /// Someone who renamed a session picked that label over what the
    /// conversation happened to open with, so it wins.
    #[test]
    fn a_deliberate_name_beats_the_title_derived_from_the_first_message() {
        let log = [
            r#"{"type":"session","id":"s1","timestamp":"2026-08-22T00:00:00Z","cwd":"/vault"}"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"how do I link two notes?"}]}}"#,
            r#"{"type":"session_info","name":"Wikilink research"}"#,
        ];

        let summary = summarize_lines(log.iter().map(|line| line.to_string()));

        assert_eq!(summary.title.as_deref(), Some("Wikilink research"));
        assert!(
            summary.has_conversation,
            "naming it does not un-say the message"
        );
    }

    /// Prime appends one entry per rename rather than rewriting the first, so
    /// the last one is the current name.
    #[test]
    fn the_most_recent_rename_is_the_name_that_shows() {
        let log = [
            r#"{"type":"session","id":"s1","timestamp":"2026-08-22T00:00:00Z","cwd":"/vault"}"#,
            r#"{"type":"session_info","name":"First idea"}"#,
            r#"{"type":"session_info","name":"What it actually became"}"#,
        ];

        let summary = summarize_lines(log.iter().map(|line| line.to_string()));

        assert_eq!(summary.title.as_deref(), Some("What it actually became"));
    }

    /// An empty or whitespace-only name is not a name. The daemon rejects one,
    /// but a log is not ours to trust — and blanking a good title because a
    /// stray entry said nothing would be worse than ignoring it.
    #[test]
    fn a_blank_name_does_not_erase_a_real_title() {
        let log = [
            r#"{"type":"session","id":"s1","timestamp":"2026-08-22T00:00:00Z","cwd":"/vault"}"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"keep me"}]}}"#,
            r#"{"type":"session_info","name":"   "}"#,
        ];

        let summary = summarize_lines(log.iter().map(|line| line.to_string()));

        assert_eq!(summary.title.as_deref(), Some("keep me"));
    }

    #[test]
    fn the_list_drops_drafts_and_keeps_conversations() {
        let draft = PrimeSessionSummary {
            id: "draft".into(),
            has_conversation: false,
            ..Default::default()
        };
        let real = PrimeSessionSummary {
            id: "real".into(),
            has_conversation: true,
            title: Some("how do I link two notes?".into()),
            ..Default::default()
        };

        let listed = worth_listing(vec![draft, real]);

        assert_eq!(listed.len(), 1, "an unused draft is not a session to open");
        assert_eq!(listed[0].id, "real");
    }

    /// #28. Measured on a real store on 2026-08-20: **41 of 91 session logs
    /// had zero messages of any kind** — five lines of header, model, thinking
    /// level, service tier and state, and nothing else. Rhizome creates a
    /// session when it attaches to a vault, so every launch that goes unused
    /// leaves one behind. They filled about half the history list as "Untitled
    /// session", and no naming scheme fixes that: there is nothing in them to
    /// name.
    #[test]
    fn a_session_that_was_never_used_carries_no_conversation() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"session","id":"draft","timestamp":"2026-08-20T19:03:05.620Z"}"#,
            r#"{"type":"model_change","model":"grok-4.6"}"#,
            r#"{"type":"thinking_level_change","level":"medium"}"#,
            r#"{"type":"service_tier_change","tier":"standard"}"#,
            r#"{"type":"session_state","state":"idle"}"#,
        ]));

        assert!(
            !summary.has_conversation,
            "a log with no message events is an unused draft, not a conversation",
        );
    }

    #[test]
    fn one_message_is_enough_to_count_as_a_conversation() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"session","id":"s1"}"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"hi"}]}}"#,
        ]));

        assert!(summary.has_conversation);
    }

    /// Six of those 91 had messages but no user turn — an agent-started or
    /// heartbeat-driven session. They are real conversations and must stay
    /// listed, so `has_conversation` cannot be a synonym for "has a title".
    #[test]
    fn an_assistant_only_session_is_still_a_conversation() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"session","id":"s1"}"#,
            r#"{"type":"message","message":{"role":"assistant","content":[{"type":"text","text":"Checking the deploy."}]}}"#,
        ]));

        assert!(summary.has_conversation, "assistant turns are conversation");
        assert_eq!(
            summary.title.as_deref(),
            Some("Checking the deploy."),
            "with no user turn to quote, the agent's own first words name it \
             better than \"Untitled session\" does",
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

    /// C26. The stored first message is what Rhizome composed, so every
    /// session would otherwise be titled "System instructions: You are working
    /// inside Rhizome…" — identical rows for every conversation.
    ///
    /// The newlines here are load-bearing: the markers are newline-delimited,
    /// and an earlier version of this fix stripped *after* whitespace
    /// normalisation, which silently matched nothing while its tests passed.
    #[test]
    fn a_title_is_the_users_words_not_the_system_block_in_front_of_them() {
        let composed = "System instructions:\nYou are working inside Rhizome, a local-first \
                        Markdown knowledge base.\n\nUser request:\nhow do I link two notes?";
        let summary = summarize_lines(
            [
                serde_json::json!({"type": "session", "id": "s1"}).to_string(),
                serde_json::json!({
                    "type": "message",
                    "message": {"role": "user", "content": [{"type": "text", "text": composed}]}
                })
                .to_string(),
            ]
            .into_iter(),
        );

        assert_eq!(summary.title.as_deref(), Some("how do I link two notes?"));
    }

    /// A multi-line user message still collapses to one list row — stripping
    /// the system block must not cost the normalisation that follows it.
    #[test]
    fn a_title_still_collapses_newlines_after_the_system_block_is_removed() {
        let composed = "System instructions:\ncontext\n\nUser request:\nfirst line\nsecond line";
        let summary = summarize_lines(
            [serde_json::json!({
                "type": "message",
                "message": {"role": "user", "content": [{"type": "text", "text": composed}]}
            })
            .to_string()]
            .into_iter(),
        );

        assert_eq!(summary.title.as_deref(), Some("first line second line"));
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
                ..
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
    fn replayed_tool_calls_use_the_real_block_shape_and_are_unwrapped() {
        // Real logs write `toolCall` with `arguments`, not `tool_use` with
        // `input`. An earlier version of this parse looked for the latter and
        // silently dropped every tool card from a replayed session.
        let code = "node '/r/mcp-server/cli-call.mjs' get_note '{\"path\":\"wiki/foo.md\"}'";
        let line = serde_json::json!({
            "type": "message",
            "id": "m1",
            "message": {
                "role": "assistant",
                "content": [
                    {"type": "toolCall", "id": "call-1", "name": "ipython",
                     "arguments": {"code": code}}
                ]
            }
        })
        .to_string();

        let items = transcript_from_lines(lines(&[&line]));

        match &items[0] {
            PrimeTranscriptItem::Message { tools, message, .. } => {
                assert_eq!(tools.len(), 1, "the tool call must survive replay");
                assert_eq!(
                    tools[0].tool, "get_note",
                    "shared unwrap with the live path"
                );
                assert_eq!(tools[0].path.as_deref(), Some("wiki/foo.md"));
                assert_eq!(tools[0].id.as_deref(), Some("call-1"));
                // Content is still verbatim — unwrapping rides alongside it.
                assert_eq!(message.content.as_array().expect("blocks").len(), 1);
            }
            other => panic!("expected a message, got {other:?}"),
        }
    }

    /// The Anthropic-style shape is accepted too; neither is ours to guarantee.
    #[test]
    fn replayed_tool_use_blocks_are_also_read() {
        let line = serde_json::json!({
            "type": "message",
            "message": {"role": "assistant", "content": [
                {"type": "tool_use", "id": "t1", "name": "get_note",
                 "input": {"path": "wiki/a.md"}}
            ]}
        })
        .to_string();

        match &transcript_from_lines(lines(&[&line]))[0] {
            PrimeTranscriptItem::Message { tools, .. } => {
                assert_eq!(tools[0].tool, "get_note");
                assert_eq!(tools[0].path.as_deref(), Some("wiki/a.md"));
            }
            other => panic!("expected a message, got {other:?}"),
        }
    }

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
            r###"{"type":"compaction","id":"dae4c7ca","parentId":"98119d8a","timestamp":"2026-08-09T13:34:20.050Z","summary":"## Goal\nContinue rhizome-agent","tokensBefore":120000}"###,
            r#"{"type":"model_change","id":"358ed70f","parentId":null,"timestamp":"2026-08-09T11:21:12.521Z","provider":"xai","modelId":"grok-4.5"}"#,
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"after"}]}}"#,
        ]));

        assert_eq!(items.len(), 4, "markers keep their position in the order");
        match &items[1] {
            PrimeTranscriptItem::Compaction {
                id,
                summary,
                tokens_before,
                ..
            } => {
                assert_eq!(id.as_deref(), Some("dae4c7ca"));
                assert_eq!(*tokens_before, Some(120_000));
                // Once compacted, the summary IS the conversation above it.
                assert!(summary.as_deref().unwrap_or_default().contains("Goal"));
            }
            other => panic!("expected a compaction, got {other:?}"),
        }
        match &items[2] {
            PrimeTranscriptItem::ModelChange {
                provider, model_id, ..
            } => {
                assert_eq!(provider.as_deref(), Some("xai"));
                assert_eq!(model_id.as_deref(), Some("grok-4.5"));
            }
            other => panic!("expected a model change, got {other:?}"),
        }
    }

    #[test]
    fn branch_summary_is_an_item_in_place_not_dropped() {
        let items = transcript_from_lines(lines(&[
            r#"{"type":"message","message":{"role":"user","content":[{"type":"text","text":"start"}]}}"#,
            r#"{"type":"branch_summary","id":"br1","fromId":"u1","summary":"tried the rust rewrite"}"#,
        ]));
        assert_eq!(items.len(), 2);
        match &items[1] {
            PrimeTranscriptItem::BranchSummary { from_id, summary, .. } => {
                assert_eq!(from_id.as_deref(), Some("u1"));
                assert_eq!(summary.as_deref(), Some("tried the rust rewrite"));
            }
            other => panic!("expected a branch summary, got {other:?}"),
        }
    }

    /// `compactionSummary` is a real role carrying no `content` at all — it has
    /// `summary`/`tokensBefore` instead. It must parse to an empty-text message
    /// rather than being dropped.
    #[test]
    fn a_compaction_summary_role_parses_without_content() {
        let items = transcript_from_lines(lines(&[
            r#"{"type":"message","message":{"role":"compactionSummary","summary":"prior work","tokensBefore":98000}}"#,
        ]));

        match &items[0] {
            PrimeTranscriptItem::Message { message, .. } => {
                assert_eq!(message.role, "compactionSummary");
                assert_eq!(message.text, "");
            }
            other => panic!("expected a message, got {other:?}"),
        }
    }

    /// A live session reports five roles, not two: user, assistant, toolResult,
    /// custom, compactionSummary. Nothing may be filtered out on role.
    #[test]
    fn every_role_survives_replay() {
        let items = transcript_from_lines(lines(&[
            r#"{"type":"message","message":{"role":"user","content":[]}}"#,
            r#"{"type":"message","message":{"role":"assistant","content":[]}}"#,
            r#"{"type":"message","message":{"role":"toolResult","content":[]}}"#,
            r#"{"type":"message","message":{"role":"custom","content":[]}}"#,
            r#"{"type":"message","message":{"role":"compactionSummary"}}"#,
        ]));

        assert_eq!(items.len(), 5);
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

    /// Parse a real session log, when one is pointed at.
    ///
    /// Ignored by default and never committed with a fixture: these logs are
    /// somebody's actual conversations and do not belong in the repo. But
    /// hand-written fixtures only prove the parse matches *my reading* of the
    /// format — an earlier version of this module invented a nested `model`
    /// object that no real log has ever contained, and every fixture test
    /// passed. Run it against a real file when touching this parse:
    ///
    /// ```text
    /// PRIME_SESSION_LOG=~/.prime/agent/sessions/<id>.jsonl \
    ///   cargo test --lib prime_sessions -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore = "needs PRIME_SESSION_LOG pointing at a real session log"]
    fn a_real_session_log_parses_into_a_plausible_transcript() {
        let Ok(raw_path) = std::env::var("PRIME_SESSION_LOG") else {
            panic!("set PRIME_SESSION_LOG to a real session log path");
        };
        let path = PathBuf::from(shellexpand_home(&raw_path));

        let summary = summarize_file(&path).expect("summarize a real log");
        let transcript = read_transcript(&path).expect("replay a real log");

        let messages = transcript
            .iter()
            .filter(|item| matches!(item, PrimeTranscriptItem::Message { .. }))
            .count();
        let markers = transcript.len() - messages;
        println!(
            "id={} title={:?} cwd={:?}\nmessages={messages} markers={markers}",
            summary.id, summary.title, summary.cwd
        );

        assert!(!summary.id.is_empty(), "a real log has a session header");
        assert!(messages > 0, "a real log has messages");
        // agent_status is the bulk of these files and must never reach here.
        // Markers should be a minority of a long transcript. Only meaningful
        // once there is a sample to judge: a real 8-message session with one
        // model change is perfectly healthy, and the old form of this
        // assertion (`markers * 10 < messages.max(10)`) failed it at exactly
        // `10 < 10` — rejecting a good log for being short.
        if messages >= 20 {
            assert!(
                markers * 10 < messages,
                "markers ({markers}) should be rare next to messages ({messages})"
            );
        }

        // C26: a replayed user turn must show what the user typed, not the
        // system-instruction block Rhizome composed in front of it. Asserted
        // against a real log because the defect was invisible to fixtures —
        // it was found by looking at the running app.
        for item in &transcript {
            let PrimeTranscriptItem::Message { message, .. } = item else {
                continue;
            };
            if message.role != "user" {
                continue;
            }
            assert!(
                !message.text.starts_with("System instructions:"),
                "a replayed user turn is still showing the system block: {:?}",
                &message.text[..message.text.len().min(120)]
            );
        }
        if let Some(first) = transcript.iter().find_map(|item| match item {
            PrimeTranscriptItem::Message { message, .. } if message.role == "user" => {
                Some(&message.text)
            }
            _ => None,
        }) {
            println!("first user turn as displayed: {:?}", first);
        }
    }

    fn shellexpand_home(path: &str) -> String {
        match path.strip_prefix("~/") {
            Some(rest) => dirs::home_dir()
                .map(|home| home.join(rest).to_string_lossy().into_owned())
                .unwrap_or_else(|| path.to_string()),
            None => path.to_string(),
        }
    }

    /// `read_transcript` takes a path straight from the frontend. Without this
    /// guard it is an arbitrary-file read across the IPC boundary.
    #[test]
    fn reading_a_transcript_outside_the_sessions_dir_is_refused() {
        let dir = tempfile::tempdir().expect("tempdir");
        let outside = dir.path().join("not-a-session.jsonl");
        std::fs::write(&outside, r#"{"type":"message"}"#).expect("write");

        let error = read_transcript(&outside).expect_err("must refuse");
        assert!(error.contains("Not a Prime session log"), "{error}");

        // An ordinary file that merely exists is refused for the same reason.
        let secret = dir.path().join("id_rsa");
        std::fs::write(&secret, "PRIVATE KEY").expect("write");
        assert!(read_transcript(&secret).is_err());
    }

    #[test]
    fn bare_string_content_still_yields_a_title() {
        let summary = summarize_lines(lines(&[
            r#"{"type":"message","message":{"role":"user","content":"plain string"}}"#,
        ]));

        assert_eq!(summary.title.as_deref(), Some("plain string"));
    }
}
