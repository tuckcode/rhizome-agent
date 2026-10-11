//! Append-only native chat session logs (plan 2c, ADR-0183).
//!
//! One JSONL file per session under the app config folder. Nothing is
//! written under `~/.prime`. Each line is flushed and synced before the
//! next event is accepted.

use std::collections::HashSet;
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
/// 1 MiB per single tool result, counted in bytes.
pub const TOOL_RESULT_CAP: usize = 1024 * 1024;
/// Reserved so a full session can still record cancel/completion.
const COMPLETION_RESERVE: u64 = 4096;

/// ADR-0183 reopen warning, exact wording.
pub const REOPEN_WARNING: &str =
    "Earlier permissions no longer apply. Approve new actions before continuing.";

const SESSIONS_DIR: &str = "native-sessions";
const DAMAGE_WARNING: &str = "This chat log was damaged. Rhizome opened the verified history only.";

/// Same-process holders. `flock` is per process, so a second window in this
/// process needs its own record. The file lock still covers a second process,
/// and the kernel drops it when that process dies.
fn process_locks() -> &'static Mutex<HashSet<String>> {
    static LOCKS: std::sync::OnceLock<Mutex<HashSet<String>>> = std::sync::OnceLock::new();
    LOCKS.get_or_init(|| Mutex::new(HashSet::new()))
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct SessionHeader {
    pub version: u32,
    pub session_id: String,
    pub created_at: String,
    pub target: String,
    pub permission_mode: String,
    #[serde(default)]
    pub vault_path: Option<String>,
    #[serde(default)]
    pub vault_paths: Vec<String>,
    #[serde(default)]
    pub system_prompt: Option<String>,
}

#[derive(Debug, Clone)]
pub struct OpenedNativeLog {
    pub header: SessionHeader,
    pub events: Vec<DurableEvent>,
    pub warning: Option<String>,
    pub read_only: bool,
    pub successor_id: Option<String>,
}

#[derive(Debug)]
pub enum AppendError {
    Full,
    Io(String),
}

impl std::fmt::Display for AppendError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppendError::Full => write!(formatter, "session log is full; start a new session"),
            AppendError::Io(message) => write!(formatter, "{message}"),
        }
    }
}

impl From<AppendError> for String {
    fn from(error: AppendError) -> Self {
        error.to_string()
    }
}

/// Exclusive process lock for one session file. Released when this value
/// drops, and by the kernel if the process is killed.
pub struct SessionLock {
    session_id: String,
    file: File,
}

impl Drop for SessionLock {
    fn drop(&mut self) {
        unlock_exclusive(&self.file);
        if let Ok(mut held) = process_locks().lock() {
            held.remove(&self.session_id);
        }
    }
}

/// Writer that appends one flushed line at a time.
pub struct NativeSessionWriter {
    file: File,
    path: PathBuf,
    next_seq: u64,
    len: u64,
    header: SessionHeader,
    fail_io: bool,
    _lock: SessionLock,
}

pub type SharedWriter = Arc<Mutex<NativeSessionWriter>>;

pub fn validate_session_id(session_id: &str) -> Result<(), String> {
    let parsed = uuid::Uuid::parse_str(session_id)
        .map_err(|_| "native session id must be a UUID".to_string())?;
    if session_id.len() != 36 || parsed.hyphenated().to_string() != session_id.to_ascii_lowercase()
    {
        return Err("native session id must be a UUID".into());
    }
    Ok(())
}

pub fn native_sessions_dir() -> Result<PathBuf, String> {
    crate::app_config::preferred_app_config_path(SESSIONS_DIR)
}

pub fn session_log_path(session_id: &str) -> Result<PathBuf, String> {
    validate_session_id(session_id)?;
    Ok(native_sessions_dir()?.join(format!("{session_id}.jsonl")))
}

fn lock_path(session_id: &str) -> Result<PathBuf, String> {
    validate_session_id(session_id)?;
    Ok(native_sessions_dir()?.join(format!("{session_id}.lock")))
}

fn successor_pointer_path(session_id: &str) -> Result<PathBuf, String> {
    validate_session_id(session_id)?;
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
    let mut out = text.to_string();
    for secret in saved_secret_values() {
        if secret.len() >= 8 {
            out = out.replace(&secret, "[redacted]");
        }
    }
    let patterns = [
        r"(?:sk-proj-|sk-or-v1-|sk-ant-|gsk_|xai-|hf_)[A-Za-z0-9_-]{8,}",
        r"(?:sk_live_|sk_test_|sk-|ghp_|gho_|ghs_|ghu_|ghr_|github_pat_|glpat-|xai-|gsk_|hf_|npm_|xox[abprse]-)[A-Za-z0-9_-]{20,}",
        r"AKIA[0-9A-Z]{16}",
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----",
        r"(?i)bearer\s+[A-Za-z0-9._\-+/=]+",
        r#"(?i)"api_key"\s*:\s*"[^"]+""#,
        r"(?i)\bapi_key\s*=\s*\S+",
    ];
    for pattern in patterns {
        if let Ok(regex) = regex::Regex::new(pattern) {
            out = regex.replace_all(&out, "[redacted]").into_owned();
        }
    }
    out
}

fn saved_secret_values() -> Vec<String> {
    let Ok(path) = crate::app_config::preferred_app_config_path("ai-provider-secrets.json") else {
        return Vec::new();
    };
    let Ok(data) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&data) else {
        return Vec::new();
    };
    parsed
        .get("provider_api_keys")
        .and_then(|value| value.as_object())
        .map(|map| {
            map.values()
                .filter_map(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
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
    let bytes = output.as_bytes();
    if bytes.len() <= TOOL_RESULT_CAP {
        return output;
    }
    let marker = "\n[truncated: tool result exceeded 1 MiB]";
    let keep = TOOL_RESULT_CAP.saturating_sub(marker.len());
    let mut end = keep.min(bytes.len());
    while end > 0 && (bytes[end] & 0b1100_0000) == 0b1000_0000 {
        end -= 1;
    }
    let mut trimmed = String::from_utf8_lossy(&bytes[..end]).into_owned();
    trimmed.push_str(marker);
    if trimmed.len() > TOOL_RESULT_CAP {
        trimmed.truncate(TOOL_RESULT_CAP);
    }
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

fn lock_exclusive(file: &File) -> bool {
    fs2::FileExt::try_lock_exclusive(file).is_ok()
}

fn unlock_exclusive(file: &File) {
    let _ = fs2::FileExt::unlock(file);
}

pub fn try_lock_session(session_id: &str) -> Result<SessionLock, String> {
    validate_session_id(session_id)?;
    let dir = native_sessions_dir()?;
    fs::create_dir_all(&dir).map_err(|error| format!("create native-sessions dir: {error}"))?;
    {
        let mut held = process_locks()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !held.insert(session_id.to_string()) {
            return Err(format!(
                "native session {session_id} is open in another window"
            ));
        }
    }
    let path = lock_path(session_id)?;
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(&path)
        .map_err(|error| {
            release_process_lock(session_id);
            format!("lock native session {session_id}: {error}")
        })?;
    if let Err(error) = set_owner_only(&path) {
        release_process_lock(session_id);
        return Err(error);
    }
    if !lock_exclusive(&file) {
        release_process_lock(session_id);
        return Err(format!(
            "native session {session_id} is open in another window"
        ));
    }
    Ok(SessionLock {
        session_id: session_id.to_string(),
        file,
    })
}

fn release_process_lock(session_id: &str) {
    if let Ok(mut held) = process_locks().lock() {
        held.remove(session_id);
    }
}

fn write_lock_is_held(session_id: &str) -> bool {
    match try_lock_session(session_id) {
        Ok(lock) => {
            drop(lock);
            false
        }
        Err(_) => true,
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

fn split_log_lines(bytes: &[u8]) -> Vec<Result<String, ()>> {
    let mut lines = Vec::new();
    if bytes.is_empty() {
        return lines;
    }
    for chunk in bytes.split(|byte| *byte == b'\n') {
        match std::str::from_utf8(chunk) {
            Ok(text) => lines.push(Ok(text.to_string())),
            Err(_) => lines.push(Err(())),
        }
    }
    if bytes.last() == Some(&b'\n') {
        lines.pop();
    }
    lines
}

pub fn open_session_log(session_id: &str) -> Result<OpenedNativeLog, String> {
    let path = session_log_path(session_id)?;
    if !path.exists() {
        return Err(format!("native session {session_id} not found"));
    }
    let bytes = fs::read(&path)
        .map_err(|error| format!("read native session {}: {error}", path.display()))?;
    let mut lines = split_log_lines(&bytes).into_iter();
    let header_line = lines
        .next()
        .ok_or_else(|| "native session log is empty".to_string())?
        .map_err(|_| "native session header is not text".to_string())?;
    let header_value: serde_json::Value = serde_json::from_str(&header_line)
        .map_err(|error| format!("native session header: {error}"))?;
    if !is_header_line(&header_value) {
        return Err("native session log is missing a header".into());
    }
    let header = parse_header(&header_value)?;
    let unknown_version = header.version != NATIVE_LOG_VERSION;
    let writer_is_live = write_lock_is_held(session_id);

    let mut events = Vec::new();
    let mut expected_seq = 1u64;
    let mut saw_damage = false;
    for line in lines {
        if saw_damage {
            continue;
        }
        let Ok(text) = line else {
            saw_damage = true;
            continue;
        };
        if text.trim().is_empty() {
            continue;
        }
        match parse_event_line(&text) {
            Ok((seq, event)) if seq == expected_seq => {
                events.push(event);
                expected_seq += 1;
            }
            _ => saw_damage = true,
        }
    }

    let mut warning = None;
    let mut successor_id = None;
    if saw_damage && !writer_is_live {
        warning = Some(DAMAGE_WARNING.into());
        if !unknown_version {
            if let Ok(Some(existing)) = read_successor_pointer(session_id) {
                successor_id = Some(existing);
            } else if let Ok(id) = create_successor(&header, &events) {
                successor_id = Some(id.clone());
                let _ = write_successor_pointer(session_id, &id);
            }
        }
    }

    Ok(OpenedNativeLog {
        header,
        events,
        warning,
        read_only: unknown_version,
        successor_id,
    })
}

fn read_header_only(path: &Path) -> Result<SessionHeader, String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("read native session {}: {error}", path.display()))?;
    let end = bytes
        .iter()
        .position(|byte| *byte == b'\n')
        .unwrap_or(bytes.len());
    let line = std::str::from_utf8(&bytes[..end])
        .map_err(|_| "native session header is not text".to_string())?;
    let value: serde_json::Value =
        serde_json::from_str(line).map_err(|error| format!("native session header: {error}"))?;
    if !is_header_line(&value) {
        return Err("native session log is missing a header".into());
    }
    parse_header(&value)
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
        vault_paths: header.vault_paths.clone(),
        system_prompt: header.system_prompt.clone(),
    };
    let mut writer = create_session_log(&successor_header)?;
    for event in events {
        writer.append(event)?;
    }
    drop(writer);
    Ok(id)
}

pub fn create_session_log(header: &SessionHeader) -> Result<NativeSessionWriter, String> {
    validate_session_id(&header.session_id)?;
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
        header: header.clone(),
        fail_io: false,
        _lock: lock,
    })
}

pub fn open_session_writer(session_id: &str, next_seq: u64) -> Result<NativeSessionWriter, String> {
    let path = session_log_path(session_id)?;
    let header = read_header_only(&path)?;
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
        header,
        fail_io: false,
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

    pub fn session_id(&self) -> &str {
        &self.header.session_id
    }

    #[cfg(test)]
    pub fn force_len(&mut self, len: u64) {
        self.len = len;
    }

    #[cfg(test)]
    pub fn fail_next_io(&mut self) {
        self.fail_io = true;
    }

    pub fn append(&mut self, event: &DurableEvent) -> Result<(), AppendError> {
        if self.fail_io {
            self.fail_io = false;
            return Err(AppendError::Io(
                "flush native session line: disk error".into(),
            ));
        }
        let event = scrub_event(event);
        let event_value = serde_json::to_value(&event)
            .map_err(|error| AppendError::Io(format!("serialize native event: {error}")))?;
        let checksum = checksum_value(self.next_seq, &event_value);
        let line = serde_json::json!({
            "seq": self.next_seq,
            "checksum": checksum,
            "event": event_value,
        });
        let encoded = serde_json::to_string(&line)
            .map_err(|error| AppendError::Io(format!("serialize native log line: {error}")))?;
        let add = encoded.len() as u64 + 1;
        let reserve = match event {
            DurableEvent::TurnEnd | DurableEvent::Cancelled { .. } => 0,
            _ => COMPLETION_RESERVE,
        };
        if self.len + add + reserve > SESSION_SIZE_CAP {
            return Err(AppendError::Full);
        }
        write_line(&mut self.file, &encoded).map_err(AppendError::Io)?;
        self.len += add;
        self.next_seq += 1;
        Ok(())
    }

    pub fn roll_to_successor(&mut self) -> Result<(), String> {
        let id = uuid::Uuid::new_v4().to_string();
        let header = SessionHeader {
            version: NATIVE_LOG_VERSION,
            session_id: id.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            target: self.header.target.clone(),
            permission_mode: self.header.permission_mode.clone(),
            vault_path: self.header.vault_path.clone(),
            vault_paths: self.header.vault_paths.clone(),
            system_prompt: self.header.system_prompt.clone(),
        };
        let previous = self.header.session_id.clone();
        let new_writer = create_session_log(&header)?;
        write_successor_pointer(&previous, &id)?;
        *self = new_writer;
        Ok(())
    }
}

/// Append one event. A full log rolls to a new session first so the event
/// is kept. Disk errors are returned instead of dropped.
pub fn append_or_roll(
    writer: &mut NativeSessionWriter,
    event: &DurableEvent,
) -> Result<Option<String>, String> {
    match writer.append(event) {
        Ok(()) => Ok(None),
        Err(AppendError::Full) => {
            writer.roll_to_successor()?;
            writer
                .append(event)
                .map_err(|error| format!("new session could not store the event: {error}"))?;
            Ok(Some(
                "This chat reached its 100 MiB log. Rhizome continued in a new session.".into(),
            ))
        }
        Err(AppendError::Io(message)) => Err(message),
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
        append_or_roll(&mut writer, event)?;
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
        if validate_session_id(id).is_err() {
            continue;
        }
        if let Ok(header) = read_header_only(&path) {
            headers.push(header);
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

    struct HomeGuard {
        _lock: std::sync::MutexGuard<'static, ()>,
        _home: tempfile::TempDir,
        previous_home: Option<String>,
        previous_xdg: Option<String>,
    }

    impl Drop for HomeGuard {
        fn drop(&mut self) {
            if let Some(value) = self.previous_home.take() {
                std::env::set_var("HOME", value);
            } else {
                std::env::remove_var("HOME");
            }
            if let Some(value) = self.previous_xdg.take() {
                std::env::set_var("XDG_CONFIG_HOME", value);
            } else {
                std::env::remove_var("XDG_CONFIG_HOME");
            }
        }
    }

    fn temp_home() -> HomeGuard {
        let lock = crate::app_config::TEST_CONFIG_ENV
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let home = tempfile::tempdir().unwrap();
        let previous_home = std::env::var("HOME").ok();
        let previous_xdg = std::env::var("XDG_CONFIG_HOME").ok();
        std::env::set_var("HOME", home.path());
        std::env::remove_var("XDG_CONFIG_HOME");
        HomeGuard {
            _lock: lock,
            _home: home,
            previous_home,
            previous_xdg,
        }
    }

    #[test]
    fn scrub_secrets_redacts_known_keys() {
        let text = "token sk-abcdefghijklmnopqrstuvwxyz123456 and ghp_abcdefghijklmnopqrstuv";
        let scrubbed = scrub_secrets(text);
        assert!(!scrubbed.contains("sk-abcdefghijklmnopqrstuvwxyz123456"));
        assert!(!scrubbed.contains("ghp_abcdefghijklmnopqrstuv"));
        assert!(scrubbed.contains("[redacted]"));
    }

    #[test]
    fn scrub_secrets_redacts_current_key_prefixes() {
        let samples = [
            "sk-proj-abcdefghijklmnopqrstuvwxyz",
            "sk-or-v1-abcdefghijklmnopqrstuvwxyz",
            "gsk_abcdefghijklmnopqrstuvwxyz",
            "xai-abcdefghijklmnopqrstuvwxyz",
            "hf_abcdefghijklmnopqrstuvwxyz",
        ];
        for sample in samples {
            let scrubbed = scrub_secrets(sample);
            assert!(!scrubbed.contains(sample), "{sample}");
            assert!(scrubbed.contains("[redacted]"), "{sample}");
        }
        let assigned = scrub_secrets("api_key=super-secret-value");
        assert!(!assigned.contains("super-secret-value"));
        let json = scrub_secrets(r#"{"api_key": "super-secret-value"}"#);
        assert!(!json.contains("super-secret-value"));
    }

    /// Keys live in the keychain after step 3a (ADR-0185), not in
    /// `ai-provider-secrets.json`, so the filter must read the keychain.
    #[test]
    fn scrub_secrets_redacts_a_keychain_key_for_a_catalog_provider() {
        let _home = temp_home();
        crate::provider_keys::ProviderKeys::for_app()
            .unwrap()
            .save("mistral", "keychain-catalog-key-value")
            .unwrap();

        let scrubbed = scrub_secrets("the key is keychain-catalog-key-value today");

        assert!(!scrubbed.contains("keychain-catalog-key-value"), "{scrubbed}");
        assert!(scrubbed.contains("[redacted]"));
    }

    #[test]
    fn scrub_secrets_redacts_a_keychain_key_for_a_saved_provider() {
        let _home = temp_home();
        let provider: crate::ai_models::AiModelProvider = serde_json::from_value(serde_json::json!({
            "id": "open_ai_compatible-scrubtest",
            "name": "Scrub test",
            "kind": "open_ai_compatible",
            "base_url": "https://hosted.test/v1",
            "api_key_storage": "local_file",
            "models": [],
        }))
        .unwrap();
        crate::settings::save_settings(crate::settings::Settings {
            ai_model_providers: Some(vec![provider]),
            ..Default::default()
        })
        .unwrap();
        crate::provider_keys::ProviderKeys::for_app()
            .unwrap()
            .save("open_ai_compatible-scrubtest", "keychain-custom-key-value")
            .unwrap();

        let scrubbed = scrub_secrets("custom keychain-custom-key-value here");

        assert!(!scrubbed.contains("keychain-custom-key-value"), "{scrubbed}");
    }

    #[test]
    fn tool_result_over_cap_is_marked() {
        let huge = "x".repeat(TOOL_RESULT_CAP + 8);
        let capped = cap_tool_result(huge);
        assert!(capped.contains("[truncated: tool result exceeded 1 MiB]"));
        assert!(capped.len() <= TOOL_RESULT_CAP);
    }

    #[test]
    fn tool_result_cap_counts_bytes() {
        let huge = "é".repeat(TOOL_RESULT_CAP);
        assert!(huge.len() > TOOL_RESULT_CAP);
        let capped = cap_tool_result(huge);
        assert!(capped.len() <= TOOL_RESULT_CAP);
        assert!(capped.contains("[truncated: tool result exceeded 1 MiB]"));
    }

    #[test]
    fn leftover_lock_file_does_not_block_reopen() {
        let _home = temp_home();
        let id = uuid::Uuid::new_v4().to_string();
        let header = SessionHeader {
            version: NATIVE_LOG_VERSION,
            session_id: id.clone(),
            created_at: "2026-10-10T00:00:00Z".into(),
            target: "openai/gpt-4o-mini".into(),
            permission_mode: "safe".into(),
            vault_path: None,
            vault_paths: Vec::new(),
            system_prompt: None,
        };
        let writer = create_session_log(&header).unwrap();
        drop(writer);
        std::fs::write(lock_path(&id).unwrap(), b"stale").unwrap();
        let reopened = open_session_writer(&id, 1).expect("stale lock file must not block");
        drop(reopened);
    }

    #[test]
    fn second_lock_in_this_process_is_refused_until_drop() {
        let _home = temp_home();
        let id = uuid::Uuid::new_v4().to_string();
        let header = SessionHeader {
            version: NATIVE_LOG_VERSION,
            session_id: id.clone(),
            created_at: "2026-10-10T00:00:00Z".into(),
            target: "openai/gpt-4o-mini".into(),
            permission_mode: "safe".into(),
            vault_path: None,
            vault_paths: Vec::new(),
            system_prompt: None,
        };
        let first = create_session_log(&header).unwrap();
        let second = try_lock_session(&id);
        assert!(second.is_err(), "a live lock must refuse a second writer");
        drop(first);
        let third = try_lock_session(&id).expect("drop releases the lock");
        drop(third);
    }

    #[test]
    fn killed_holder_releases_the_lock() {
        let _home = temp_home();
        let id = uuid::Uuid::new_v4().to_string();
        let path = lock_path(&id).unwrap();
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let mut child = std::process::Command::new("python3")
            .arg("-c")
            .arg("import fcntl,os,sys; f=open(sys.argv[1],'a+'); fcntl.flock(f.fileno(), fcntl.LOCK_EX|fcntl.LOCK_NB); os.kill(os.getpid(), 9)")
            .arg(&path)
            .spawn()
            .expect("python3");
        let status = child.wait().expect("wait");
        assert!(!status.success(), "the holder must be killed");
        let lock =
            try_lock_session(&id).expect("a killed process must not keep the chat read-only");
        drop(lock);
    }

    #[test]
    fn full_log_rolls_and_keeps_the_event() {
        let _home = temp_home();
        let id = uuid::Uuid::new_v4().to_string();
        let header = SessionHeader {
            version: NATIVE_LOG_VERSION,
            session_id: id.clone(),
            created_at: "2026-10-10T00:00:00Z".into(),
            target: "openai/gpt-4o-mini".into(),
            permission_mode: "safe".into(),
            vault_path: None,
            vault_paths: Vec::new(),
            system_prompt: None,
        };
        let mut writer = create_session_log(&header).unwrap();
        let before = std::fs::metadata(writer.path()).unwrap().len();
        writer.force_len(SESSION_SIZE_CAP);
        let event = DurableEvent::User {
            text: "keep me".into(),
        };
        let warning = append_or_roll(&mut writer, &event).unwrap();
        assert!(warning.is_some(), "the cap must be surfaced");
        assert_ne!(writer.session_id(), id);
        let original = std::fs::metadata(session_log_path(&id).unwrap())
            .unwrap()
            .len();
        assert_eq!(original, before, "the full log must stay untouched");
        let opened = open_session_log(writer.session_id()).unwrap();
        assert!(opened
            .events
            .iter()
            .any(|item| matches!(item, DurableEvent::User { text } if text == "keep me")));
    }

    #[test]
    fn disk_error_is_returned() {
        let _home = temp_home();
        let id = uuid::Uuid::new_v4().to_string();
        let header = SessionHeader {
            version: NATIVE_LOG_VERSION,
            session_id: id.clone(),
            created_at: "2026-10-10T00:00:00Z".into(),
            target: "openai/gpt-4o-mini".into(),
            permission_mode: "safe".into(),
            vault_path: None,
            vault_paths: Vec::new(),
            system_prompt: None,
        };
        let mut writer = create_session_log(&header).unwrap();
        writer.fail_next_io();
        let error = append_or_roll(
            &mut writer,
            &DurableEvent::User {
                text: "nope".into(),
            },
        )
        .expect_err("disk error");
        assert!(error.contains("disk error"));
        let opened = open_session_log(&id).unwrap();
        assert!(
            !opened
                .events
                .iter()
                .any(|event| matches!(event, DurableEvent::User { text } if text == "nope")),
            "a failed save must not pretend the event was stored"
        );
    }

    #[test]
    fn bad_bytes_are_damage_and_the_header_still_lists() {
        let _home = temp_home();
        let id = uuid::Uuid::new_v4().to_string();
        let header = SessionHeader {
            version: NATIVE_LOG_VERSION,
            session_id: id.clone(),
            created_at: "2026-10-10T00:00:00Z".into(),
            target: "openai/gpt-4o-mini".into(),
            permission_mode: "safe".into(),
            vault_path: None,
            vault_paths: Vec::new(),
            system_prompt: None,
        };
        let path = write_fixture(&header, &[], &[]).unwrap();
        let mut bytes = std::fs::read(&path).unwrap();
        bytes.extend_from_slice(&[0xff, 0xfe, b'\n']);
        std::fs::write(&path, &bytes).unwrap();
        let listed = list_session_headers().unwrap();
        assert!(listed.iter().any(|item| item.session_id == id));
        let opened = open_session_log(&id).unwrap();
        assert!(opened.warning.is_some());
        let after = std::fs::read(&path).unwrap();
        assert_eq!(after, bytes, "damage must not rewrite the original");
    }

    #[test]
    fn traversal_id_is_rejected() {
        let error = session_log_path("../x").expect_err("reject");
        assert!(error.to_lowercase().contains("uuid"));
    }

    #[test]
    fn a_skipped_sequence_number_is_damage() {
        let _home = temp_home();
        let id = uuid::Uuid::new_v4().to_string();
        let header = SessionHeader {
            version: NATIVE_LOG_VERSION,
            session_id: id.clone(),
            created_at: "2026-10-10T00:00:00Z".into(),
            target: "openai/gpt-4o-mini".into(),
            permission_mode: "safe".into(),
            vault_path: None,
            vault_paths: Vec::new(),
            system_prompt: None,
        };
        let event = r#"{"User":{"text":"hi"}}"#;
        let checksum = checksum_event(5, event);
        let line = serde_json::json!({
            "seq": 5,
            "checksum": checksum,
            "event": serde_json::from_str::<serde_json::Value>(event).unwrap(),
        })
        .to_string();
        let path = write_fixture(&header, &[], &[&line]).unwrap();
        let before = std::fs::read(&path).unwrap();
        let opened = open_session_log(&id).unwrap();
        assert!(opened.events.is_empty());
        assert!(opened.warning.is_some());
        assert!(opened.successor_id.is_some());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }
}
