//! Client of the Prime Agent daemon.
//!
//! Rhizome connects to Prime's background service over its unix socket and
//! attaches to one session. It does **not** own Prime: closing the connection
//! detaches, and the session keeps running inside the daemon (ADR-0163).
//!
//! Wire format is LF-delimited JSONL, strict `\n` framing — never Unicode line
//! separators. Commands go out inside a protocol envelope; the daemon answers
//! with `response` lines correlated by id, and pushes agent activity as
//! `session_event` wrappers whose inner `event` object is the same shape RPC
//! mode emitted. That is why `prime_events` needed no change: the reader
//! unwraps one layer and everything downstream sees what it always saw.
//!
//! Every session-scoped command carries `activeSessionId`, the daemon's handle
//! for the attached session. It is stable across `new_session` (which mints a
//! fresh Prime `sessionId` behind the same handle), so the handle and the
//! session id are deliberately two different fields here.

use crate::ai_agents::{AiAgentAvailability, AiAgentStreamEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

const DAEMON_RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);
const DAEMON_HELLO_TIMEOUT: Duration = Duration::from_secs(10);
const TURN_IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// Protocol Rhizome speaks. Verified against `prime-agent` 0.7.1, whose
/// `DAEMON_PROTOCOL_VERSION` is 7 — the first version accepting the command
/// envelope (`DAEMON_COMMAND_ENVELOPE_MIN_PROTOCOL_VERSION`).
const DAEMON_PROTOCOL_NAME: &str = "prime-agent.daemon";
const DAEMON_PROTOCOL_VERSION: u64 = 7;

/// What this client can handle. `slim_attach` keeps the attach reply small by
/// omitting the duplicated top-level `state`/`messages` — the snapshot carries
/// both. We deliberately do **not** claim `extension_ui`: Rhizome has no UI for
/// an extension's prompts, and not claiming it means the daemon never routes
/// one here to hang the turn.
const DAEMON_CLIENT_CAPABILITIES: [&str; 3] = ["attach_snapshot", "event_sequence", "slim_attach"];

/// The oldest `prime-agent` Rhizome can talk to.
///
/// Named separately from the protocol version because a version number is what
/// a user can act on — "update to 0.7.1" is a instruction, "protocol 7" is not.
/// 0.7.1 is the build that ships daemon protocol 7, verified against it.
pub const MINIMUM_PRIME_VERSION: &str = "0.7.1";

/// Why Rhizome cannot reach Prime.
///
/// A typed state rather than a message, because each case has a *different*
/// action behind it: install the CLI, start the service, or update it. ADR-0163
/// requires these be visible and actionable rather than a spinner — a client of
/// a service it does not own has failure modes owning a child process did not.
///
/// There is deliberately no "fell back to RPC mode" case. A silent fallback
/// would make "close the app, work continues" quietly untrue with no
/// explanation, so the RPC transport was removed rather than kept as a spare.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum PrimeConnectionProblem {
    /// No `prime-agent` binary on this machine.
    NotInstalled,
    /// The binary is installed, but its background service is not answering.
    ServiceUnreachable { detail: String },
    /// The service answered, but speaks a protocol older than this client.
    ServiceTooOld {
        /// What the daemon reports it is, when it says.
        #[serde(skip_serializing_if = "Option::is_none")]
        installed_version: Option<String>,
        required_version: String,
    },
}

/// The last reason a connection attempt failed, cleared when one succeeds.
///
/// Remembered rather than recomputed because the version case can only be
/// learned from a handshake, and re-handshaking on every status poll would open
/// a socket every few seconds to answer a question whose answer changes only
/// when the daemon restarts.
fn last_problem() -> &'static Mutex<Option<PrimeConnectionProblem>> {
    static PROBLEM: OnceLock<Mutex<Option<PrimeConnectionProblem>>> = OnceLock::new();
    PROBLEM.get_or_init(|| Mutex::new(None))
}

fn record_problem(problem: Option<PrimeConnectionProblem>) {
    if let Ok(mut slot) = last_problem().lock() {
        *slot = problem;
    }
}

fn current_problem() -> Option<PrimeConnectionProblem> {
    last_problem().lock().ok().and_then(|slot| slot.clone())
}

/// Points the client at a different daemon socket.
///
/// This is the transport's only injection point, and it is what the tests
/// drive a fake daemon through.
const DAEMON_SOCKET_ENV: &str = "RHIZOME_PRIME_DAEMON_SOCKET";

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

/// The socket type per platform.
///
/// Prime listens on a unix socket everywhere except Windows, where it uses a
/// named pipe this client does not speak yet. Aliasing the type keeps the
/// `cfg` to the one function that actually connects, rather than smearing it
/// across every method that touches a stream.
#[cfg(unix)]
type DaemonStream = std::os::unix::net::UnixStream;
#[cfg(not(unix))]
type DaemonStream = std::net::TcpStream;

// ── Public types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimePromptRequest {
    pub message: String,
    pub system_prompt: Option<String>,
    pub vault_path: String,
    #[serde(default)]
    pub event_name: Option<String>,
    /// Optional provider override (`anthropic`, `openai`, `xai`, …).
    #[serde(default)]
    pub provider: Option<String>,
    /// Optional model id override.
    #[serde(default)]
    pub model_id: Option<String>,
    /// When true, call `new_session` before this prompt.
    #[serde(default)]
    pub new_session: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeHostStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub running: bool,
    pub session_id: Option<String>,
    pub is_streaming: bool,
    pub binary_path: Option<String>,
    /// Provider id from Prime get_state model, when known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_provider: Option<String>,
    /// Model id from Prime get_state, when known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    /// Display name from Prime get_state model, when known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_name: Option<String>,
    /// Reasoning level the session is running at, when the daemon reports one.
    /// Read from the same state payload as the model so the strip's one
    /// control has one source (#9), rather than polling two commands that can
    /// disagree mid-change.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking_level: Option<String>,
    /// True when this connection rejoined a session that was already running.
    pub reattached: bool,
    /// When the attached session started, ISO-8601. The UI derives uptime from
    /// it, so "working" can be told apart from "stuck".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    /// The attached session's log file. Rehydrating on reattach reads this
    /// rather than matching an id against a disk scan, so the transcript shown
    /// is always the session actually attached.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_path: Option<String>,
    /// Why Prime is unreachable, when it is. `None` while connected.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub problem: Option<PrimeConnectionProblem>,
}

/// Token / cost / context-window snapshot for the live Prime session.
///
/// Every field is optional on purpose: Prime omits them on a fresh session,
/// and a missing value must stay unknown rather than collapsing to zero. "0%
/// of context used" and "we don't know yet" are different claims and the UI
/// must not render the second as the first.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeSessionStats {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_messages: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u64>,
    /// Percent of the context window in use (0-100).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost: Option<f64>,
}

impl PrimeSessionStats {
    fn from_state_data(data: &serde_json::Value) -> Self {
        let usage = &data["contextUsage"];
        Self {
            session_id: crate::prime_events::session_id_from_state(data).map(str::to_string),
            total_messages: data["totalMessages"].as_u64(),
            tool_calls: data["toolCalls"].as_u64(),
            total_tokens: data["tokens"]["total"].as_u64(),
            context_tokens: usage["tokens"].as_u64(),
            context_window: usage["contextWindow"].as_u64(),
            context_percent: usage["percent"].as_f64(),
            cost: data["cost"].as_f64(),
        }
    }
}

/// One message from Prime's conversation history.
///
/// `content` is passed through as raw JSON rather than modelled here. Prime
/// discriminates content blocks by `type` — `text`, plus tool and thinking
/// shapes — and a Rust-side enum would silently drop any block kind it did not
/// anticipate. That is exactly the data a rehydrated transcript needs most, so
/// the parse is deliberately lossless. The frontend already understands
/// Prime's block shapes from the streaming path (`prime_events`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeMessage {
    pub role: String,
    /// Verbatim `content` as Prime sent it. Never reshaped.
    pub content: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<u64>,
    /// Concatenated `text` blocks, for callers that only want the prose.
    /// A convenience over `content`, never a replacement for it.
    pub text: String,
}

impl PrimeMessage {
    /// Parse one message object. Shared with `prime_sessions`, which finds the
    /// identical shape nested inside each `message` line of the on-disk log —
    /// so a live transcript and a replayed one are the same type.
    pub(crate) fn from_value(value: &serde_json::Value) -> Self {
        let content = value
            .get("content")
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        let role = value["role"].as_str().unwrap_or_default().to_string();
        let text = text_from_content(&content);
        // A user turn is stored as Rhizome composed it: the message with a
        // system-instruction block in front. Showing that back is showing the
        // user words they never wrote (C26), so the prose field carries what
        // they actually typed. `content` stays verbatim — the composition is
        // real, and this is a display concern, not a reason to rewrite history.
        let text = if role == "user" {
            crate::cli_agent_runtime::user_request_from_prompt(&text)
                .map(str::to_string)
                .unwrap_or(text)
        } else {
            text
        };
        Self {
            role,
            text,
            timestamp: value["timestamp"].as_u64(),
            content,
        }
    }
}

/// Flatten the `text` blocks of a content payload.
///
/// Accepts a bare string as well as a block array: Prime's own message shape is
/// an array, but a plain string is the obvious degenerate form and treating it
/// as "no text" would be a silent data loss for one character of tolerance.
fn text_from_content(content: &serde_json::Value) -> String {
    if let Some(text) = content.as_str() {
        return text.to_string();
    }
    let Some(blocks) = content.as_array() else {
        return String::new();
    };
    blocks
        .iter()
        .filter(|block| block["type"].as_str() == Some("text"))
        .filter_map(|block| block["text"].as_str())
        .collect::<Vec<_>>()
        .join("")
}

fn messages_from_response(data: &serde_json::Value) -> Vec<PrimeMessage> {
    data["messages"]
        .as_array()
        .map(|messages| messages.iter().map(PrimeMessage::from_value).collect())
        .unwrap_or_default()
}

// ── Process-wide host registry ──────────────────────────────────────────────

struct HostSlot {
    host: Mutex<Option<PrimeHost>>,
}

fn host_slot() -> &'static HostSlot {
    static SLOT: OnceLock<HostSlot> = OnceLock::new();
    SLOT.get_or_init(|| HostSlot {
        host: Mutex::new(None),
    })
}

// ── Outbound / inbound framing ──────────────────────────────────────────────

#[derive(Debug)]
enum OutboundLine {
    Event(serde_json::Value),
    /// Reader thread exited (EOF or IO error).
    Closed(Option<String>),
}

struct PendingResponse {
    tx: Sender<serde_json::Value>,
}

struct PrimeHost {
    /// Write half of the daemon connection. The reader thread holds a clone.
    stream: DaemonStream,
    /// Correlates command `id` → oneshot response channel.
    pending: Arc<Mutex<HashMap<String, PendingResponse>>>,
    /// Fan-out of non-response lines (agent events).
    /// Kept so the sender side of the channel outlives the reader thread join.
    #[allow(dead_code)]
    event_tx: Sender<OutboundLine>,
    event_rx: Arc<Mutex<Receiver<OutboundLine>>>,
    /// Cleared by the reader on EOF, socket error, or `daemon_closing`. There
    /// is no child process to `try_wait` any more, so liveness is something the
    /// connection tells us rather than something we can ask the OS.
    connected: Arc<AtomicBool>,
    /// The daemon's handle for the attached session. Every session-scoped
    /// command carries it. Stable across `new_session`.
    active_session_id: String,
    /// Prime's own session id, from `get_state`. Changes on `new_session`.
    session_id: Option<String>,
    /// True when this connection rejoined work that was already running,
    /// rather than starting something new.
    reattached: bool,
    /// When the attached session was created, ISO-8601 from Prime. Uptime is
    /// derived in the UI so a long-running session can be told from a stuck
    /// one without this having to tick.
    started_at: Option<String>,
    /// The attached session's log file, from `get_state`.
    session_path: Option<String>,
    model_provider: Option<String>,
    model_id: Option<String>,
    model_name: Option<String>,
    thinking_level: Option<String>,
    socket_path: PathBuf,
    cwd: PathBuf,
    is_streaming: bool,
}

// ── Socket discovery ────────────────────────────────────────────────────────

/// Where Prime's daemon listens.
///
/// Prime computes this as `<tmpdir>/prime-agent-<uid>/daemon.sock`
/// (`defaultDaemonSocketPath`, read from the installed 0.7.1 build). Checked in
/// order: the env override, then that default, then whatever `prime-agent
/// status` reports — the last covers a daemon deliberately started elsewhere,
/// and costs a subprocess only when the default is absent.
fn daemon_socket_path() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os(DAEMON_SOCKET_ENV) {
        let path = PathBuf::from(path);
        if path.as_os_str().is_empty() {
            return Err(format!("{DAEMON_SOCKET_ENV} is set but empty"));
        }
        return Ok(path);
    }

    if let Some(path) = default_daemon_socket_path() {
        if path.exists() {
            return Ok(path);
        }
    }

    reported_daemon_socket_path().ok_or_else(|| {
        "Prime's background service is not reachable. Check it with `prime-agent status`."
            .to_string()
    })
}

/// Classify a failure to reach the service.
///
/// A missing binary and a stopped service look the same to a socket call and
/// need different actions from the user, so they are separated here rather
/// than collapsed into one "unavailable".
fn unreachable_problem(detail: &str) -> PrimeConnectionProblem {
    if crate::prime_discovery::find_binary().is_err() {
        return PrimeConnectionProblem::NotInstalled;
    }
    PrimeConnectionProblem::ServiceUnreachable {
        detail: detail.to_string(),
    }
}

/// `<tmpdir>/prime-agent-<uid>/daemon.sock`, or `None` when the uid is unknown.
fn default_daemon_socket_path() -> Option<PathBuf> {
    Some(
        std::env::temp_dir()
            .join(format!("prime-agent-{}", current_uid()?))
            .join("daemon.sock"),
    )
}

/// This process's uid, read off the home directory rather than via libc.
///
/// Prime keys the socket directory by `process.getuid()`. Rust's std has no
/// portable `getuid`, and adding a `libc` dependency to read one integer is a
/// poor trade — the owner of `$HOME` is the same uid in every case where the
/// socket is reachable anyway.
#[cfg(unix)]
fn current_uid() -> Option<u32> {
    use std::os::unix::fs::MetadataExt;
    std::fs::metadata(dirs::home_dir()?).ok().map(|m| m.uid())
}

#[cfg(not(unix))]
fn current_uid() -> Option<u32> {
    None
}

/// Ask the CLI where its daemon is. Used only when the default path is absent.
fn reported_daemon_socket_path() -> Option<PathBuf> {
    let binary = crate::prime_discovery::find_binary().ok()?;
    let target =
        crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(&binary).ok()?;
    let mut command = crate::hidden_command(&target.program);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, &binary);
    if let Some(first_arg) = target.first_arg {
        command.arg(first_arg);
    }
    let output = command.arg("status").output().ok()?;
    parse_status_socket_path(&String::from_utf8_lossy(&output.stdout))
}

/// Pull the socket path out of `prime-agent status`.
///
/// The table marks the default background service with a trailing `*`, which is
/// part of the display and not of the path.
fn parse_status_socket_path(stdout: &str) -> Option<PathBuf> {
    stdout
        .lines()
        .map(str::trim)
        .filter(|line| line.starts_with('/'))
        .find_map(|line| line.split_whitespace().next())
        .filter(|path| path.ends_with(".sock"))
        .map(PathBuf::from)
}

#[cfg(unix)]
fn connect_stream(path: &Path) -> Result<DaemonStream, String> {
    DaemonStream::connect(path).map_err(|error| {
        format!(
            "Could not reach Prime's background service at {}: {error}",
            path.display()
        )
    })
}

#[cfg(not(unix))]
fn connect_stream(_path: &Path) -> Result<DaemonStream, String> {
    Err("Rhizome cannot reach Prime's background service on this platform yet".into())
}

// ── Public API ──────────────────────────────────────────────────────────────

pub fn check_cli() -> AiAgentAvailability {
    crate::prime_discovery::check_cli()
}

pub fn get_status() -> PrimeHostStatus {
    let availability = check_cli();
    let binary_path = crate::prime_discovery::find_binary()
        .ok()
        .map(|p| p.to_string_lossy().into_owned());

    let slot = host_slot();
    let mut guard = match slot.host.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };

    // Drop dead hosts so status reflects reality.
    if let Some(host) = guard.as_mut() {
        if !host.is_alive() {
            let _ = host.shutdown();
            *guard = None;
        }
    }

    match guard.as_ref() {
        Some(host) => PrimeHostStatus {
            installed: availability.installed,
            version: availability.version,
            running: true,
            session_id: host.session_id.clone(),
            is_streaming: host.is_streaming,
            // Where `prime-agent` is installed. The connection no longer owns a
            // binary — it owns a socket — but this field has always meant
            // "where Prime lives" to the UI, and that is still the CLI path.
            binary_path,
            model_provider: host.model_provider.clone(),
            model_id: host.model_id.clone(),
            model_name: host.model_name.clone(),
            thinking_level: host.thinking_level.clone(),
            reattached: host.reattached,
            started_at: host.started_at.clone(),
            // The daemon reports `sessionFile` on only some state payloads,
            // so fall back to the log the session id names.
            session_path: host.session_path.clone().or_else(|| {
                host.session_id
                    .as_deref()
                    .and_then(crate::prime_sessions::session_log_path)
            }),
            // Connected: whatever went wrong before is history.
            problem: None,
        },
        None => PrimeHostStatus {
            installed: availability.installed,
            version: availability.version,
            running: false,
            session_id: None,
            is_streaming: false,
            binary_path,
            model_provider: None,
            model_id: None,
            model_name: None,
            thinking_level: None,
            reattached: false,
            started_at: None,
            session_path: None,
            problem: current_problem(),
        },
    }
}

/// Ensure a host is running for `vault_path` (restarts if cwd changed).
pub fn ensure_host(vault_path: &str) -> Result<String, String> {
    let cwd = normalize_cwd(vault_path)?;
    ensure_host_for_cwd(cwd)
}

pub fn shutdown_host() -> Result<bool, String> {
    let slot = host_slot();
    let mut guard = slot.host.lock().map_err(poison)?;
    if let Some(mut host) = guard.take() {
        host.shutdown()?;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub fn new_session() -> Result<String, String> {
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({ "type": "new_session" }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "new_session"));
        }
        // Refresh session id from get_state.
        host.refresh_session_id()?;
        Ok(host.session_id.clone().unwrap_or_default())
    })
}

/// Token / cost / context usage for the live session.
pub fn get_session_stats() -> Result<PrimeSessionStats, String> {
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({ "type": "get_session_stats" }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "get_session_stats"));
        }
        Ok(PrimeSessionStats::from_state_data(
            response.get("data").unwrap_or(&serde_json::Value::Null),
        ))
    })
}

/// Fetch the live session's conversation history.
///
/// This is what a transcript rehydrates from: reopening a session, or
/// recovering the panel after a reload, without replaying the stream.
pub fn get_messages() -> Result<Vec<PrimeMessage>, String> {
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({ "type": "get_messages" }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "get_messages"));
        }
        Ok(messages_from_response(
            response.get("data").unwrap_or(&serde_json::Value::Null),
        ))
    })
}

/// What a fork produced: the session now live, and what it branched from.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeForkResult {
    pub session_id: String,
    /// The user message at the branch point, as Prime reports it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branched_from: Option<String>,
}

/// A model the live Prime host can switch to.
///
/// Only the fields a picker needs. Prime reports ~78 models with pricing,
/// thinking-level maps and base URLs; carrying all of that across the IPC
/// boundary to render a menu would be waste.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeModel {
    pub id: String,
    pub name: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u64>,
    pub reasoning: bool,
}

/// One entry from Prime `get_commands`, as the daemon actually reports it.
///
/// Origin is `source_info`, not the flatter `source`/`location` still in
/// Prime's docs. The frontend filter (#16) reads these fields; inventing a
/// different shape here would silently drop every skill.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeCommandSourceInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_dir: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeReportedCommand {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub argument_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_info: Option<PrimeCommandSourceInfo>,
}

fn opt_str(value: &serde_json::Value, key: &str) -> Option<String> {
    value[key]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn source_info_from_value(value: &serde_json::Value) -> Option<PrimeCommandSourceInfo> {
    if !value.is_object() {
        return None;
    }
    Some(PrimeCommandSourceInfo {
        path: opt_str(value, "path"),
        source: opt_str(value, "source"),
        scope: opt_str(value, "scope"),
        origin: opt_str(value, "origin"),
        base_dir: opt_str(value, "baseDir"),
    })
}

fn commands_from_response(data: &serde_json::Value) -> Vec<PrimeReportedCommand> {
    data["commands"]
        .as_array()
        .map(|commands| {
            commands
                .iter()
                .filter_map(|command| {
                    let name = opt_str(command, "name")?;
                    Some(PrimeReportedCommand {
                        name,
                        description: opt_str(command, "description"),
                        source: opt_str(command, "source"),
                        argument_hint: opt_str(command, "argumentHint"),
                        source_info: source_info_from_value(&command["sourceInfo"]),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Skills and extension commands the live session can invoke via `/`.
pub fn get_commands() -> Result<Vec<PrimeReportedCommand>, String> {
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({ "type": "get_commands" }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "get_commands"));
        }
        Ok(commands_from_response(
            response.get("data").unwrap_or(&serde_json::Value::Null),
        ))
    })
}

fn models_from_response(data: &serde_json::Value) -> Vec<PrimeModel> {
    data["models"]
        .as_array()
        .map(|models| {
            models
                .iter()
                .filter_map(|model| {
                    let id = model["id"].as_str()?;
                    let provider = model["provider"].as_str()?;
                    Some(PrimeModel {
                        id: id.to_string(),
                        // Fall back to the id: a model with no display name is
                        // still selectable, and a blank row is not.
                        name: model["name"].as_str().unwrap_or(id).to_string(),
                        provider: provider.to_string(),
                        context_window: model["contextWindow"].as_u64(),
                        reasoning: model["reasoning"].as_bool().unwrap_or(false),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Every model the host can switch to, as Prime reports them.
pub fn get_available_models() -> Result<Vec<PrimeModel>, String> {
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({ "type": "get_available_models" }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "get_available_models"));
        }
        Ok(models_from_response(
            response.get("data").unwrap_or(&serde_json::Value::Null),
        ))
    })
}

/// Switch the live host's model.
///
/// Prime names these `provider` and `modelId` and needs both — sending one
/// alone fails with `Model not found: opencode/undefined`.
pub fn set_model(provider: &str, model_id: &str) -> Result<(), String> {
    if provider.trim().is_empty() || model_id.trim().is_empty() {
        return Err("A model needs both a provider and an id".into());
    }
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({
            "type": "set_model",
            "provider": provider,
            "modelId": model_id,
        }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "set_model"));
        }
        host.refresh_session_id()?;
        Ok(())
    })
}

/// The reasoning levels Prime accepts, in increasing order of effort.
///
/// Mirrors `ThinkingLevel` in `@earendil-works/pi-agent-core`, confirmed twice:
/// the type in `pi-agent-core/dist/types.d.ts` and `prime-agent --help`'s
/// `--thinking` line agree exactly. Ordered because the UI renders them as a
/// scale, not an unordered set.
pub const PRIME_THINKING_LEVELS: [&str; 7] =
    ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

/// Set the attached session's reasoning level.
///
/// Validated against `PRIME_THINKING_LEVELS` before it goes out rather than
/// forwarded blind: the daemon takes a typed `ThinkingLevel`, so an unknown
/// string is a command that fails at the far end with a less useful message —
/// and a level silently not applied reads to the user as the control being
/// broken, since the strip would keep showing the old value.
pub fn set_thinking_level(level: &str) -> Result<(), String> {
    let level = level.trim();
    if !PRIME_THINKING_LEVELS.contains(&level) {
        return Err(format!(
            "Unknown thinking level {level:?}. Expected one of: {}",
            PRIME_THINKING_LEVELS.join(", "),
        ));
    }
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({
            "type": "set_thinking_level",
            "level": level,
        }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "set_thinking_level"));
        }
        Ok(())
    })
}

/// What the harness is doing besides answering: goal, heartbeats, schedules.
///
/// One host lock for three round-trips. A sub-request that fails degrades that
/// section to empty rather than failing the whole band — a missing heartbeat
/// list should not hide an active goal.
pub fn agent_activity() -> Result<crate::prime_agent_activity::PrimeAgentActivity, String> {
    use crate::prime_agent_activity as activity;
    with_host_mut(|host| {
        // Not `get_state`: probed live against 0.7.2, the daemon's `get_state`
        // never carries a `goal` key at all (its summarizer just does not set
        // one). `get_connection_state` does — it wraps the same
        // `session.goalState` the daemon forwards in `goal_update` events —
        // and also carries `thinkingLevel`, so one command covers both.
        let state = host.send_command(serde_json::json!({ "type": "get_connection_state" }))?;
        let state_data = state
            .get("data")
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        // Named `heartbeats_list` / `cron_list` on the daemon, not the
        // `list_heartbeats` / `list_schedules` RPC mode answered to. Probed
        // against 0.7.1: the RPC spellings return `Unknown daemon command`,
        // and would have degraded both sections to empty in silence.
        let heartbeats = host
            .send_command(serde_json::json!({ "type": "heartbeats_list" }))
            .ok()
            .and_then(|response| response.get("data").cloned())
            .map(|data| activity::scheduled_work_from_response(&data, &["heartbeats"]))
            .unwrap_or_default();

        let schedules = host
            .send_command(serde_json::json!({ "type": "cron_list" }))
            .ok()
            .and_then(|response| response.get("data").cloned())
            .map(|data| activity::scheduled_work_from_response(&data, &["jobs", "schedules"]))
            .unwrap_or_default();

        Ok(activity::PrimeAgentActivity {
            goal: activity::goal_from_state(&state_data),
            heartbeats,
            schedules,
            thinking_level: state_data["thinkingLevel"].as_str().map(str::to_string),
        })
    })
}

/// How long to keep re-reading state for a goal change to land, and how often.
///
/// Prime updates goal state synchronously — before any model call — as part
/// of parsing `/goal`, so this normally confirms on the first or second read.
/// It stays bounded rather than blocking indefinitely because #20 requires a
/// set that did not take to report as failed, not hang forever pretending it
/// might still succeed.
const GOAL_CONFIRM_ATTEMPTS: u32 = 16;
const GOAL_CONFIRM_INTERVAL: Duration = Duration::from_millis(250);

/// Not `get_state` — see the note in `agent_activity`: the daemon's
/// `get_state` never carries a `goal` key, `get_connection_state` does.
fn read_goal_state() -> Result<Option<crate::prime_agent_activity::PrimeGoalState>, String> {
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({ "type": "get_connection_state" }))?;
        let data = response
            .get("data")
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        Ok(crate::prime_agent_activity::goal_from_state(&data))
    })
}

/// Re-read goal state until `matches` accepts it, or give up.
///
/// `Some(goal)` on the outside means confirmed (the inner `Option` is the
/// confirmed goal itself, which is legitimately `None` for a cleared goal).
/// `None` on the outside means the wait ran out without a matching read —
/// the caller must treat this as failure, never fall back to the send
/// response.
fn poll_goal_until(
    matches: impl Fn(Option<&crate::prime_agent_activity::PrimeGoalState>) -> bool,
) -> Option<Option<crate::prime_agent_activity::PrimeGoalState>> {
    for attempt in 0..GOAL_CONFIRM_ATTEMPTS {
        if attempt > 0 {
            thread::sleep(GOAL_CONFIRM_INTERVAL);
        }
        if let Ok(goal) = read_goal_state() {
            if matches(goal.as_ref()) {
                return Some(goal);
            }
        }
    }
    None
}

/// Send `/goal ...` text as an ordinary prompt.
///
/// There is no protocol command for goal changes — probed against 0.7.2's
/// `DAEMON_COMMAND_TYPES`, which lists neither `goal_create` nor any
/// variant. Prime's own CLI sets a goal the same way: `/goal` text is parsed
/// as a session command before the model ever sees it (`SESSION_SLASH_COMMAND_NAMES`
/// in the installed daemon), so this is the same mechanism Prime's own
/// interface uses, not an invented one.
///
/// A success here means Prime *admitted* the text, not that the goal change
/// landed — an active goal also queues a follow-up turn, which can take a
/// while and does not gate this response. Callers must re-read state.
/// Prime's own `isStreaming`, from `get_connection_state` — not the client's
/// `host.is_streaming`, which only tracks turns *this* process started via
/// `run_prompt_stream`.
///
/// Needed because a `/goal` sent while the session is mid-turn is not parsed
/// as a session command at all: observed live, a `/goal clear` sent during
/// the continuation an active goal itself triggers landed in
/// `sessionActions.steering` rather than clearing anything — the send
/// reported success and nothing happened.
fn session_is_streaming() -> bool {
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({ "type": "get_connection_state" }))?;
        Ok(response["data"]["isStreaming"].as_bool().unwrap_or(false))
    })
    .unwrap_or(false)
}

/// Interrupt the running turn and wait for the session to go idle.
fn abort_and_wait_for_idle() -> Result<(), String> {
    with_host_mut(|host| {
        let _ = host.send_command(serde_json::json!({ "type": "abort" }));
        Ok(())
    })?;
    for attempt in 0..GOAL_CONFIRM_ATTEMPTS {
        if attempt > 0 {
            thread::sleep(GOAL_CONFIRM_INTERVAL);
        }
        if !session_is_streaming() {
            return Ok(());
        }
    }
    Err("Prime is still busy after aborting the current turn — try again".into())
}

fn send_goal_command(text: &str) -> Result<(), String> {
    // A turn *this* Rhizome window started (the user's own in-flight chat
    // message) is left alone — changing the goal must not silently cancel
    // something the user is watching stream. Refuse outright instead.
    if with_host_mut(|host| Ok(host.is_streaming)).unwrap_or(false) {
        return Err("Cannot change the goal while a turn is running".into());
    }
    // The session can still be busy server-side without Rhizome having
    // started it — most commonly the goal's own auto-continuation, which
    // this same set/clear call is what's about to redirect. Interrupting
    // that is what "replace" and "clear" mean; queuing behind it would just
    // silently no-op instead.
    if session_is_streaming() {
        abort_and_wait_for_idle()?;
    }
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({
            "type": "prompt",
            "message": text,
        }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "prompt"));
        }
        Ok(())
    })
}

/// Give the session a persistent objective, replacing any goal already active.
///
/// Confirmation comes from re-reading `get_state`, never from the send
/// response (#20): a set that did not take is reported as an error here, not
/// as success.
pub fn set_goal(
    objective: &str,
    token_budget: Option<u64>,
) -> Result<crate::prime_agent_activity::PrimeGoalState, String> {
    let objective = objective.trim();
    if objective.is_empty() {
        return Err("Goal objective must not be empty".into());
    }
    if token_budget == Some(0) {
        return Err("Goal token budget must be a positive integer".into());
    }

    // Prime refuses to create a goal while one is active, paused, or
    // budget-limited — replacing means clearing first, confirmed the same
    // way a fresh set is.
    if let Some(existing) = read_goal_state()? {
        if existing.active {
            clear_goal()?;
        }
    }

    let command_text = match token_budget {
        Some(budget) => format!("/goal --budget {budget} {objective}"),
        None => format!("/goal {objective}"),
    };
    send_goal_command(&command_text)?;

    match poll_goal_until(|goal| {
        goal.map(|g| g.active && g.objective.as_deref() == Some(objective))
            .unwrap_or(false)
    }) {
        Some(Some(goal)) => Ok(goal),
        _ => Err("Prime did not confirm the goal was set".into()),
    }
}

/// Clear the active goal, confirmed by re-reading state.
pub fn clear_goal() -> Result<(), String> {
    send_goal_command("/goal clear")?;
    match poll_goal_until(|goal| goal.map(|g| !g.active).unwrap_or(true)) {
        Some(_) => Ok(()),
        None => Err("Prime did not confirm the goal was cleared".into()),
    }
}

/// Branch a new session from a past entry.
///
/// Prime names the argument `entryId` and takes the `id` from a message line in
/// the session log — the same id `prime_sessions` already carries on every
/// replayed entry. Probed 2026-08-15: `id`, `messageId`, `entry`, `from` and
/// five other spellings all fail with `Invalid entry ID for forking`.
///
/// The host **switches into the fork**: afterwards `get_state` reports a new
/// session id and history is truncated at the branch point. Returns the user
/// message at that entry, which Prime hands back, so the caller can say what
/// was branched from.
///
/// Refuses mid-turn for the same reason `switch_session` does — Prime does not
/// document what forking does to a running turn.
pub fn fork(entry_id: &str) -> Result<PrimeForkResult, String> {
    let trimmed = entry_id.trim();
    if trimmed.is_empty() {
        return Err("Cannot fork without an entry id".into());
    }
    with_host_mut(|host| {
        if host.is_streaming {
            return Err("Cannot fork while a turn is running".into());
        }
        let response = host.send_command(serde_json::json!({
            "type": "fork",
            "entryId": trimmed,
        }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "fork"));
        }
        host.refresh_session_id()?;
        Ok(PrimeForkResult {
            session_id: host.session_id.clone().unwrap_or_default(),
            branched_from: response["data"]["text"].as_str().map(str::to_string),
        })
    })
}

/// Load a past session into the live host.
///
/// Prime names the argument `sessionPath` and wants the log file itself —
/// established by probing the binary, which rejects `path`, `sessionId` and
/// ten other spellings with an error that names no parameter.
///
/// Refuses while a turn is streaming. Prime's docs do not say what switching
/// mid-turn does to the running turn, and the place to find that out is not a
/// user's session — the same caution `steer` already applies.
pub fn switch_session(session_path: &str) -> Result<String, String> {
    crate::prime_sessions::ensure_inside_sessions_dir(std::path::Path::new(session_path))?;
    with_host_mut(|host| {
        if host.is_streaming {
            return Err("Cannot switch sessions while a turn is running".into());
        }
        let response = host.send_command(serde_json::json!({
            "type": "switch_session",
            "sessionPath": session_path,
        }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(switch_session_error(&response));
        }
        host.refresh_session_id()?;
        Ok(host.session_id.clone().unwrap_or_default())
    })
}

/// Compact the conversation now. Returns tokens held before compaction when
/// Prime reports it, so the caller can show what the run actually reclaimed.
pub fn compact(custom_instructions: Option<String>) -> Result<Option<u64>, String> {
    with_host_mut(|host| {
        let mut command = serde_json::json!({ "type": "compact" });
        if let Some(instructions) = custom_instructions.filter(|s| !s.trim().is_empty()) {
            command["customInstructions"] = serde_json::Value::String(instructions);
        }
        let response = host.send_command(command)?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "compact"));
        }
        Ok(response["data"]["tokensBefore"].as_u64())
    })
}

pub fn set_auto_compaction(enabled: bool) -> Result<(), String> {
    with_host_mut(|host| {
        let response = host.send_command(serde_json::json!({
            "type": "set_auto_compaction",
            "enabled": enabled,
        }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "set_auto_compaction"));
        }
        Ok(())
    })
}

fn build_queue_command(kind: &str, message: &str) -> serde_json::Value {
    serde_json::json!({ "type": kind, "message": message })
}

/// Queue a steering message for the running turn, or a follow-up for after it.
///
/// Returns `Ok(false)` when nothing is streaming. Prime's docs do not say what
/// `steer` does with no active run, so we do not find out the hard way — the
/// caller is expected to send a normal prompt instead, which is what a user
/// pressing enter on an idle session means anyway.
fn queue_message(kind: &str, message: &str) -> Result<bool, String> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("Cannot queue an empty message".into());
    }
    with_host_mut(|host| {
        if !host.is_streaming {
            return Ok(false);
        }
        let response = host.send_command(build_queue_command(kind, trimmed))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, kind));
        }
        Ok(true)
    })
}

/// Redirect the turn that is currently running, without discarding its work.
pub fn steer(message: &str) -> Result<bool, String> {
    queue_message("steer", message)
}

/// Queue a message to run after the current turn finishes.
pub fn follow_up(message: &str) -> Result<bool, String> {
    queue_message("follow_up", message)
}

pub fn abort_turn() -> Result<bool, String> {
    let slot = host_slot();
    let mut guard = slot.host.lock().map_err(poison)?;
    let Some(host) = guard.as_mut() else {
        return Ok(false);
    };
    if !host.is_alive() {
        let _ = host.shutdown();
        *guard = None;
        return Ok(false);
    }
    let response = host.send_command(serde_json::json!({ "type": "abort" }))?;
    let ok = response["success"].as_bool().unwrap_or(false);
    host.is_streaming = false;
    Ok(ok)
}

/// Prompt the long-lived host and map RPC events into `AiAgentStreamEvent`s.
///
/// Returns the Prime session id (empty string if unknown). Always emits
/// `Done` as the final event (mirrors other agent runners).
pub fn run_prompt_stream<F>(request: PrimePromptRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let cwd = normalize_cwd(&request.vault_path)?;
    ensure_host_for_cwd(cwd)?;

    if request.new_session {
        match new_session() {
            Ok(session_id) if !session_id.is_empty() => {
                emit(AiAgentStreamEvent::Init {
                    session_id: session_id.clone(),
                });
            }
            Ok(_) => {}
            Err(error) => {
                emit(AiAgentStreamEvent::Error { message: error });
                emit(AiAgentStreamEvent::Done);
                return Ok(String::new());
            }
        }
    }

    // Apply optional model override before the prompt.
    if let (Some(provider), Some(model_id)) = (
        request.provider.as_deref().filter(|s| !s.is_empty()),
        request.model_id.as_deref().filter(|s| !s.is_empty()),
    ) {
        if let Err(error) = with_host_mut(|host| {
            let response = host.send_command(serde_json::json!({
                "type": "set_model",
                "provider": provider,
                "modelId": model_id,
            }))?;
            if response["success"].as_bool() != Some(true) {
                return Err(response_error(&response, "set_model"));
            }
            Ok(())
        }) {
            emit(AiAgentStreamEvent::Error { message: error });
            emit(AiAgentStreamEvent::Done);
            return Ok(String::new());
        }
    }

    let message =
        crate::cli_agent_runtime::build_prompt(&request.message, request.system_prompt.as_deref());

    // Emit Init from current session if we have one and didn't already.
    let session_before = with_host_mut(|host| Ok(host.session_id.clone())).unwrap_or(None);
    if let Some(session_id) = session_before.clone().filter(|s| !s.is_empty()) {
        if !request.new_session {
            emit(AiAgentStreamEvent::Init {
                session_id: session_id.clone(),
            });
        }
    }

    // Drain any stale events left from a previous turn.
    drain_pending_events();

    let prompt_response = match with_host_mut(|host| {
        host.is_streaming = true;
        host.send_command(serde_json::json!({
            "type": "prompt",
            "message": message,
        }))
    }) {
        Ok(response) => response,
        Err(error) => {
            let _ = with_host_mut(|host| {
                host.is_streaming = false;
                Ok(())
            });
            emit(AiAgentStreamEvent::Error {
                message: crate::prime_events::format_spawn_error(&error),
            });
            emit(AiAgentStreamEvent::Done);
            return Ok(session_before.unwrap_or_default());
        }
    };

    if prompt_response["success"].as_bool() != Some(true) {
        let _ = with_host_mut(|host| {
            host.is_streaming = false;
            Ok(())
        });
        emit(AiAgentStreamEvent::Error {
            message: response_error(&prompt_response, "prompt"),
        });
        emit(AiAgentStreamEvent::Done);
        return Ok(session_before.unwrap_or_default());
    }

    // Stream events until agent_end (or timeout / host death).
    let mut saw_text = false;
    let outcome = stream_until_agent_end(|json| {
        if json["type"].as_str() == Some("message_update")
            && json["assistantMessageEvent"]["type"].as_str() == Some("text_delta")
            && json["assistantMessageEvent"]["delta"]
                .as_str()
                .is_some_and(|d| !d.is_empty())
        {
            saw_text = true;
        }
        crate::prime_events::dispatch_event(json, &mut emit);
    });

    let _ = with_host_mut(|host| {
        host.is_streaming = false;
        // Best-effort session id refresh after a turn.
        let _ = host.refresh_session_id();
        Ok(())
    });

    match outcome {
        Ok(()) => {
            if !saw_text {
                // Still a successful empty turn is fine; don't force an error.
            }
        }
        Err(error) => {
            emit(AiAgentStreamEvent::Error {
                message: crate::prime_events::format_spawn_error(&error),
            });
        }
    }

    let session_id =
        with_host_mut(|host| Ok(host.session_id.clone().unwrap_or_default())).unwrap_or_default();
    if session_before.as_deref() != Some(session_id.as_str()) && !session_id.is_empty() {
        // Session id learned mid-turn (get_state after first prompt).
        emit(AiAgentStreamEvent::Init {
            session_id: session_id.clone(),
        });
    }

    emit(AiAgentStreamEvent::Done);
    Ok(session_id)
}

// ── Internals ───────────────────────────────────────────────────────────────

fn poison<T>(_: std::sync::PoisonError<T>) -> String {
    "Prime session host lock was poisoned".into()
}

fn normalize_cwd(vault_path: &str) -> Result<PathBuf, String> {
    let trimmed = vault_path.trim();
    if trimmed.is_empty() {
        return dirs::home_dir().ok_or_else(|| {
            "No vault path and could not resolve home directory for Prime host cwd".into()
        });
    }
    let expanded = crate::commands::expand_tilde(trimmed);
    Ok(PathBuf::from(expanded.as_ref()))
}

fn with_host_mut<T>(f: impl FnOnce(&mut PrimeHost) -> Result<T, String>) -> Result<T, String> {
    let slot = host_slot();
    let mut guard = slot.host.lock().map_err(poison)?;
    let host = guard
        .as_mut()
        .ok_or_else(|| "Prime session host is not running".to_string())?;
    if !host.is_alive() {
        let _ = host.shutdown();
        *guard = None;
        return Err("Prime session host process exited".into());
    }
    f(host)
}

fn ensure_host_for_cwd(cwd: PathBuf) -> Result<String, String> {
    let slot = host_slot();
    {
        let mut guard = slot.host.lock().map_err(poison)?;
        if let Some(host) = guard.as_mut() {
            if host.is_alive() && host.cwd == cwd {
                let _ = crate::prime_vault_skill::seed_vault_skill(&cwd);
                return Ok(host.session_id.clone().unwrap_or_default());
            }
            // Disconnected or wrong cwd → detach and open a new session.
            let _ = host.shutdown();
            *guard = None;
        }
    }
    connect_and_store(cwd)
}

fn connect_and_store(cwd: PathBuf) -> Result<String, String> {
    let host = PrimeHost::connect(cwd)?;
    let session_id = host.session_id.clone().unwrap_or_default();
    let slot = host_slot();
    let mut guard = slot.host.lock().map_err(poison)?;
    // If something raced us, detach the loser.
    if let Some(mut existing) = guard.take() {
        let _ = existing.shutdown();
    }
    *guard = Some(host);
    Ok(session_id)
}

fn drain_pending_events() {
    let rx = {
        let slot = host_slot();
        let guard = match slot.host.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        guard.as_ref().map(|h| Arc::clone(&h.event_rx))
    };
    let Some(rx) = rx else { return };
    let Ok(rx) = rx.lock() else { return };
    while let Ok(line) = rx.try_recv() {
        if matches!(line, OutboundLine::Closed(_)) {
            // Put it back? Can't. Mark dead on next with_host_mut.
            break;
        }
    }
}

fn stream_until_agent_end(mut on_event: impl FnMut(&serde_json::Value)) -> Result<(), String> {
    let rx = {
        let slot = host_slot();
        let guard = slot.host.lock().map_err(poison)?;
        let host = guard
            .as_ref()
            .ok_or_else(|| "Prime session host is not running".to_string())?;
        Arc::clone(&host.event_rx)
    };

    let deadline = Instant::now() + TURN_IDLE_TIMEOUT;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("Prime agent turn timed out".into());
        }

        let line = {
            let rx = rx.lock().map_err(poison)?;
            match rx.recv_timeout(remaining.min(Duration::from_secs(1))) {
                Ok(line) => line,
                Err(RecvTimeoutError::Timeout) => {
                    // Still within overall deadline; check liveness.
                    if !with_host_mut(|h| Ok(h.is_alive())).unwrap_or(false) {
                        return Err("Prime session host process exited during turn".into());
                    }
                    continue;
                }
                Err(RecvTimeoutError::Disconnected) => {
                    return Err("Prime session host event channel closed".into());
                }
            }
        };

        match line {
            OutboundLine::Closed(err) => {
                return Err(
                    err.unwrap_or_else(|| "Prime session host process closed stdout".into())
                );
            }
            OutboundLine::Event(json) => {
                let ty = json["type"].as_str().unwrap_or_default();
                if ty == "agent_end" {
                    on_event(&json);
                    return Ok(());
                }
                // Rhizome does not claim the `extension_ui` capability, so the
                // daemon should never route one of these here. If one arrives
                // anyway, cancel it rather than let the turn hang on a prompt
                // no surface in this app can answer.
                if ty.starts_with("extension_ui") {
                    let request_id = json["requestId"]
                        .as_str()
                        .or_else(|| json["id"].as_str())
                        .unwrap_or_default()
                        .to_string();
                    let _ = with_host_mut(|host| {
                        let command = host.command_envelope(
                            serde_json::json!({
                                "type": "extension_ui_response",
                                "activeSessionId": host.active_session_id,
                                "requestId": request_id,
                                "response": { "cancelled": true },
                            }),
                            &next_id(),
                        );
                        let _ = host.write_raw(&command);
                        Ok(())
                    });
                    continue;
                }
                on_event(&json);
            }
        }
    }
}

/// Choose which running session reopening should land in.
///
/// Three rules, in order:
///
/// - **Same working directory.** A session rooted somewhere else is somebody
///   else's work; opening a vault must not adopt it.
/// - **Nobody else is holding it.** The daemon allows several clients on one
///   session, but this product shows one conversation per window (#5, out of
///   scope: multi-window). Taking a session another client is displaying would
///   be a hijack, so those are skipped and a fresh one is made instead.
/// - **Most recently active wins**, which is what "where I left off" means when
///   several are running.
///
/// `lastActivityAt` is ISO-8601 in UTC with a `Z` suffix, so lexicographic
/// order is chronological order and no date parsing is needed. A session
/// missing the field sorts oldest rather than winning by accident.
fn pick_resumable_session(data: &serde_json::Value, cwd: &Path) -> Option<String> {
    let cwd = cwd.to_string_lossy();
    data["sessions"]
        .as_array()?
        .iter()
        .filter(|session| session["cwd"].as_str() == Some(cwd.as_ref()))
        .filter(|session| session["attachedClients"].as_u64().unwrap_or(0) == 0)
        .max_by_key(|session| session["lastActivityAt"].as_str().unwrap_or(""))
        .and_then(|session| {
            session["activeSessionId"]
                .as_str()
                .or_else(|| session["id"].as_str())
        })
        .map(str::to_string)
}

/// The actionable sentence for a connection problem.
///
/// Each names the one action that fixes it. Rust-side English, matching the
/// convention of the other transport errors here; the frontend renders its own
/// localized copy from the `code` and only falls back to this.
fn describe_problem(problem: &PrimeConnectionProblem) -> String {
    match problem {
        PrimeConnectionProblem::NotInstalled => {
            "Prime is not installed. Install it with `npm i -g prime-agent`.".to_string()
        }
        PrimeConnectionProblem::ServiceUnreachable { .. } => {
            // Not "start it with `prime-agent daemon`": that command does not
            // exist, and per Prime's own daemon.md the supervisor is internal
            // infrastructure that starts itself and is restarted by a worker if
            // it dies. `status` is a real, read-only command that shows whether
            // it is there.
            "Prime's background service is not reachable. Check it with `prime-agent status`."
                .to_string()
        }
        PrimeConnectionProblem::ServiceTooOld {
            installed_version,
            required_version,
        } => match installed_version {
            Some(installed) => format!(
                "Prime {installed} is too old for Rhizome. Update to {required_version} or \
                 newer with `npm i -g prime-agent@latest`."
            ),
            None => format!(
                "This version of Prime is too old for Rhizome. Update to {required_version} or \
                 newer with `npm i -g prime-agent@latest`."
            ),
        },
    }
}

/// What quitting Rhizome should do with the session it was running.
///
/// Deliberately about the *session*, not Prime's background service. The
/// daemon is shared infrastructure — per Prime's own `daemon.md` it starts
/// itself, restarts if it dies, and hosts other clients' work — so it is not
/// Rhizome's to stop. What Rhizome can orphan is the session it opened, and
/// that is what this decides.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum QuitDisposition {
    /// Default: closing the harness stops the agent, as Claude Code and Hermes
    /// do. Nothing is left running that the user cannot see.
    StopSession,
    /// The user asked for sessions to outlive the app, so this one is left
    /// running and detached.
    KeepSessionRunning,
    /// Not connected, so there is nothing to decide.
    NotConnected,
}

/// Decide what quitting should do with our session.
///
/// Pure so the rule is testable without a socket, and so the whole policy is
/// one line the reader can check against the setting's own description.
fn quit_disposition(keep_running: bool) -> QuitDisposition {
    if keep_running {
        QuitDisposition::KeepSessionRunning
    } else {
        QuitDisposition::StopSession
    }
}

/// How long a roster query will wait before giving up on the daemon.
///
/// Much shorter than `DAEMON_RESPONSE_TIMEOUT`: this runs when the menu-bar
/// popover opens, and a popover that hangs for 30s is worse than one that
/// quietly shows nothing.
const ROSTER_TIMEOUT: Duration = Duration::from_secs(3);

/// Every session the daemon is hosting right now, newest state included.
///
/// A deliberately short-lived, standalone connection: connect, greet, `list`,
/// disconnect. It does **not** touch the attached `PrimeSessionHost`, because
/// the menu-bar companion asks this question when no vault is open and no host
/// exists — routing it through the host would make "is anything running?"
/// answerable only while the main window is up, which is the opposite of what
/// the menu bar is for.
///
/// Returns the daemon's session objects unchanged rather than a narrowed Rust
/// struct. The shaping lives in `src/lib/primeRunningSessions.ts`, and keeping
/// one shape instead of two means a field Prime adds does not have to be
/// re-declared here before the UI can read it.
///
/// An unreachable daemon is `Ok(vec![])`, not `Err`: "nothing is running" and
/// "the service is down" render the same quiet way in the popover, and the
/// popover must not show an error banner for a service the user never started.
pub fn list_running_sessions() -> Result<Vec<serde_json::Value>, String> {
    let Ok(socket_path) = daemon_socket_path() else {
        return Ok(Vec::new());
    };
    let Ok(stream) = DaemonStream::connect(&socket_path) else {
        return Ok(Vec::new());
    };
    let _ = stream.set_read_timeout(Some(ROSTER_TIMEOUT));
    let _ = stream.set_write_timeout(Some(ROSTER_TIMEOUT));

    read_roster_over(stream)
}

/// The protocol half of `list_running_sessions`, split out so the exchange can
/// be tested against the fake daemon without binding the real socket path.
fn read_roster_over(stream: DaemonStream) -> Result<Vec<serde_json::Value>, String> {
    let mut writer = stream
        .try_clone()
        .map_err(|error| format!("Failed to clone Prime daemon socket: {error}"))?;
    let mut reader = BufReader::new(stream);

    let deadline = Instant::now() + ROSTER_TIMEOUT;
    let mut greeted = false;
    let mut line = String::new();

    loop {
        if Instant::now() >= deadline {
            return Ok(Vec::new());
        }
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => return Ok(Vec::new()),
            Ok(_) => {}
        }
        let Ok(message) = serde_json::from_str::<serde_json::Value>(line.trim()) else {
            continue;
        };

        // The daemon greets first; asking before the greeting is not answered.
        if !greeted && message["type"].as_str() == Some("daemon_hello") {
            greeted = true;
            let envelope = serde_json::json!({
                "type": "command",
                "id": ROSTER_COMMAND_ID,
                "protocol": { "name": DAEMON_PROTOCOL_NAME, "version": DAEMON_PROTOCOL_VERSION },
                "command": { "type": "list", "id": ROSTER_COMMAND_ID },
            });
            if writeln!(writer, "{envelope}")
                .and_then(|_| writer.flush())
                .is_err()
            {
                return Ok(Vec::new());
            }
            continue;
        }

        // Match on the command id: the daemon interleaves session events with
        // command responses on the same line-delimited stream.
        if message["id"].as_str() == Some(ROSTER_COMMAND_ID)
            || message["command"].as_str() == Some("list")
        {
            if message["success"].as_bool() == Some(false) {
                return Ok(Vec::new());
            }
            return Ok(roster_sessions(&message));
        }
    }
}

const ROSTER_COMMAND_ID: &str = "rhizome-roster";

/// Pull the session array out of a `list` response.
///
/// Tolerates both `data.sessions` (what 0.7.2 sends) and a bare `sessions`, so
/// a shape change one level up does not silently empty the menu bar.
fn roster_sessions(response: &serde_json::Value) -> Vec<serde_json::Value> {
    response["data"]["sessions"]
        .as_array()
        .or_else(|| response["sessions"].as_array())
        .cloned()
        .unwrap_or_default()
}

/// Settle Rhizome's session on quit, per the user's preference.
///
/// Returns what it decided so the caller can log it and, later, surface a
/// session left running where the user can see it.
pub fn settle_session_on_quit(keep_running: bool) -> Result<QuitDisposition, String> {
    let slot = host_slot();
    let mut guard = slot.host.lock().map_err(poison)?;
    let Some(host) = guard.as_mut() else {
        return Ok(QuitDisposition::NotConnected);
    };
    if !host.is_alive() || host.active_session_id.is_empty() {
        return Ok(QuitDisposition::NotConnected);
    }

    let disposition = quit_disposition(keep_running);
    if disposition == QuitDisposition::StopSession {
        // `kill` ends this session only. `shutdown` would stop every agent on
        // the machine including other clients' — never the right tool for
        // "the user closed my window".
        let _ = host.send_command(serde_json::json!({ "type": "kill" }));
    }
    // Either way the connection goes: detaching is what leaves a kept session
    // running rather than tied to a process that is exiting.
    let _ = host.shutdown();
    *guard = None;
    Ok(disposition)
}

/// Explain a refused session switch.
///
/// The daemon holds every client's sessions, so a session log can already be
/// live in another worker — a conflict RPC mode could not produce, because
/// Rhizome's own child was the only thing holding anything. ADR-0163 calls
/// this out: connecting to a shared service buys failure modes owning a
/// process did not have, and they have to be actionable rather than raw.
///
/// Prime's own wording names an internal worker id and a session file path.
/// Neither is something a user can do anything about, and `worker` is
/// transport vocabulary that must not surface in the UI (`CONTEXT.md`).
/// Matched on the structured `errorInfo.code` rather than the prose, which is
/// free to change between Prime versions.
fn switch_session_error(response: &serde_json::Value) -> String {
    if response["errorInfo"]["code"].as_str() == Some("session_already_active") {
        return "That session is already open in another Prime client. \
                Close it there, or choose a different session."
            .to_string();
    }
    response_error(response, "switch_session")
}

fn response_error(response: &serde_json::Value, command: &str) -> String {
    response["error"]
        .as_str()
        .or_else(|| response["message"].as_str())
        .map(str::to_string)
        .unwrap_or_else(|| format!("Prime RPC `{command}` failed: {response}"))
}

fn next_id() -> String {
    format!(
        "rhizome-{}",
        NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed)
    )
}

impl PrimeHost {
    /// Open a connection, create a session in `cwd`, and attach to it.
    ///
    /// Creating rather than adopting an existing session preserves today's
    /// behaviour exactly: `ensure_host` has always produced a session scoped to
    /// the vault it was handed. Reattaching to work left running is #7's job,
    /// and needs a UI to choose *which* session — a choice this function has no
    /// standing to make on the user's behalf.
    fn connect(cwd: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&cwd).map_err(|error| {
            format!(
                "Failed to create Prime session working directory {}: {error}",
                cwd.display()
            )
        })?;

        // Seed Rhizome vault skill + optional mcpServers entry when cwd is a vault.
        // Failures are non-fatal so chat still works without vault tools.
        match crate::prime_vault_skill::seed_vault_skill(&cwd) {
            Ok(seed) => {
                log::info!(
                    "Prime vault skill ready at {} (vault={}, cli={})",
                    seed.skill_dir.display(),
                    seed.vault_path,
                    seed.cli_call_path.display()
                );
            }
            Err(error) => {
                log::debug!("Prime vault skill not seeded: {error}");
            }
        }

        let socket_path = daemon_socket_path().map_err(|detail| {
            let problem = unreachable_problem(&detail);
            let message = describe_problem(&problem);
            record_problem(Some(problem));
            message
        })?;
        let stream = connect_stream(&socket_path).map_err(|detail| {
            let problem = unreachable_problem(&detail);
            let message = describe_problem(&problem);
            record_problem(Some(problem));
            message
        })?;
        let reader_stream = stream
            .try_clone()
            .map_err(|error| format!("Failed to split the Prime daemon connection: {error}"))?;

        let pending: Arc<Mutex<HashMap<String, PendingResponse>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let (event_tx, event_rx) = mpsc::channel::<OutboundLine>();
        let event_rx = Arc::new(Mutex::new(event_rx));
        let connected = Arc::new(AtomicBool::new(true));

        spawn_daemon_reader(
            reader_stream,
            Arc::clone(&pending),
            event_tx.clone(),
            Arc::clone(&connected),
        )?;

        let mut host = Self {
            stream,
            pending,
            event_tx,
            event_rx,
            connected,
            active_session_id: String::new(),
            session_id: None,
            reattached: false,
            started_at: None,
            session_path: None,
            model_provider: None,
            model_id: None,
            model_name: None,
            thinking_level: None,
            socket_path,
            cwd: cwd.clone(),
            is_streaming: false,
        };

        // The daemon greets first. Reading it is the handshake — it carries the
        // protocol version and confirms we are talking to a daemon at all.
        host.await_hello()?;

        // Rejoin work left running here before starting anything new. This is
        // what makes closing the window a detach rather than a loss (#7): the
        // daemon kept the session, so reopening should land back in it.
        match host.find_resumable_session(&cwd) {
            Ok(Some(found)) => {
                log::info!("Reattaching to Prime session {found}");
                host.active_session_id = found;
                host.reattached = true;
            }
            Ok(None) => host.create_session(&cwd)?,
            Err(error) => {
                // Enumeration is an optimisation, not a precondition. Failing
                // to list is no reason to refuse to open — start fresh.
                log::debug!("Could not enumerate Prime sessions, creating one: {error}");
                host.create_session(&cwd)?;
            }
        }

        let attached = host.send_bare_command(serde_json::json!({
            "type": "attach",
            "activeSessionId": host.active_session_id,
            "capabilities": DAEMON_CLIENT_CAPABILITIES,
        }))?;
        if attached["success"].as_bool() != Some(true) {
            let _ = host.shutdown();
            return Err(response_error(&attached, "attach"));
        }

        // Warm-up: get_state confirms the session answers and yields sessionId.
        match host.send_command(serde_json::json!({ "type": "get_state" })) {
            Ok(response) if response["success"].as_bool() == Some(true) => {
                if let Some(data) = response.get("data") {
                    host.apply_state_data(data);
                }
                // Reached it: whatever was wrong before no longer is.
                record_problem(None);
            }
            Ok(response) => {
                let _ = host.shutdown();
                return Err(response_error(&response, "get_state"));
            }
            Err(error) => {
                let _ = host.shutdown();
                return Err(error);
            }
        }

        Ok(host)
    }

    /// Create a fresh session rooted at `cwd`, and adopt it.
    ///
    /// `create` takes cwd inside `config`, not at the top level. Sending it at
    /// the top level is silently ignored and the session lands in the daemon's
    /// own directory, which is how the vault tools would quietly start
    /// operating on the wrong tree.
    fn create_session(&mut self, cwd: &Path) -> Result<(), String> {
        let created = self.send_bare_command(serde_json::json!({
            "type": "create",
            "config": { "cwd": cwd.to_string_lossy() },
            // Explicit rather than defaulted: outliving this client is the
            // property ADR-0163 exists for, so it should not rest on a default.
            "lifecycle": "resident",
        }))?;
        if created["success"].as_bool() != Some(true) {
            let _ = self.shutdown();
            return Err(response_error(&created, "create"));
        }
        let Some(active_session_id) = created["data"]["activeSessionId"].as_str() else {
            let _ = self.shutdown();
            return Err("Prime's daemon created a session without an id".into());
        };
        self.active_session_id = active_session_id.to_string();
        Ok(())
    }

    /// Find a session already running here that this client can rejoin.
    fn find_resumable_session(&mut self, cwd: &Path) -> Result<Option<String>, String> {
        let response = self.send_bare_command(serde_json::json!({ "type": "list" }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "list"));
        }
        Ok(pick_resumable_session(
            response.get("data").unwrap_or(&serde_json::Value::Null),
            cwd,
        ))
    }

    /// Wait for the daemon's opening `daemon_hello`.
    ///
    /// Anything else arriving first is forwarded, not dropped — a stray line
    /// before the greeting is not a reason to lose it.
    fn await_hello(&mut self) -> Result<(), String> {
        let deadline = Instant::now() + DAEMON_HELLO_TIMEOUT;
        let rx = Arc::clone(&self.event_rx);
        let rx = rx.lock().map_err(poison)?;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(format!(
                    "Prime's background service did not answer within {}s",
                    DAEMON_HELLO_TIMEOUT.as_secs()
                ));
            }
            match rx.recv_timeout(remaining) {
                Ok(OutboundLine::Event(json)) => {
                    if json["type"].as_str() == Some("daemon_hello") {
                        // The greeting is also the compatibility check. A
                        // daemon older than this protocol cannot serve the
                        // harness commands the product is built on, and
                        // ADR-0163 forbids quietly dropping to the old
                        // transport instead — so this is a hard stop with a
                        // version the user can act on.
                        let protocol = json["protocol"]["version"].as_u64().unwrap_or(0);
                        if protocol < DAEMON_PROTOCOL_VERSION {
                            return Err(self.fail_with(PrimeConnectionProblem::ServiceTooOld {
                                installed_version: json["appVersion"].as_str().map(str::to_string),
                                required_version: MINIMUM_PRIME_VERSION.to_string(),
                            }));
                        }
                        log::info!(
                            "Connected to Prime daemon {} (protocol {protocol}) at {}",
                            json["appVersion"].as_str().unwrap_or("unknown"),
                            self.socket_path.display()
                        );
                        return Ok(());
                    }
                }
                Ok(OutboundLine::Closed(error)) => {
                    return Err(error.unwrap_or_else(|| {
                        "Prime's background service closed the connection during the handshake"
                            .into()
                    }));
                }
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => {
                    return Err("Prime daemon connection closed during the handshake".into());
                }
            }
        }
    }

    /// Record a problem and render it as the error the caller sees.
    ///
    /// Both halves matter: the string is what a failed command reports now,
    /// and the recorded state is what the polled status surfaces afterwards,
    /// so the UI can stay actionable rather than reverting to a bare "idle".
    fn fail_with(&self, problem: PrimeConnectionProblem) -> String {
        let message = describe_problem(&problem);
        record_problem(Some(problem));
        message
    }

    fn is_alive(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }

    /// Detach and drop the connection.
    ///
    /// Deliberately not a kill. The daemon is not ours to stop — that is the
    /// whole of ADR-0163, and the reason work survives closing the window.
    fn shutdown(&mut self) -> Result<(), String> {
        if !self.active_session_id.is_empty() && self.is_alive() {
            let _ = self.write_raw(&self.command_envelope(
                serde_json::json!({
                    "type": "detach",
                    "activeSessionId": self.active_session_id,
                }),
                &next_id(),
            ));
        }
        self.connected.store(false, Ordering::Relaxed);
        // Half-close: the daemon sees EOF after the detach it has yet to read,
        // and closes its end, which in turn unblocks our reader thread.
        // Closing both halves here would tear the socket down before the
        // detach had been consumed.
        #[cfg(unix)]
        let _ = self.stream.shutdown(std::net::Shutdown::Write);
        Ok(())
    }

    /// Wrap a command in the protocol envelope the daemon expects at v7.
    fn command_envelope(&self, mut command: serde_json::Value, id: &str) -> serde_json::Value {
        if let Some(object) = command.as_object_mut() {
            object.insert("id".into(), serde_json::Value::String(id.to_string()));
        }
        serde_json::json!({
            "type": "command",
            "id": id,
            "protocol": { "name": DAEMON_PROTOCOL_NAME, "version": DAEMON_PROTOCOL_VERSION },
            "command": command,
        })
    }

    fn write_raw(&self, value: &serde_json::Value) -> Result<(), String> {
        let mut line = serde_json::to_string(value)
            .map_err(|error| format!("Failed to serialize Prime daemon command: {error}"))?;
        line.push('\n');
        (&self.stream)
            .write_all(line.as_bytes())
            .and_then(|_| (&self.stream).flush())
            .map_err(|error| format!("Failed to write Prime daemon command: {error}"))
    }

    /// Send a session-scoped command, filling in `activeSessionId`.
    fn send_command(
        &mut self,
        mut command: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let object = command
            .as_object_mut()
            .ok_or_else(|| "Prime daemon command must be a JSON object".to_string())?;
        if !object.contains_key("activeSessionId") && !self.active_session_id.is_empty() {
            object.insert(
                "activeSessionId".into(),
                serde_json::Value::String(self.active_session_id.clone()),
            );
        }
        self.send_bare_command(command)
    }

    /// Send a command exactly as given. Used for the pre-attach handshake,
    /// where there is no session to scope to yet.
    fn send_bare_command(
        &mut self,
        command: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        if !command.is_object() {
            return Err("Prime daemon command must be a JSON object".into());
        }
        let id = next_id();
        let envelope = self.command_envelope(command, &id);

        let (tx, rx) = mpsc::channel();
        {
            let mut pending = self.pending.lock().map_err(poison)?;
            pending.insert(id.clone(), PendingResponse { tx });
        }

        if let Err(error) = self.write_raw(&envelope) {
            let mut pending = self.pending.lock().map_err(poison)?;
            pending.remove(&id);
            return Err(error);
        }

        match rx.recv_timeout(DAEMON_RESPONSE_TIMEOUT) {
            Ok(response) => Ok(response),
            Err(RecvTimeoutError::Timeout) => {
                let mut pending = self.pending.lock().map_err(poison)?;
                pending.remove(&id);
                Err(format!(
                    "Prime daemon command timed out after {}s (id={id})",
                    DAEMON_RESPONSE_TIMEOUT.as_secs()
                ))
            }
            Err(RecvTimeoutError::Disconnected) => {
                Err("Prime daemon response channel closed (connection lost?)".into())
            }
        }
    }

    fn refresh_session_id(&mut self) -> Result<(), String> {
        let response = self.send_command(serde_json::json!({ "type": "get_state" }))?;
        if response["success"].as_bool() == Some(true) {
            if let Some(data) = response.get("data") {
                self.apply_state_data(data);
            }
        }
        Ok(())
    }

    fn apply_state_data(&mut self, data: &serde_json::Value) {
        if let Some(id) = crate::prime_events::session_id_from_state(data) {
            self.session_id = Some(id.to_string());
        }
        if let Some(created) = data["created"].as_str() {
            self.started_at = Some(created.to_string());
        }
        if let Some(session_file) = data["sessionFile"].as_str() {
            self.session_path = Some(session_file.to_string());
        }
        // Read before the model early-return below: a session whose model is
        // momentarily null would otherwise silently keep a stale level.
        if let Some(level) = data["thinkingLevel"].as_str() {
            self.thinking_level = Some(level.to_string());
        }
        let model = &data["model"];
        if model.is_null() {
            return;
        }
        self.model_provider = model["provider"].as_str().map(str::to_string).or_else(|| {
            model
                .get("provider")
                .and_then(|v| v.as_str())
                .map(str::to_string)
        });
        self.model_id = model["id"].as_str().map(str::to_string);
        self.model_name = model["name"]
            .as_str()
            .or_else(|| model["id"].as_str())
            .map(str::to_string);
    }
}

fn spawn_daemon_reader(
    stream: DaemonStream,
    pending: Arc<Mutex<HashMap<String, PendingResponse>>>,
    event_tx: Sender<OutboundLine>,
    connected: Arc<AtomicBool>,
) -> Result<(), String> {
    thread::Builder::new()
        .name("prime-daemon-reader".into())
        .spawn(move || {
            // Strict LF framing: BufRead::read_until(b'\n') only splits on \n,
            // never on U+2028/U+2029 (the trap Node's readline hits).
            let mut reader = BufReader::new(stream);
            let mut buffer = Vec::new();
            loop {
                buffer.clear();
                match reader.read_until(b'\n', &mut buffer) {
                    Ok(0) => {
                        connected.store(false, Ordering::Relaxed);
                        let _ = event_tx.send(OutboundLine::Closed(None));
                        break;
                    }
                    Ok(_) => {
                        // Trim trailing \n and optional \r.
                        if buffer.last() == Some(&b'\n') {
                            buffer.pop();
                        }
                        if buffer.last() == Some(&b'\r') {
                            buffer.pop();
                        }
                        if buffer.is_empty() {
                            continue;
                        }
                        let line = match std::str::from_utf8(&buffer) {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        let Ok(json) = serde_json::from_str::<serde_json::Value>(line) else {
                            log::debug!("prime daemon non-json line: {line}");
                            continue;
                        };
                        if json["type"].as_str() == Some("daemon_closing") {
                            connected.store(false, Ordering::Relaxed);
                        }
                        route_daemon_line(json, &pending, &event_tx);
                    }
                    Err(error) => {
                        connected.store(false, Ordering::Relaxed);
                        let _ = event_tx.send(OutboundLine::Closed(Some(format!(
                            "Prime daemon connection read error: {error}"
                        ))));
                        break;
                    }
                }
            }
        })
        .map_err(|error| format!("Failed to start the Prime daemon reader: {error}"))?;
    Ok(())
}

/// Route one line from the daemon: responses to their caller, everything else
/// onto the event stream.
///
/// Agent activity arrives wrapped as `{"type":"session_event","event":{…}}`
/// with the daemon's own sequencing metadata alongside. The inner object is
/// byte-identical to what RPC mode emitted, so unwrapping exactly one layer
/// here is what lets `prime_events` stay untouched by the transport swap.
fn route_daemon_line(
    json: serde_json::Value,
    pending: &Mutex<HashMap<String, PendingResponse>>,
    event_tx: &Sender<OutboundLine>,
) {
    let is_response = json["type"].as_str() == Some("response");
    if is_response {
        if let Some(id) = json["id"].as_str() {
            if let Ok(mut map) = pending.lock() {
                if let Some(entry) = map.remove(id) {
                    let _ = entry.tx.send(json);
                    return;
                }
            }
        }
        // Unsolicited response — still forward so it isn't lost.
    }

    if json["type"].as_str() == Some("session_event") {
        if let Some(event) = json.get("event") {
            let _ = event_tx.send(OutboundLine::Event(event.clone()));
            return;
        }
    }

    let _ = event_tx.send(OutboundLine::Event(json));
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::MutexGuard;

    /// Every test that touches `host_slot()` must hold this.
    ///
    /// The host registry is a process-wide `OnceLock`, so parallel tests
    /// otherwise tear down each other's connection mid-assertion:
    /// `shutdown_host()` in one test races `run_prompt_stream` in another. It
    /// also guards `RHIZOME_PRIME_DAEMON_SOCKET`, which is process-global: two
    /// tests pointing it at different fake daemons at once would connect to
    /// each other's.
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    fn host_guard() -> MutexGuard<'static, ()> {
        TEST_LOCK.lock().unwrap_or_else(|p| p.into_inner())
    }

    // ── Fake daemon ─────────────────────────────────────────────────────────
    //
    // The one seam this work adds. It is a real unix socket speaking the real
    // envelope framing, not a stub of our own client — so a test passing here
    // means the bytes on the wire were parsed, not that a mock was called.

    #[cfg(unix)]
    const FAKE_ACTIVE_SESSION_ID: &str = "daemon-1";

    #[cfg(unix)]
    struct FakeDaemon {
        path: PathBuf,
        /// Every command the daemon received, inner command object only.
        received: Arc<Mutex<Vec<serde_json::Value>>>,
        _dir: tempfile::TempDir,
    }

    #[cfg(unix)]
    impl FakeDaemon {
        /// Start a listener. `overrides` answers a command, or returns `None`
        /// to fall through to the handshake defaults.
        fn start<H>(overrides: H) -> Self
        where
            H: Fn(&serde_json::Value, &str) -> Option<Vec<serde_json::Value>>
                + Send
                + Sync
                + 'static,
        {
            Self::start_with_hello(overrides, fake_hello())
        }

        /// Start with a chosen greeting, for exercising the version floor.
        fn start_with_hello<H>(overrides: H, hello: serde_json::Value) -> Self
        where
            H: Fn(&serde_json::Value, &str) -> Option<Vec<serde_json::Value>>
                + Send
                + Sync
                + 'static,
        {
            use std::os::unix::net::UnixListener;

            let dir = tempfile::tempdir().unwrap();
            // Keep the filename short: macOS caps a unix socket path at 104
            // bytes, and a tempdir already spends about sixty of them.
            let path = dir.path().join("d.sock");
            let listener = UnixListener::bind(&path).unwrap();
            let received = Arc::new(Mutex::new(Vec::new()));

            let thread_received = Arc::clone(&received);
            let overrides = Arc::new(overrides);
            let hello = Arc::new(hello);
            thread::spawn(move || {
                let session_id = Arc::new(Mutex::new("sess-a".to_string()));
                for stream in listener.incoming() {
                    let Ok(stream) = stream else { break };
                    let received = Arc::clone(&thread_received);
                    let overrides = Arc::clone(&overrides);
                    let session_id = Arc::clone(&session_id);
                    let hello = Arc::clone(&hello);
                    thread::spawn(move || {
                        serve_fake_client(stream, received, overrides, session_id, &hello);
                    });
                }
            });

            Self {
                path,
                received,
                _dir: dir,
            }
        }

        /// Point the transport at this daemon and clear any previous host.
        fn install(&self) {
            std::env::set_var(DAEMON_SOCKET_ENV, &self.path);
            let slot = host_slot();
            let mut guard = slot.host.lock().unwrap_or_else(|p| p.into_inner());
            *guard = None;
        }

        fn commands(&self) -> Vec<String> {
            self.received
                .lock()
                .unwrap()
                .iter()
                .filter_map(|command| command["type"].as_str().map(str::to_string))
                .collect()
        }

        fn command(&self, kind: &str) -> Option<serde_json::Value> {
            self.received
                .lock()
                .unwrap()
                .iter()
                .find(|command| command["type"].as_str() == Some(kind))
                .cloned()
        }

        /// Every command of one type, in the order the daemon received them.
        fn commands_matching(&self, kind: &str) -> Vec<serde_json::Value> {
            self.received
                .lock()
                .unwrap()
                .iter()
                .filter(|command| command["type"].as_str() == Some(kind))
                .cloned()
                .collect()
        }

        /// Wait for a command to arrive, up to a bound.
        ///
        /// Commands the client does not await a response for — `detach` is the
        /// only one — are in flight when the call that sent them returns.
        /// Polling to a deadline keeps that deterministic: it either arrives
        /// or the test fails, with no sleep tuned to a machine's speed.
        fn wait_for_command(&self, kind: &str, within: Duration) -> Option<serde_json::Value> {
            let deadline = Instant::now() + within;
            while Instant::now() < deadline {
                if let Some(command) = self.command(kind) {
                    return Some(command);
                }
                thread::yield_now();
            }
            self.command(kind)
        }
    }

    #[cfg(unix)]
    type Overrides = Arc<
        dyn Fn(&serde_json::Value, &str) -> Option<Vec<serde_json::Value>> + Send + Sync + 'static,
    >;

    #[cfg(unix)]
    fn serve_fake_client(
        stream: std::os::unix::net::UnixStream,
        received: Arc<Mutex<Vec<serde_json::Value>>>,
        overrides: Overrides,
        session_id: Arc<Mutex<String>>,
        hello: &serde_json::Value,
    ) {
        let mut writer = stream.try_clone().unwrap();
        let write = |writer: &mut std::os::unix::net::UnixStream, value: &serde_json::Value| {
            let _ = writeln!(writer, "{value}");
            let _ = writer.flush();
        };

        // The daemon greets before the client says anything.
        write(&mut writer, hello);

        let mut reader = BufReader::new(stream);
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => {}
            }
            let Ok(envelope) = serde_json::from_str::<serde_json::Value>(line.trim()) else {
                continue;
            };
            let id = envelope["id"].as_str().unwrap_or_default().to_string();
            let command = envelope
                .get("command")
                .cloned()
                .unwrap_or(serde_json::Value::Null);
            received.lock().unwrap().push(command.clone());

            let kind = command["type"].as_str().unwrap_or_default();
            let lines = overrides(&command, &id).unwrap_or_else(|| {
                let current = session_id.lock().unwrap().clone();
                match kind {
                    "create" => vec![ok(
                        &id,
                        kind,
                        serde_json::json!({ "activeSessionId": FAKE_ACTIVE_SESSION_ID }),
                    )],
                    "attach" => vec![ok(
                        &id,
                        kind,
                        serde_json::json!({
                            "activeSessionId": FAKE_ACTIVE_SESSION_ID,
                            "snapshot": {
                                "activeSessionId": FAKE_ACTIVE_SESSION_ID,
                                "messages": [],
                                "lastEventSequence": 0
                            }
                        }),
                    )],
                    "get_state" => vec![ok(&id, kind, fake_state(&current))],
                    _ => vec![ok(&id, kind, serde_json::Value::Null)],
                }
            });
            for value in lines {
                write(&mut writer, &value);
            }
        }
    }

    #[cfg(unix)]
    fn fake_hello() -> serde_json::Value {
        serde_json::json!({
            "type": "daemon_hello",
            "socketPath": "/fake/daemon.sock",
            "protocol": { "name": DAEMON_PROTOCOL_NAME, "version": DAEMON_PROTOCOL_VERSION },
            "schemaId": "protocol-7-schema-13-816309b1cd50",
            "appVersion": "0.7.1",
            "clientId": "fake-client",
            "serverCapabilities": ["attach_snapshot", "event_sequence", "slim_attach"],
        })
    }

    #[cfg(unix)]
    fn fake_state(session_id: &str) -> serde_json::Value {
        serde_json::json!({
            "activeSessionId": FAKE_ACTIVE_SESSION_ID,
            "sessionId": session_id,
            "isStreaming": false,
            "model": { "provider": "anthropic", "id": "claude-x", "name": "Claude X" },
        })
    }

    #[cfg(unix)]
    fn ok(id: &str, command: &str, data: serde_json::Value) -> serde_json::Value {
        serde_json::json!({
            "type": "response", "id": id, "command": command, "success": true, "data": data
        })
    }

    #[cfg(unix)]
    fn failed(id: &str, command: &str, error: &str) -> serde_json::Value {
        serde_json::json!({
            "type": "response", "id": id, "command": command, "success": false, "error": error
        })
    }

    /// Wrap an agent event the way the daemon does. The inner object is the
    /// shape RPC mode emitted, pinned from a live 0.7.1 capture.
    #[cfg(unix)]
    fn session_event(event: serde_json::Value) -> serde_json::Value {
        serde_json::json!({
            "type": "session_event",
            "activeSessionId": FAKE_ACTIVE_SESSION_ID,
            "event": event,
            "meta": {
                "id": "daemon-1:1",
                "protocol": { "name": DAEMON_PROTOCOL_NAME, "version": DAEMON_PROTOCOL_VERSION },
                "activeSessionId": FAKE_ACTIVE_SESSION_ID,
                "sequence": 1,
                "emittedAt": "2026-08-15T00:00:00.000Z",
            },
        })
    }

    #[cfg(unix)]
    fn text_delta(text: &str) -> serde_json::Value {
        serde_json::json!({
            "type": "message_update",
            "assistantMessageEvent": { "type": "text_delta", "delta": text }
        })
    }

    #[cfg(unix)]
    fn connect_host(vault: &Path) -> Result<String, String> {
        ensure_host(&vault.to_string_lossy())
    }

    #[cfg(unix)]
    fn prompt_request(vault: &Path, new_session: bool) -> PrimePromptRequest {
        PrimePromptRequest {
            message: "hi".into(),
            system_prompt: None,
            vault_path: vault.to_string_lossy().into_owned(),
            event_name: None,
            provider: None,
            model_id: None,
            new_session,
        }
    }

    // ── Handshake ───────────────────────────────────────────────────────────

    /// The order is the contract: read the greeting, look for work already
    /// running here, create only if there is none, attach, then read state.
    /// Attaching before the daemon has greeted, or issuing a session command
    /// before attaching, is how a client gets rejected in ways that look like
    /// an unreachable service.
    #[cfg(unix)]
    #[test]
    fn connecting_greets_looks_for_running_work_then_attaches_and_reads_state() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        // The default handler answers `list` with no data, so there is nothing
        // to rejoin and this is the first-run path.
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();

        let session_id = connect_host(vault.path()).unwrap();

        assert_eq!(session_id, "sess-a");
        assert_eq!(
            daemon.commands(),
            vec!["list", "create", "attach", "get_state"]
        );
        let _ = shutdown_host();
    }

    /// `create` carries cwd inside `config`. Prime's create command has no
    /// top-level `cwd` field, so sending it there is accepted and ignored —
    /// and the session silently lands in the daemon's own directory, which is
    /// how the vault tools would start reading the wrong tree.
    #[cfg(unix)]
    #[test]
    fn create_sends_the_vault_path_as_the_session_cwd() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();

        connect_host(vault.path()).unwrap();

        let create = daemon.command("create").expect("create was sent");
        assert_eq!(
            create["config"]["cwd"].as_str(),
            Some(vault.path().to_string_lossy().as_ref()),
            "cwd must ride inside config: {create}"
        );
        // Outliving this client is the property ADR-0163 exists for; it should
        // be asked for rather than inherited from a default.
        assert_eq!(create["lifecycle"].as_str(), Some("resident"));
        let _ = shutdown_host();
    }

    /// Every session-scoped command carries the daemon's session handle. A
    /// command sent without it is rejected by the daemon, which would surface
    /// as an inexplicable failure of a feature that used to work.
    #[cfg(unix)]
    #[test]
    fn session_commands_carry_the_daemon_session_handle() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        let _ = get_session_stats();

        let stats = daemon
            .command("get_session_stats")
            .expect("get_session_stats was sent");
        assert_eq!(
            stats["activeSessionId"].as_str(),
            Some(FAKE_ACTIVE_SESSION_ID)
        );
        let _ = shutdown_host();
    }

    /// The whole of ADR-0163 in one assertion. Rhizome does not own Prime, so
    /// closing the connection must detach and leave the session running. A
    /// `kill` here would destroy the user's work on window close.
    #[cfg(unix)]
    #[test]
    fn shutdown_detaches_and_never_kills_the_session() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert!(shutdown_host().unwrap(), "shutdown reports it took a host");

        let detach = daemon.wait_for_command("detach", Duration::from_secs(5));
        assert!(
            detach.is_some(),
            "closing must detach: {:?}",
            daemon.commands()
        );
        assert_eq!(
            detach.unwrap()["activeSessionId"].as_str(),
            Some(FAKE_ACTIVE_SESSION_ID),
            "detach names the session it is releasing"
        );
        let commands = daemon.commands();
        assert!(
            !commands.iter().any(|c| c == "kill" || c == "shutdown"),
            "closing must not stop the session or the daemon: {commands:?}"
        );
    }

    // ── Reattach (#7) ───────────────────────────────────────────────────────

    #[cfg(unix)]
    fn listed(sessions: serde_json::Value) -> serde_json::Value {
        serde_json::json!({ "sessions": sessions })
    }

    fn session_row(
        id: &str,
        cwd: &str,
        last_activity: &str,
        attached_clients: u64,
    ) -> serde_json::Value {
        serde_json::json!({
            "id": id,
            "activeSessionId": id,
            "cwd": cwd,
            "lastActivityAt": last_activity,
            "attachedClients": attached_clients,
            "lifecycle": "live",
            "messageCount": 4,
        })
    }

    /// "Where I left off" is the most recently active session, not the first
    /// the daemon happens to list.
    #[test]
    fn the_most_recently_active_session_is_the_one_to_rejoin() {
        let data = serde_json::json!({
            "sessions": [
                session_row("older", "/vault", "2026-08-15T09:00:00.000Z", 0),
                session_row("newest", "/vault", "2026-08-15T14:30:00.000Z", 0),
                session_row("middle", "/vault", "2026-08-15T11:00:00.000Z", 0),
            ]
        });

        assert_eq!(
            pick_resumable_session(&data, Path::new("/vault")),
            Some("newest".to_string())
        );
    }

    /// A session rooted somewhere else is another vault's work. Opening a
    /// vault must never adopt it.
    #[test]
    fn a_session_from_another_directory_is_never_adopted() {
        let data = serde_json::json!({
            "sessions": [
                session_row("elsewhere", "/other-vault", "2026-08-15T14:30:00.000Z", 0),
            ]
        });

        assert_eq!(pick_resumable_session(&data, Path::new("/vault")), None);
    }

    /// The daemon permits several clients on one session, but this product
    /// shows one conversation per window. Taking a session another client is
    /// displaying would be a hijack, so a fresh one is made instead.
    #[test]
    fn a_session_another_client_is_holding_is_left_alone() {
        let data = serde_json::json!({
            "sessions": [
                session_row("held", "/vault", "2026-08-15T14:30:00.000Z", 1),
                session_row("free", "/vault", "2026-08-15T09:00:00.000Z", 0),
            ]
        });

        // The held one is newer, and still loses.
        assert_eq!(
            pick_resumable_session(&data, Path::new("/vault")),
            Some("free".to_string())
        );
    }

    /// Nothing running here means there is nothing to rejoin — the caller
    /// creates. An empty list must not be mistaken for a candidate.
    #[test]
    fn nothing_running_here_yields_no_candidate() {
        let vault = Path::new("/vault");
        assert_eq!(
            pick_resumable_session(&serde_json::json!({ "sessions": [] }), vault),
            None
        );
        assert_eq!(
            pick_resumable_session(&serde_json::Value::Null, vault),
            None
        );
        assert_eq!(pick_resumable_session(&serde_json::json!({}), vault), None);
    }

    /// A row with no `lastActivityAt` must sort oldest rather than win by
    /// accident — otherwise a malformed row could outrank real work.
    #[test]
    fn a_session_with_no_activity_timestamp_does_not_outrank_real_work() {
        let data = serde_json::json!({
            "sessions": [
                serde_json::json!({
                    "id": "undated", "activeSessionId": "undated",
                    "cwd": "/vault", "attachedClients": 0
                }),
                session_row("dated", "/vault", "2026-08-15T09:00:00.000Z", 0),
            ]
        });

        assert_eq!(
            pick_resumable_session(&data, Path::new("/vault")),
            Some("dated".to_string())
        );
    }

    /// The whole of #7 at the transport seam: reopening rejoins the session
    /// the daemon kept running, instead of stranding it and starting over.
    #[cfg(unix)]
    #[test]
    fn opening_rejoins_the_session_left_running_here() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let cwd = vault.path().to_string_lossy().into_owned();
        let daemon = {
            let cwd = cwd.clone();
            FakeDaemon::start(move |command, id| {
                (command["type"].as_str() == Some("list")).then(|| {
                    vec![ok(
                        id,
                        "list",
                        listed(serde_json::json!([session_row(
                            "left-running",
                            &cwd,
                            "2026-08-15T14:30:00.000Z",
                            0
                        )])),
                    )]
                })
            })
        };
        daemon.install();

        connect_host(vault.path()).unwrap();

        let commands = daemon.commands();
        assert!(
            !commands.contains(&"create".to_string()),
            "rejoining must not strand the running session and start over: {commands:?}"
        );
        let attach = daemon.command("attach").expect("attached");
        assert_eq!(attach["activeSessionId"].as_str(), Some("left-running"));
        assert!(
            get_status().reattached,
            "the UI has to be able to tell a rejoin from a fresh start"
        );

        let _ = shutdown_host();
    }

    /// With nothing to rejoin, opening still creates — #6's behaviour has to
    /// survive #7, or a first run would land nowhere.
    #[cfg(unix)]
    #[test]
    fn opening_with_nothing_running_still_creates_a_session() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| {
            (command["type"].as_str() == Some("list"))
                .then(|| vec![ok(id, "list", listed(serde_json::json!([])))])
        });
        daemon.install();

        connect_host(vault.path()).unwrap();

        assert!(
            daemon.command("create").is_some(),
            "a first run must create"
        );
        assert!(
            !get_status().reattached,
            "a fresh session is not a reattach"
        );

        let _ = shutdown_host();
    }

    /// Enumeration is an optimisation, not a precondition. A daemon that
    /// cannot list must not leave the user unable to open the app at all.
    #[cfg(unix)]
    #[test]
    fn a_failed_enumeration_still_opens_a_session() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| {
            (command["type"].as_str() == Some("list"))
                .then(|| vec![failed(id, "list", "enumeration exploded")])
        });
        daemon.install();

        let session = connect_host(vault.path()).expect("opening must survive a failed list");

        assert_eq!(session, "sess-a");
        assert!(daemon.command("create").is_some());

        let _ = shutdown_host();
    }

    /// Uptime is how a user tells working from stuck, so the session's start
    /// time has to reach status rather than being computed from "now".
    #[cfg(unix)]
    #[test]
    fn status_carries_the_session_start_time_for_uptime() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| {
            (command["type"].as_str() == Some("get_state")).then(|| {
                let mut state = fake_state("sess-a");
                state["created"] = serde_json::json!("2026-08-15T09:00:00.000Z");
                vec![ok(id, "get_state", state)]
            })
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(
            get_status().started_at.as_deref(),
            Some("2026-08-15T09:00:00.000Z")
        );

        let _ = shutdown_host();
    }

    // ── Version floor and unreachable states (#8) ───────────────────────────

    /// A daemon too old to speak this protocol is a hard stop with a version
    /// number the user can act on. ADR-0163 forbids the alternative — quietly
    /// dropping to the old transport would make "close the app, work
    /// continues" untrue with no explanation.
    #[cfg(unix)]
    #[test]
    fn a_daemon_older_than_the_floor_is_refused_and_names_the_version() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start_with_hello(
            |_, _| None,
            serde_json::json!({
                "type": "daemon_hello",
                "protocol": { "name": DAEMON_PROTOCOL_NAME, "version": 6 },
                "appVersion": "0.6.4",
                "clientId": "fake-client",
                "serverCapabilities": [],
            }),
        );
        daemon.install();

        let error = connect_host(vault.path()).expect_err("an old daemon must be refused");

        assert!(error.contains("0.6.4"), "names what is installed: {error}");
        assert!(
            error.contains(MINIMUM_PRIME_VERSION),
            "names what is required: {error}"
        );
        // Refused, not downgraded: no session was created behind the user's back.
        assert!(
            daemon.command("create").is_none(),
            "a refused connection must not start work: {:?}",
            daemon.commands()
        );
        assert!(!get_status().running);
        assert_eq!(
            get_status().problem,
            Some(PrimeConnectionProblem::ServiceTooOld {
                installed_version: Some("0.6.4".into()),
                required_version: MINIMUM_PRIME_VERSION.into(),
            })
        );

        record_problem(None);
    }

    /// A daemon newer than this client still speaks the envelope, so a version
    /// floor must not become a ceiling that breaks on every Prime release.
    #[cfg(unix)]
    #[test]
    fn a_newer_daemon_is_accepted_rather_than_treated_as_incompatible() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start_with_hello(
            |_, _| None,
            serde_json::json!({
                "type": "daemon_hello",
                "protocol": { "name": DAEMON_PROTOCOL_NAME, "version": 9 },
                "appVersion": "0.9.0",
                "clientId": "fake-client",
                "serverCapabilities": [],
            }),
        );
        daemon.install();

        connect_host(vault.path()).expect("a newer daemon is still a daemon");

        assert!(get_status().running);
        assert_eq!(get_status().problem, None);
        let _ = shutdown_host();
    }

    /// A socket nothing is listening on is the "service is not running" case,
    /// and must be distinguishable from Prime not being installed at all —
    /// they need different actions from the user.
    #[cfg(unix)]
    #[test]
    fn an_unreachable_service_is_reported_as_a_state_the_user_can_act_on() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let dir = tempfile::tempdir().unwrap();
        // A path with no listener: connect fails the way a stopped daemon does.
        std::env::set_var(DAEMON_SOCKET_ENV, dir.path().join("absent.sock"));
        {
            let slot = host_slot();
            *slot.host.lock().unwrap_or_else(|p| p.into_inner()) = None;
        }
        record_problem(None);

        let error = connect_host(vault.path()).expect_err("nothing is listening");

        assert!(!error.is_empty());
        let status = get_status();
        assert!(!status.running);
        // Which of the two it is depends on whether this machine has the CLI;
        // both are actionable, and neither may be silence.
        let problem = status.problem.expect("an unreachable service is reported");
        assert!(
            matches!(
                problem,
                PrimeConnectionProblem::ServiceUnreachable { .. }
                    | PrimeConnectionProblem::NotInstalled
            ),
            "{problem:?}"
        );

        record_problem(None);
    }

    /// Reconnecting must clear the state, or the app would keep telling a user
    /// to fix something they already fixed.
    #[cfg(unix)]
    #[test]
    fn connecting_successfully_clears_a_previous_problem() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        record_problem(Some(PrimeConnectionProblem::NotInstalled));
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();

        connect_host(vault.path()).unwrap();

        assert_eq!(
            get_status().problem,
            None,
            "a stale problem must not linger"
        );
        let _ = shutdown_host();
    }

    /// Each case names the one action that fixes it. A message that says only
    /// "unavailable" is the spinner this ticket exists to remove.
    #[test]
    fn every_problem_names_the_action_that_fixes_it() {
        assert!(describe_problem(&PrimeConnectionProblem::NotInstalled).contains("npm i -g"));

        let unreachable = describe_problem(&PrimeConnectionProblem::ServiceUnreachable {
            detail: "connection refused".into(),
        });
        assert!(unreachable.contains("prime-agent status"), "{unreachable}");

        let too_old = describe_problem(&PrimeConnectionProblem::ServiceTooOld {
            installed_version: Some("0.6.4".into()),
            required_version: MINIMUM_PRIME_VERSION.into(),
        });
        assert!(too_old.contains("0.6.4") && too_old.contains(MINIMUM_PRIME_VERSION));

        // An unknown installed version still gives the required one.
        let unknown = describe_problem(&PrimeConnectionProblem::ServiceTooOld {
            installed_version: None,
            required_version: MINIMUM_PRIME_VERSION.into(),
        });
        assert!(unknown.contains(MINIMUM_PRIME_VERSION), "{unknown}");
    }

    /// The version floor is a version, not a protocol number, because that is
    /// what a user can act on.
    #[test]
    fn the_version_floor_is_a_version_a_user_could_install() {
        assert!(MINIMUM_PRIME_VERSION.split('.').count() >= 2);
        assert!(MINIMUM_PRIME_VERSION
            .chars()
            .all(|c| c.is_ascii_digit() || c == '.'));
    }

    // ── Quit semantics (#12) ────────────────────────────────────────────────

    /// The default: closing the harness stops the agent, as Claude Code and
    /// Hermes do. Nothing keeps running that the user cannot see.
    #[test]
    fn quitting_stops_the_session_by_default() {
        assert_eq!(quit_disposition(false), QuitDisposition::StopSession);
    }

    /// Opting in is the whole reason ADR-0163 connects to a daemon rather than
    /// owning a child: a heartbeat that only fires while a window happens to
    /// be open is not a heartbeat.
    #[test]
    fn opting_in_keeps_the_session_running() {
        assert_eq!(quit_disposition(true), QuitDisposition::KeepSessionRunning);
    }

    /// Quitting without a connection has nothing to decide and must not error
    /// on the way out of the app.
    #[cfg(unix)]
    #[test]
    fn quitting_without_a_connection_is_a_no_op() {
        let _guard = host_guard();
        let _ = shutdown_host();

        assert_eq!(
            settle_session_on_quit(false).unwrap(),
            QuitDisposition::NotConnected
        );
        assert_eq!(
            settle_session_on_quit(true).unwrap(),
            QuitDisposition::NotConnected
        );
    }

    /// End to end at the transport: the default ends our session, and ends
    /// **only** ours. `shutdown` would stop every agent on the machine
    /// including other clients' — never the right tool for "the user closed my
    /// window", and the reason this is `kill` instead.
    #[cfg(unix)]
    #[test]
    fn quitting_kills_our_session_and_never_the_whole_service() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(
            settle_session_on_quit(false).unwrap(),
            QuitDisposition::StopSession
        );

        let kill = daemon
            .wait_for_command("kill", Duration::from_secs(5))
            .expect("our session is stopped");
        assert_eq!(
            kill["activeSessionId"].as_str(),
            Some(FAKE_ACTIVE_SESSION_ID),
            "it must name our own session"
        );
        assert!(
            !daemon.commands().contains(&"shutdown".to_string()),
            "the shared service is never stopped: {:?}",
            daemon.commands()
        );
    }

    /// With the toggle on, the session is left running and merely detached —
    /// which is what lets a heartbeat still fire after the app is gone.
    #[cfg(unix)]
    #[test]
    fn opting_in_detaches_without_killing_anything() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(
            settle_session_on_quit(true).unwrap(),
            QuitDisposition::KeepSessionRunning
        );

        assert!(
            daemon
                .wait_for_command("detach", Duration::from_secs(5))
                .is_some(),
            "a kept session is released, not held by a dying process"
        );
        let commands = daemon.commands();
        assert!(
            !commands.contains(&"kill".to_string()),
            "a kept session must survive: {commands:?}"
        );
        assert!(!commands.contains(&"shutdown".to_string()));
    }

    // ── Turns ───────────────────────────────────────────────────────────────

    /// Multi-turn on one connection, with the daemon's `session_event`
    /// wrapper. If the unwrap were missing every event would be an unknown
    /// type and the transcript would render empty while the turn "succeeded".
    #[cfg(unix)]
    #[test]
    fn prompt_maps_wrapped_events_and_survives_two_turns() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let turn = Arc::new(AtomicU64::new(0));
        let daemon = {
            let turn = Arc::clone(&turn);
            FakeDaemon::start(move |command, id| {
                if command["type"].as_str() != Some("prompt") {
                    return None;
                }
                let n = turn.fetch_add(1, Ordering::SeqCst) + 1;
                Some(vec![
                    ok(id, "prompt", serde_json::Value::Null),
                    session_event(serde_json::json!({ "type": "agent_start" })),
                    session_event(text_delta(&format!("turn-{n}"))),
                    session_event(serde_json::json!({
                        "type": "tool_execution_start",
                        "toolCallId": format!("t{n}"),
                        "toolName": "read",
                        "args": { "path": "a.md" }
                    })),
                    session_event(serde_json::json!({
                        "type": "tool_execution_end",
                        "toolCallId": format!("t{n}"),
                        "result": "ok"
                    })),
                    session_event(serde_json::json!({ "type": "agent_end", "messages": [] })),
                ])
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();

        let mut events = Vec::new();
        let session =
            run_prompt_stream(prompt_request(vault.path(), false), |e| events.push(e)).unwrap();

        assert_eq!(session, "sess-a");
        assert!(
            events
                .iter()
                .any(|e| matches!(e, AiAgentStreamEvent::TextDelta { text } if text == "turn-1")),
            "events={events:?}"
        );
        assert!(events.iter().any(
            |e| matches!(e, AiAgentStreamEvent::ToolStart { tool_name, .. } if tool_name == "read")
        ));
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));

        // Second turn on the SAME connection — multi-turn is the whole point.
        let mut events2 = Vec::new();
        run_prompt_stream(prompt_request(vault.path(), false), |e| events2.push(e)).unwrap();
        assert!(
            events2
                .iter()
                .any(|e| matches!(e, AiAgentStreamEvent::TextDelta { text } if text == "turn-2")),
            "events={events2:?}"
        );
        // One connection, not one per turn.
        assert_eq!(
            daemon
                .commands()
                .iter()
                .filter(|c| c.as_str() == "create")
                .count(),
            1
        );

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn prompt_rejected_by_the_daemon_emits_error_then_done_and_clears_streaming() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| {
            (command["type"].as_str() == Some("prompt"))
                .then(|| vec![failed(id, "prompt", "model is rate limited")])
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let mut events = Vec::new();
        run_prompt_stream(prompt_request(vault.path(), false), |e| events.push(e)).unwrap();

        assert!(
            events.iter().any(
                |e| matches!(e, AiAgentStreamEvent::Error { message } if message.contains("rate limited"))
            ),
            "daemon error must reach the user verbatim: {events:?}"
        );
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
        // A failed prompt must not leave the host wedged as "streaming",
        // or the composer stays disabled with no turn in flight.
        assert!(!get_status().is_streaming);

        let _ = shutdown_host();
    }

    /// `new_session` keeps the daemon handle and mints a fresh Prime session
    /// id behind it — verified against 0.7.1. The Init the UI rehydrates from
    /// must carry the new id, and must be emitted exactly once.
    #[cfg(unix)]
    #[test]
    fn new_session_emits_one_init_with_the_refreshed_id() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let fresh = Arc::new(AtomicBool::new(false));
        let daemon = {
            let fresh = Arc::clone(&fresh);
            FakeDaemon::start(move |command, id| match command["type"].as_str() {
                Some("new_session") => {
                    fresh.store(true, Ordering::SeqCst);
                    Some(vec![ok(
                        id,
                        "new_session",
                        serde_json::json!({ "cancelled": false }),
                    )])
                }
                Some("get_state") => {
                    let session = if fresh.load(Ordering::SeqCst) {
                        "sess-fresh"
                    } else {
                        "sess-a"
                    };
                    Some(vec![ok(id, "get_state", fake_state(session))])
                }
                Some("prompt") => Some(vec![
                    ok(id, "prompt", serde_json::Value::Null),
                    session_event(serde_json::json!({ "type": "agent_end", "messages": [] })),
                ]),
                _ => None,
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();

        let mut events = Vec::new();
        let session =
            run_prompt_stream(prompt_request(vault.path(), true), |e| events.push(e)).unwrap();

        assert_eq!(session, "sess-fresh");
        let inits: Vec<&AiAgentStreamEvent> = events
            .iter()
            .filter(|e| matches!(e, AiAgentStreamEvent::Init { .. }))
            .collect();
        assert!(
            matches!(inits.first(), Some(AiAgentStreamEvent::Init { session_id }) if session_id == "sess-fresh"),
            "{events:?}"
        );
        // Exactly one Init — the post-turn refresh must not re-announce the
        // same session the new_session branch already emitted.
        assert_eq!(inits.len(), 1, "duplicate Init: {events:?}");

        // The daemon handle survives new_session; only Prime's id changes.
        let new_session_command = daemon.command("new_session").unwrap();
        assert_eq!(
            new_session_command["activeSessionId"].as_str(),
            Some(FAKE_ACTIVE_SESSION_ID)
        );

        let _ = shutdown_host();
    }

    /// Rhizome does not claim the `extension_ui` capability, so the daemon
    /// should never route one here. If one arrives anyway the turn must not
    /// hang on a prompt this app has no surface to answer.
    #[cfg(unix)]
    #[test]
    fn an_unexpected_extension_ui_request_is_cancelled_so_the_turn_finishes() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        // The daemon only finishes the turn AFTER it sees the cancel, so the
        // turn completing at all proves the reply round-tripped.
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("prompt") => Some(vec![
                ok(id, "prompt", serde_json::Value::Null),
                session_event(serde_json::json!({
                    "type": "extension_ui_request",
                    "requestId": "ui-1",
                    "prompt": "ok?"
                })),
            ]),
            Some("extension_ui_response") => Some(vec![
                session_event(text_delta("after-cancel")),
                session_event(serde_json::json!({ "type": "agent_end", "messages": [] })),
            ]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let mut events = Vec::new();
        run_prompt_stream(prompt_request(vault.path(), false), |e| events.push(e)).unwrap();

        assert!(
            events.iter().any(
                |e| matches!(e, AiAgentStreamEvent::TextDelta { text } if text == "after-cancel")
            ),
            "turn must proceed past the extension UI request: {events:?}"
        );
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
        let cancel = daemon.command("extension_ui_response").unwrap();
        assert_eq!(cancel["requestId"].as_str(), Some("ui-1"));
        assert_eq!(cancel["response"]["cancelled"], true);

        let _ = shutdown_host();
    }

    // ── Status and harness reads ────────────────────────────────────────────

    #[cfg(unix)]
    #[test]
    fn status_surfaces_session_and_model_metadata_while_connected() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        let status = get_status();
        assert!(status.running);
        assert_eq!(status.session_id.as_deref(), Some("sess-a"));
        assert_eq!(status.model_provider.as_deref(), Some("anthropic"));
        assert_eq!(status.model_id.as_deref(), Some("claude-x"));
        assert_eq!(status.model_name.as_deref(), Some("Claude X"));

        assert!(shutdown_host().unwrap(), "shutdown reports it took a host");
        assert!(!get_status().running);
        assert!(
            !shutdown_host().unwrap(),
            "second shutdown is a no-op, not an error"
        );
    }

    /// The RPC host asked for `list_heartbeats` / `list_schedules`. The daemon
    /// answers `Unknown daemon command` to both, and `agent_activity` degrades
    /// a failed sub-request to empty — so the wrong names would have emptied
    /// the band in silence rather than failing loudly.
    #[cfg(unix)]
    #[test]
    fn agent_activity_asks_for_the_daemon_names_for_scheduled_work() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("heartbeats_list") => Some(vec![ok(
                id,
                "heartbeats_list",
                serde_json::json!({ "heartbeats": [{ "id": "hb-1", "prompt": "check in" }] }),
            )]),
            Some("cron_list") => Some(vec![ok(
                id,
                "cron_list",
                serde_json::json!({ "jobs": [{ "id": "job-1", "prompt": "nightly" }] }),
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let activity = agent_activity().unwrap();

        let asked = daemon.commands();
        assert!(asked.contains(&"heartbeats_list".to_string()), "{asked:?}");
        assert!(asked.contains(&"cron_list".to_string()), "{asked:?}");
        assert!(
            !asked.iter().any(|c| c.starts_with("list_")),
            "the RPC spellings are gone: {asked:?}"
        );
        assert_eq!(activity.heartbeats.len(), 1);
        assert_eq!(activity.schedules.len(), 1);

        let _ = shutdown_host();
    }

    // ── Goal set / clear (#20) ──────────────────────────────────────────────

    #[cfg(unix)]
    fn goal_state_json(goal: &Option<(String, Option<u64>)>) -> serde_json::Value {
        match goal {
            None => serde_json::json!({ "active": false, "status": "idle", "tokensUsed": 0 }),
            Some((objective, budget)) => serde_json::json!({
                "active": true,
                "status": "active",
                "objective": objective,
                "tokensUsed": 0,
                "tokenBudget": budget,
            }),
        }
    }

    /// A fake daemon that tracks goal state like Prime's own session-command
    /// parser does: `/goal clear` empties it, `/goal [--budget N] <objective>`
    /// sets it, and `get_state` always reports whatever it currently holds.
    /// `prompt` never carries goal data itself — only admits the text — so a
    /// test relying on the send response instead of a re-read would pass
    /// against this fake even though it proves nothing about confirmation.
    #[cfg(unix)]
    fn goal_tracking_daemon(initial: Option<(String, Option<u64>)>) -> FakeDaemon {
        goal_tracking_daemon_with_streaming(initial, false)
    }

    /// `initially_streaming` reproduces what the real daemon does while a
    /// turn is running: a `/goal` sent through `prompt` is admitted (still
    /// returns success) but never updates goal state, because it is queued
    /// as steering/follow-up rather than parsed as a session command
    /// (confirmed live, 2026-08-16 — see `send_goal_command`'s doc). Only
    /// `abort` clears the streaming flag here, matching what actually
    /// unblocks it.
    #[cfg(unix)]
    fn goal_tracking_daemon_with_streaming(
        initial: Option<(String, Option<u64>)>,
        initially_streaming: bool,
    ) -> FakeDaemon {
        let goal = Arc::new(Mutex::new(initial));
        let streaming = Arc::new(std::sync::atomic::AtomicBool::new(initially_streaming));
        FakeDaemon::start(move |command, id| match command["type"].as_str() {
            Some("abort") => {
                streaming.store(false, Ordering::Relaxed);
                Some(vec![ok(id, "abort", serde_json::Value::Null)])
            }
            Some("prompt") => {
                if streaming.load(Ordering::Relaxed) {
                    // Admitted, but a busy session queues it instead of
                    // running the session-command parser — goal state does
                    // not change.
                    return Some(vec![ok(id, "prompt", serde_json::Value::Null)]);
                }
                let text = command["message"].as_str().unwrap_or_default();
                let mut current = goal.lock().unwrap();
                if text.trim() == "/goal clear" {
                    *current = None;
                } else if let Some(rest) = text.strip_prefix("/goal ") {
                    if let Some(budget_text) = rest.strip_prefix("--budget ") {
                        let mut parts = budget_text.splitn(2, ' ');
                        let budget = parts.next().and_then(|n| n.parse::<u64>().ok());
                        let objective = parts.next().unwrap_or_default().to_string();
                        *current = Some((objective, budget));
                    } else {
                        *current = Some((rest.to_string(), None));
                    }
                }
                Some(vec![ok(id, "prompt", serde_json::Value::Null)])
            }
            Some("get_connection_state") => {
                let current = goal.lock().unwrap();
                Some(vec![ok(
                    id,
                    "get_connection_state",
                    serde_json::json!({
                        "activeSessionId": FAKE_ACTIVE_SESSION_ID,
                        "sessionId": "sess-a",
                        "isStreaming": streaming.load(Ordering::Relaxed),
                        "goal": goal_state_json(&current),
                    }),
                )])
            }
            _ => None,
        })
    }

    /// Confirmation must come from re-reading state. `prompt`'s own response
    /// carries no goal data at all here — if `set_goal` returned success from
    /// that response alone, it would be trusting nothing.
    #[cfg(unix)]
    #[test]
    fn set_goal_confirms_from_a_re_read_not_the_send_response() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = goal_tracking_daemon(None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        let goal = set_goal("ship the release notes", Some(5000)).unwrap();

        assert!(goal.active);
        assert_eq!(goal.objective.as_deref(), Some("ship the release notes"));
        assert_eq!(goal.remaining_tokens, Some(5000));

        let sent = daemon.command("prompt").unwrap();
        assert_eq!(
            sent["message"].as_str(),
            Some("/goal --budget 5000 ship the release notes")
        );

        let _ = shutdown_host();
    }

    /// Prime refuses `/goal <new>` while a goal is already active, so
    /// replacing one means clearing first — both steps confirmed the same
    /// way a fresh set is.
    #[cfg(unix)]
    #[test]
    fn set_goal_replaces_an_active_goal_by_clearing_first() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = goal_tracking_daemon(Some(("old objective".to_string(), Some(1000))));
        daemon.install();
        connect_host(vault.path()).unwrap();

        let goal = set_goal("new objective", None).unwrap();

        assert!(goal.active);
        assert_eq!(goal.objective.as_deref(), Some("new objective"));

        let prompts: Vec<String> = daemon
            .commands_matching("prompt")
            .into_iter()
            .map(|c| c["message"].as_str().unwrap_or_default().to_string())
            .collect();
        assert_eq!(prompts, vec!["/goal clear", "/goal new objective"]);

        let _ = shutdown_host();
    }

    /// A set that never shows up in state must fail, not report success
    /// because the daemon accepted the text.
    #[cfg(unix)]
    #[test]
    fn set_goal_fails_when_state_never_confirms_it() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        // Accepts the prompt but never actually updates goal state — the
        // daemon equivalent of Prime silently no-op'ing the command.
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("prompt") => Some(vec![ok(id, "prompt", serde_json::Value::Null)]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let result = set_goal("ship the release notes", None);

        assert!(matches!(result, Err(message) if message.contains("did not confirm")));

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn clear_goal_confirms_the_goal_is_gone() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = goal_tracking_daemon(Some(("ship the release notes".to_string(), Some(5000))));
        daemon.install();
        connect_host(vault.path()).unwrap();

        clear_goal().unwrap();

        let activity = agent_activity().unwrap();
        assert!(!activity.goal.map(|g| g.active).unwrap_or(false));

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn set_goal_rejects_an_empty_objective_without_contacting_the_daemon() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = goal_tracking_daemon(None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        let result = set_goal("   ", None);

        assert!(matches!(result, Err(message) if message.contains("must not be empty")));
        assert!(!daemon.commands().contains(&"prompt".to_string()));

        let _ = shutdown_host();
    }

    /// A `/goal` sent while the session is server-side busy (most commonly
    /// the goal's own auto-continuation) is queued rather than parsed, so
    /// `set_goal`/`clear_goal` must interrupt it first — otherwise the send
    /// reports success and nothing actually changes (observed live).
    #[cfg(unix)]
    #[test]
    fn clear_goal_aborts_a_busy_session_before_sending_the_clear() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = goal_tracking_daemon_with_streaming(
            Some(("ship the release notes".to_string(), Some(5000))),
            true,
        );
        daemon.install();
        connect_host(vault.path()).unwrap();

        clear_goal().unwrap();

        assert!(daemon.commands().contains(&"abort".to_string()));
        let activity = agent_activity().unwrap();
        assert!(!activity.goal.map(|g| g.active).unwrap_or(false));

        let _ = shutdown_host();
    }

    /// A turn *this* Rhizome client started must never be silently cancelled
    /// just because the goal dialog was also used — that would cut off a
    /// response the user is actively watching stream.
    #[cfg(unix)]
    #[test]
    fn set_goal_refuses_rather_than_interrupting_our_own_in_flight_turn() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = goal_tracking_daemon(None);
        daemon.install();
        connect_host(vault.path()).unwrap();
        with_host_mut(|host| {
            host.is_streaming = true;
            Ok(())
        })
        .unwrap();

        let result = set_goal("ship the release notes", None);

        assert!(matches!(result, Err(message) if message.contains("turn is running")));
        assert!(!daemon.commands().contains(&"prompt".to_string()));
        assert!(!daemon.commands().contains(&"abort".to_string()));

        let _ = shutdown_host();
    }

    /// A connection that has gone away must be evicted, not left reporting
    /// `running` — the UI would offer a composer wired to nothing.
    #[cfg(unix)]
    #[test]
    fn abort_reports_false_and_clears_the_slot_when_the_connection_is_gone() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        // Drop the connection out from under the host, as a daemon restart would.
        {
            let slot = host_slot();
            let mut guard = slot.host.lock().unwrap();
            let host = guard.as_mut().unwrap();
            host.connected.store(false, Ordering::Relaxed);
        }

        assert!(!abort_turn().unwrap(), "a lost connection cannot abort");
        assert!(!get_status().running);

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn abort_returns_false_when_no_host() {
        let _guard = host_guard();
        let _ = shutdown_host();
        assert!(!abort_turn().unwrap());
    }

    #[test]
    fn status_reports_not_running_without_host() {
        let _guard = host_guard();
        let _ = shutdown_host();
        let status = get_status();
        assert!(!status.running);
        assert!(!status.is_streaming);
    }

    // ── Socket discovery ────────────────────────────────────────────────────

    /// The env override is the transport's only injection point. Without it
    /// the tests would drive the developer's own daemon.
    #[test]
    fn the_env_override_wins_over_the_default_socket_path() {
        let _guard = host_guard();
        std::env::set_var(DAEMON_SOCKET_ENV, "/tmp/fake-prime/daemon.sock");
        assert_eq!(
            daemon_socket_path().unwrap(),
            PathBuf::from("/tmp/fake-prime/daemon.sock")
        );
        std::env::remove_var(DAEMON_SOCKET_ENV);
    }

    /// An empty override is a misconfiguration, not "use the default" — the
    /// silent fallback would connect somewhere the operator did not ask for.
    #[test]
    fn an_empty_env_override_is_an_error_rather_than_a_fallback() {
        let _guard = host_guard();
        std::env::set_var(DAEMON_SOCKET_ENV, "");
        assert!(daemon_socket_path().is_err());
        std::env::remove_var(DAEMON_SOCKET_ENV);
    }

    /// Pinned from real `prime-agent status` output. The trailing `*` marks the
    /// default background service and is display, not path — including it
    /// would produce a socket that cannot be opened.
    #[test]
    fn status_output_yields_the_socket_path_without_its_default_marker() {
        let stdout = "socket                                   pid    version  status   sessions  uptime\n\
                      /var/folders/_9/hp/T/prime-agent-501/daemon.sock *  54409  0.7.1    current  0\n\
                      \n* default background service\n";

        assert_eq!(
            parse_status_socket_path(stdout),
            Some(PathBuf::from(
                "/var/folders/_9/hp/T/prime-agent-501/daemon.sock"
            ))
        );
    }

    #[test]
    fn status_output_without_a_socket_yields_nothing() {
        assert_eq!(parse_status_socket_path("no daemon running\n"), None);
        assert_eq!(parse_status_socket_path(""), None);
    }

    #[cfg(unix)]
    #[test]
    fn the_default_socket_path_matches_primes_own_layout() {
        let path = default_daemon_socket_path().expect("a uid on unix");

        assert_eq!(path.file_name().unwrap(), "daemon.sock");
        let dir = path
            .parent()
            .unwrap()
            .file_name()
            .unwrap()
            .to_string_lossy();
        assert!(
            dir.starts_with("prime-agent-"),
            "Prime keys the socket dir by uid: {dir}"
        );
        assert!(path.starts_with(std::env::temp_dir()));
    }

    // ── Line routing ────────────────────────────────────────────────────────

    #[test]
    fn route_delivers_a_response_to_the_waiting_caller() {
        let pending: Mutex<HashMap<String, PendingResponse>> = Mutex::new(HashMap::new());
        let (reply_tx, reply_rx) = mpsc::channel();
        pending
            .lock()
            .unwrap()
            .insert("rhizome-7".into(), PendingResponse { tx: reply_tx });
        let (event_tx, event_rx) = mpsc::channel();

        route_daemon_line(
            serde_json::json!({ "type": "response", "id": "rhizome-7", "success": true }),
            &pending,
            &event_tx,
        );

        let delivered = reply_rx.try_recv().expect("response reached the caller");
        assert_eq!(delivered["id"], "rhizome-7");
        // A matched response must NOT also land on the event stream, or the
        // turn loop would try to interpret a reply as an agent event.
        assert!(event_rx.try_recv().is_err());
        // The entry is consumed, so a duplicate id cannot double-deliver.
        assert!(pending.lock().unwrap().is_empty());
    }

    #[test]
    fn route_forwards_unmatched_and_non_response_lines_as_events() {
        let pending: Mutex<HashMap<String, PendingResponse>> = Mutex::new(HashMap::new());
        let (event_tx, event_rx) = mpsc::channel();

        // Response for an id nobody is waiting on — forwarded, not dropped.
        route_daemon_line(
            serde_json::json!({ "type": "response", "id": "stale", "success": true }),
            &pending,
            &event_tx,
        );
        route_daemon_line(
            serde_json::json!({ "type": "daemon_hello", "clientId": "c1" }),
            &pending,
            &event_tx,
        );

        let first = event_rx.try_recv().expect("stale response forwarded");
        assert!(matches!(first, OutboundLine::Event(ref v) if v["id"] == "stale"));
        let second = event_rx.try_recv().expect("hello forwarded");
        assert!(matches!(second, OutboundLine::Event(ref v) if v["type"] == "daemon_hello"));
    }

    /// The unwrap that lets `prime_events` survive the transport swap. The
    /// daemon nests agent activity one level deeper than RPC mode did; without
    /// this the whole transcript would arrive as an unrecognised event type.
    #[test]
    fn route_unwraps_session_events_to_the_shape_prime_events_parses() {
        let pending: Mutex<HashMap<String, PendingResponse>> = Mutex::new(HashMap::new());
        let (event_tx, event_rx) = mpsc::channel();

        route_daemon_line(
            serde_json::json!({
                "type": "session_event",
                "activeSessionId": "daemon-1",
                "event": { "type": "agent_end", "messages": [] },
                "meta": { "sequence": 12 }
            }),
            &pending,
            &event_tx,
        );

        let forwarded = event_rx.try_recv().expect("event forwarded");
        let OutboundLine::Event(value) = forwarded else {
            panic!("expected an event");
        };
        assert_eq!(
            value["type"], "agent_end",
            "the turn loop terminates on the inner type, not the wrapper"
        );
        assert!(
            value.get("meta").is_none(),
            "daemon sequencing metadata is transport detail: {value}"
        );
    }

    /// A wrapper with no inner event must not be silently swallowed.
    #[test]
    fn route_forwards_a_session_event_wrapper_that_carries_no_event() {
        let pending: Mutex<HashMap<String, PendingResponse>> = Mutex::new(HashMap::new());
        let (event_tx, event_rx) = mpsc::channel();

        route_daemon_line(
            serde_json::json!({ "type": "session_event", "activeSessionId": "d1" }),
            &pending,
            &event_tx,
        );

        let forwarded = event_rx.try_recv().expect("nothing may be dropped");
        assert!(matches!(forwarded, OutboundLine::Event(ref v) if v["type"] == "session_event"));
    }

    // ── Pure helpers ────────────────────────────────────────────────────────

    /// Steering is the whole point of this slice: redirect a running turn
    /// without throwing its work away. `abort` was the only interrupt before.
    #[test]
    fn steer_and_follow_up_send_the_message_prime_expects() {
        assert_eq!(
            build_queue_command("steer", "focus on error handling"),
            serde_json::json!({"type": "steer", "message": "focus on error handling"})
        );
        assert_eq!(
            build_queue_command("follow_up", "then summarise"),
            serde_json::json!({"type": "follow_up", "message": "then summarise"})
        );
    }

    /// Prime's queue state arrives as one event carrying both lists. The UI
    /// needs the count to show "2 queued" without tracking sends itself.
    #[test]
    fn session_action_update_reports_queue_depth() {
        let json = serde_json::json!({
            "type": "session_action_update",
            "actions": {
                "queuedCount": 2,
                "steering": ["focus on error handling"],
                "followUps": ["then summarise"]
            }
        });
        let queued = crate::prime_events::queued_action_count(&json);
        assert_eq!(queued, Some(2));
    }

    /// A payload without an explicit count still has the lists — falling back
    /// to their combined length keeps the indicator honest rather than blank.
    #[test]
    fn queue_depth_falls_back_to_list_lengths_when_count_is_absent() {
        let json = serde_json::json!({
            "type": "session_action_update",
            "actions": {"steering": ["a"], "followUps": ["b", "c"]}
        });
        assert_eq!(crate::prime_events::queued_action_count(&json), Some(3));
    }

    /// Context usage is the whole point of the stats call — a long session
    /// needs to show how full the window is before it compacts, not after.
    #[test]
    fn session_stats_parse_context_usage_and_cost_from_prime_payload() {
        let data = serde_json::json!({
            "sessionId": "abc123",
            "totalMessages": 22,
            "toolCalls": 12,
            "tokens": {"input": 50000, "output": 10000, "total": 105000},
            "cost": 0.45,
            "contextUsage": {"tokens": 60000, "contextWindow": 200000, "percent": 30}
        });

        let stats = PrimeSessionStats::from_state_data(&data);

        assert_eq!(stats.session_id.as_deref(), Some("abc123"));
        assert_eq!(stats.total_messages, Some(22));
        assert_eq!(stats.tool_calls, Some(12));
        assert_eq!(stats.total_tokens, Some(105_000));
        assert_eq!(stats.context_window, Some(200_000));
        assert_eq!(stats.context_percent, Some(30.0));
        assert_eq!(stats.cost, Some(0.45));
    }

    #[test]
    fn models_parse_the_fields_a_picker_needs() {
        let data = serde_json::json!({
            "models": [
                {"id": "grok-4.5", "name": "Grok 4.5", "provider": "xai",
                 "contextWindow": 256000, "reasoning": true, "cost": {"input": 3.0}},
                {"id": "bare", "provider": "local"}
            ]
        });

        let models = models_from_response(&data);

        assert_eq!(models.len(), 2);
        assert_eq!(models[0].provider, "xai");
        assert_eq!(models[0].context_window, Some(256_000));
        assert!(models[0].reasoning);
        // A model with no display name is still selectable; a blank row is not.
        assert_eq!(models[1].name, "bare");
        assert!(!models[1].reasoning);
    }

    /// A model without an id or provider cannot be switched to, so offering it
    /// would be a menu entry that always fails.
    #[test]
    fn models_without_an_id_or_provider_are_dropped() {
        let models = models_from_response(&serde_json::json!({
            "models": [{"name": "no id", "provider": "x"}, {"id": "no provider"}]
        }));

        assert!(models.is_empty());
    }

    /// Live 0.7.2 probe: sourceInfo is the origin, not the flatter
    /// source/location layout still in Prime's docs.
    #[test]
    fn commands_parse_the_source_info_the_menu_filters_on() {
        let data = serde_json::json!({
            "commands": [
                {
                    "name": "skill:ask-matt",
                    "description": "Ask which skill fits",
                    "source": "skill",
                    "sourceInfo": {
                        "path": "/Users/dtc/.agents/skills/ask-matt/SKILL.md",
                        "source": "auto",
                        "scope": "user",
                        "origin": "top-level"
                    }
                },
                {
                    "name": "skill:goal",
                    "description": "Set a persistent objective",
                    "source": "skill",
                    "sourceInfo": {
                        "path": "/opt/prime/skills/goal/SKILL.md",
                        "source": "builtin",
                        "scope": "user"
                    }
                },
                { "description": "nameless" }
            ]
        });

        let commands = commands_from_response(&data);
        assert_eq!(commands.len(), 2);
        assert_eq!(commands[0].name, "skill:ask-matt");
        assert_eq!(commands[0].source.as_deref(), Some("skill"));
        assert_eq!(
            commands[0].source_info.as_ref().unwrap().source.as_deref(),
            Some("auto")
        );
        assert_eq!(
            commands[0].source_info.as_ref().unwrap().scope.as_deref(),
            Some("user")
        );
        assert_eq!(commands[1].name, "skill:goal");
        assert_eq!(
            commands[1].source_info.as_ref().unwrap().source.as_deref(),
            Some("builtin")
        );
    }

    #[test]
    fn fork_refuses_without_an_entry_id() {
        assert!(fork("").is_err());
        assert!(fork("   ").is_err());
    }

    #[test]
    fn set_model_refuses_a_half_specified_model() {
        assert!(set_model("", "grok-4.5").is_err());
        assert!(set_model("xai", "  ").is_err());
    }

    /// The composer chip reads `get_status`, which is a cache of the last
    /// `get_state`. Switching the model without refreshing that cache leaves
    /// the chip on the previous model even when Prime accepted the switch.
    #[cfg(unix)]
    #[test]
    fn status_reports_the_thinking_level_the_daemon_sent() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("get_state") => Some(vec![ok(
                id,
                "get_state",
                serde_json::json!({
                    "sessionId": "sess-a",
                    "isStreaming": false,
                    "thinkingLevel": "high",
                    "model": { "provider": "xai", "id": "grok-4.5", "name": "Grok 4.5" }
                }),
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(get_status().thinking_level.as_deref(), Some("high"));

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn thinking_level_survives_a_state_payload_with_no_model() {
        // apply_state_data returns early when `model` is null. Anything read
        // after that point is silently dropped, so the level is read before
        // it -- this test is the guard on that ordering.
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let calls = Arc::new(Mutex::new(0usize));
        let daemon = {
            let calls = Arc::clone(&calls);
            FakeDaemon::start(move |command, id| match command["type"].as_str() {
                Some("get_state") => {
                    let mut n = calls.lock().unwrap();
                    *n += 1;
                    // First reply carries a model, second does not.
                    let model = if *n <= 1 {
                        serde_json::json!({ "provider": "xai", "id": "grok-4.5", "name": "Grok 4.5" })
                    } else {
                        serde_json::Value::Null
                    };
                    Some(vec![ok(
                        id,
                        "get_state",
                        serde_json::json!({
                            "sessionId": "sess-a",
                            "isStreaming": false,
                            "thinkingLevel": if *n <= 1 { "low" } else { "max" },
                            "model": model
                        }),
                    )])
                }
                _ => None,
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();
        assert_eq!(get_status().thinking_level.as_deref(), Some("low"));

        // Force another state read; the model is null this time.
        let _ = with_host_mut(|host| {
            let response = host.send_command(serde_json::json!({ "type": "get_state" }))?;
            if let Some(data) = response.get("data") {
                host.apply_state_data(data);
            }
            Ok(())
        });
        assert_eq!(
            get_status().thinking_level.as_deref(),
            Some("max"),
            "a null model must not swallow the level",
        );

        let _ = shutdown_host();
    }

    #[test]
    fn set_thinking_level_refuses_a_level_prime_does_not_have() {
        // Fails here rather than at the daemon: an unapplied level leaves the
        // strip showing the old value, which reads as a broken control.
        assert!(set_thinking_level("turbo").is_err());
        assert!(set_thinking_level("").is_err());
        assert!(set_thinking_level("HIGH").is_err(), "levels are lower-case");
    }

    #[test]
    fn set_thinking_level_accepts_every_level_prime_documents() {
        // Guards the list against drift: `prime-agent --help` and
        // pi-agent-core's ThinkingLevel both name exactly these seven.
        assert_eq!(
            PRIME_THINKING_LEVELS,
            ["off", "minimal", "low", "medium", "high", "xhigh", "max"],
        );
    }

    #[cfg(unix)]
    #[test]
    fn set_thinking_level_sends_the_level_to_the_daemon() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let sent: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
        let daemon = {
            let sent = Arc::clone(&sent);
            FakeDaemon::start(move |command, id| match command["type"].as_str() {
                Some("set_thinking_level") => {
                    *sent.lock().unwrap() =
                        Some(command["level"].as_str().unwrap_or_default().to_string());
                    Some(vec![ok(id, "set_thinking_level", serde_json::Value::Null)])
                }
                _ => None,
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();

        set_thinking_level("high").unwrap();
        assert_eq!(sent.lock().unwrap().clone().as_deref(), Some("high"));

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn set_thinking_level_surfaces_a_daemon_refusal() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("set_thinking_level") => Some(vec![failed(
                id,
                "set_thinking_level",
                "model has no reasoning",
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        // A model without reasoning support is a real refusal the user needs
        // to see, not something to swallow into a silently unchanged strip.
        let error = set_thinking_level("high").unwrap_err();
        assert!(error.contains("model has no reasoning"), "got: {error}");

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn set_model_updates_status_to_the_model_just_chosen() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let chosen: Arc<Mutex<Option<(String, String)>>> = Arc::new(Mutex::new(None));
        let daemon = {
            let chosen = Arc::clone(&chosen);
            FakeDaemon::start(move |command, id| match command["type"].as_str() {
                Some("set_model") => {
                    *chosen.lock().unwrap() = Some((
                        command["provider"].as_str().unwrap_or_default().to_string(),
                        command["modelId"].as_str().unwrap_or_default().to_string(),
                    ));
                    Some(vec![ok(id, "set_model", serde_json::Value::Null)])
                }
                Some("get_state") => {
                    let model = match chosen.lock().unwrap().clone() {
                        Some((provider, model_id)) => serde_json::json!({
                            "provider": provider, "id": model_id, "name": model_id
                        }),
                        None => serde_json::json!({
                            "provider": "anthropic", "id": "claude-x", "name": "Claude X"
                        }),
                    };
                    Some(vec![ok(
                        id,
                        "get_state",
                        serde_json::json!({
                            "sessionId": "sess-a", "isStreaming": false, "model": model
                        }),
                    )])
                }
                _ => None,
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(get_status().model_id.as_deref(), Some("claude-x"));
        set_model("xai", "grok-4.5").unwrap();
        let status = get_status();
        assert_eq!(status.model_provider.as_deref(), Some("xai"));
        assert_eq!(status.model_id.as_deref(), Some("grok-4.5"));

        let _ = shutdown_host();
    }

    #[test]
    fn messages_parse_role_text_and_timestamp_from_prime_payload() {
        let data = serde_json::json!({
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": "hello"}],
                    "timestamp": 1_723_000_000_000u64
                },
                {
                    "role": "assistant",
                    "content": [
                        {"type": "text", "text": "hi "},
                        {"type": "text", "text": "there"}
                    ]
                }
            ]
        });

        let messages = messages_from_response(&data);

        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[0].text, "hello");
        assert_eq!(messages[0].timestamp, Some(1_723_000_000_000));
        // Adjacent text blocks are one utterance, not two.
        assert_eq!(messages[1].text, "hi there");
        assert_eq!(messages[1].timestamp, None);
    }

    /// The parse must not become a text extractor. A rehydrated transcript
    /// needs the tool calls too, and Prime's block taxonomy is not ours to
    /// enumerate — anything we fail to recognise still has to survive.
    #[test]
    fn messages_preserve_non_text_content_blocks_verbatim() {
        let data = serde_json::json!({
            "messages": [{
                "role": "assistant",
                "content": [
                    {"type": "thinking", "thinking": "weighing options"},
                    {"type": "text", "text": "Reading the file."},
                    {"type": "tool_use", "id": "t1", "name": "read", "input": {"path": "a.md"}},
                    {"type": "some_future_block", "payload": {"nested": true}}
                ]
            }]
        });

        let messages = messages_from_response(&data);

        assert_eq!(messages[0].text, "Reading the file.");
        let blocks = messages[0]
            .content
            .as_array()
            .expect("content stays an array");
        assert_eq!(blocks.len(), 4, "no block may be dropped");
        assert_eq!(blocks[2]["name"], "read");
        assert_eq!(blocks[2]["input"]["path"], "a.md");
        assert_eq!(
            blocks[3]["payload"]["nested"], true,
            "an unrecognised block kind must round-trip untouched"
        );
    }

    /// A fresh session answers `{"messages": []}`, and a malformed payload must
    /// not be louder than an empty one — neither is an error the UI can act on.
    #[test]
    fn messages_are_empty_rather_than_an_error_when_absent() {
        assert!(messages_from_response(&serde_json::json!({"messages": []})).is_empty());
        assert!(messages_from_response(&serde_json::json!({})).is_empty());
        assert!(messages_from_response(&serde_json::Value::Null).is_empty());
    }

    /// Tolerate a bare string where a block array was expected. Treating it as
    /// "no text" would lose the whole message for one character of strictness.
    /// C26. What Prime is sent — and therefore what the log stores — is the
    /// user's message behind a system-instruction block. Replaying that
    /// verbatim showed "hi" as a screenful of instructions the user never
    /// wrote. Pinned from a real session log, not composed here.
    #[test]
    fn a_replayed_user_turn_shows_what_the_user_typed_not_the_system_block() {
        let stored = "System instructions:\nYou are working inside Rhizome, a local-first \
                      Markdown knowledge base.\n\nNotes are Markdown files with YAML \
                      frontmatter.\n\nUser request:\nhi";
        let messages = messages_from_response(&serde_json::json!({
            "messages": [{ "role": "user", "content": [{"type": "text", "text": stored}] }]
        }));

        assert_eq!(messages[0].text, "hi");
        // The composition really happened, so the raw record keeps it. This is
        // a display concern, not a licence to rewrite the transcript.
        assert!(
            messages[0].content[0]["text"]
                .as_str()
                .unwrap()
                .starts_with("System instructions:"),
            "content stays verbatim"
        );
    }

    /// Only the user side is composed. An assistant message that happens to
    /// quote the marker must not be cut apart.
    #[test]
    fn an_assistant_message_is_never_split_on_the_prompt_marker() {
        let quoted = "The prompt looks like:\n\nUser request:\nhi";
        let messages = messages_from_response(&serde_json::json!({
            "messages": [{ "role": "assistant", "content": [{"type": "text", "text": quoted}] }]
        }));

        assert_eq!(messages[0].text, quoted);
    }

    /// A prompt sent without a system block is already the user's own words.
    #[test]
    fn a_user_turn_with_no_system_block_is_left_alone() {
        let messages = messages_from_response(&serde_json::json!({
            "messages": [{ "role": "user", "content": [{"type": "text", "text": "plain ask"}] }]
        }));

        assert_eq!(messages[0].text, "plain ask");
    }

    /// Whatever `build_prompt` composes, this must give back exactly the
    /// message that went in — including one that quotes the marker itself,
    /// where truncating the user is the worse of the two failure modes.
    #[test]
    fn composing_then_recovering_a_prompt_returns_the_original_message() {
        use crate::cli_agent_runtime::{build_prompt, user_request_from_prompt};

        for message in [
            "hi",
            "",
            "multi\nline ask",
            "quoting\n\nUser request:\nitself",
        ] {
            let composed = build_prompt(message, Some("system context here"));
            assert_eq!(
                user_request_from_prompt(&composed),
                Some(message),
                "round trip failed for {message:?}"
            );
        }

        // No system block: nothing to recover, and the caller keeps the text.
        assert_eq!(user_request_from_prompt("just a message"), None);
    }

    #[test]
    fn message_text_accepts_a_bare_string_content() {
        let messages = messages_from_response(&serde_json::json!({
            "messages": [{"role": "user", "content": "plain"}]
        }));

        assert_eq!(messages[0].text, "plain");
        assert_eq!(messages[0].content, serde_json::json!("plain"));
    }

    /// Prime omits fields on a fresh session. Missing must stay `None` rather
    /// than defaulting to 0 — "0% context used" and "unknown" are different
    /// claims, and the UI must not render a confident zero.
    #[test]
    fn session_stats_leave_absent_fields_unknown_rather_than_zero() {
        let stats = PrimeSessionStats::from_state_data(&serde_json::json!({}));

        assert_eq!(stats.context_percent, None);
        assert_eq!(stats.total_tokens, None);
        assert_eq!(stats.cost, None);
        assert_eq!(stats.session_id, None);
    }

    #[test]
    fn next_id_is_unique() {
        let a = next_id();
        let b = next_id();
        assert_ne!(a, b);
        assert!(a.starts_with("rhizome-"));
    }

    #[test]
    fn normalize_cwd_falls_back_to_home_for_blank_paths() {
        let home = dirs::home_dir().expect("home dir");
        assert_eq!(normalize_cwd("").unwrap(), home);
        assert_eq!(normalize_cwd("   ").unwrap(), home);
    }

    #[test]
    fn normalize_cwd_expands_tilde_and_trims() {
        let home = dirs::home_dir().expect("home dir");
        assert_eq!(normalize_cwd("  ~/vault  ").unwrap(), home.join("vault"));
        assert_eq!(
            normalize_cwd("/tmp/plain").unwrap(),
            PathBuf::from("/tmp/plain")
        );
    }

    #[test]
    fn response_error_prefers_error_then_message_then_whole_body() {
        let both = serde_json::json!({ "error": "boom", "message": "ignored" });
        assert_eq!(response_error(&both, "prompt"), "boom");

        let message_only = serde_json::json!({ "message": "softer" });
        assert_eq!(response_error(&message_only, "prompt"), "softer");

        // Neither field: the command name must survive so the caller can tell
        // which command failed, not just that something did.
        let neither = serde_json::json!({ "success": false });
        let fallback = response_error(&neither, "set_model");
        assert!(fallback.contains("set_model"), "{fallback}");
    }

    /// A failure mode the daemon introduces and RPC mode could not produce:
    /// one session log can only be live in one worker, and the daemon holds
    /// every client's. Pinned from a live 0.7.1 refusal.
    ///
    /// The raw message names an internal worker id and a full path. Neither is
    /// something a user can act on, and `worker` is transport vocabulary that
    /// must never reach the UI (`CONTEXT.md`).
    #[test]
    fn a_session_held_elsewhere_is_explained_rather_than_leaked() {
        let refusal = serde_json::json!({
            "type": "response",
            "command": "switch_session",
            "success": false,
            "error": "Session is already active in ba59aa844040: \
                      /Users/dtc/.prime/agent/sessions/01a005b2-9453.jsonl",
            "errorInfo": {
                "code": "session_already_active",
                "sessionPath": "/Users/dtc/.prime/agent/sessions/01a005b2-9453.jsonl",
                "activeSessionId": "ba59aa844040"
            }
        });

        let message = switch_session_error(&refusal);

        assert!(
            !message.contains("ba59aa844040"),
            "an internal worker id is not actionable: {message}"
        );
        assert!(
            !message.contains(".jsonl"),
            "a session file path is not actionable: {message}"
        );
        assert!(
            !message.to_lowercase().contains("worker"),
            "`worker` stays in the transport layer: {message}"
        );
        assert!(
            message.to_lowercase().contains("already open"),
            "the user must learn what is wrong: {message}"
        );
    }

    /// Any other refusal keeps Prime's own wording — inventing a friendlier
    /// message for an error we have not seen would hide what went wrong.
    #[test]
    fn other_switch_failures_keep_primes_own_wording() {
        let refusal = serde_json::json!({
            "type": "response",
            "command": "switch_session",
            "success": false,
            "error": "Session file is corrupt"
        });

        assert_eq!(switch_session_error(&refusal), "Session file is corrupt");
    }

    // ── Live ────────────────────────────────────────────────────────────────

    /// Drive a real Prime daemon end to end.
    ///
    /// ```sh
    /// cargo test --lib prime_session_host::tests::live_daemon -- --ignored --nocapture
    /// ```
    ///
    /// Ignored by default because it needs `prime-agent daemon` running and
    /// spends real tokens. It exists because this repo has shipped code that
    /// passed every test and was unreachable in the app: a fake socket proves
    /// the framing, and only the real daemon proves the framing was right.
    #[cfg(unix)]
    #[test]
    #[ignore = "requires a running prime-agent daemon (see `prime-agent status`)"]
    fn live_daemon_round_trip() {
        let _guard = host_guard();
        // Use the real socket, not whatever a sibling test last pointed at.
        std::env::remove_var(DAEMON_SOCKET_ENV);
        let vault = tempfile::tempdir().unwrap();

        let socket = daemon_socket_path().expect("a reachable daemon");
        println!("socket: {}", socket.display());

        let session_id = ensure_host(&vault.path().to_string_lossy()).expect("connect + attach");
        println!("session: {session_id}");
        assert!(!session_id.is_empty(), "a live session must report an id");

        let mut events = Vec::new();
        run_prompt_stream(
            PrimePromptRequest {
                message: "Reply with exactly the word: pong".into(),
                system_prompt: None,
                vault_path: vault.path().to_string_lossy().into_owned(),
                event_name: None,
                provider: None,
                model_id: None,
                new_session: false,
            },
            |event| events.push(event),
        )
        .expect("a live turn");

        let text: String = events
            .iter()
            .filter_map(|event| match event {
                AiAgentStreamEvent::TextDelta { text } => Some(text.as_str()),
                _ => None,
            })
            .collect();
        println!("assistant: {text:?}");
        assert!(
            !text.trim().is_empty(),
            "a live turn must stream text: {events:?}"
        );
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));

        // The reads the UI depends on, against real payloads.
        let stats = get_session_stats().expect("live stats");
        println!("stats: {stats:?}");
        assert!(
            stats.context_window.unwrap_or(0) > 0,
            "a live session knows its context window: {stats:?}"
        );
        let messages = get_messages().expect("live messages");
        assert!(
            messages.len() >= 2,
            "the turn above is history now: {messages:?}"
        );
        assert!(get_status().running);

        // Detach, then reconnect: the daemon outlives this client, which is
        // the property the whole transport change exists for.
        assert!(shutdown_host().unwrap());
        assert!(!get_status().running);
        let reconnected = ensure_host(&vault.path().to_string_lossy())
            .expect("the daemon is still there after we let go of it");
        println!("reconnected session: {reconnected}");
        assert!(!reconnected.is_empty());
        let _ = shutdown_host();
    }

    /// Live counterpart to the goal fake-daemon tests (#20): set, replace and
    /// clear a goal against a real `prime-agent daemon`, proving the
    /// `/goal [--budget N] <objective>` text this module sends is actually
    /// what the installed daemon's session-command parser accepts — a fake
    /// daemon only proves our own assumption about that text, not Prime's.
    ///
    /// ```sh
    /// cargo test --lib prime_session_host::tests::live_goal_round_trip -- --ignored --nocapture
    /// ```
    #[cfg(unix)]
    #[test]
    #[ignore = "requires a running prime-agent daemon (see `prime-agent status`)"]
    fn live_goal_round_trip() {
        let _guard = host_guard();
        std::env::remove_var(DAEMON_SOCKET_ENV);
        let vault = tempfile::tempdir().unwrap();

        let session_id = ensure_host(&vault.path().to_string_lossy()).expect("connect + attach");
        println!("session: {session_id}");

        let goal = set_goal("rhizome-agent live goal demo", Some(1234)).expect("set_goal");
        println!("set: {goal:?}");
        assert!(goal.active);
        assert_eq!(
            goal.objective.as_deref(),
            Some("rhizome-agent live goal demo")
        );
        assert_eq!(goal.remaining_tokens, Some(1234));

        let replaced = set_goal("rhizome-agent live goal demo (replaced)", None)
            .expect("set_goal replaces an active goal");
        println!("replaced: {replaced:?}");
        assert!(replaced.active);
        assert_eq!(
            replaced.objective.as_deref(),
            Some("rhizome-agent live goal demo (replaced)")
        );

        clear_goal().expect("clear_goal");
        let activity = agent_activity().expect("agent_activity after clear");
        println!("after clear: {:?}", activity.goal);
        assert!(!activity.goal.map(|g| g.active).unwrap_or(false));

        let _ = shutdown_host();
    }

    /// Live counterpart to the version-floor tests: a real daemon must report
    /// no problem, and taking it away must produce an actionable one.
    ///
    /// ```sh
    /// cargo test --lib prime_session_host::tests::live_unreachable -- --ignored --nocapture
    /// ```
    ///
    /// The too-old case is not forced here — downgrading the developer's
    /// `prime-agent` to prove a version check is a worse trade than the fake
    /// daemon that already covers it. That gap is deliberate and stated rather
    /// than papered over.
    #[cfg(unix)]
    #[test]
    #[ignore = "requires a running prime-agent daemon (see `prime-agent status`)"]
    fn live_unreachable_service_is_actionable_and_recovers() {
        let _guard = host_guard();
        std::env::remove_var(DAEMON_SOCKET_ENV);
        record_problem(None);
        let vault = tempfile::tempdir().unwrap();

        // A real daemon: connected, nothing to report.
        ensure_host(&vault.path().to_string_lossy()).expect("the real daemon");
        let healthy = get_status();
        assert!(healthy.running);
        assert_eq!(healthy.problem, None, "a reachable service reports nothing");
        let _ = shutdown_host();

        // Forced failure: point at a socket nothing is listening on.
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var(DAEMON_SOCKET_ENV, dir.path().join("gone.sock"));
        let error = ensure_host(&vault.path().to_string_lossy())
            .expect_err("a missing service must not look like success");
        println!("forced failure: {error}");
        let broken = get_status();
        assert!(!broken.running);
        let problem = broken.problem.expect("an actionable state, not silence");
        println!("reported: {problem:?}");
        assert!(matches!(
            problem,
            PrimeConnectionProblem::ServiceUnreachable { .. }
                | PrimeConnectionProblem::NotInstalled
        ));

        // Recovery: the real daemon is still there, and the state must clear.
        std::env::remove_var(DAEMON_SOCKET_ENV);
        ensure_host(&vault.path().to_string_lossy()).expect("reconnect to the real daemon");
        assert_eq!(
            get_status().problem,
            None,
            "a fixed problem must stop being reported"
        );
        let _ = shutdown_host();
        record_problem(None);
    }

    /// Quit semantics against a **real** Prime daemon, both ways.
    ///
    /// ```sh
    /// RHIZOME_TEST_DAEMON_SOCKET=/tmp/a/t.sock \
    ///   cargo test --lib prime_session_host::tests::live_quit -- --ignored --nocapture
    /// ```
    ///
    /// Runs against an **isolated** daemon (`prime-agent --mode daemon
    /// --daemon-socket <path>`) rather than the developer's default background
    /// service. Nothing here stops a shared service any more — that was the
    /// point of making quit session-scoped — but the test still creates and
    /// kills real sessions, which is not something to do in someone's live
    /// workspace.
    #[cfg(unix)]
    #[test]
    #[ignore = "requires an isolated daemon; set RHIZOME_TEST_DAEMON_SOCKET"]
    fn live_quit_stops_our_session_by_default_and_keeps_it_when_asked() {
        let _guard = host_guard();
        let socket = std::env::var("RHIZOME_TEST_DAEMON_SOCKET")
            .expect("set RHIZOME_TEST_DAEMON_SOCKET to an isolated daemon socket");
        std::env::set_var(DAEMON_SOCKET_ENV, &socket);
        record_problem(None);
        let vault = tempfile::tempdir().unwrap();

        // ── Default: our session is stopped ──────────────────────────────
        ensure_host(&vault.path().to_string_lossy()).expect("connect");
        let stopped_id = with_host_mut(|host| Ok(host.active_session_id.clone())).unwrap();
        assert_eq!(
            settle_session_on_quit(false).unwrap(),
            QuitDisposition::StopSession
        );
        println!("default quit stopped session {stopped_id}");

        // The service itself is untouched, and the session is gone from it.
        std::thread::sleep(Duration::from_secs(1));
        ensure_host(&vault.path().to_string_lossy())
            .expect("the shared service must survive our quitting");
        let resident =
            with_host_mut(|host| host.send_bare_command(serde_json::json!({ "type": "list" })))
                .expect("list");
        let ids: Vec<String> = resident["data"]["sessions"]
            .as_array()
            .map(|rows| {
                rows.iter()
                    .filter_map(|row| row["activeSessionId"].as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        println!("resident after default quit: {ids:?}");
        assert!(
            !ids.contains(&stopped_id),
            "the stopped session must be gone: {ids:?}"
        );

        // ── Opted in: the session is left running ────────────────────────
        let kept_id = with_host_mut(|host| Ok(host.active_session_id.clone())).unwrap();
        assert_eq!(
            settle_session_on_quit(true).unwrap(),
            QuitDisposition::KeepSessionRunning
        );
        std::thread::sleep(Duration::from_secs(1));

        ensure_host(&vault.path().to_string_lossy()).expect("reconnect");
        let after =
            with_host_mut(|host| host.send_bare_command(serde_json::json!({ "type": "list" })))
                .expect("list");
        let ids_after: Vec<String> = after["data"]["sessions"]
            .as_array()
            .map(|rows| {
                rows.iter()
                    .filter_map(|row| row["activeSessionId"].as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        println!("kept session {kept_id}; resident now: {ids_after:?}");
        assert!(
            ids_after.contains(&kept_id),
            "an opted-in session must outlive quitting: {ids_after:?}"
        );

        let _ = shutdown_host();
        std::env::remove_var(DAEMON_SOCKET_ENV);
        record_problem(None);
    }

    #[test]
    fn next_id_values_are_monotonic_and_namespaced() {
        let ids: Vec<String> = (0..5).map(|_| next_id()).collect();
        let unique: std::collections::HashSet<&String> = ids.iter().collect();
        assert_eq!(unique.len(), ids.len(), "ids must not repeat: {ids:?}");
        assert!(ids.iter().all(|id| id.starts_with("rhizome-")));
    }

    // ── Menu-bar roster (#13) ───────────────────────────────────────────────

    #[test]
    fn roster_sessions_reads_the_daemon_shape() {
        let response = serde_json::json!({
            "success": true,
            "data": { "sessions": [{ "id": "a" }, { "id": "b" }] }
        });
        let sessions = roster_sessions(&response);
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0]["id"], "a");
    }

    #[test]
    fn roster_sessions_tolerates_a_bare_sessions_array() {
        let response = serde_json::json!({ "sessions": [{ "id": "only" }] });
        assert_eq!(roster_sessions(&response).len(), 1);
    }

    #[test]
    fn roster_sessions_is_empty_when_the_shape_is_unrecognised() {
        assert!(roster_sessions(&serde_json::json!({ "data": {} })).is_empty());
        assert!(roster_sessions(&serde_json::json!({})).is_empty());
        assert!(roster_sessions(&serde_json::json!({ "data": { "sessions": 7 } })).is_empty());
    }

    /// Drive `read_roster_over` against a scripted daemon on the other end of a
    /// socket pair. Returns what the roster query produced plus every command
    /// the fake daemon received, so the exchange itself can be asserted.
    #[cfg(unix)]
    fn roster_against_fake_daemon(
        script: impl Fn(&serde_json::Value) -> Vec<serde_json::Value> + Send + 'static,
        greet: bool,
    ) -> (
        Result<Vec<serde_json::Value>, String>,
        Vec<serde_json::Value>,
    ) {
        let (client, server) = std::os::unix::net::UnixStream::pair().unwrap();
        let received = Arc::new(Mutex::new(Vec::new()));
        let thread_received = Arc::clone(&received);

        let daemon = thread::spawn(move || {
            let mut writer = server.try_clone().unwrap();
            if greet {
                let _ = writeln!(writer, "{}", fake_hello());
                let _ = writer.flush();
            }
            let mut reader = BufReader::new(server);
            let mut line = String::new();
            if reader.read_line(&mut line).unwrap_or(0) == 0 {
                return;
            }
            let Ok(envelope) = serde_json::from_str::<serde_json::Value>(line.trim()) else {
                return;
            };
            thread_received.lock().unwrap().push(envelope.clone());
            for value in script(&envelope) {
                let _ = writeln!(writer, "{value}");
                let _ = writer.flush();
            }
        });

        let _ = client.set_read_timeout(Some(Duration::from_secs(5)));
        let result = read_roster_over(client);
        let _ = daemon.join();
        let commands = received.lock().unwrap().clone();
        (result, commands)
    }

    #[cfg(unix)]
    #[test]
    fn roster_query_greets_then_lists() {
        let (result, commands) = roster_against_fake_daemon(
            |envelope| {
                let id = envelope["id"].as_str().unwrap_or_default().to_string();
                vec![serde_json::json!({
                    "type": "response",
                    "id": id,
                    "command": "list",
                    "success": true,
                    "data": { "sessions": [
                        { "id": "root", "activity": "working" },
                        { "id": "kid", "runtimeKind": "subagent" }
                    ] }
                })]
            },
            true,
        );

        let sessions = result.expect("roster");
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0]["activity"], "working");

        // The command must go out inside the protocol envelope, after the
        // greeting — a bare `list` written first is simply never answered.
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0]["type"], "command");
        assert_eq!(commands[0]["command"]["type"], "list");
        assert_eq!(commands[0]["protocol"]["name"], DAEMON_PROTOCOL_NAME);
        assert_eq!(commands[0]["protocol"]["version"], DAEMON_PROTOCOL_VERSION);
    }

    #[cfg(unix)]
    #[test]
    fn roster_query_skips_events_before_the_response() {
        // The daemon interleaves session events with command responses on one
        // stream; matching on anything less than the command id reads an event
        // as the answer and returns an empty roster.
        let (result, _) = roster_against_fake_daemon(
            |envelope| {
                let id = envelope["id"].as_str().unwrap_or_default().to_string();
                vec![
                    serde_json::json!({ "type": "session_event", "event": { "type": "agent_end" } }),
                    serde_json::json!({ "type": "response", "id": "someone-else", "success": true,
                                        "data": { "sessions": [] } }),
                    serde_json::json!({
                        "type": "response", "id": id, "command": "list", "success": true,
                        "data": { "sessions": [{ "id": "mine" }] }
                    }),
                ]
            },
            true,
        );
        let sessions = result.expect("roster");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0]["id"], "mine");
    }

    #[cfg(unix)]
    #[test]
    fn roster_query_is_quiet_when_the_daemon_refuses() {
        // "Nothing running" and "the service said no" must render the same
        // quiet way; an error banner for a service the user never started is
        // noise in a popover opened to capture a thought.
        let (result, _) = roster_against_fake_daemon(
            |envelope| {
                let id = envelope["id"].as_str().unwrap_or_default().to_string();
                vec![serde_json::json!({
                    "type": "response", "id": id, "command": "list",
                    "success": false, "error": "enumeration exploded"
                })]
            },
            true,
        );
        assert_eq!(result.expect("roster"), Vec::<serde_json::Value>::new());
    }

    #[cfg(unix)]
    #[test]
    fn roster_query_is_quiet_when_the_daemon_hangs_up() {
        let (result, _) = roster_against_fake_daemon(|_| Vec::new(), true);
        assert_eq!(result.expect("roster"), Vec::<serde_json::Value>::new());
    }

    /// End-to-end against whatever `prime-agent` daemon is actually running.
    ///
    /// Ignored by default — it needs a live daemon, so it is environment
    /// dependent and has no business in the push gate. Run it by hand when
    /// changing the roster protocol:
    ///
    /// ```text
    /// cargo test --manifest-path src-tauri/Cargo.toml --lib \
    ///   roster_against_the_live_daemon -- --ignored --nocapture
    /// ```
    ///
    /// It exists because every other roster test speaks to a fake daemon of
    /// our own making: they prove the framing is parsed, not that the real
    /// daemon answers `list` the way this client expects.
    #[cfg(unix)]
    #[test]
    #[ignore = "needs a running prime-agent daemon"]
    fn roster_against_the_live_daemon() {
        let _guard = host_guard();
        let sessions = list_running_sessions().expect("roster");
        println!("live daemon reported {} sessions", sessions.len());
        for session in &sessions {
            println!(
                "  {} kind={} activity={} depth={}",
                session["id"].as_str().unwrap_or("?"),
                session["runtimeKind"].as_str().unwrap_or("?"),
                session["activity"].as_str().unwrap_or("?"),
                session["rlmDepth"],
            );
        }
        assert!(
            !sessions.is_empty(),
            "expected at least one session; start one with `prime-agent --mode daemon`",
        );
        // The three fields the menu-bar roster is built on. If the daemon ever
        // stops sending these, the list silently renders as nothing.
        assert!(sessions.iter().all(|s| s["activeSessionId"].is_string()));
        assert!(sessions.iter().any(|s| s["runtimeKind"].is_string()));
        assert!(sessions.iter().any(|s| s["activity"].is_string()));
    }

    #[cfg(unix)]
    #[test]
    fn roster_is_empty_when_no_daemon_is_listening() {
        // The ordinary case on a fresh boot: the socket path resolves but
        // nothing is behind it. The menu bar must show nothing, not an error.
        let _guard = host_guard();
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var(DAEMON_SOCKET_ENV, dir.path().join("absent.sock"));
        let sessions = list_running_sessions().expect("roster");
        std::env::remove_var(DAEMON_SOCKET_ENV);
        assert!(sessions.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn roster_is_empty_when_the_socket_path_cannot_be_resolved() {
        let _guard = host_guard();
        // An empty override is the one input `daemon_socket_path` rejects
        // outright, so this exercises the unresolvable branch.
        std::env::set_var(DAEMON_SOCKET_ENV, "");
        let sessions = list_running_sessions().expect("roster");
        std::env::remove_var(DAEMON_SOCKET_ENV);
        assert!(sessions.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn roster_query_is_quiet_when_the_daemon_never_greets() {
        // No greeting means the command is never sent; the connection closing
        // must end the loop rather than spin until the deadline.
        let (result, commands) = roster_against_fake_daemon(|_| Vec::new(), false);
        assert_eq!(result.expect("roster"), Vec::<serde_json::Value>::new());
        assert!(commands.is_empty(), "must not ask before being greeted");
    }
}
