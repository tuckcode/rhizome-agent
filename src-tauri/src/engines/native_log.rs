//! Append-only native chat session logs (plan 2c, ADR-0183).
//!
//! One JSONL file per session under the app config folder. Nothing is
//! written under `~/.prime`. Each line is flushed and synced before the
//! next event is accepted.

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::ai_agents::AiAgentPermissionMode;
use crate::rhizome_loop::DurableEvent;
use sha2::{Digest, Sha256};

/// On-disk format version. Unknown versions open read-only.
pub const NATIVE_LOG_VERSION: u32 = 1;
/// 100 MiB per session log.
pub const SESSION_SIZE_CAP: u64 = 100 * 1024 * 1024;
/// 1 MiB per single tool result.
pub const TOOL_RESULT_CAP: usize = 1024 * 1024;
/// Reserved so a full session can still record cancel/completion.
const COMPLETION_RESERVE: u64 = 4096;

/// D13 reopen warning. Plan 2c copy, includes the ADR phrase.
pub const REOPEN_WARNING: &str = "Rhizome restarted. Permissions you gave earlier in this chat no longer apply, so Rhizome asks again.";

const SESSIONS_DIR: &str = "native-sessions";

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct SessionHeader {
    pub version: u32,
    pub session_id: String,
    pub created_at: String,
    pub target: String,
    pub permission_mode: String,
    pub vault_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct OpenedNativeLog {
    pub header: SessionHeader,
    pub events: Vec<DurableEvent>,
    pub warning: Option<String>,
    pub read_only: bool,
    pub successor_id: Option<String>,
}

/// Exclusive process lock for one session file.
pub struct SessionLock {
    path: PathBuf,
    _file: File,
}

impl Drop for SessionLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

/// Writer that appends one flushed line at a time.
pub struct NativeSessionWriter {
    file: File,
    path: PathBuf,
    next_seq: u64,
    len: u64,
    _lock: SessionLock,
}

pub type SharedWriter = Arc<Mutex<NativeSessionWriter>>;

pub fn native_sessions_dir() -> Result<PathBuf, String> {
    crate::app_config::preferred_app_config_path(SESSIONS_DIR)
}

pub fn session_log_path(session_id: &str) -> Result<PathBuf, String> {
    Ok(native_sessions_dir()?.join(format!("{session_id}.jsonl")))
}

fn lock_path(session_id: &str) -> Result<PathBuf, String> {
    Ok(native_sessions_dir()?.join(format!("{session_id}.lock")))
}

fn successor_pointer_path(session_id: &str) -> Result<PathBuf, String> {
    Ok(native_sessions_dir()?.join(format!("{session_id}.successor")))
}

pub fn checksum_event(seq: u64, event_json: &str) -> String {
    let value: serde_json::Value = serde_json::from_str(event_json)
        .unwrap_or_else(|_| serde_json::Value::String(event_json.to_string()));
    checksum_value(seq, &value)
}

fn checksum_value(seq: u64, value: &serde_json::Value) -> String {
    let canonical = serde_json::to_string(value).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(seq.to_string().as_bytes());
    hasher.update(b":");
    hasher.update(canonical.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn scrub_secrets(text: &str) -> String {
    let patterns = [
        r"sk-ant-[A-Za-z0-9_-]+",
        r"sk-[A-Za-z0-9]{20,}",
        r"ghp_[A-Za-z0-9]{20,}",
        r"github_pat_[A-Za-z0-9_]+",
        r"xox[baprs]-[A-Za-z0-9-]+",
        r"AKIA[0-9A-Z]{16}",
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----",
        r"(?i)bearer\s+[A-Za-z0-9._\-+/=]+",
    ];
    let mut out = text.to_string();
    for pattern in patterns {
        if let Ok(regex) = regex::Regex::new(pattern) {
            out = regex.replace_all(&out, "[redacted]").into_owned();
        }
    }
    out
}

fn scrub_event(event: &DurableEvent) -> DurableEvent {
    match event.clone() {
        DurableEvent::User { text } => DurableEvent::User {
            text: scrub_secrets(&text),
        },
        DurableEvent::Assistant { text } => DurableEvent::Assistant {
            text: scrub_secrets(&text),
        },
        DurableEvent::ToolCall { id, name, args } => DurableEvent::ToolCall {
            id,
            name,
            args: scrub_secrets(&args),
        },
        DurableEvent::ToolResult { id, name, output } => DurableEvent::ToolResult {
            id,
            name,
            output: cap_tool_result(scrub_secrets(&output)),
        },
        DurableEvent::ToolDenied { id, name, reason } => DurableEvent::ToolDenied {
            id,
            name,
            reason: scrub_secrets(&reason),
        },
        DurableEvent::ModelFailed { message } => DurableEvent::ModelFailed {
            message: scrub_secrets(&message),
        },
        other => other,
    }
}

fn cap_tool_result(output: String) -> String {
    if output.len() <= TOOL_RESULT_CAP {
        return output;
    }
    let keep = TOOL_RESULT_CAP.saturating_sub(48);
    let mut trimmed = output.chars().take(keep).collect::<String>();
    trimmed.push_str("\n[truncated: tool result exceeded 1 MiB]");
    trimmed
}

fn set_owner_only(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("restrict native session log {}: {error}", path.display()))?;
    }
    let _ = path;
    Ok(())
}

pub fn try_lock_session(session_id: &str) -> Result<SessionLock, String> {
    let dir = native_sessions_dir()?;
    fs::create_dir_all(&dir).map_err(|error| format!("create native-sessions dir: {error}"))?;
    let path = lock_path(session_id)?;
    match OpenOptions::new().write(true).create_new(true).open(&path) {
        Ok(file) => {
            set_owner_only(&path)?;
            Ok(SessionLock { path, _file: file })
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Err(format!(
            "native session {session_id} is open in another window"
        )),
        Err(error) => Err(format!("lock native session {session_id}: {error}")),
    }
}

fn parse_header(value: &serde_json::Value) -> Result<SessionHeader, String> {
    serde_json::from_value(value.clone()).map_err(|error| format!("native log header: {error}"))
}

fn parse_event_line(line: &str) -> Result<(u64, DurableEvent), String> {
    let value: serde_json::Value =
        serde_json::from_str(line).map_err(|error| format!("native log line: {error}"))?;
    let seq = value
        .get("seq")
        .and_then(|item| item.as_u64())
        .ok_or_else(|| "native log line missing seq".to_string())?;
    let checksum = value
        .get("checksum")
        .and_then(|item| item.as_str())
        .ok_or_else(|| "native log line missing checksum".to_string())?;
    let event_value = value
        .get("event")
        .cloned()
        .ok_or_else(|| "native log line missing event".to_string())?;
    let expected = checksum_value(seq, &event_value);
    if expected != checksum {
        return Err("native log checksum mismatch".into());
    }
    let event: DurableEvent = serde_json::from_value(event_value)
        .map_err(|error| format!("native log event: {error}"))?;
    Ok((seq, event))
}

fn is_header_line(value: &serde_json::Value) -> bool {
    value.get("version").is_some()
        && value.get("session_id").is_some()
        && value.get("event").is_none()
}

pub fn open_session_log(session_id: &str) -> Result<OpenedNativeLog, String> {
    let path = session_log_path(session_id)?;
    if !path.exists() {
        return Err(format!("native session {session_id} not found"));
    }
    let held_by_other = try_lock_session(session_id).is_err();
    let data = fs::read_to_string(&path)
        .map_err(|error| format!("read native session {}: {error}", path.display()))?;
    let mut lines = data.lines().enumerate();
    let header_line = lines
        .next()
        .ok_or_else(|| "native session log is empty".to_string())?;
    let header_value: serde_json::Value = serde_json::from_str(header_line.1)
        .map_err(|error| format!("native session header: {error}"))?;
    if !is_header_line(&header_value) {
        return Err("native session log is missing a header".into());
    }
    let header = parse_header(&header_value)?;
    let unknown_version = header.version != NATIVE_LOG_VERSION;

    let mut events = Vec::new();
    let mut last_good_end = header_line.1.len();
    if data.as_bytes().get(last_good_end) == Some(&b'\n') {
        last_good_end += 1;
    }
    let mut first_invalid: Option<usize> = None;
    let mut lines_after_invalid = 0usize;

    let remaining: Vec<(usize, &str)> = lines.collect();
    for (index, line) in remaining {
        if line.trim().is_empty() {
            last_good_end += line.len() + 1;
            continue;
        }
        if first_invalid.is_some() {
            lines_after_invalid += 1;
            continue;
        }
        match parse_event_line(line) {
            Ok((_seq, event)) => {
                events.push(event);
                last_good_end += line.len() + 1;
            }
            Err(_) => {
                first_invalid = Some(index);
            }
        }
    }

    let mut warning = None;
    let mut successor_id = None;
    if first_invalid.is_some() {
        warning =
            Some("This chat log was damaged. Rhizome opened the verified history only.".into());
        if lines_after_invalid == 0 {
            if !held_by_other && !unknown_version {
                if let Ok(file) = OpenOptions::new().write(true).open(&path) {
                    let _ = file.set_len(last_good_end as u64);
                }
            }
        } else if let Ok(Some(existing)) = read_successor_pointer(session_id) {
            successor_id = Some(existing);
        } else if !unknown_version {
            successor_id = Some(create_successor(&header, &events)?);
            let _ = write_successor_pointer(session_id, successor_id.as_deref().unwrap_or(""));
        }
    }

    Ok(OpenedNativeLog {
        header,
        events,
        warning,
        read_only: held_by_other || unknown_version,
        successor_id,
    })
}

fn read_successor_pointer(session_id: &str) -> Result<Option<String>, String> {
    let path = successor_pointer_path(session_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let id =
        fs::read_to_string(path).map_err(|error| format!("read successor pointer: {error}"))?;
    let id = id.trim();
    if id.is_empty() {
        Ok(None)
    } else {
        Ok(Some(id.to_string()))
    }
}

fn write_successor_pointer(session_id: &str, successor_id: &str) -> Result<(), String> {
    let path = successor_pointer_path(session_id)?;
    fs::write(&path, successor_id).map_err(|error| format!("write successor pointer: {error}"))?;
    set_owner_only(&path)
}

fn create_successor(header: &SessionHeader, events: &[DurableEvent]) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let successor_header = SessionHeader {
        version: NATIVE_LOG_VERSION,
        session_id: id.clone(),
        created_at: chrono::Utc::now().to_rfc3339(),
        target: header.target.clone(),
        permission_mode: header.permission_mode.clone(),
        vault_path: header.vault_path.clone(),
    };
    let mut writer = create_session_log(&successor_header)?;
    for event in events {
        writer.append(event)?;
    }
    drop(writer);
    Ok(id)
}

pub fn create_session_log(header: &SessionHeader) -> Result<NativeSessionWriter, String> {
    let dir = native_sessions_dir()?;
    fs::create_dir_all(&dir).map_err(|error| format!("create native-sessions dir: {error}"))?;
    let path = session_log_path(&header.session_id)?;
    let lock = try_lock_session(&header.session_id)?;
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&path)
        .map_err(|error| format!("create native session {}: {error}", path.display()))?;
    set_owner_only(&path)?;
    let header_json = serde_json::to_string(header)
        .map_err(|error| format!("serialize native session header: {error}"))?;
    write_line(&mut file, &header_json)?;
    let len = file.metadata().map(|meta| meta.len()).unwrap_or(0);
    Ok(NativeSessionWriter {
        file,
        path,
        next_seq: 1,
        len,
        _lock: lock,
    })
}

pub fn open_session_writer(session_id: &str, next_seq: u64) -> Result<NativeSessionWriter, String> {
    let path = session_log_path(session_id)?;
    let lock = try_lock_session(session_id)?;
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("append native session {}: {error}", path.display()))?;
    set_owner_only(&path)?;
    let len = file.metadata().map(|meta| meta.len()).unwrap_or(0);
    Ok(NativeSessionWriter {
        file,
        path,
        next_seq,
        len,
        _lock: lock,
    })
}

fn write_line(file: &mut File, line: &str) -> Result<(), String> {
    file.write_all(line.as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .and_then(|_| file.flush())
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("flush native session line: {error}"))
}

impl NativeSessionWriter {
    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn append(&mut self, event: &DurableEvent) -> Result<(), String> {
        let event = scrub_event(event);
        let event_value = serde_json::to_value(&event)
            .map_err(|error| format!("serialize native event: {error}"))?;
        let checksum = checksum_value(self.next_seq, &event_value);
        let line = serde_json::json!({
            "seq": self.next_seq,
            "checksum": checksum,
            "event": event_value,
        });
        let encoded = serde_json::to_string(&line)
            .map_err(|error| format!("serialize native log line: {error}"))?;
        let add = encoded.len() as u64 + 1;
        let reserve = match event {
            DurableEvent::TurnEnd | DurableEvent::Cancelled { .. } => 0,
            _ => COMPLETION_RESERVE,
        };
        if self.len + add + reserve > SESSION_SIZE_CAP {
            return Err("session log is full; start a new session".into());
        }
        write_line(&mut self.file, &encoded)?;
        self.len += add;
        self.next_seq += 1;
        Ok(())
    }
}

pub fn persist_missing_suffix(
    session_id: &str,
    disk: &[DurableEvent],
    memory: &[DurableEvent],
) -> Result<(), String> {
    if memory.len() <= disk.len() {
        return Ok(());
    }
    let next_seq = disk.len() as u64 + 1;
    let mut writer = open_session_writer(session_id, next_seq)?;
    for event in &memory[disk.len()..] {
        writer.append(event)?;
    }
    Ok(())
}

pub fn list_session_headers() -> Result<Vec<SessionHeader>, String> {
    let dir = native_sessions_dir()?;
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut headers = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|error| format!("list native-sessions: {error}"))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("read native-sessions: {error}"))?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        if let Ok(opened) = open_session_log(id) {
            headers.push(opened.header);
        }
    }
    headers.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(headers)
}

pub fn delete_session_log(session_id: &str) -> Result<(), String> {
    let path = session_log_path(session_id)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("delete native session {}: {error}", path.display()))?;
    }
    let _ = fs::remove_file(lock_path(session_id)?);
    let _ = fs::remove_file(successor_pointer_path(session_id)?);
    Ok(())
}

pub fn permission_mode_label(mode: AiAgentPermissionMode) -> String {
    match mode {
        AiAgentPermissionMode::Safe => "safe".into(),
        AiAgentPermissionMode::PowerUser => "power_user".into(),
    }
}

pub fn next_seq_after(events: &[DurableEvent]) -> u64 {
    events.len() as u64 + 1
}

/// Test helper: write a session through the real append path, then optional
/// extra raw lines (for damage cases). Callers pass events, not session ids,
/// into the file write.
#[cfg(test)]
pub fn write_fixture(
    header: &SessionHeader,
    events: &[DurableEvent],
    extra_lines: &[&str],
) -> Result<PathBuf, String> {
    let mut writer = create_session_log(header)?;
    for event in events {
        writer.append(event)?;
    }
    let path = writer.path().to_path_buf();
    drop(writer);
    if !extra_lines.is_empty() {
        let mut file = OpenOptions::new()
            .append(true)
            .open(&path)
            .map_err(|error| format!("append fixture tail: {error}"))?;
        for line in extra_lines {
            write_line(&mut file, line)?;
        }
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scrub_secrets_redacts_known_keys() {
        let text = "token sk-abcdefghijklmnopqrstuvwxyz123456 and ghp_abcdefghijklmnopqrstuv";
        let scrubbed = scrub_secrets(text);
        assert!(!scrubbed.contains("sk-abcdefghijklmnopqrstuvwxyz123456"));
        assert!(!scrubbed.contains("ghp_abcdefghijklmnopqrstuv"));
        assert!(scrubbed.contains("[redacted]"));
    }

    #[test]
    fn tool_result_over_cap_is_marked() {
        let huge = "x".repeat(TOOL_RESULT_CAP + 8);
        let capped = cap_tool_result(huge);
        assert!(capped.contains("[truncated: tool result exceeded 1 MiB]"));
        assert!(capped.len() <= TOOL_RESULT_CAP);
    }
}
