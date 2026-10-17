//! Append-only native chat session logs (plan 2c, ADR-0183).
//!
//! One JSONL file per session under the app config folder. Nothing is
//! written under `~/.prime`. Each line is flushed and synced before the
//! next event is accepted.

use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
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
/// User-facing notice when a mid-turn log append fails. The turn continues.
pub const LOG_SAVE_NOTICE: &str =
    "This part of the chat couldn't be saved, so it won't be there after a restart.";
/// Shown once when the writer can no longer append at all.
pub const LOG_SAVE_STOPPED: &str =
    "Saving has stopped for this chat, so later messages won't be there after a restart.";

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
    /// Truncate, rewind, or sync failed. Later appends must not write.
    poisoned: bool,
    /// The user has already been told that saving stopped.
    stop_announced: bool,
    /// Test hook: write this many bytes of the next line, then fail.
    #[cfg(test)]
    partial_write_limit: Option<usize>,
    /// Test hook: 1 = truncate fails, 2 = rewind fails, 3 = sync fails.
    #[cfg(test)]
    repair_fault: u8,
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

/// One read of saved provider keys, reused across every string in a call.
pub(crate) struct SecretScrub {
    values: Vec<String>,
}

impl SecretScrub {
    pub(crate) fn capture() -> Self {
        Self {
            values: saved_secret_values(),
        }
    }

    pub(crate) fn apply(&self, text: &str) -> String {
        apply_scrub(text, &self.values)
    }
}

pub fn scrub_secrets(text: &str) -> String {
    SecretScrub::capture().apply(text)
}

fn apply_scrub(text: &str, saved: &[String]) -> String {
    let mut out = text.to_string();
    for secret in saved {
        if secret.len() >= 8 {
            out = out.replace(secret, "[redacted]");
        }
    }
    let scrubbers = scrub_regexes();
    out = scrub_assignments(&out, scrubbers);
    out = scrub_bearer(&out, scrubbers);
    for pattern in &scrubbers.patterns {
        out = pattern.replace_all(&out, "[redacted]").into_owned();
    }
    scrub_bare_mistral_keys(&out, scrubbers)
}

struct ScrubRegexes {
    assignment: regex::Regex,
    api_key_name: regex::Regex,
    env_name: regex::Regex,
    quoted_env_name: regex::Regex,
    prefixed_key_name: regex::Regex,
    bearer: regex::Regex,
    patterns: Vec<regex::Regex>,
    mistral_context: regex::Regex,
    mistral_key: regex::Regex,
}

fn scrub_regexes() -> &'static ScrubRegexes {
    // OnceLock, not LazyLock: LazyLock needs Rust 1.80 and this crate's MSRV is 1.77.2.
    static SCRUBBERS: std::sync::OnceLock<ScrubRegexes> = std::sync::OnceLock::new();
    SCRUBBERS.get_or_init(|| {
        // `_` is part of the name, so `SORT_KEY` is not a bare `KEY`.
        // `=` is not `==`. The value is checked in `scrub_assignments`.
        let assignment = regex::Regex::new(
            r#"(?P<pre>(?:^|[^A-Za-z0-9_])(?:(?:export|set)[ \t]+)?)(?P<quote>["']?)(?P<name>[A-Za-z][A-Za-z0-9_]*)["']?[ \t]*(?P<sep>[=:])[ \t]*(?P<value>"[^"\r\n]*"|'[^'\r\n]*'|[^[:space:]#]+)"#,
        )
        .expect("assignment scrubber");
        let api_key_name = regex::Regex::new(
            r"(?i)^(?:[a-z][a-z0-9]*_?)?api_?key(?:_[a-z0-9]+)*$",
        )
        .expect("api_key name");
        let env_name = regex::Regex::new(
            r"^(?:[A-Z][A-Z0-9]*_)?(?:TOKEN|SECRET|PASSWORD)(?:_[A-Z0-9]+)*$",
        )
        .expect("env secret name");
        let quoted_env_name = regex::Regex::new(
            r"(?i)^(?:[A-Z][A-Z0-9]*_)?(?:TOKEN|SECRET|PASSWORD)(?:_[A-Z0-9]+)*$",
        )
        .expect("quoted env secret name");
        let prefixed_key_name =
            regex::Regex::new(r"^[A-Z][A-Z0-9]*_KEY(?:_[A-Z0-9]+)*$").expect("prefixed key name");
        let bearer = regex::Regex::new(r"(?i)bearer\s+(?P<token>[A-Za-z0-9._\-+/=]{8,})")
            .expect("bearer token");
        let patterns = [
            r"(?:sk-proj-|sk-or-v1-|sk-ant-|gsk_)[A-Za-z0-9_-]{8,}",
            r"(?:sk_live_|sk_test_|sk-|ghp_|gho_|ghs_|ghu_|ghr_|github_pat_|glpat-|gsk_|npm_|xox[abprse]-)[A-Za-z0-9_-]{20,}",
            r"hf_[A-Za-z0-9]{20,}",
            r"xai-[A-Za-z0-9]{20,}",
            r"nvapi-[A-Za-z0-9_-]{20,}",
            r"\bAIza[0-9A-Za-z_-]{35}\b",
            r"pplx-[A-Za-z0-9_-]{20,}",
            r"AKIA[0-9A-Z]{16}",
            r"SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}",
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----",
            r#"(?i)"api_key"\s*:\s*"[^"]+""#,
        ]
        .into_iter()
        .map(|pattern| regex::Regex::new(pattern).expect(pattern))
        .collect();
        ScrubRegexes {
            assignment,
            api_key_name,
            env_name,
            quoted_env_name,
            prefixed_key_name,
            bearer,
            patterns,
            mistral_context: regex::Regex::new(r"(?i)mistral|api\.mistral\.ai")
                .expect("mistral context"),
            mistral_key: regex::Regex::new(r"\b[A-Za-z0-9]{32}\b").expect("mistral key"),
        }
    })
}

/// `apiKey` / `api_key` match in any case. Unquoted `TOKEN`, `SECRET`,
/// `PASSWORD`, and a prefixed `_KEY` match only as uppercase env names.
/// A quoted name matches those words in any case. After a name that is not
/// a secret, scanning resumes just after its `=` or `:` so `api_key` inside
/// a URL is still found. `==` is not an assignment.
fn scrub_assignments(text: &str, scrubbers: &ScrubRegexes) -> String {
    let mut out = String::with_capacity(text.len());
    let mut copied = 0;
    let mut search_from = 0;
    while search_from < text.len() {
        let Some(caps) = scrubbers.assignment.captures_at(text, search_from) else {
            break;
        };
        let Some(whole) = caps.get(0) else {
            break;
        };
        let Some(name) = caps.name("name") else {
            break;
        };
        let Some(value) = caps.name("value") else {
            break;
        };
        let Some(sep) = caps.name("sep") else {
            break;
        };
        let quoted = caps
            .name("quote")
            .is_some_and(|quote| !quote.as_str().is_empty());
        let comparison = sep.as_str() == "=" && text.as_bytes().get(sep.end()) == Some(&b'=');
        let redact = !comparison
            && assignment_name_is_secret(name.as_str(), quoted, scrubbers)
            && assignment_value_is_secret(value.as_str(), name.as_str(), scrubbers);
        if redact {
            out.push_str(&text[copied..value.start()]);
            out.push_str("[redacted]");
            copied = value.end();
            search_from = value.end();
        } else {
            search_from = sep.end();
        }
        if search_from <= whole.start() {
            search_from = whole.start() + 1;
        }
    }
    out.push_str(&text[copied..]);
    out
}

fn assignment_name_is_secret(name: &str, quoted: bool, scrubbers: &ScrubRegexes) -> bool {
    if scrubbers.api_key_name.is_match(name) {
        return true;
    }
    if quoted {
        return scrubbers.quoted_env_name.is_match(name);
    }
    scrubbers.env_name.is_match(name) || scrubbers.prefixed_key_name.is_match(name)
}

/// Quoted values and unquoted uppercase `*PASSWORD` / `*SECRET` / `*TOKEN` /
/// `*API_KEY` values are secrets at 6 characters. Other unquoted values need 8.
/// A JWT is always a secret. `process.env` and the other env readers are always
/// code. An uppercase env name has no further code exemption. A lowercase or
/// camelCase name may be a call, an index, or a field read.
fn assignment_value_is_secret(raw: &str, name: &str, scrubbers: &ScrubRegexes) -> bool {
    let quoted = (raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2)
        || (raw.starts_with('\'') && raw.ends_with('\'') && raw.len() >= 2);
    let inner = if quoted { &raw[1..raw.len() - 1] } else { raw };
    let value = inner.trim_end_matches(['}', ']', ')', ',', ';']);
    if is_strict_jwt(value) {
        return true;
    }
    if !quoted && is_env_accessor(value) {
        return false;
    }
    if !quoted && !name_is_uppercase_env(name) && is_camel_case_code(value) {
        return false;
    }
    let mut chars = inner.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if matches!(first, '{' | '$' | '<' | '[') || inner.chars().any(char::is_whitespace) {
        return false;
    }
    let uppercase_api_key = scrubbers.api_key_name.is_match(name)
        && name.chars().all(|ch| ch.is_ascii_uppercase() || ch == '_');
    let short_ok = quoted || scrubbers.env_name.is_match(name) || uppercase_api_key;
    let min = if short_ok { 6 } else { 8 };
    inner.chars().count() >= min
}

/// Three base64url parts, the first starting with `eyJ`, each at least 10 characters.
fn is_strict_jwt(value: &str) -> bool {
    let mut parts = value.split('.');
    let Some(header) = parts.next() else {
        return false;
    };
    let Some(payload) = parts.next() else {
        return false;
    };
    let Some(signature) = parts.next() else {
        return false;
    };
    if parts.next().is_some() {
        return false;
    }
    header.starts_with("eyJ")
        && is_base64url(header)
        && is_base64url(payload)
        && is_base64url(signature)
}

fn is_base64url(part: &str) -> bool {
    part.len() >= 10
        && part
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '='))
}

fn is_env_accessor(value: &str) -> bool {
    value.starts_with("process.env.")
        || value.starts_with("import.meta.env.")
        || value.starts_with("os.environ")
        || value.starts_with("os.getenv")
}

fn name_is_uppercase_env(name: &str) -> bool {
    !name.is_empty() && name.chars().all(|ch| ch.is_ascii_uppercase() || ch == '_')
}

/// A call, an index, or two or more identifiers split on `.` or `?.`.
/// Each identifier has fewer than 3 digits, so `abc123.def456` stays a secret.
fn is_camel_case_code(value: &str) -> bool {
    if value.contains('(') || value.contains('[') {
        return true;
    }
    let parts = field_parts(value);
    parts.len() >= 2 && parts.iter().all(|part| is_field_ident(part))
}

fn field_parts(value: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let bytes = value.as_bytes();
    let mut start = 0;
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'?' && bytes.get(index + 1) == Some(&b'.') {
            parts.push(&value[start..index]);
            index += 2;
            start = index;
        } else if bytes[index] == b'.' {
            parts.push(&value[start..index]);
            index += 1;
            start = index;
        } else {
            index += 1;
        }
    }
    parts.push(&value[start..]);
    parts
}

fn is_field_ident(part: &str) -> bool {
    let mut chars = part.chars();
    match chars.next() {
        Some(ch) if ch.is_ascii_alphabetic() || ch == '_' => {}
        _ => return false,
    }
    let mut digits = 0;
    for ch in chars {
        if ch.is_ascii_digit() {
            digits += 1;
            if digits >= 3 {
                return false;
            }
        } else if !(ch.is_ascii_alphabetic() || ch == '_') {
            return false;
        }
    }
    true
}

/// `Bearer authentication` is a sentence. A token needs a digit or `. _ - / + =`.
fn scrub_bearer(text: &str, scrubbers: &ScrubRegexes) -> String {
    scrubbers
        .bearer
        .replace_all(text, |caps: &regex::Captures| {
            let token = caps
                .name("token")
                .map(|matched| matched.as_str())
                .unwrap_or("");
            if token
                .chars()
                .any(|ch| ch.is_ascii_digit() || matches!(ch, '.' | '_' | '-' | '/' | '+' | '='))
            {
                "[redacted]".to_string()
            } else {
                caps.get(0)
                    .map(|matched| matched.as_str().to_string())
                    .unwrap_or_default()
            }
        })
        .into_owned()
}

/// A bare Mistral key is 32 letters and digits with both cases, and only
/// when `mistral` is within 200 bytes. An MD5, a dashless UUID, and a
/// 40-hex SHA stay.
fn scrub_bare_mistral_keys(text: &str, scrubbers: &ScrubRegexes) -> String {
    let contexts: Vec<(usize, usize)> = scrubbers
        .mistral_context
        .find_iter(text)
        .map(|matched| (matched.start(), matched.end()))
        .collect();
    if contexts.is_empty() {
        return text.to_string();
    }
    let mut out = String::with_capacity(text.len());
    let mut last = 0;
    for matched in scrubbers.mistral_key.find_iter(text) {
        let token = matched.as_str();
        let mixed_case = token.chars().any(|ch| ch.is_ascii_uppercase())
            && token.chars().any(|ch| ch.is_ascii_lowercase());
        if !mixed_case {
            continue;
        }
        let near = contexts.iter().any(|&(start, end)| {
            let gap = if matched.end() < start {
                start - matched.end()
            } else if end < matched.start() {
                matched.start() - end
            } else {
                0
            };
            gap <= 200
        });
        if near {
            out.push_str(&text[last..matched.start()]);
            out.push_str("[redacted]");
            last = matched.end();
        }
    }
    out.push_str(&text[last..]);
    out
}

/// Saved provider keys, read through `ProviderKeys` (the OS keychain since
/// step 3a, plus any key still in the legacy file). The ids are the
/// free-tier catalog and the providers saved under Settings → AI.
fn saved_secret_values() -> Vec<String> {
    static CATALOG_IDS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
    let mut ids = CATALOG_IDS
        .get_or_init(|| {
            crate::rhizome_routing::Catalog::pinned()
                .providers
                .into_iter()
                .map(|provider| provider.id)
                .collect()
        })
        .clone();
    if let Ok(settings) = crate::settings::get_settings() {
        ids.extend(
            settings
                .ai_model_providers
                .unwrap_or_default()
                .into_iter()
                .map(|provider| provider.id),
        );
    }
    crate::provider_keys::cached_saved_key_values(ids)
}

fn scrub_event(event: &DurableEvent) -> DurableEvent {
    let scrub = SecretScrub::capture();
    match event.clone() {
        DurableEvent::User { text } => DurableEvent::User {
            text: scrub.apply(&text),
        },
        DurableEvent::Assistant { text } => DurableEvent::Assistant {
            text: scrub.apply(&text),
        },
        DurableEvent::ToolCall { id, name, args } => DurableEvent::ToolCall {
            id,
            name,
            args: scrub.apply(&args),
        },
        DurableEvent::ToolResult { id, name, output } => DurableEvent::ToolResult {
            id,
            name,
            output: cap_tool_result(scrub.apply(&output)),
        },
        DurableEvent::ToolDenied { id, name, reason } => DurableEvent::ToolDenied {
            id,
            name,
            reason: scrub.apply(&reason),
        },
        DurableEvent::ModelFailed { message } => DurableEvent::ModelFailed {
            message: scrub.apply(&message),
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
    fs4::FileExt::try_lock_exclusive(file).is_ok()
}

fn unlock_exclusive(file: &File) {
    let _ = fs4::FileExt::unlock(file);
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
            // A torn line must not hide a later line that still has the
            // next sequence number.
            _ => saw_damage = true,
        }
    }

    let mut warning = None;
    let mut successor_id = if unknown_version {
        None
    } else {
        read_successor_pointer(session_id).ok().flatten()
    };
    if saw_damage && !writer_is_live {
        warning = Some(DAMAGE_WARNING.into());
        if !unknown_version && successor_id.is_none() {
            if let Ok(id) = create_successor(&header, &events) {
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
    write_session_events(&successor_header, events)?;
    Ok(id)
}

/// Write a new native session log with these events. Used by fork and by
/// the damage-recovery successor path.
pub fn write_session_events(header: &SessionHeader, events: &[DurableEvent]) -> Result<(), String> {
    let mut writer = create_session_log(header)?;
    for event in events {
        writer.append(event)?;
    }
    drop(writer);
    Ok(())
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
        poisoned: false,
        stop_announced: false,
        #[cfg(test)]
        partial_write_limit: None,
        #[cfg(test)]
        repair_fault: 0,
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
        poisoned: false,
        stop_announced: false,
        #[cfg(test)]
        partial_write_limit: None,
        #[cfg(test)]
        repair_fault: 0,
        _lock: lock,
    })
}

struct WriteLineError {
    message: String,
    /// Truncate, rewind, or sync failed. The writer must not append again.
    poison: bool,
}

fn write_line(file: &mut File, line: &str) -> Result<(), String> {
    let good_len = file.metadata().ok().map(|meta| meta.len());
    write_line_from(file, line, good_len, None, 0).map_err(|error| error.message)
}

/// Writes one JSONL line. On any write error the file is truncated back to
/// `good_len` and that length is synced. A failed repair is returned so the
/// writer can stop; a later line must not be glued onto the torn bytes.
fn write_line_from(
    file: &mut File,
    line: &str,
    good_len: Option<u64>,
    partial_limit: Option<usize>,
    repair_fault: u8,
) -> Result<(), WriteLineError> {
    let outcome = write_payload(file, line, partial_limit);
    if let Err(write_error) = outcome {
        if let Some(good_len) = good_len {
            if let Err(repair) = repair_short_write(file, good_len, repair_fault) {
                return Err(WriteLineError {
                    message: format!("{write_error}; {repair}"),
                    poison: true,
                });
            }
        }
        return Err(WriteLineError {
            message: write_error,
            poison: false,
        });
    }
    Ok(())
}

/// Drops a short write and makes that shorter length durable.
fn repair_short_write(file: &mut File, good_len: u64, fault: u8) -> Result<(), String> {
    if fault == 1 {
        return Err("truncate native session log: simulated failure".into());
    }
    file.set_len(good_len)
        .map_err(|error| format!("truncate native session log: {error}"))?;
    if fault == 2 {
        return Err("rewind native session log: simulated failure".into());
    }
    file.seek(SeekFrom::Start(good_len))
        .map_err(|error| format!("rewind native session log: {error}"))?;
    if fault == 3 {
        return Err("sync native session log: simulated failure".into());
    }
    file.sync_all()
        .map_err(|error| format!("sync native session log: {error}"))
}

fn write_payload(file: &mut File, line: &str, partial_limit: Option<usize>) -> Result<(), String> {
    if let Some(limit) = partial_limit {
        let bytes = line.as_bytes();
        let count = limit.min(bytes.len());
        file.write_all(&bytes[..count])
            .map_err(|error| format!("flush native session line: {error}"))?;
        return Err("flush native session line: short write".into());
    }
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

    /// The next append writes `bytes` of the line, then fails and truncates.
    #[cfg(test)]
    pub fn fail_after_partial_write(&mut self, bytes: usize) {
        self.partial_write_limit = Some(bytes);
    }

    /// The next short-write repair fails at truncate (1), rewind (2), or sync (3).
    #[cfg(test)]
    pub fn fail_repair(&mut self, fault: u8) {
        self.repair_fault = fault;
    }

    pub fn append(&mut self, event: &DurableEvent) -> Result<(), AppendError> {
        if self.poisoned {
            return Err(AppendError::Io(
                "native session log writer is unusable after a failed repair".into(),
            ));
        }
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
        #[cfg(test)]
        let partial = self.partial_write_limit.take();
        #[cfg(not(test))]
        let partial = None;
        #[cfg(test)]
        let fault = std::mem::take(&mut self.repair_fault);
        #[cfg(not(test))]
        let fault = 0;
        if let Err(error) =
            write_line_from(&mut self.file, &encoded, Some(self.len), partial, fault)
        {
            if error.poison {
                self.poisoned = true;
            }
            return Err(AppendError::Io(error.message));
        }
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
        Err(AppendError::Io(detail)) => {
            if writer.poisoned {
                if writer.stop_announced {
                    return Ok(None);
                }
                writer.stop_announced = true;
                log::warn!("Native session log saving stopped: {detail}");
                return Err(LOG_SAVE_STOPPED.to_string());
            }
            log::warn!("Native session log save failed: {detail}");
            Err(LOG_SAVE_NOTICE.to_string())
        }
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

    /// 32 alphanumeric characters, split in source so push protection does
    /// not treat the fixture as a live Mistral key.
    fn bare_mistral_sample() -> String {
        let key = format!("{}{}", "AbcdEf0123456789", "ZyXwVu9876543210");
        assert_eq!(key.len(), 32);
        key
    }

    fn sample_aiza() -> String {
        // Built in pieces so the source has no contiguous Google key.
        let body = format!("{}{}", "SyABCDEFGHIJKLMNOP", "QRSTUVWXYZ1234567");
        let key = format!("AIza{body}");
        assert_eq!(key.len(), 39);
        key
    }

    #[test]
    fn scrub_secrets_redacts_env_assignments_and_provider_prefixes() {
        let mistral = bare_mistral_sample();
        let aiza = sample_aiza();
        let mistral_assigned = format!("MISTRAL_API_KEY={mistral}");
        let mistral_bare = format!("mistral key {mistral}");
        let gemini_assigned = format!("GEMINI_API_KEY={aiza}");
        let cases = [
            (
                "NVIDIA_API_KEY=nvapi-abcdefghijklmnopqrstuvwxyz012345",
                "nvapi-abcdefghijklmnopqrstuvwxyz012345",
            ),
            (gemini_assigned.as_str(), aiza.as_str()),
            (aiza.as_str(), aiza.as_str()),
            (
                "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz",
                "sk-proj-abcdefghijklmnopqrstuvwxyz",
            ),
            (mistral_assigned.as_str(), mistral.as_str()),
            (mistral_bare.as_str(), mistral.as_str()),
            (
                "export HF_TOKEN=hf_abcdefghijklmnopqrstuvwxyz",
                "hf_abcdefghijklmnopqrstuvwxyz",
            ),
            (
                "pplx-abcd_efgh-ijklmnopqrstuvwx",
                "pplx-abcd_efgh-ijklmnopqrstuvwx",
            ),
        ];
        for (input, secret) in cases {
            let scrubbed = scrub_secrets(input);
            assert!(!scrubbed.contains(secret), "secret must be removed");
            assert!(scrubbed.contains("[redacted]"), "redaction marker missing");
        }
    }

    #[test]
    fn scrub_secrets_redacts_api_key_assignment() {
        assert_redacted("API_KEY=supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_exported_api_key_assignment() {
        assert_redacted("export API_KEY=supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_mixed_case_api_key_assignment() {
        assert_redacted("Api_Key=supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_token_assignment() {
        assert_redacted("TOKEN=supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_secret_assignment() {
        assert_redacted("SECRET=supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_secret_key_base_assignment() {
        assert_redacted("SECRET_KEY_BASE=supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_openai_key_assignment() {
        assert_redacted("OPENAI_KEY=supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_db_password_assignment() {
        assert_redacted("DB_PASSWORD=supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_yaml_api_key() {
        assert_redacted("X_API_KEY: supersecret", "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_json_api_key() {
        assert_redacted(r#""X_API_KEY": "supersecret""#, "supersecret");
    }

    #[test]
    fn scrub_secrets_redacts_camel_case_api_key() {
        assert_redacted(r#"apiKey: "hunter2""#, "hunter2");
    }

    #[test]
    fn scrub_secrets_redacts_quoted_password() {
        assert_redacted(r#""password": "hunter2""#, "hunter2");
    }

    #[test]
    fn scrub_secrets_redacts_quoted_password_in_single_quotes() {
        assert_redacted("'password': 'hunter2'", "hunter2");
    }

    #[test]
    fn scrub_secrets_redacts_quoted_token() {
        assert_redacted(r#""token": "hunter2""#, "hunter2");
    }

    #[test]
    fn scrub_secrets_redacts_quoted_secret() {
        assert_redacted(r#""secret": "hunter2""#, "hunter2");
    }

    #[test]
    fn scrub_secrets_redacts_quoted_client_secret() {
        assert_redacted(r#""client_secret": "hunter2""#, "hunter2");
    }

    #[test]
    fn scrub_secrets_redacts_exported_github_token() {
        let value = format!("{}{}", "abcd", "efghij");
        assert_redacted(&format!("export GITHUB_TOKEN={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_aws_secret_access_key() {
        let value = format!("{}{}", "abcd", "efghij");
        assert_redacted(&format!("AWS_SECRET_ACCESS_KEY={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_a_bearer_token() {
        let token = format!("{}{}", "abcd", "12xy");
        assert_eq!(token.len(), 8);
        assert_redacted(&format!("Authorization: Bearer {token}"), &token);
    }

    #[test]
    fn scrub_secrets_redacts_bearer_tokens_with_marks() {
        for mark in ['.', '_', '-', '/', '+', '='] {
            let token = format!("abcd{mark}wxy");
            assert_eq!(token.len(), 8);
            assert_redacted(&format!("Authorization: Bearer {token}"), &token);
        }
    }

    #[test]
    fn scrub_secrets_leaves_bearer_authentication_prose() {
        assert_unchanged("uses Bearer authentication");
    }

    #[test]
    fn scrub_secrets_redacts_a_slack_bot_token() {
        let token = format!("xoxb-{}", "ab".repeat(10));
        assert_redacted(&token, &token);
    }

    #[test]
    fn scrub_secrets_redacts_an_aws_access_key_id() {
        let key = format!("AKIA{}{}", "ABCD1234", "WXYZ5678");
        assert_eq!(key.len(), 20);
        assert_redacted(&format!("id {key}"), &key);
    }

    #[test]
    fn scrub_secrets_redacts_a_pem_block() {
        let pem = format!(
            "{}{}\n{}\n{}{}",
            "-----BEGIN ", "PRIVATE KEY-----", "abcd", "-----END ", "PRIVATE KEY-----",
        );
        assert_redacted(&pem, "abcd");
    }

    #[test]
    fn scrub_secrets_redacts_api_key_inside_a_url() {
        let value = format!("{}{}", "super", "secret");
        assert_redacted(&format!("curl https://x.test/?api_key={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_api_key_inside_a_url_assignment() {
        let value = format!("{}{}", "super", "secret");
        assert_redacted(&format!("url=https://x.test/?API_KEY={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_api_key_after_another_assignment() {
        let value = format!("{}{}", "super", "secret");
        assert_redacted(&format!("X=1;API_KEY={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_a_short_db_password() {
        assert_redacted("DB_PASSWORD=hunter2", "hunter2");
    }

    #[test]
    fn scrub_secrets_redacts_a_lowercase_api_key_suffix() {
        let value = format!("{}{}", "super", "secret");
        assert_redacted(&format!("api_key_prod={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_an_uppercase_api_key_suffix() {
        let value = format!("{}{}", "super", "secret");
        assert_redacted(&format!("API_KEY_PROD={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_a_jwt_after_api_key() {
        let header = format!("eyJ{}", "aaaaaaa");
        let jwt = format!("{header}.{}.{}", "bbbbbbbbbb", "cccccccccc");
        assert!(header.len() >= 10);
        assert_redacted(&format!("apiKey: {jwt}"), &jwt);
    }

    #[test]
    fn scrub_secrets_redacts_a_vault_token() {
        let value = format!("hvs.{}{}", "CAESI", "abc123XYZdefGHI456");
        assert_redacted(&format!("VAULT_TOKEN={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_a_sendgrid_key() {
        let key = format!("SG.{}.{}", "abcdefghijABCDEF", "klmnopqrstUVWXYZ");
        assert_redacted(&key, &key);
    }

    #[test]
    fn scrub_secrets_redacts_a_dotted_lowercase_api_key() {
        let value = format!("{}.{}", "abc123", "def456ghi789");
        assert_redacted(&format!("api_key={value}"), &value);
    }

    #[test]
    fn scrub_secrets_redacts_an_uppercase_api_key_call() {
        let value = format!("abc({}{})xyz", "12", "3");
        assert_redacted(&format!("API_KEY={value}"), &value);
    }

    #[test]
    fn scrub_secrets_leaves_an_api_key_read_from_process_env() {
        assert_unchanged("apiKey: process.env.OPENAI_API_KEY");
    }

    #[test]
    fn scrub_secrets_leaves_an_api_key_field_read() {
        assert_unchanged("{ apiKey: settings.apiKey }");
    }

    #[test]
    fn scrub_secrets_leaves_a_longer_api_key_field_chain() {
        assert_unchanged("apiKey: config.auth.apiKey");
    }

    #[test]
    fn scrub_secrets_leaves_a_this_config_field_read() {
        assert_unchanged("apiKey: this.config.key");
    }

    #[test]
    fn scrub_secrets_leaves_an_optional_api_key_field_read() {
        assert_unchanged("apiKey: settings?.apiKey");
    }

    #[test]
    fn scrub_secrets_leaves_an_import_meta_env_read() {
        assert_unchanged("apiKey: import.meta.env.X");
    }

    #[test]
    fn scrub_secrets_leaves_an_os_getenv_call() {
        assert_unchanged(r#"apiKey: os.getenv("X")"#);
    }

    #[test]
    fn scrub_secrets_leaves_an_api_key_function_call() {
        assert_unchanged("const apiKey = getKey()");
    }

    #[test]
    fn scrub_secrets_leaves_an_api_key_read_from_os_environ() {
        assert_unchanged(r#"api_key=os.environ["OPENAI_API_KEY"]"#);
    }

    #[test]
    fn scrub_secrets_leaves_a_quoted_secret_phrase() {
        assert_unchanged(r#""secret": "sauce recipe""#);
    }

    #[test]
    fn scrub_secrets_leaves_an_empty_quoted_password() {
        assert_unchanged(r#""password": """#);
    }

    #[test]
    fn scrub_secrets_leaves_an_api_key_label() {
        assert_unchanged(r#""apiKeyLabel": "Enter key""#);
    }

    #[test]
    fn scrub_secrets_leaves_max_tokens() {
        assert_unchanged("max_tokens: 512");
    }

    #[test]
    fn scrub_secrets_leaves_an_equality() {
        assert_unchanged("a == b");
    }

    #[test]
    fn scrub_secrets_leaves_a_bare_key_assignment() {
        assert_unchanged("KEY=1");
    }

    #[test]
    fn scrub_secrets_leaves_password_field() {
        assert_unchanged("passwordField: input");
    }

    #[test]
    fn scrub_secrets_leaves_an_object_key() {
        assert_unchanged("{ key: item.id }");
    }

    #[test]
    fn scrub_secrets_leaves_a_jsx_key() {
        assert_unchanged("<Row key={item.id} />");
    }

    #[test]
    fn scrub_secrets_leaves_a_json_key_field() {
        assert_unchanged(r#""key": "en.greeting""#);
    }

    #[test]
    fn scrub_secrets_leaves_a_type_token_field() {
        assert_unchanged("type User = { token: string }");
    }

    #[test]
    fn scrub_secrets_leaves_primary_key() {
        assert_unchanged("primary_key: id");
    }

    #[test]
    fn scrub_secrets_leaves_max_token() {
        assert_unchanged("max_token: 5");
    }

    #[test]
    fn scrub_secrets_leaves_sort_key() {
        assert_unchanged("SORT_KEY=name");
    }

    #[test]
    fn scrub_secrets_leaves_token_count() {
        assert_unchanged("token_count=12");
    }

    #[test]
    fn scrub_secrets_leaves_prose_about_a_token() {
        assert_unchanged("the token: is");
    }

    #[test]
    fn scrub_secrets_leaves_prose_about_a_secret() {
        assert_unchanged("secret: we should");
    }

    #[test]
    fn scrub_secrets_leaves_prose_about_a_key() {
        assert_unchanged("Key: the thing");
    }

    #[test]
    fn scrub_secrets_leaves_a_url_query_key() {
        assert_unchanged("https://example.test/search?key=ordinary-value");
    }

    #[test]
    fn scrub_secrets_leaves_a_command_substitution() {
        assert_unchanged("SECRET_KEY_BASE=$(rails secret)");
    }

    #[test]
    fn scrub_secrets_leaves_an_equality_comparison() {
        assert_unchanged("if MY_TOKEN == other");
    }

    #[test]
    fn scrub_secrets_leaves_bearer_of_bad_news() {
        assert_unchanged("bearer of bad news");
    }

    #[test]
    fn scrub_secrets_redacts_aiza_after_a_boundary_only() {
        let key = sample_aiza();
        assert_redacted(&format!("?key={key}"), &key);
        let glued = format!("thin{key}");
        assert_eq!(scrub_secrets(&glued), glued);
    }

    #[test]
    fn scrub_secrets_leaves_mistral_model_names_md5_and_shas() {
        assert_eq!(scrub_secrets("mistral-large-2411"), "mistral-large-2411");
        let md5 = format!("{}{}", "d41d8cd98f00b204", "e9800998ecf8427e");
        let near_md5 = format!("mistral commit {md5}");
        assert_eq!(scrub_secrets(&near_md5), near_md5);
        let sha = "0123456789abcdef0123456789abcdef01234567";
        assert_eq!(sha.len(), 40);
        let near_sha = format!("mistral {sha}");
        assert_eq!(scrub_secrets(&near_sha), near_sha);
    }

    fn assert_redacted(input: &str, secret: &str) {
        let scrubbed = scrub_secrets(input);
        assert!(!scrubbed.contains(secret), "secret must be removed");
        assert!(scrubbed.contains("[redacted]"), "redaction marker missing");
    }

    fn assert_unchanged(input: &str) {
        assert_eq!(scrub_secrets(input), input);
    }

    #[test]
    fn scrub_secrets_keeps_ordinary_text_and_redacts_dotenv_output() {
        let mistral = bare_mistral_sample();
        let checksum = format!("checksum {mistral} stays");
        let ordinary = [
            "The garden needs water before noon.",
            "use hf_hub_download to fetch the file",
            "Set the token in the settings screen.",
            "the secret sauce is a recipe",
            "OPENAI_API_KEY is the variable name",
            "The word AIza appears in a short note.",
            "PATH=/usr/bin",
            checksum.as_str(),
        ];
        for text in ordinary {
            assert_eq!(scrub_secrets(text), text, "{text}");
        }
        let far = format!("mistral\n{}\n{mistral}", "x".repeat(400));
        let far_scrubbed = scrub_secrets(&far);
        assert!(
            far_scrubbed.contains(&mistral),
            "a bare key far from the word mistral must stay"
        );

        let aiza = sample_aiza();
        let dotenv = format!(
            "# local secrets\nOPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz\nNVIDIA_API_KEY=nvapi-abcdefghijklmnopqrstuvwxyz012345\nGEMINI_API_KEY=\"{aiza}\"\nMISTRAL_API_KEY={mistral}\nPATH=/usr/bin\n"
        );
        let scrubbed = scrub_secrets(&dotenv);
        assert!(scrubbed.contains("PATH=/usr/bin"));
        assert!(scrubbed.contains("# local secrets"));
        assert!(!scrubbed.contains("sk-proj-abcdefghijklmnopqrstuvwxyz"));
        assert!(!scrubbed.contains("nvapi-abcdefghijklmnopqrstuvwxyz012345"));
        assert!(!scrubbed.contains(&aiza));
        assert!(!scrubbed.contains(&mistral));
    }

    #[test]
    fn scrub_secrets_leaves_code_names_and_redacts_long_tokens() {
        let code = scrub_secrets("use hf_hub_download to fetch the file");
        assert!(
            code.contains("hf_hub_download"),
            "a function name must stay"
        );
        let hf_key = format!("hf_{}", "Ab12".repeat(8));
        let xai_key = format!("xai-{}", "Cd34".repeat(8));
        let scrubbed = scrub_secrets(&format!("keys {hf_key} and {xai_key}"));
        assert!(!scrubbed.contains(&hf_key));
        assert!(!scrubbed.contains(&xai_key));
        assert!(scrubbed.contains("[redacted]"));
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

        assert!(!scrubbed.contains("keychain-catalog-key-value"));
        assert!(scrubbed.contains("[redacted]"));
    }

    #[test]
    fn scrub_secrets_redacts_a_keychain_key_for_a_saved_provider() {
        let _home = temp_home();
        let provider: crate::ai_models::AiModelProvider =
            serde_json::from_value(serde_json::json!({
                "id": "open_ai_compatible-scrubtest",
                "name": "Scrub test",
                "kind": "open_ai_compatible",
                "base_url": "https://hosted.test/v1",
                "api_key_storage": "local_file",
                "models": [{
                    "id": "m",
                    "capabilities": {
                        "streaming": true, "tools": true, "vision": false,
                        "json_mode": false, "reasoning": false
                    }
                }],
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

        assert!(!scrubbed.contains("keychain-custom-key-value"));
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
    fn reopen_follows_the_successor_after_a_size_rollover() {
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
        writer.force_len(SESSION_SIZE_CAP);
        let kept = DurableEvent::User {
            text: "after the cap".into(),
        };
        append_or_roll(&mut writer, &kept).unwrap();
        let successor = writer.session_id().to_string();
        drop(writer);
        let reopened = open_session_log(&id).unwrap();
        assert_eq!(
            reopened.successor_id.as_deref(),
            Some(successor.as_str()),
            "a full log must reopen on its successor"
        );
        let continued = open_session_log(&successor).unwrap();
        assert!(continued
            .events
            .iter()
            .any(|event| matches!(event, DurableEvent::User { text } if text == "after the cap")));
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
        .expect_err("log-save notice");
        assert_eq!(error, LOG_SAVE_NOTICE);
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
    fn a_partial_write_is_truncated_so_later_events_reopen() {
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
        append_or_roll(
            &mut writer,
            &DurableEvent::User {
                text: "first".into(),
            },
        )
        .unwrap();
        let good_len = std::fs::metadata(writer.path()).unwrap().len();
        writer.fail_after_partial_write(8);
        let error = append_or_roll(
            &mut writer,
            &DurableEvent::User {
                text: "torn-secret".into(),
            },
        )
        .expect_err("short write");
        assert_eq!(error, LOG_SAVE_NOTICE);
        assert_eq!(
            std::fs::metadata(writer.path()).unwrap().len(),
            good_len,
            "a short write must be truncated back to the last good line"
        );
        let bytes = std::fs::read(writer.path()).unwrap();
        assert!(
            !bytes.windows(8).any(|window| window == b"torn-sec"),
            "the torn text must not remain in the log"
        );
        append_or_roll(
            &mut writer,
            &DurableEvent::User {
                text: "second".into(),
            },
        )
        .unwrap();
        drop(writer);

        let opened = open_session_log(&id).unwrap();
        let texts: Vec<_> = opened
            .events
            .iter()
            .filter_map(|event| match event {
                DurableEvent::User { text } => Some(text.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(texts, ["first", "second"]);
        assert_eq!(opened.warning, None);
    }

    #[test]
    fn a_failed_truncate_poisons_the_writer() {
        let _home = temp_home();
        let (id, mut writer) = open_test_writer();
        append_or_roll(&mut writer, &user_event("a")).unwrap();
        writer.fail_after_partial_write(1);
        writer.fail_repair(1);
        let first = append_or_roll(&mut writer, &user_event("torn")).expect_err("short write");
        assert_eq!(first, LOG_SAVE_STOPPED);
        assert_eq!(
            append_or_roll(&mut writer, &user_event("after")).unwrap(),
            None,
            "a poisoned writer announces the stop once"
        );
        let bytes = std::fs::read(writer.path()).unwrap();
        assert!(
            !bytes.windows(5).any(|window| window == b"after"),
            "a poisoned writer must not append the next event"
        );
        drop(writer);
        assert_eq!(user_texts(&id), ["a"]);
    }

    #[test]
    fn a_failed_rewind_poisons_the_writer() {
        let _home = temp_home();
        let (id, mut writer) = open_test_writer();
        append_or_roll(&mut writer, &user_event("a")).unwrap();
        let good_len = std::fs::metadata(writer.path()).unwrap().len();
        writer.fail_after_partial_write(1);
        writer.fail_repair(2);
        assert_eq!(
            append_or_roll(&mut writer, &user_event("torn")).unwrap_err(),
            LOG_SAVE_STOPPED
        );
        assert_eq!(
            std::fs::metadata(writer.path()).unwrap().len(),
            good_len,
            "truncate already succeeded"
        );
        assert_eq!(
            append_or_roll(&mut writer, &user_event("after")).unwrap(),
            None
        );
        assert_eq!(
            std::fs::metadata(writer.path()).unwrap().len(),
            good_len,
            "a failed rewind must not leave a hole for the next write"
        );
        drop(writer);
        assert_eq!(user_texts(&id), ["a"]);
    }

    #[test]
    fn a_failed_sync_after_truncate_poisons_the_writer() {
        let _home = temp_home();
        let (id, mut writer) = open_test_writer();
        append_or_roll(&mut writer, &user_event("a")).unwrap();
        writer.fail_after_partial_write(1);
        writer.fail_repair(3);
        assert_eq!(
            append_or_roll(&mut writer, &user_event("torn")).unwrap_err(),
            LOG_SAVE_STOPPED
        );
        assert_eq!(
            append_or_roll(&mut writer, &user_event("after")).unwrap(),
            None
        );
        drop(writer);
        assert_eq!(user_texts(&id), ["a"]);
    }

    #[test]
    fn a_truncated_prefix_is_what_a_reopen_reads() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session.jsonl");
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&path)
            .unwrap();
        file.write_all(b"good\nTORN").unwrap();
        repair_short_write(&mut file, 5, 0).unwrap();
        drop(file);
        assert_eq!(std::fs::read(&path).unwrap(), b"good\n");
    }

    fn open_test_writer() -> (String, NativeSessionWriter) {
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
        (id, create_session_log(&header).unwrap())
    }

    fn user_event(text: &str) -> DurableEvent {
        DurableEvent::User {
            text: text.to_string(),
        }
    }

    fn user_texts(id: &str) -> Vec<String> {
        open_session_log(id)
            .unwrap()
            .events
            .iter()
            .filter_map(|event| match event {
                DurableEvent::User { text } => Some(text.clone()),
                _ => None,
            })
            .collect()
    }

    #[test]
    fn a_torn_line_does_not_hide_a_later_good_line() {
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
        let path = write_fixture(
            &header,
            &[
                DurableEvent::User {
                    text: "before".into(),
                },
                DurableEvent::User {
                    text: "after".into(),
                },
            ],
            &[],
        )
        .unwrap();
        let raw = std::fs::read_to_string(&path).unwrap();
        let mut lines: Vec<&str> = raw.lines().collect();
        assert!(lines.len() >= 3, "header plus two events: {raw}");
        lines.insert(2, "{\"seq\":2,\"checksum\":\"dead\",\"event\":");
        std::fs::write(&path, format!("{}\n", lines.join("\n"))).unwrap();

        let opened = open_session_log(&id).unwrap();
        let texts: Vec<_> = opened
            .events
            .iter()
            .filter_map(|event| match event {
                DurableEvent::User { text } => Some(text.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(texts, ["before", "after"]);
        assert!(opened.warning.is_some());
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
