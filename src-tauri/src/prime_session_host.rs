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
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

const DAEMON_RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);
const DAEMON_HELLO_TIMEOUT: Duration = Duration::from_secs(10);
/// Prime's own CLI waits 30s for `ensureDaemonRunning` (installed 0.8.0).
const DAEMON_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const TURN_IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// Protocol Rhizome speaks. Verified against `prime-agent` 0.7.1, whose
/// `DAEMON_PROTOCOL_VERSION` is 7 — the first version accepting the command
/// envelope (`DAEMON_COMMAND_ENVELOPE_MIN_PROTOCOL_VERSION`).
const DAEMON_PROTOCOL_NAME: &str = "prime-agent.daemon";
const DAEMON_PROTOCOL_VERSION: u64 = 7;

/// What this client can handle. `slim_attach` keeps the attach reply small by
/// omitting the duplicated top-level `state`/`messages` — the snapshot carries
/// both. `client_owned_sessions` is required before Prime will honor
/// `lifecycle: "client_owned"` on create (ADR-0167). We deliberately do **not**
/// claim `extension_ui`: Rhizome has no UI for an extension's prompts, and not
/// claiming it means the daemon never routes one here to hang the turn.
const DAEMON_CLIENT_CAPABILITIES: [&str; 4] = [
    "attach_snapshot",
    "event_sequence",
    "slim_attach",
    "client_owned_sessions",
];
const CLIENT_OWNED_SESSIONS_CAPABILITY: &str = "client_owned_sessions";

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
/// named pipe. Aliasing the type keeps the `cfg` to the one function that
/// actually connects, rather than smearing it across every method that touches
/// a stream.
#[cfg(unix)]
type DaemonStream = std::os::unix::net::UnixStream;
#[cfg(windows)]
type DaemonStream = std::fs::File;

// ── Public types ────────────────────────────────────────────────────────────

/// One image on a `prompt`, `steer` or `follow_up`, exactly as Prime's
/// `docs/rpc.md` specifies `ImageContent`.
///
/// `data` is base64 with no `data:` prefix — that prefix is a browser
/// artifact, and the frontend strips it before this struct ever sees it.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeImageContent {
    #[serde(rename = "type", default = "image_content_type")]
    pub kind: String,
    pub data: String,
    pub mime_type: String,
}

fn image_content_type() -> String {
    "image".to_string()
}

/// Images Rhizome will actually put on the wire.
///
/// The last gate before a unix socket that speaks newline-delimited JSON, so
/// the caps are enforced here too and not only in the composer: a blank
/// payload or a fifth image is dropped rather than turned into one enormous
/// line the whole session waits behind. `MAX_PROMPT_IMAGES` mirrors
/// `MAX_IMAGES_PER_MESSAGE` in `src/lib/composerAttachments.ts`.
pub const MAX_PROMPT_IMAGES: usize = 4;

fn normalized_images(images: &[PrimeImageContent]) -> Vec<serde_json::Value> {
    images
        .iter()
        .filter(|image| !image.data.trim().is_empty() && !image.mime_type.trim().is_empty())
        .take(MAX_PROMPT_IMAGES)
        .map(|image| {
            serde_json::json!({
                "type": "image",
                "data": image.data.trim(),
                "mimeType": image.mime_type.trim(),
            })
        })
        .collect()
}

/// The `images` entry for a command, or `None` when there is nothing to send.
///
/// `None` rather than an empty array on purpose: a text-only turn has to stay
/// byte-identical to what Rhizome sent before images existed, so adding this
/// feature cannot change ordinary chat.
fn prompt_images_field(images: &[PrimeImageContent]) -> Option<serde_json::Value> {
    let normalized = normalized_images(images);
    (!normalized.is_empty()).then_some(serde_json::Value::Array(normalized))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimePromptRequest {
    pub message: String,
    /// Images attached to this turn, as Prime's `ImageContent`.
    ///
    /// Empty for every text-only turn, and the command then carries no
    /// `images` key at all — see [`prompt_images_field`].
    #[serde(default)]
    pub images: Vec<PrimeImageContent>,
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
    /// Whether the running model accepts image input.
    ///
    /// Three states, and the third is load-bearing: `None` means Prime did
    /// not report modalities, which is not the same as "text only". Callers
    /// must stay silent on `None` rather than warn.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_accepts_images: Option<bool>,
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

/// Prime's steering / follow-up queue, as `get_queue` reports it.
///
/// Previews, not the full prompt body. `followUp` is the daemon spelling
/// (`get_queue` / `clear_queue`); `session_action_update` uses `followUps`.
/// `from_data` accepts both so a payload either way still lists the same
/// messages.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeQueue {
    pub steering: Vec<String>,
    pub follow_up: Vec<String>,
}

impl PrimeQueue {
    fn from_data(data: &serde_json::Value) -> Self {
        let follow_up = if data.get("followUp").map(serde_json::Value::is_array) == Some(true) {
            string_previews(&data["followUp"])
        } else {
            string_previews(&data["followUps"])
        };
        Self {
            steering: string_previews(&data["steering"]),
            follow_up,
        }
    }
}

/// Fork/branch history of the attached session (`get_session_tree`).
///
/// Flat nodes only — the tree is rebuilt on the frontend. Entries are reduced
/// to an id, parent, kind and a short title so a full `AgentMessage` never
/// crosses IPC just to name a branch.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeSessionTree {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leaf_id: Option<String>,
    pub nodes: Vec<PrimeSessionTreeNode>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeSessionTreeNode {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub kind: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

impl PrimeSessionTree {
    fn from_data(data: &serde_json::Value) -> Self {
        let leaf_id = data["leafId"]
            .as_str()
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(str::to_string);
        let nodes = data["flatNodes"]
            .as_array()
            .map(|items| items.iter().filter_map(tree_node_from_flat).collect())
            .unwrap_or_default();
        Self { leaf_id, nodes }
    }
}

const TREE_TITLE_MAX: usize = 80;

fn tree_node_from_flat(value: &serde_json::Value) -> Option<PrimeSessionTreeNode> {
    let entry = value.get("entry")?;
    let id = entry["id"]
        .as_str()
        .map(str::trim)
        .filter(|id| !id.is_empty())?
        .to_string();
    let parent_id = entry["parentId"]
        .as_str()
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(str::to_string);
    let label = value["label"]
        .as_str()
        .map(str::trim)
        .filter(|label| !label.is_empty())
        .map(str::to_string);
    let (kind, title) = tree_title_from_entry(entry, label.as_deref());
    Some(PrimeSessionTreeNode {
        id,
        parent_id,
        kind,
        title,
        label,
    })
}

fn tree_title_from_entry(entry: &serde_json::Value, label: Option<&str>) -> (String, String) {
    let kind = match entry["type"].as_str() {
        Some("message") => match entry["message"]["role"].as_str() {
            Some("user") => "user",
            Some("assistant") => "assistant",
            _ => "other",
        },
        Some(other) => other,
        None => "other",
    };
    if let Some(label) = label {
        return (kind.to_string(), preview_text(label, TREE_TITLE_MAX));
    }
    let title = if entry["type"].as_str() == Some("message") {
        PrimeMessage::from_value(&entry["message"]).text
    } else {
        String::new()
    };
    let title = preview_text(title.trim(), TREE_TITLE_MAX);
    (
        kind.to_string(),
        if title.is_empty() {
            kind.replace('_', " ")
        } else {
            title
        },
    )
}

fn preview_text(text: &str, max: usize) -> String {
    let trimmed: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if trimmed.chars().count() <= max {
        return trimmed;
    }
    let mut out: String = trimmed.chars().take(max.saturating_sub(1)).collect();
    out.push('…');
    out
}

fn string_previews(value: &serde_json::Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let text = item.as_str()?.trim();
                    if text.is_empty() {
                        return None;
                    }
                    Some(text.to_string())
                })
                .collect()
        })
        .unwrap_or_default()
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
    /// Whether the running model takes images, from `get_state`'s Model
    /// `input` array. `None` means Prime did not say — never "text only".
    model_accepts_images: Option<bool>,
    /// Whether this session still carries the placeholder name Rhizome wrote
    /// at creation. Set false the moment a real name is stored, so the first
    /// exchange names the session once and never fights a later rename.
    name_is_placeholder: bool,
    thinking_level: Option<String>,
    socket_path: PathBuf,
    cwd: PathBuf,
    is_streaming: bool,
    /// Capabilities the daemon advertised in `daemon_hello`. Used to refuse
    /// `client_owned` create/promote/complete before sending a command an
    /// older service cannot honor (ADR-0167).
    server_capabilities: Vec<String>,
    /// Whether this attached session is foreground-owned, explicitly resident,
    /// or unknown (reattached work from before we recorded the grant).
    session_ownership: SessionOwnership,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SessionOwnership {
    ClientOwned,
    Resident,
    Unknown,
}

// ── Socket discovery ────────────────────────────────────────────────────────

/// Where Prime's daemon listens.
///
/// Prime computes this as `<tmpdir>/prime-agent-<uid>/daemon.sock`
/// (`defaultDaemonSocketPath`, read from the installed 0.7.1 build). Checked in
/// order: the env override, then that default — even if the socket file is
/// missing, because that is where we spawn a cold supervisor — then whatever
/// `prime-agent status` reports. Status covers a daemon deliberately started
/// elsewhere, and costs a subprocess only when the default path is unknown.
fn daemon_socket_path() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os(DAEMON_SOCKET_ENV) {
        let path = PathBuf::from(path);
        if path.as_os_str().is_empty() {
            return Err(format!("{DAEMON_SOCKET_ENV} is set but empty"));
        }
        return Ok(path);
    }

    if let Some(path) = default_daemon_socket_path() {
        return Ok(path);
    }

    reported_daemon_socket_path().ok_or_else(|| {
        "Prime's background service is not reachable. Check it with `prime-agent status`."
            .to_string()
    })
}

/// Whether the socket path came from `RHIZOME_PRIME_DAEMON_SOCKET`.
///
/// Tests and explicit overrides point at a listener we must not replace.
/// Spawning a real supervisor onto a FakeDaemon path (or an absent test
/// socket) would be a side effect the suite cannot clean up.
fn daemon_socket_is_overridden() -> bool {
    std::env::var_os(DAEMON_SOCKET_ENV).is_some()
}

/// Arguments Prime's CLI uses to start a supervisor.
///
/// Probed on installed 0.8.0 `ensureDaemonRunning`:
/// `node entrypoint --mode daemon --daemon-socket <path>`. The public
/// `prime-agent` binary *is* that entrypoint.
fn daemon_launch_args(socket_path: &Path) -> Vec<String> {
    vec![
        "--mode".into(),
        "daemon".into(),
        "--daemon-socket".into(),
        socket_path.to_string_lossy().into_owned(),
    ]
}

/// If nothing is listening, start Prime's supervisor the way the CLI does.
///
/// Rhizome used to only connect. That works while a `prime-agent` TUI (or a
/// leftover worker) has already kicked the supervisor. A test build, a
/// machine that has not opened the CLI today, or a supervisor that exited
/// with no workers left all look like "Prime is not reachable" — and the
/// model picker, session switch, and first prompt all fail the same way.
/// The CLI's own clients call `ensureInteractiveDaemonRunning` on the way
/// in. We do the same, then attach. Never fatal to try: a refused spawn
/// still surfaces as `ServiceUnreachable`.
fn ensure_daemon_listening(socket_path: &Path) -> Result<(), String> {
    if connect_stream(socket_path).is_ok() {
        return Ok(());
    }
    if daemon_socket_is_overridden() {
        return Err(format!(
            "Could not reach Prime's background service at {}",
            socket_path.display()
        ));
    }
    spawn_prime_daemon(socket_path)?;
    wait_for_daemon(socket_path)
}

fn spawn_prime_daemon(socket_path: &Path) -> Result<(), String> {
    if let Some(dir) = socket_path.parent() {
        std::fs::create_dir_all(dir).map_err(|error| {
            format!("Could not create the Prime daemon socket directory: {error}")
        })?;
    }
    let binary = crate::prime_discovery::find_binary()?;
    let target = crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(&binary)?;
    let mut command = crate::hidden_command(&target.program);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, &binary);
    if let Some(first_arg) = target.first_arg {
        command.arg(first_arg);
    }
    command.args(daemon_launch_args(socket_path));
    command.stdin(Stdio::null());
    command.stdout(Stdio::null());
    command.stderr(Stdio::null());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start Prime's background service: {error}"))?;
    // `Child` waits on drop. A supervisor that stays up would hang
    // `ensure_host` for the rest of the process. Reap it in the background.
    thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

fn wait_for_daemon(socket_path: &Path) -> Result<(), String> {
    let deadline = Instant::now() + DAEMON_STARTUP_TIMEOUT;
    while Instant::now() < deadline {
        if connect_stream(socket_path).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err(format!(
        "Timed out waiting for Prime's background service at {}",
        socket_path.display()
    ))
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
#[cfg(unix)]
fn default_daemon_socket_path() -> Option<PathBuf> {
    Some(
        std::env::temp_dir()
            .join(format!("prime-agent-{}", current_uid()?))
            .join("daemon.sock"),
    )
}

/// Prime's default background-service pipe on Windows.
#[cfg(windows)]
fn default_daemon_socket_path() -> Option<PathBuf> {
    Some(PathBuf::from(r"\\.\pipe\prime-agent-daemon"))
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
    stdout.lines().map(str::trim).find_map(|line| {
        let path = line.split_whitespace().next()?;
        is_daemon_transport_path(path).then(|| PathBuf::from(path))
    })
}

fn is_daemon_transport_path(path: &str) -> bool {
    path.ends_with(".sock") || path.starts_with(r"\\.\pipe\") || path.starts_with(r"\\?\pipe\")
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

#[cfg(windows)]
fn connect_stream(path: &Path) -> Result<DaemonStream, String> {
    use std::fs::OpenOptions;
    use std::os::windows::ffi::OsStrExt;

    const PIPE_CONNECT_TIMEOUT_MS: u32 = 3_000;

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    // Wait until an instance is listening. If the daemon is down, `open` below
    // still fails — this just avoids racing a pipe that is starting up.
    unsafe {
        windows_sys::Win32::System::Pipes::WaitNamedPipeW(wide.as_ptr(), PIPE_CONNECT_TIMEOUT_MS);
    }

    OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|error| {
            format!(
                "Could not reach Prime's background service at {}: {error}",
                path.display()
            )
        })
}

fn set_stream_roster_timeouts(stream: &mut DaemonStream) {
    #[cfg(unix)]
    {
        let _ = stream.set_read_timeout(Some(ROSTER_TIMEOUT));
        let _ = stream.set_write_timeout(Some(ROSTER_TIMEOUT));
    }
    #[cfg(windows)]
    {
        let _ = stream;
        // A named pipe opened as a `File` has no socket-style read timeout, so
        // there is nothing to set here. The bound that actually holds is the
        // `recv_timeout` in `list_running_sessions` — `read_roster_over`'s
        // deadline is checked *between* reads and cannot interrupt one.
    }
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

    // A host with no session yet has no model to report from `get_state`, and
    // Chat home draws the model chip before a word is typed. Prime's own
    // configured defaults are what the session it eventually creates will
    // start as, so they are the honest answer rather than "unknown". Read only
    // when there is nothing better: once a session exists it is the authority,
    // because the user may have switched model inside it.
    let defaults = match guard.as_ref() {
        Some(host) if !host.has_session() => crate::prime_settings::read_defaults(),
        _ => crate::prime_settings::PrimeDefaults::default(),
    };

    match guard.as_ref() {
        Some(host) => PrimeHostStatus {
            model_accepts_images: host.model_accepts_images,
            installed: availability.installed,
            version: availability.version,
            running: true,
            session_id: host.session_id.clone(),
            is_streaming: host.is_streaming,
            // Where `prime-agent` is installed. The connection no longer owns a
            // binary — it owns a socket — but this field has always meant
            // "where Prime lives" to the UI, and that is still the CLI path.
            binary_path,
            model_provider: host.model_provider.clone().or(defaults.default_provider),
            model_id: host.model_id.clone().or(defaults.default_model),
            model_name: host.model_name.clone(),
            thinking_level: host
                .thinking_level
                .clone()
                .or(defaults.default_thinking_level),
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
        None => {
            // Same reason the session-less connected host reads defaults: the
            // composer chip is drawn before a connection exists, and "Model"
            // on every launch is a worse answer than what the next session
            // will actually start as.
            let defaults = crate::prime_settings::read_defaults();
            PrimeHostStatus {
                // No session, so nothing is running and nothing is claimed.
                model_accepts_images: None,
                installed: availability.installed,
                version: availability.version,
                running: false,
                session_id: None,
                is_streaming: false,
                binary_path,
                model_provider: defaults.default_provider,
                model_id: defaults.default_model,
                model_name: None,
                thinking_level: defaults.default_thinking_level,
                reattached: false,
                started_at: None,
                session_path: None,
                problem: current_problem(),
            }
        }
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
        // A host that never got a session does not need a second one: the
        // session it is about to create *is* the new chat. Asking the daemon
        // for another would leave the first empty — the litter of #28.
        if !host.has_session() {
            host.ensure_session()?;
            return Ok(host.session_id.clone().unwrap_or_default());
        }
        host.call(serde_json::json!({ "type": "new_session" }))?;
        // Refresh session id from get_state.
        host.refresh_session_id()?;
        Ok(host.session_id.clone().unwrap_or_default())
    })
}

/// Token / cost / context usage for the live session.
pub fn get_session_stats() -> Result<PrimeSessionStats, String> {
    with_host_mut(|host| {
        // Polled every 15s while the panel is open. Every field is already
        // optional for "Prime has not said yet", and no session is the same
        // answer — so this reports unknown rather than creating one.
        if !host.has_session() {
            return Ok(PrimeSessionStats::default());
        }
        let data = host.call(serde_json::json!({ "type": "get_session_stats" }))?;
        Ok(PrimeSessionStats::from_state_data(&data))
    })
}

/// Fetch the live session's conversation history.
///
/// This is what a transcript rehydrates from: reopening a session, or
/// recovering the panel after a reload, without replaying the stream.
pub fn get_messages() -> Result<Vec<PrimeMessage>, String> {
    with_host_mut(|host| {
        let data = host.call(serde_json::json!({ "type": "get_messages" }))?;
        Ok(messages_from_response(&data))
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
    /// Input modalities Prime reports for this model, e.g. `["text","image"]`.
    ///
    /// `None` means Prime did not say — which is not the same as "text only",
    /// and callers must not read it that way. The picker and the composer both
    /// follow the house rule here: never guess a failure.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<Vec<String>>,
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
        // The composer menu fetches this on mount and again whenever the
        // session id changes — so opening the panel must not create a
        // session, and the refetch after one exists fills the menu in.
        if !host.has_session() {
            return Ok(Vec::new());
        }
        let data = host.call(serde_json::json!({ "type": "get_commands" }))?;
        Ok(commands_from_response(&data))
    })
}

/// Whether a Prime `Model` reports image input.
///
/// `None` when the model carries no `input` array at all. Reading that as
/// "text only" would warn on models that work, which is worse than not
/// warning: the same refusal to guess that `check_provider_connected` makes
/// about credentials.
fn model_accepts_images(model: &serde_json::Value) -> Option<bool> {
    let modalities = model["input"].as_array()?;
    if modalities.is_empty() {
        return None;
    }
    Some(modalities.iter().any(|value| {
        value
            .as_str()
            .is_some_and(|modality| modality.trim().eq_ignore_ascii_case("image"))
    }))
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
                        input: model["input"].as_array().map(|modalities| {
                            modalities
                                .iter()
                                .filter_map(|value| value.as_str().map(str::to_string))
                                .collect()
                        }),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Every model the host can switch to, as Prime reports them.
pub fn get_available_models() -> Result<Vec<PrimeModel>, String> {
    with_host_mut(|host| {
        let data = host.call(serde_json::json!({ "type": "get_available_models" }))?;
        Ok(models_from_response(&data))
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
        host.call(serde_json::json!({
            "type": "set_model",
            "provider": provider,
            "modelId": model_id,
        }))?;
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
        host.call(serde_json::json!({
            "type": "set_thinking_level",
            "level": level,
        }))?;
        // Refresh the cached state, exactly as `set_model` does. `get_status`
        // -- what the strip polls every 4s -- reads that cache and does not
        // re-issue `get_state` itself, so without this the strip keeps showing
        // the level the user just changed away from until something unrelated
        // happens to refresh it. #9 requires the strip to reflect the change
        // immediately, and a control whose label does not move reads as one
        // that did not work.
        host.refresh_session_id()?;
        Ok(())
    })
}

/// Pause, resume, or stop one heartbeat.
///
/// `stop` is the daemon's word for cancel. Only heartbeats accept this — the
/// daemon has no `cron_pause`, so a plain schedule can be cancelled
/// (`cancel_scheduled_work`) but never paused. Probed against 0.7.4.
pub fn manage_heartbeat(job_id: &str, action: &str) -> Result<(), String> {
    let job_id = job_id.trim();
    if job_id.is_empty() {
        return Err("A heartbeat needs an id to manage".into());
    }
    if !matches!(action, "pause" | "resume" | "stop") {
        return Err(format!(
            "Unknown heartbeat action {action:?}. Expected one of: pause, resume, stop",
        ));
    }
    with_host_mut(|host| {
        host.call(serde_json::json!({
            "type": "heartbeat_manage",
            "jobId": job_id,
            "action": action,
        }))?;
        Ok(())
    })
}

/// Cancel a scheduled prompt.
///
/// Works for both kinds: `cron_cancel` takes any job id. Cancelling is
/// irreversible — the job is gone, not paused — which is why the UI must not
/// present it as the same weight of action as pause.
pub fn cancel_scheduled_work(job_id: &str) -> Result<(), String> {
    let job_id = job_id.trim();
    if job_id.is_empty() {
        return Err("A scheduled prompt needs an id to cancel".into());
    }
    with_host_mut(|host| {
        host.call(serde_json::json!({
            "type": "cron_cancel",
            "jobId": job_id,
        }))?;
        Ok(())
    })
}

/// Start a heartbeat or a cron schedule on the attached session.
///
/// `kind` is Prime's `source`: `heartbeat` → `heartbeat_set` (pauseable),
/// `cron` → `cron_add` (cancel only). Must not create a session (#28): a
/// schedule belongs to a conversation that already exists. Heartbeats require
/// a persisted session file on Prime's side too.
pub fn create_scheduled_work(
    kind: &str,
    schedule: &str,
    prompt: &str,
    delivery_mode: Option<&str>,
) -> Result<(), String> {
    let schedule = schedule.trim();
    let prompt = prompt.trim();
    if schedule.is_empty() {
        return Err("A cadence is required".into());
    }
    if prompt.is_empty() {
        return Err("A prompt is required".into());
    }
    let command = match kind.trim() {
        "heartbeat" => {
            let mut payload = serde_json::json!({
                "type": "heartbeat_set",
                "schedule": schedule,
                "prompt": prompt,
            });
            if let Some(mode) = delivery_mode.map(str::trim).filter(|mode| !mode.is_empty()) {
                if !matches!(mode, "steer" | "follow_up") {
                    return Err("Heartbeat delivery must be steer or follow_up".into());
                }
                payload["deliveryMode"] = serde_json::Value::String(mode.to_string());
            }
            payload
        }
        "cron" => serde_json::json!({
            "type": "cron_add",
            "schedule": schedule,
            "prompt": prompt,
        }),
        other => {
            return Err(format!(
                "Unknown schedule kind {other:?}. Expected heartbeat or cron",
            ));
        }
    };
    with_host_mut(|host| {
        if !host.has_session() {
            return Err("Start a conversation before scheduling a prompt".into());
        }
        host.call(command)?;
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
        // Mounted at app level and ticking on a timer, so this is the poll
        // most likely to create a session nobody asked for. An agent with no
        // session has no goal, no heartbeats and nothing scheduled — which is
        // exactly the empty payload the band already renders as nothing.
        if !host.has_session() {
            return Ok(activity::PrimeAgentActivity::default());
        }
        // Not `get_state`: probed live against 0.7.2, the daemon's `get_state`
        // never carries a `goal` key at all (its summarizer just does not set
        // one). `get_connection_state` does — it wraps the same
        // `session.goalState` the daemon forwards in `goal_update` events —
        // and also carries `thinkingLevel`, so one command covers both.
        // `call`, not `send_command`: reading `data` without checking `success`
        // made a daemon refusal indistinguishable from "no goal and no
        // thinking level". The band's caller already treats an error as
        // "render nothing", so propagating is both honest and harmless.
        let state_data = host.call(serde_json::json!({ "type": "get_connection_state" }))?;

        // `cron_list` alone, not `cron_list` + `heartbeats_list`. Probed live
        // against 0.7.4: `cron_list` returns BOTH kinds in `data.jobs`, tagged
        // by `source`, and `heartbeats_list` returns the same heartbeats again
        // wrapped in a `{"job": …}` envelope. Two calls meant every heartbeat
        // appeared twice, and the enveloped copy parsed to all-None fields.
        //
        // Named `cron_list`, not the `list_schedules` spelling RPC mode
        // answers to — that returns `Unknown daemon command` and would
        // degrade the section to empty in silence.
        // Deliberately tolerant: a failed schedule read degrades this one
        // section to empty rather than hiding an active goal. That policy is
        // kept — but it now logs, because the previous version could not tell
        // "nothing scheduled" from "the daemon refused" and said nothing
        // either way.
        let (heartbeats, schedules) = match host.call(serde_json::json!({ "type": "cron_list" })) {
            Ok(data) => activity::split_scheduled_work(&data),
            Err(error) => {
                log::warn!("Prime cron_list failed; scheduled work shown as empty: {error}");
                Default::default()
            }
        };

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
        // A refusal here previously produced `None`, which the confirm loop
        // reads as "the goal is cleared" — turning a transport failure into a
        // false confirmation.
        let data = host.call(serde_json::json!({ "type": "get_connection_state" }))?;
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
        let data = host.call(serde_json::json!({ "type": "get_connection_state" }))?;
        Ok(data["isStreaming"].as_bool().unwrap_or(false))
    })
    .unwrap_or_else(|error| {
        // Fail closed. Answering "idle" on a daemon error is not a harmless
        // default: `send_goal_command` skips its abort and sends `/goal`
        // straight into a running turn, which is precisely the failure the
        // caller exists to prevent (see its note — the send reports success
        // and nothing happens). `abort_and_wait_for_idle` would likewise
        // declare success without the session ever going idle.
        //
        // Claiming "still busy" instead costs a bounded wait and then a clear
        // error, which is the honest outcome.
        log::warn!("Prime streaming check failed; assuming the turn is still running: {error}");
        true
    })
}

/// Interrupt the running turn and wait for the session to go idle.
fn abort_and_wait_for_idle() -> Result<(), String> {
    with_host_mut(|host| {
        // A failed abort is not fatal — the wait loop below is what actually
        // decides the outcome — but discarding it silently meant a daemon
        // that never received the abort looked identical to one that did.
        if let Err(error) = host.call(serde_json::json!({ "type": "abort" })) {
            log::warn!("Prime abort request failed; waiting for idle anyway: {error}");
        }
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
        host.call(serde_json::json!({
            "type": "prompt",
            "message": text,
        }))?;
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
        let data = host.call(serde_json::json!({
            "type": "fork",
            "entryId": trimmed,
        }))?;
        host.refresh_session_id()?;
        Ok(PrimeForkResult {
            session_id: host.session_id.clone().unwrap_or_default(),
            branched_from: data["text"].as_str().map(str::to_string),
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

/// Rename a session on disk, or the live one if that log is still attached.
///
/// Prime's `set_session_name` only addresses the attached session. The list
/// is history — most rows are not the one this window is in — so this speaks
/// `rename_saved_session`, which takes the log path and writes `session_info`
/// there. Probed on installed 0.8.0: `{ sessionPath, name }`; `activeSessionId`
/// is optional and only used to prove the caller is attached, so we omit it.
/// The daemon trims and rejects an empty name; we do the same before talking
/// to it, so a blank field never becomes a round trip.
///
/// Sent bare on purpose. The session-scoped sender would `ensure_session`
/// first, and renaming a past conversation must not be what creates a new
/// one. #31.
pub fn rename_saved_session(session_path: &str, name: &str) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Session name cannot be empty".into());
    }
    ensure_renameable_session_path(session_path)?;
    with_host_mut(|host| {
        let response = host.send_bare_command(serde_json::json!({
            "type": "rename_saved_session",
            "sessionPath": session_path,
            "name": name,
        }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "rename_saved_session"));
        }
        Ok(())
    })
}

/// A session name taken from the exchange that just happened.
///
/// Every other harness on this machine **stores** a name: Claude Code keeps a
/// `customTitle`, OpenCode a `title` column seeded `"New session - <stamp>"`.
/// Rhizome seeded a placeholder with `set_session_name` at creation and then
/// never replaced it, so the list fell back to re-deriving a label from the
/// first message on every render. That is why a session reads `/prime-intellect`
/// or `hi'` — faithful to the first line, and useless as a name.
///
/// Rules, in order, each from a real row in the list:
///
/// - A slash command names the command, not the session. `/prime-intellect`
///   becomes `prime-intellect`.
/// - One sentence, not a paragraph. A pasted brief should not become the
///   title of everything that follows it.
/// - The user's words beat the agent's. A session the agent opened has no
///   user turn at all — 7 of 31 here — and only then does its first line win.
/// - Too short to mean anything is worse than no name: `hi` tells you less
///   than the timestamp already beside it.
fn session_title_from_exchange(
    user_request: Option<&str>,
    agent_opening: Option<&str>,
) -> Option<String> {
    user_request
        .and_then(title_candidate)
        .or_else(|| agent_opening.and_then(title_candidate))
}

/// The shortest useful name a single message can give.
const MIN_TITLE_CHARS: usize = 8;
/// Long enough to be a sentence, short enough for a 228px column.
const MAX_SESSION_TITLE_CHARS: usize = 60;

/// The first sentence, where a full stop inside a version or a filename is not
/// the end of one.
///
/// Splitting on every `.` turned "Draft the release notes for 0.8" into
/// "…for 0". A stop only ends a sentence when what follows is a space or the
/// end of the text; `?` and `!` always do.
fn first_sentence_of(text: &str) -> &str {
    let bytes = text.as_bytes();
    for (index, ch) in text.char_indices() {
        let ends = match ch {
            '?' | '!' | '\n' => true,
            // `is_none_or` is newer than this crate's MSRV.
            '.' => bytes
                .get(index + 1)
                .map_or(true, |next| next.is_ascii_whitespace()),
            _ => false,
        };
        if ends {
            return text[..index].trim();
        }
    }
    text.trim()
}

fn title_candidate(text: &str) -> Option<String> {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let unprefixed = collapsed.strip_prefix('/').unwrap_or(&collapsed);
    let first_sentence = first_sentence_of(unprefixed);

    if first_sentence.chars().count() < MIN_TITLE_CHARS {
        return None;
    }
    if first_sentence.chars().count() <= MAX_SESSION_TITLE_CHARS {
        return Some(first_sentence.to_string());
    }
    // Cut on a word so the name reads as a phrase rather than a slice.
    let mut cut = String::new();
    for word in first_sentence.split(' ') {
        if cut.chars().count() + word.chars().count() + 1 > MAX_SESSION_TITLE_CHARS {
            break;
        }
        if !cut.is_empty() {
            cut.push(' ');
        }
        cut.push_str(word);
    }
    let cut = cut.trim_end_matches([',', ';', ':', '-']).trim();
    (cut.chars().count() >= MIN_TITLE_CHARS).then(|| format!("{cut}…"))
}

/// Whether a name is still the placeholder Rhizome wrote at creation.
///
/// A name a person chose must never be overwritten — that is the whole reason
/// rename exists. Only our own `Rhizome · vault · id` is fair game.
pub(crate) fn is_rhizome_placeholder_name(name: &str) -> bool {
    name.starts_with("Rhizome · ")
}

/// What Rhizome writes when it creates a session.
///
/// Identifies this client and the vault the session is working in. The id
/// tail is uniqueness for the daemon, which rejects a name already held by
/// another live session at the same depth — not a timestamp; the row already
/// shows one. `primeSessionRowTitles` then leaves a unique name alone.
fn rhizome_created_session_name(cwd: &Path, session_id: &str) -> String {
    let vault = cwd
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "vault".to_string());
    let tail: String = session_id.chars().rev().take(6).collect();
    let suffix: String = tail.chars().rev().collect();
    format!("Rhizome · {vault} · {suffix}")
}

/// A rename talks to the daemon about a path the user picked from the list.
/// Refuse anything that is not a session log before that round trip — the
/// daemon will also reject it, but a bad path should fail here, not after
/// a hop. Containment is only checkable when the file exists; a test path
/// that is shaped like a log is allowed through so the command itself can
/// be asserted without writing into `~/.prime/agent/sessions`.
fn ensure_renameable_session_path(session_path: &str) -> Result<(), String> {
    if session_path.contains("..") {
        return Err("Not a Prime session log".into());
    }
    let path = Path::new(session_path);
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    if name.is_empty() || !name.ends_with(".jsonl") || name.contains(".mindwalk-bridge.") {
        return Err("Not a Prime session log".into());
    }
    if path.exists() {
        crate::prime_sessions::ensure_inside_sessions_dir(path)?;
    }
    Ok(())
}

/// Compact the conversation now. Returns tokens held before compaction when
/// Prime reports it, so the caller can show what the run actually reclaimed.
pub fn compact(custom_instructions: Option<String>) -> Result<Option<u64>, String> {
    with_host_mut(|host| {
        let mut command = serde_json::json!({ "type": "compact" });
        if let Some(instructions) = custom_instructions.filter(|s| !s.trim().is_empty()) {
            command["customInstructions"] = serde_json::Value::String(instructions);
        }
        let data = host.call(command)?;
        Ok(data["tokensBefore"].as_u64())
    })
}

pub fn set_auto_compaction(enabled: bool) -> Result<(), String> {
    with_host_mut(|host| {
        host.call(serde_json::json!({
            "type": "set_auto_compaction",
            "enabled": enabled,
        }))?;
        Ok(())
    })
}

/// Stop one RLM child of the attached session.
///
/// Prime owns the child. This is a request, not a local kill. Empty ids are
/// refused before they hit the daemon so a miswired Stop cannot cancel
/// "whatever is current". `childId` is Prime's `rlmChildId`, not the child's
/// daemon handle — `host.call` injects the *parent's* `activeSessionId`.
pub fn cancel_rlm_child(child_id: &str) -> Result<bool, String> {
    let trimmed = child_id.trim();
    if trimmed.is_empty() {
        return Err("Cannot cancel an RLM child without an id".into());
    }
    with_host_mut(|host| {
        let data = host.call(serde_json::json!({
            "type": "cancel_rlm_child",
            "childId": trimmed,
        }))?;
        Ok(data["cancelled"].as_bool().unwrap_or(false))
    })
}

/// Promote the attached client-owned session to resident work.
///
/// This is the explicit background grant in ADR-0167. One-way: Prime does not
/// offer a demote. Refuses before sending if the greeting did not advertise
/// `client_owned_sessions`.
pub fn promote_owned_session() -> Result<(), String> {
    with_host_mut(|host| {
        host.require_client_owned_sessions("keep this session working in the background")?;
        host.call(serde_json::json!({ "type": "promote_owned_session" }))?;
        host.session_ownership = SessionOwnership::Resident;
        Ok(())
    })
}

/// Stop the attached client-owned session's worker.
///
/// The default close/quit action. The durable transcript stays on disk.
/// Refuses before sending if the greeting did not advertise
/// `client_owned_sessions`.
pub fn complete_owned_session() -> Result<(), String> {
    with_host_mut(|host| {
        host.require_client_owned_sessions("stop this foreground-owned session")?;
        host.call(serde_json::json!({ "type": "complete_owned_session" }))?;
        Ok(())
    })
}

fn client_owned_unavailable(operation: &str) -> String {
    format!(
        "Prime cannot {operation} because this daemon does not support \
         client-owned sessions. Update Prime and try again."
    )
}

fn is_not_owned_error(error: &str) -> bool {
    error.to_ascii_lowercase().contains("not owned")
}

fn build_queue_command(
    kind: &str,
    message: &str,
    images: &[PrimeImageContent],
) -> serde_json::Value {
    let mut command = serde_json::json!({ "type": kind, "message": message });
    if let Some(images) = prompt_images_field(images) {
        command["images"] = images;
    }
    command
}

/// Queue a steering message for the running turn, or a follow-up for after it.
///
/// Returns `Ok(false)` when nothing is streaming. Prime's docs do not say what
/// `steer` does with no active run, so we do not find out the hard way — the
/// caller is expected to send a normal prompt instead, which is what a user
/// pressing enter on an idle session means anyway.
fn queue_message(kind: &str, message: &str, images: &[PrimeImageContent]) -> Result<bool, String> {
    let trimmed = message.trim();
    // An image with no words is still a message — "what is this?" is the
    // whole point of pasting a screenshot.
    if trimmed.is_empty() && prompt_images_field(images).is_none() {
        return Err("Cannot queue an empty message".into());
    }
    with_host_mut(|host| {
        if !host.is_streaming {
            return Ok(false);
        }
        let data = host.call(build_queue_command(kind, trimmed, images))?;
        if kind == "follow_up" {
            return Ok(data["queued"].as_bool().unwrap_or(false));
        }
        Ok(true)
    })
}

/// Redirect the turn that is currently running, without discarding its work.
pub fn steer(message: &str, images: &[PrimeImageContent]) -> Result<bool, String> {
    queue_message("steer", message, images)
}

/// Queue a message to run after the current turn finishes.
pub fn follow_up(message: &str, images: &[PrimeImageContent]) -> Result<bool, String> {
    queue_message("follow_up", message, images)
}

/// The attached session's steering and follow-up previews.
///
/// Polled while Chat is open. Must not create a session (#28): no session
/// means an empty queue, which is true.
pub fn get_queue() -> Result<PrimeQueue, String> {
    with_host_mut(|host| {
        if !host.has_session() {
            return Ok(PrimeQueue::default());
        }
        let data = host.call(serde_json::json!({ "type": "get_queue" }))?;
        Ok(PrimeQueue::from_data(&data))
    })
}

/// Drop every queued steer and follow-up. Returns the queue Prime reports
/// afterwards (usually empty).
pub fn clear_queue() -> Result<PrimeQueue, String> {
    with_host_mut(|host| {
        if !host.has_session() {
            return Ok(PrimeQueue::default());
        }
        let data = host.call(serde_json::json!({ "type": "clear_queue" }))?;
        Ok(PrimeQueue::from_data(&data))
    })
}

/// Fork/branch history of the attached session.
///
/// Polled while Chat is open. Must not create a session (#28): no session
/// means no branches, which is true.
pub fn get_session_tree() -> Result<PrimeSessionTree, String> {
    with_host_mut(|host| {
        if !host.has_session() {
            return Ok(PrimeSessionTree::default());
        }
        let data = host.call(serde_json::json!({ "type": "get_session_tree" }))?;
        Ok(PrimeSessionTree::from_data(&data))
    })
}

/// Move the live leaf to an earlier branch of this conversation.
///
/// Same session, not a new one — that is `fork`. Refuses mid-turn for the
/// same reason `fork` and `switch_session` do. Empty ids are refused before
/// they hit the daemon so a miswired click cannot navigate "whatever is
/// current". Returns the tree Prime reports afterwards so the band can mark
/// the new leaf without a second poll.
pub fn navigate_tree(target_id: &str) -> Result<PrimeSessionTree, String> {
    let trimmed = target_id.trim();
    if trimmed.is_empty() {
        return Err("Cannot navigate without a branch id".into());
    }
    with_host_mut(|host| {
        if !host.has_session() {
            return Err("No conversation to navigate".into());
        }
        if host.is_streaming {
            return Err("Cannot switch branches while a turn is running".into());
        }
        let result = host.call(serde_json::json!({
            "type": "navigate_tree",
            "targetId": trimmed,
        }))?;
        if result["cancelled"].as_bool() == Some(true) {
            return Err("Branch switch was cancelled".into());
        }
        let data = host.call(serde_json::json!({ "type": "get_session_tree" }))?;
        Ok(PrimeSessionTree::from_data(&data))
    })
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
            host.call(serde_json::json!({
                "type": "set_model",
                "provider": provider,
                "modelId": model_id,
            }))?;
            Ok(())
        }) {
            emit(AiAgentStreamEvent::Error { message: error });
            emit(AiAgentStreamEvent::Done);
            return Ok(String::new());
        }
    }

    let message =
        crate::cli_agent_runtime::build_prompt(&request.message, request.system_prompt.as_deref());
    let images_field = prompt_images_field(&request.images);

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
        let mut command = serde_json::json!({
            "type": "prompt",
            "message": message,
        });
        if let Some(images) = images_field.clone() {
            command["images"] = images;
        }
        host.send_command(command)
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
    let mut provider_error: Option<String> = None;
    // Enough of the agent's opening to name a session with, for the sessions a
    // person never typed in (7 of 31 on this machine). Bounded so a long reply
    // does not accumulate a second copy of itself in memory.
    let mut agent_opening = String::new();
    let outcome = stream_until_agent_end(|json| {
        if json["type"].as_str() == Some("message_update")
            && json["assistantMessageEvent"]["type"].as_str() == Some("text_delta")
        {
            if let Some(delta) = json["assistantMessageEvent"]["delta"]
                .as_str()
                .filter(|d| !d.is_empty())
            {
                saw_text = true;
                if agent_opening.len() < AGENT_OPENING_SAMPLE_BYTES {
                    agent_opening.push_str(delta);
                }
            }
        }
        if json["type"].as_str() == Some("agent_end") {
            provider_error = crate::prime_events::provider_error_from_agent_end(json);
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
            // A turn with no text is not automatically a failure — a model may
            // legitimately say nothing. But when Prime recorded a provider
            // error on that empty turn, say so: "… finished without returning
            // a reply" hid 429 rate limits, a 402 on an account that never
            // bought credits, and a 404 for a retired model, all of which read
            // to the user as a broken app.
            if !saw_text {
                if let Some(reason) = provider_error.take() {
                    emit(AiAgentStreamEvent::Error { message: reason });
                }
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

    // Name the session from the exchange that just happened, replacing the
    // placeholder written at creation. Runs after Done so it never delays the
    // reply, and it is a no-op on every turn after the first.
    let spoken = crate::cli_agent_runtime::user_request_from_prompt(&message)
        .unwrap_or(request.message.as_str());
    let _ = with_host_mut(|host| {
        host.name_session_from_exchange(non_empty(spoken), non_empty(&agent_opening));
        Ok(())
    });

    emit(AiAgentStreamEvent::Done);
    Ok(session_id)
}

/// How much of the agent's first reply to keep for naming. A title is cut at
/// 60 characters; this is slack for a long opening sentence, not a transcript.
const AGENT_OPENING_SAMPLE_BYTES: usize = 400;

fn non_empty(text: &str) -> Option<&str> {
    let trimmed = text.trim();
    (!trimmed.is_empty()).then_some(trimmed)
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
            // Disconnected or wrong cwd → detach and reconnect there.
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
/// A session on this daemon that this client may rejoin.
struct ResumableSession {
    id: String,
    /// Its stored name, when the daemon reports one.
    name: Option<String>,
}

fn pick_resumable_row<'a>(
    data: &'a serde_json::Value,
    cwd: &Path,
) -> Option<&'a serde_json::Value> {
    let cwd = cwd.to_string_lossy();
    data["sessions"]
        .as_array()?
        .iter()
        .filter(|session| session["cwd"].as_str() == Some(cwd.as_ref()))
        .filter(|session| session["attachedClients"].as_u64().unwrap_or(0) == 0)
        .max_by_key(|session| session["lastActivityAt"].as_str().unwrap_or(""))
}

fn pick_resumable_session(data: &serde_json::Value, cwd: &Path) -> Option<String> {
    pick_resumable_row(data, cwd)
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
            // We start the supervisor ourselves on connect (the same
            // `--mode daemon --daemon-socket` kick the CLI uses). This copy
            // is the fallback when that spawn still cannot listen.
            "Prime's background service could not be started. Check it with `prime-agent status`."
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
    /// The session was detached. Owned workers expire after Prime's reconnect
    /// grace; explicitly resident work keeps running.
    KeepSessionRunning,
    /// Not connected, so there is nothing to decide.
    NotConnected,
}

/// How Rhizome should settle its attached Prime session.
///
/// ADR-0167: idle close detaches, stop completes owned work, keep-working
/// promotes then detaches. There is no global "survive quit" toggle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionCloseIntent {
    Detach,
    Stop,
    KeepWorking,
}

fn disposition_for(intent: SessionCloseIntent) -> QuitDisposition {
    match intent {
        SessionCloseIntent::Stop => QuitDisposition::StopSession,
        SessionCloseIntent::Detach | SessionCloseIntent::KeepWorking => {
            QuitDisposition::KeepSessionRunning
        }
    }
}

/// Whether the attached session is mid-turn. Used by window-close to decide
/// between a quiet detach and the Stop / Keep working confirmation.
pub fn is_streaming() -> bool {
    let slot = host_slot();
    let Ok(guard) = slot.host.lock() else {
        return false;
    };
    guard
        .as_ref()
        .is_some_and(|host| host.is_alive() && host.is_streaming)
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
    // Only one roster read at a time. This bounds the cost of the failure
    // below: a daemon that accepts a connection and then never speaks leaves
    // its reader parked, and without this guard the 4s poll would park a new
    // thread every few seconds forever.
    if ROSTER_IN_FLIGHT.swap(true, Ordering::SeqCst) {
        return Ok(Vec::new());
    }

    let (tx, rx) = mpsc::channel();
    let spawned = thread::Builder::new()
        .name("prime-roster".into())
        .spawn(move || {
            let roster = (|| {
                let socket_path = daemon_socket_path().ok()?;
                let mut stream = connect_stream(&socket_path).ok()?;
                set_stream_roster_timeouts(&mut stream);
                read_roster_over(stream).ok()
            })()
            .unwrap_or_default();
            let _ = tx.send(roster);
            ROSTER_IN_FLIGHT.store(false, Ordering::SeqCst);
        });

    if spawned.is_err() {
        ROSTER_IN_FLIGHT.store(false, Ordering::SeqCst);
        return Ok(Vec::new());
    }

    // The timeout lives here, on the *wait*, rather than on the read — which
    // is the only place it can be enforced on every platform. `read_roster_over`
    // checks a deadline between reads, but a blocking read that never returns
    // is never interrupted by it: on Unix `set_read_timeout` bounded the read
    // itself, and a Windows named pipe opened as a `File` has no equivalent.
    // Waiting on a channel is bounded regardless of what the read is doing.
    match rx.recv_timeout(ROSTER_TIMEOUT) {
        Ok(roster) => Ok(roster),
        // Timed out or the thread died: nothing is running, as far as anyone
        // can tell right now. The parked thread ends on its own when the
        // daemon finally answers or drops the connection.
        Err(_) => Ok(Vec::new()),
    }
}

/// Guards against parking a reader thread per poll. See `list_running_sessions`.
static ROSTER_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

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

/// Settle Rhizome's attached session, then drop the connection.
///
/// Never sends `prime-agent shutdown`. Detach is what leaves promoted work
/// running; complete (with kill as last resort) is what stops owned work.
pub fn settle_session(intent: SessionCloseIntent) -> Result<QuitDisposition, String> {
    let slot = host_slot();
    let mut guard = slot.host.lock().map_err(poison)?;
    let Some(host) = guard.as_mut() else {
        return Ok(QuitDisposition::NotConnected);
    };
    if !host.is_alive() || host.active_session_id.is_empty() {
        return Ok(QuitDisposition::NotConnected);
    }

    match intent {
        SessionCloseIntent::Stop => host.stop_owned_session(),
        SessionCloseIntent::KeepWorking => host.promote_then_detach_grant(),
        SessionCloseIntent::Detach => {}
    }
    let _ = host.shutdown();
    *guard = None;
    Ok(disposition_for(intent))
}

/// Full quit: stop foreground-owned work; leave explicitly resident work.
pub fn settle_session_on_quit() -> Result<QuitDisposition, String> {
    let ownership = {
        let slot = host_slot();
        let guard = slot.host.lock().map_err(poison)?;
        guard
            .as_ref()
            .map(|host| host.session_ownership)
            .unwrap_or(SessionOwnership::Unknown)
    };
    let intent = match ownership {
        SessionOwnership::Resident => SessionCloseIntent::Detach,
        SessionOwnership::ClientOwned | SessionOwnership::Unknown => SessionCloseIntent::Stop,
    };
    settle_session(intent)
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
    /// Open a connection in `cwd` and rejoin work already running there.
    ///
    /// Deliberately does *not* create a session when there is nothing to
    /// rejoin. Rhizome connects on every vault attach — including the
    /// transient default vault a window opens with — and the daemon writes a
    /// session log the moment it is asked to `create`, so connecting eagerly
    /// is what filled the user's history with empty sessions (#28). A session
    /// arrives from `ensure_session`, when something actually needs one.
    ///
    /// Reattaching to work left running is #7's job. Choosing *which* session
    /// to rejoin when several qualify is `pick_resumable_session`; this
    /// function has no standing to make a wider choice on the user's behalf.
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
        if let Err(detail) = ensure_daemon_listening(&socket_path) {
            let problem = unreachable_problem(&detail);
            let message = describe_problem(&problem);
            record_problem(Some(problem));
            return Err(message);
        }
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
            model_accepts_images: None,
            name_is_placeholder: false,
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
            server_capabilities: Vec::new(),
            session_ownership: SessionOwnership::Unknown,
        };

        // The daemon greets first. Reading it is the handshake — it carries the
        // protocol version and confirms we are talking to a daemon at all.
        host.await_hello()?;

        // Rejoin work left running here before starting anything new. This is
        // what makes closing the window a detach rather than a loss (#7): the
        // daemon kept the session, so reopening should land back in it.
        match host.find_resumable_session(&cwd) {
            Ok(Some(found)) => {
                log::info!("Reattaching to Prime session {}", found.id);
                host.name_is_placeholder = found
                    .name
                    .as_deref()
                    .is_some_and(is_rhizome_placeholder_name);
                host.active_session_id = found.id;
                host.reattached = true;
                host.attach_and_read_state()?;
            }
            // Nothing to rejoin: connected, with no session. Creating one here
            // is what littered `~/.prime/agent/sessions` with empty logs (#28)
            // — the daemon writes the file on `create`, and Rhizome connects
            // on every vault attach whether or not anyone means to chat.
            // `ensure_session` makes one when something actually needs it.
            Ok(None) => {
                // The connection itself is proven: the daemon greeted us and
                // answered `list`. Whatever was wrong before no longer is.
                record_problem(None);
            }
            Err(error) => {
                // Enumeration is an optimisation, not a precondition. Failing
                // to list is no reason to refuse to open — the session this
                // host will create on demand is a fresh one either way.
                log::debug!("Could not enumerate Prime sessions: {error}");
                record_problem(None);
            }
        }

        Ok(host)
    }

    /// Give the session Rhizome just created a name.
    ///
    /// Prime records this as a `session_info` entry in the log, so it survives
    /// on disk and the history list reads it back — that is the whole point.
    /// It is also the origin marker the log otherwise lacks: the `session`
    /// header carries no field saying which client wrote it, so a session that
    /// Rhizome names is one Rhizome can recognise later. #31.
    ///
    /// **Never fatal.** Two constraints make failure ordinary rather than
    /// exceptional: the daemon rejects a name already held by another *live*
    /// session at the same depth, so opening the same vault in a second window
    /// legitimately collides; and an older daemon may not route the command at
    /// all. A session with no name works perfectly well — it falls back to the
    /// title derived from its first message, exactly as before — so refusing
    /// to open a session because it could not be labelled would trade a real
    /// capability for a cosmetic one.
    ///
    /// The id tail is what makes the name unique. It is the *end* of the id,
    /// not the start: session ids are uuidv7 and their leading characters are
    /// a timestamp — measured over 93 real logs, the first six characters gave
    /// 23 distinct values and one prefix covered 23 sessions.
    fn name_session(&mut self, cwd: &Path) {
        let id = self
            .session_id
            .clone()
            .unwrap_or_else(|| self.active_session_id.clone());
        let name = rhizome_created_session_name(cwd, &id);

        if let Err(error) = self.call(serde_json::json!({
            "type": "set_session_name",
            "name": name.clone(),
        })) {
            log::debug!("Could not name the Prime session ({name}): {error}");
            return;
        }
        self.name_is_placeholder = true;
    }

    /// Replace the placeholder with a name taken from the first exchange.
    ///
    /// Stored through `set_session_name`, so `prime-agent` and every other
    /// client see it too — not re-derived at render time, which is what left
    /// sessions reading `/prime-intellect`. Runs once: after it succeeds the
    /// session is no longer ours to rename, and a person's own rename is never
    /// touched at all.
    fn name_session_from_exchange(
        &mut self,
        user_request: Option<&str>,
        agent_opening: Option<&str>,
    ) {
        if !self.name_is_placeholder {
            return;
        }
        let Some(name) = session_title_from_exchange(user_request, agent_opening) else {
            return;
        };
        if self
            .call(serde_json::json!({ "type": "set_session_name", "name": name.clone() }))
            .is_err()
        {
            // Keep the placeholder flag set so the next turn can try again;
            // a failed rename should cost the name, not the retry.
            return;
        }
        self.name_is_placeholder = false;
        log::debug!("named the Prime session from its first exchange: {name}");
    }

    /// Join `active_session_id` and read its state.
    ///
    /// Shared by the two ways a host acquires a session — rejoining one left
    /// running, and creating one on demand — because the daemon rejects any
    /// session command sent before `attach`, and `get_state` is what turns
    /// the daemon's handle into the session id, model and start time the UI
    /// shows.
    fn attach_and_read_state(&mut self) -> Result<(), String> {
        let attached = self.send_bare_command(serde_json::json!({
            "type": "attach",
            "activeSessionId": self.active_session_id,
            "capabilities": DAEMON_CLIENT_CAPABILITIES,
        }))?;
        if attached["success"].as_bool() != Some(true) {
            let _ = self.shutdown();
            return Err(response_error(&attached, "attach"));
        }

        // Warm-up: get_state confirms the session answers and yields sessionId.
        match self.send_command(serde_json::json!({ "type": "get_state" })) {
            Ok(response) if response["success"].as_bool() == Some(true) => {
                if let Some(data) = response.get("data") {
                    self.apply_state_data(data);
                }
                // Reached it: whatever was wrong before no longer is.
                record_problem(None);
                Ok(())
            }
            Ok(response) => {
                let _ = self.shutdown();
                Err(response_error(&response, "get_state"))
            }
            Err(error) => {
                let _ = self.shutdown();
                Err(error)
            }
        }
    }

    /// Create a fresh session rooted at `cwd`, and adopt it.
    ///
    /// `create` takes cwd inside `config`, not at the top level. Sending it at
    /// the top level is silently ignored and the session lands in the daemon's
    /// own directory, which is how the vault tools would quietly start
    /// operating on the wrong tree.
    fn create_session(&mut self, cwd: &Path) -> Result<(), String> {
        self.require_client_owned_sessions("create a foreground-owned session")?;
        let created = self.send_bare_command(serde_json::json!({
            "type": "create",
            "config": { "cwd": cwd.to_string_lossy() },
            // Explicit rather than defaulted: foreground-owned is the ADR-0167
            // default. Resident is an explicit later promotion, not create.
            "lifecycle": "client_owned",
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
        self.session_ownership = SessionOwnership::ClientOwned;
        Ok(())
    }

    /// Create the deferred session and attach to it, if there is not one.
    ///
    /// Idempotent by design: `create_session` sets `active_session_id` before
    /// this returns, so the `get_state` warm-up below — which goes out through
    /// the session-scoped sender, and so back through here — sees a session
    /// and stops rather than recursing.
    fn ensure_session(&mut self) -> Result<(), String> {
        if !self.active_session_id.is_empty() {
            return Ok(());
        }
        let cwd = self.cwd.clone();
        self.create_session(&cwd)?;
        self.attach_and_read_state()?;
        self.name_session(&cwd);
        Ok(())
    }

    /// Find a session already running here that this client can rejoin.
    fn find_resumable_session(&mut self, cwd: &Path) -> Result<Option<ResumableSession>, String> {
        let response = self.send_bare_command(serde_json::json!({ "type": "list" }))?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, "list"));
        }
        let data = response.get("data").unwrap_or(&serde_json::Value::Null);
        let Some(id) = pick_resumable_session(data, cwd) else {
            return Ok(None);
        };
        // The stored name comes back on the same row, so rejoining a session
        // we created but nobody ever spoke in can still earn a real name on
        // its first exchange.
        let name = pick_resumable_row(data, cwd)
            .and_then(|session| session["name"].as_str())
            .map(str::to_string);
        Ok(Some(ResumableSession { id, name }))
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
                        self.record_hello_capabilities(&json);
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

    fn record_hello_capabilities(&mut self, hello: &serde_json::Value) {
        self.server_capabilities = hello["serverCapabilities"]
            .as_array()
            .map(|capabilities| {
                capabilities
                    .iter()
                    .filter_map(|capability| capability.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
    }

    fn require_client_owned_sessions(&self, operation: &str) -> Result<(), String> {
        if self
            .server_capabilities
            .iter()
            .any(|capability| capability == CLIENT_OWNED_SESSIONS_CAPABILITY)
        {
            return Ok(());
        }
        Err(client_owned_unavailable(operation))
    }

    /// Stop this client's owned worker. A resident session is left running
    /// (complete refuses "not owned"); any other complete failure falls back
    /// to `kill` of *this* session only.
    fn stop_owned_session(&mut self) {
        if self
            .require_client_owned_sessions("stop this foreground-owned session")
            .is_err()
        {
            let _ = self.send_command(serde_json::json!({ "type": "kill" }));
            return;
        }
        match self.call(serde_json::json!({ "type": "complete_owned_session" })) {
            Ok(_) => {}
            Err(error) if is_not_owned_error(&error) => {}
            Err(_) => {
                let _ = self.send_command(serde_json::json!({ "type": "kill" }));
            }
        }
    }

    fn promote_then_detach_grant(&mut self) {
        if self
            .require_client_owned_sessions("keep this session working in the background")
            .is_err()
        {
            return;
        }
        if self
            .call(serde_json::json!({ "type": "promote_owned_session" }))
            .is_ok()
        {
            self.session_ownership = SessionOwnership::Resident;
        }
    }

    /// Has this host got a session yet? False between connecting and the
    /// first thing that needs one.
    fn has_session(&self) -> bool {
        !self.active_session_id.is_empty()
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
    /// Send a command and unwrap the daemon's envelope, returning `data`.
    ///
    /// The command name in the error comes from `command["type"]`, so it
    /// cannot drift from what was actually sent. Written out by hand, the
    /// name appears twice per call — once in the payload, once in the error —
    /// and nothing makes the two agree.
    ///
    /// Callers that must apply their own error *policy* (emit an event, return
    /// a bool, map a specific `errorInfo.code` to user-facing advice, or shut
    /// the host down before failing) keep using `send_command` directly. The
    /// policy is the point there, not boilerplate.
    fn call(&mut self, command: serde_json::Value) -> Result<serde_json::Value, String> {
        let name = command["type"].as_str().unwrap_or("command").to_string();
        let response = self.send_command(command)?;
        if response["success"].as_bool() != Some(true) {
            return Err(response_error(&response, &name));
        }
        Ok(response
            .get("data")
            .cloned()
            .unwrap_or(serde_json::Value::Null))
    }

    /// Send a session-scoped command, creating the session if there is not
    /// one yet.
    ///
    /// This is the choke point that makes creation lazy: asking for a session
    /// is what buys one. Reads that run on a timer must not come through here
    /// — see `agent_activity`, `get_session_stats`, `get_commands`,
    /// `get_queue` and `get_session_tree`, which answer "nothing" instead.
    fn send_command(
        &mut self,
        mut command: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        self.ensure_session()?;
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
        self.model_accepts_images = model_accepts_images(model);
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

    /// #31. The name has to identify Rhizome *and* be useful. Vault folder
    /// plus the id tail — the tail is uniqueness for the daemon, taken from
    /// the end because uuidv7's leading characters are a clock.
    #[test]
    fn created_session_names_identify_rhizome_and_the_vault() {
        assert_eq!(
            rhizome_created_session_name(
                Path::new("/Users/dtc/Documents/Notes"),
                "01a0252e-b9d5-71e9-83de-2bce32f65c06",
            ),
            "Rhizome · Notes · f65c06"
        );
    }

    #[test]
    fn created_session_names_fall_back_when_the_folder_has_no_name() {
        assert_eq!(
            rhizome_created_session_name(Path::new("/"), "abc123xyz"),
            "Rhizome · vault · 123xyz"
        );
    }

    /// Probed on installed 0.8.0 `ensureDaemonRunning`. The public binary is
    /// the CLI entrypoint; these are the flags it passes to itself.
    #[test]
    fn daemon_launch_args_match_what_prime_spawns() {
        assert_eq!(
            daemon_launch_args(Path::new("/tmp/prime-agent-501/daemon.sock")),
            vec![
                "--mode",
                "daemon",
                "--daemon-socket",
                "/tmp/prime-agent-501/daemon.sock",
            ]
        );
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
            "serverCapabilities": [
                "attach_snapshot",
                "event_sequence",
                "slim_attach",
                "client_owned_sessions",
            ],
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

    /// Connect and materialize the session, the way a user reaching for the
    /// agent does. Most tests here exercise a live session, so this keeps them
    /// reading as they did before sessions became lazy.
    #[cfg(unix)]
    fn connect_host(vault: &Path) -> Result<String, String> {
        ensure_host(&vault.to_string_lossy())?;
        with_host_mut(|host| {
            host.ensure_session()?;
            Ok(host.session_id.clone().unwrap_or_default())
        })
    }

    /// Connect and stop there — no session. This is what attaching a vault
    /// does now, and the only helper that should be used to assert it.
    #[cfg(unix)]
    fn connect_host_lazy(vault: &Path) -> Result<String, String> {
        ensure_host(&vault.to_string_lossy())
    }

    #[cfg(unix)]
    fn prompt_request(vault: &Path, new_session: bool) -> PrimePromptRequest {
        PrimePromptRequest {
            images: Vec::new(),
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
            vec!["list", "create", "attach", "get_state", "set_session_name"]
        );
        let _ = shutdown_host();
    }

    /// The path a user actually takes: launch, then type. The session has to
    /// come into existence inside the prompt, in the order the daemon
    /// requires, and the turn has to stream as it always did — including the
    /// `Init` that tells the frontend which session it is now in, which on
    /// this path can only be known after the prompt has been sent.
    #[cfg(unix)]
    #[test]
    fn the_first_prompt_on_a_lazy_host_creates_the_session_and_still_streams() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| {
            (command["type"].as_str() == Some("prompt")).then(|| {
                vec![
                    ok(id, "prompt", serde_json::Value::Null),
                    session_event(serde_json::json!({ "type": "agent_start" })),
                    session_event(text_delta("hello")),
                    session_event(serde_json::json!({ "type": "agent_end", "messages": [] })),
                ]
            })
        });
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        let mut events = Vec::new();
        let session =
            run_prompt_stream(prompt_request(vault.path(), false), |e| events.push(e)).unwrap();

        assert_eq!(session, "sess-a");
        assert_eq!(
            daemon.commands(),
            vec![
                "list",
                "create",
                "attach",
                "get_state",
                "set_session_name",
                "prompt",
                "get_state"
            ],
            "the session is created inside the prompt, attached before it, and \
             re-read after"
        );
        assert!(
            events
                .iter()
                .any(|e| matches!(e, AiAgentStreamEvent::TextDelta { text } if text == "hello")),
            "events={events:?}"
        );
        assert!(
            events.iter().any(
                |e| matches!(e, AiAgentStreamEvent::Init { session_id } if session_id == "sess-a")
            ),
            "the frontend has to learn the session it landed in: {events:?}"
        );
        let _ = shutdown_host();
    }

    /// Deferring the session must not cost the user the model chip. Chat home
    /// draws it before a word is typed, and "Model unknown" on every launch
    /// would be a worse answer than the true one: what Prime is configured to
    /// start a session with.
    #[cfg(unix)]
    #[test]
    fn a_session_less_host_reports_the_model_prime_would_start_with() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        let status = get_status();

        assert!(status.running, "connected, just not in a session yet");
        assert!(
            status.session_id.is_none(),
            "and there is no session to name"
        );
        // Whatever this machine's Prime is set to. The assertion that matters
        // is that the two agree — hardcoding a model here would encode a
        // default the product deliberately does not have.
        let defaults = crate::prime_settings::read_defaults();
        assert_eq!(status.model_id, defaults.default_model);
        assert_eq!(status.model_provider, defaults.default_provider);
        assert_eq!(status.thinking_level, defaults.default_thinking_level);

        let _ = shutdown_host();
    }

    /// #28's root cause. Attaching a vault must not create a session.
    ///
    /// Rhizome connects on every vault attach — including the transient
    /// default vault the window opens with before the real one loads — and
    /// the daemon writes a session log the moment it is asked to `create`.
    /// Every launch therefore left husks on disk: 43 of 93 logs in the
    /// author's `~/.prime/agent/sessions` held no message at all. Filtering
    /// them out of the list was the display half; this is the half that stops
    /// making them.
    #[cfg(unix)]
    #[test]
    fn attaching_a_vault_creates_no_session() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();

        let session_id = connect_host_lazy(vault.path()).unwrap();

        assert_eq!(session_id, "", "no session yet means no session id");
        assert_eq!(
            daemon.commands(),
            vec!["list"],
            "connecting looks for work to rejoin and stops there"
        );
        let _ = shutdown_host();
    }

    /// The deferred half, on demand. A command that needs a session pays for
    /// one — in the same order the eager path used, because the daemon
    /// rejects a session command sent before `attach`.
    #[cfg(unix)]
    #[test]
    fn the_first_command_that_needs_a_session_creates_one() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        get_available_models().expect("models list");

        assert_eq!(
            daemon.commands(),
            vec![
                "list",
                "create",
                "attach",
                "get_state",
                "set_session_name",
                "get_available_models"
            ]
        );
        let _ = shutdown_host();
    }

    /// Once a session exists, later commands reuse it rather than creating
    /// another. Deferring must not turn into creating one per command.
    #[cfg(unix)]
    #[test]
    fn a_session_is_created_once_and_then_reused() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        get_available_models().expect("models list");
        get_available_models().expect("models list again");

        let creates = daemon.commands().iter().filter(|c| *c == "create").count();
        assert_eq!(creates, 1, "one session, not one per command");
        let _ = shutdown_host();
    }

    /// #31. A name at create time is what the list later reads back. The
    /// payload is the contract: Rhizome, the vault, the id tail. The type
    /// sequence already asserted `set_session_name` is sent; this is the
    /// half that says *what*.
    #[cfg(unix)]
    #[test]
    fn a_new_session_is_named_for_rhizome_and_the_vault() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();

        connect_host(vault.path()).unwrap();

        let command = daemon
            .command("set_session_name")
            .expect("the new session must be named");
        let folder = vault.path().file_name().unwrap().to_string_lossy();
        let expected = format!("Rhizome · {folder} · sess-a");
        assert_eq!(command["name"].as_str(), Some(expected.as_str()));
        let _ = shutdown_host();
    }

    /// #49. The placeholder is a stand-in, not a name. After the first real
    /// exchange the session is renamed through `set_session_name`, so the name
    /// lands in Prime's own log and every client reads the same one — rather
    /// than each client re-deriving a label from the first message, which is
    /// what left rows reading `/prime-intellect`.
    #[cfg(unix)]
    #[test]
    fn the_first_exchange_replaces_the_placeholder_name() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| {
            (command["type"].as_str() == Some("prompt")).then(|| {
                vec![
                    ok(id, "prompt", serde_json::Value::Null),
                    session_event(serde_json::json!({ "type": "agent_start" })),
                    session_event(text_delta("On it.")),
                    session_event(serde_json::json!({ "type": "agent_end", "messages": [] })),
                ]
            })
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let mut request = prompt_request(vault.path(), false);
        request.message = "Draft the release notes for 0.8".into();
        run_prompt_stream(request, |_| {}).unwrap();

        let names = daemon.commands_matching("set_session_name");
        assert_eq!(names.len(), 2, "placeholder, then the real name");
        assert_eq!(
            names[1]["name"].as_str(),
            Some("Draft the release notes for 0.8")
        );

        // A session is named once. The second turn must not rewrite it — that
        // would make the title follow whatever was asked most recently.
        let mut again = prompt_request(vault.path(), false);
        again.message = "And publish the tag".into();
        run_prompt_stream(again, |_| {}).unwrap();
        assert_eq!(daemon.commands_matching("set_session_name").len(), 2);

        let _ = shutdown_host();
    }

    /// A turn too slight to name leaves the placeholder in place, and the next
    /// turn may still earn one. Better a stand-in than a session called `hi`.
    #[cfg(unix)]
    #[test]
    fn a_turn_with_nothing_to_name_it_keeps_the_placeholder() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| {
            (command["type"].as_str() == Some("prompt")).then(|| {
                vec![
                    ok(id, "prompt", serde_json::Value::Null),
                    session_event(serde_json::json!({ "type": "agent_start" })),
                    session_event(text_delta("Hi!")),
                    session_event(serde_json::json!({ "type": "agent_end", "messages": [] })),
                ]
            })
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        // "hi" — under the floor, and the reply is no better.
        run_prompt_stream(prompt_request(vault.path(), false), |_| {}).unwrap();
        assert_eq!(daemon.commands_matching("set_session_name").len(), 1);

        let mut second = prompt_request(vault.path(), false);
        second.message = "Trace why search misses aliases".into();
        run_prompt_stream(second, |_| {}).unwrap();
        let names = daemon.commands_matching("set_session_name");
        assert_eq!(names.len(), 2);
        assert_eq!(
            names[1]["name"].as_str(),
            Some("Trace why search misses aliases")
        );

        let _ = shutdown_host();
    }

    /// Renaming a past conversation must not be what materializes a session.
    /// `send_command` would `ensure_session` first; this path is bare.
    #[cfg(unix)]
    #[test]
    fn renaming_a_saved_session_does_not_create_one() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        rename_saved_session("/sessions/abc.jsonl", "Inbox triage").unwrap();

        assert_eq!(
            daemon.commands(),
            vec!["list", "rename_saved_session"],
            "a rename is not a reason to create"
        );
        let command = daemon.command("rename_saved_session").unwrap();
        assert_eq!(command["sessionPath"], "/sessions/abc.jsonl");
        assert_eq!(command["name"], "Inbox triage");
        assert!(
            command.get("activeSessionId").is_none(),
            "activeSessionId is optional and we must not invent one: {command}"
        );
        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn renaming_rejects_an_empty_name_without_talking_to_the_daemon() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        let error = rename_saved_session("/sessions/abc.jsonl", "   ").unwrap_err();
        assert!(
            error.contains("empty"),
            "blank names fail here, not after a hop: {error}"
        );
        assert!(
            daemon.command("rename_saved_session").is_none(),
            "the daemon must not see a blank rename"
        );
        let _ = shutdown_host();
    }

    #[test]
    fn renaming_rejects_a_path_that_is_not_a_session_log() {
        assert_eq!(
            rename_saved_session("/etc/passwd", "Inbox").unwrap_err(),
            "Not a Prime session log"
        );
        assert_eq!(
            rename_saved_session("/sessions/foo.mindwalk-bridge.jsonl", "Inbox").unwrap_err(),
            "Not a Prime session log"
        );
        assert_eq!(
            rename_saved_session("/sessions/../other.jsonl", "Inbox").unwrap_err(),
            "Not a Prime session log"
        );
    }

    /// The polls that run whether or not anyone is talking to the agent must
    /// not be what creates the session. `usePrimeAgentActivity` is mounted at
    /// app level and ticks on a timer; the stats poll, the command menu, and
    /// the composer queue all fetch on mount. If any of them materialized a
    /// session, deferring creation would buy nothing.
    #[cfg(unix)]
    #[test]
    fn background_reads_do_not_create_a_session() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        let activity = agent_activity().expect("activity reads as empty");
        let stats = get_session_stats().expect("stats read as unknown");
        let commands = get_commands().expect("commands read as empty");
        let queue = get_queue().expect("queue read as empty");
        let tree = get_session_tree().expect("tree read as empty");

        assert_eq!(
            activity,
            Default::default(),
            "nothing to report, not a goal"
        );
        assert!(stats.session_id.is_none(), "no session, no stats");
        assert!(commands.is_empty(), "no session, no session commands");
        assert_eq!(queue, PrimeQueue::default(), "no session, no queue");
        assert_eq!(tree, PrimeSessionTree::default(), "no session, no branches");
        assert_eq!(
            daemon.commands(),
            vec!["list"],
            "a background poll must not spend a session: {:?}",
            daemon.commands()
        );
        let _ = shutdown_host();
    }

    /// "New chat" on a host that never got one is the session, not a second
    /// one. Materializing and then asking the daemon for a fresh session
    /// would create two logs and leave the first empty — the exact litter
    /// this change exists to stop.
    #[cfg(unix)]
    #[test]
    fn a_new_chat_on_a_fresh_host_creates_one_session_not_two() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        let session_id = new_session().expect("a session to chat in");

        assert_eq!(session_id, "sess-a");
        let commands = daemon.commands();
        assert_eq!(
            commands.iter().filter(|c| *c == "create").count(),
            1,
            "{commands:?}"
        );
        assert!(
            !commands.iter().any(|c| c == "new_session"),
            "the session just created is already new: {commands:?}"
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
        // ADR-0167: a new session is owned by this client. Resident is an
        // explicit promotion, not the create default.
        assert_eq!(create["lifecycle"].as_str(), Some("client_owned"));
        let attach = daemon.command("attach").expect("attach follows create");
        let capabilities = attach["capabilities"]
            .as_array()
            .expect("attach advertises client capabilities");
        assert!(
            capabilities
                .iter()
                .any(|capability| capability.as_str() == Some("client_owned_sessions")),
            "client_owned create is rejected unless attach claims the capability: {attach}"
        );
        let _ = shutdown_host();
    }

    /// Promotion is the explicit grant that turns a foreground-owned session
    /// into resident work. The command must name the attached session.
    #[cfg(unix)]
    #[test]
    fn promote_owned_session_sends_the_attached_session() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        promote_owned_session()
            .expect("promote must succeed when the daemon advertises the capability");

        let promote = daemon
            .command("promote_owned_session")
            .expect("promote was sent");
        assert_eq!(
            promote["activeSessionId"].as_str(),
            Some(FAKE_ACTIVE_SESSION_ID)
        );
        let _ = shutdown_host();
    }

    /// Completing owned work is the default close/quit stop. Same handle as
    /// promote, different lifetime.
    #[cfg(unix)]
    #[test]
    fn complete_owned_session_sends_the_attached_session() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        complete_owned_session()
            .expect("complete must succeed when the daemon advertises the capability");

        let complete = daemon
            .command("complete_owned_session")
            .expect("complete was sent");
        assert_eq!(
            complete["activeSessionId"].as_str(),
            Some(FAKE_ACTIVE_SESSION_ID)
        );
        let _ = shutdown_host();
    }

    /// A daemon that cannot own sessions must fail before the command goes
    /// out. Sending it anyway would produce a raw protocol error.
    #[cfg(unix)]
    #[test]
    fn promote_refuses_when_the_daemon_lacks_client_owned_sessions() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let cwd = vault.path().to_string_lossy().to_string();
        let daemon = FakeDaemon::start_with_hello(
            {
                let cwd = cwd.clone();
                move |command, id| {
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
                }
            },
            serde_json::json!({
                "type": "daemon_hello",
                "protocol": { "name": DAEMON_PROTOCOL_NAME, "version": DAEMON_PROTOCOL_VERSION },
                "appVersion": "0.7.1",
                "clientId": "fake-client",
                "serverCapabilities": ["attach_snapshot", "event_sequence", "slim_attach"],
            }),
        );
        daemon.install();
        connect_host(vault.path()).unwrap();

        let error = promote_owned_session().expect_err("must not promote without the capability");
        assert!(error.contains("client-owned"), "{error}");
        assert!(
            !daemon
                .commands()
                .contains(&"promote_owned_session".to_string()),
            "capability-aware: do not send a command the daemon cannot honor"
        );
        let _ = shutdown_host();
    }

    /// Creating as `client_owned` is rejected the same way: do not send a
    /// lifecycle the greeting said this daemon cannot honor.
    #[cfg(unix)]
    #[test]
    fn create_refuses_client_owned_when_the_daemon_lacks_the_capability() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start_with_hello(
            |_, _| None,
            serde_json::json!({
                "type": "daemon_hello",
                "protocol": { "name": DAEMON_PROTOCOL_NAME, "version": DAEMON_PROTOCOL_VERSION },
                "appVersion": "0.7.1",
                "clientId": "fake-client",
                "serverCapabilities": ["attach_snapshot", "event_sequence", "slim_attach"],
            }),
        );
        daemon.install();

        let error = connect_host(vault.path())
            .expect_err("create must not send client_owned to an incapable daemon");
        assert!(error.contains("client-owned"), "{error}");
        assert!(
            !daemon.commands().contains(&"create".to_string()),
            "capability-aware: do not send create: {commands:?}",
            commands = daemon.commands()
        );
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

    /// With nothing to rejoin, the session a first run gets is a created one,
    /// not an adopted one — #6's behaviour has to survive #7, or a first run
    /// would land nowhere. It arrives on demand now rather than at connect
    /// (see `attaching_a_vault_creates_no_session`), but it still arrives.
    #[cfg(unix)]
    #[test]
    fn a_first_run_creates_rather_than_rejoins() {
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
                "serverCapabilities": [
                    "attach_snapshot",
                    "event_sequence",
                    "slim_attach",
                    "client_owned_sessions",
                ],
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
        assert_eq!(
            disposition_for(SessionCloseIntent::Stop),
            QuitDisposition::StopSession
        );
    }

    /// Keep working and idle detach both leave the worker; they differ in
    /// whether it was promoted first.
    #[test]
    fn detach_and_keep_working_leave_the_session() {
        assert_eq!(
            disposition_for(SessionCloseIntent::Detach),
            QuitDisposition::KeepSessionRunning
        );
        assert_eq!(
            disposition_for(SessionCloseIntent::KeepWorking),
            QuitDisposition::KeepSessionRunning
        );
    }

    /// Quitting without a connection has nothing to decide and must not error
    /// on the way out of the app.
    #[cfg(unix)]
    #[test]
    fn quitting_without_a_connection_is_a_no_op() {
        let _guard = host_guard();
        let _ = shutdown_host();

        assert_eq!(
            settle_session(SessionCloseIntent::Stop).unwrap(),
            QuitDisposition::NotConnected
        );
        assert_eq!(
            settle_session(SessionCloseIntent::Detach).unwrap(),
            QuitDisposition::NotConnected
        );
        assert_eq!(
            settle_session_on_quit().unwrap(),
            QuitDisposition::NotConnected
        );
    }

    /// End to end at the transport: the default completes our owned session,
    /// and ends **only** ours. `shutdown` would stop every agent on the
    /// machine including other clients' — never the right tool for "the user
    /// closed my window".
    #[cfg(unix)]
    #[test]
    fn quitting_completes_our_owned_session_and_never_the_whole_service() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(
            settle_session_on_quit().unwrap(),
            QuitDisposition::StopSession
        );

        let complete = daemon
            .wait_for_command("complete_owned_session", Duration::from_secs(5))
            .expect("our owned session is stopped");
        assert_eq!(
            complete["activeSessionId"].as_str(),
            Some(FAKE_ACTIVE_SESSION_ID),
            "it must name our own session"
        );
        assert!(
            !daemon.commands().contains(&"shutdown".to_string()),
            "the shared service is never stopped: {:?}",
            daemon.commands()
        );
        assert!(
            !daemon.commands().contains(&"kill".to_string()),
            "owned stop uses complete, not kill: {:?}",
            daemon.commands()
        );
    }

    /// Idle close detaches. The owned worker expires after Prime's grace;
    /// we do not complete or kill it here.
    #[cfg(unix)]
    #[test]
    fn idle_close_detaches_without_completing_or_killing() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(
            settle_session(SessionCloseIntent::Detach).unwrap(),
            QuitDisposition::KeepSessionRunning
        );

        assert!(
            daemon
                .wait_for_command("detach", Duration::from_secs(5))
                .is_some(),
            "idle close releases the client"
        );
        let commands = daemon.commands();
        assert!(
            !commands.contains(&"complete_owned_session".to_string()),
            "{commands:?}"
        );
        assert!(!commands.contains(&"kill".to_string()), "{commands:?}");
        assert!(!commands.contains(&"shutdown".to_string()));
    }

    /// Keep working is the explicit grant: promote, then detach.
    #[cfg(unix)]
    #[test]
    fn keep_working_promotes_then_detaches() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(
            settle_session(SessionCloseIntent::KeepWorking).unwrap(),
            QuitDisposition::KeepSessionRunning
        );

        let promote = daemon
            .command("promote_owned_session")
            .expect("keep working promotes");
        assert_eq!(
            promote["activeSessionId"].as_str(),
            Some(FAKE_ACTIVE_SESSION_ID)
        );
        assert!(daemon
            .wait_for_command("detach", Duration::from_secs(5))
            .is_some());
        assert!(!daemon
            .commands()
            .contains(&"complete_owned_session".to_string()));
        assert!(!daemon.commands().contains(&"kill".to_string()));
        assert!(!daemon.commands().contains(&"shutdown".to_string()));
    }

    /// After an explicit promote, full quit must not complete the worker.
    #[cfg(unix)]
    #[test]
    fn quit_after_promote_detaches_resident_work() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|_, _| None);
        daemon.install();
        connect_host(vault.path()).unwrap();
        promote_owned_session().unwrap();

        assert_eq!(
            settle_session_on_quit().unwrap(),
            QuitDisposition::KeepSessionRunning
        );
        let commands = daemon.commands();
        assert!(commands.contains(&"promote_owned_session".to_string()));
        assert!(
            !commands.contains(&"complete_owned_session".to_string()),
            "{commands:?}"
        );
        assert!(!commands.contains(&"kill".to_string()), "{commands:?}");
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
    ///
    /// Updated for #14: `cron_list` alone now serves both sections. It returns
    /// heartbeats *and* cron jobs tagged by `source`, so the extra
    /// `heartbeats_list` round-trip only re-delivered the same heartbeats in a
    /// `{"job": …}` envelope — showing each one twice, once unparseable.
    #[cfg(unix)]
    #[test]
    fn agent_activity_asks_for_the_daemon_names_for_scheduled_work() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("cron_list") => Some(vec![ok(
                id,
                "cron_list",
                serde_json::json!({ "jobs": [
                    { "id": "hb-1", "source": "heartbeat", "prompt": "check in",
                      "schedule": { "expression": "every 30 minutes" } },
                    { "id": "job-1", "source": "cron", "prompt": "nightly",
                      "schedule": { "expression": "0 3 * * *" } }
                ] }),
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let activity = agent_activity().unwrap();

        let asked = daemon.commands();
        assert!(asked.contains(&"cron_list".to_string()), "{asked:?}");
        assert!(
            !asked.contains(&"heartbeats_list".to_string()),
            "one call serves both sections now: {asked:?}"
        );
        assert!(
            !asked.iter().any(|c| c.starts_with("list_")),
            "the RPC spellings are gone: {asked:?}"
        );
        assert_eq!(activity.heartbeats.len(), 1, "split by source");
        assert_eq!(activity.schedules.len(), 1, "split by source");
        assert_eq!(
            activity.heartbeats[0].interval.as_deref(),
            Some("every 30 minutes")
        );

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

    #[test]
    fn status_output_yields_a_windows_named_pipe_path() {
        let stdout =
            "socket                                   pid    version  status   sessions  uptime\n\
                      \\\\.\\pipe\\prime-agent-daemon *  1234  0.7.4    current  0\n\
                      \n* default background service\n";

        assert_eq!(
            parse_status_socket_path(stdout),
            Some(PathBuf::from(r"\\.\pipe\prime-agent-daemon"))
        );
    }

    #[test]
    fn is_daemon_transport_path_accepts_unix_sockets_and_windows_pipes() {
        assert!(is_daemon_transport_path(
            "/var/folders/_9/hp/T/prime-agent-501/daemon.sock"
        ));
        assert!(is_daemon_transport_path(r"\\.\pipe\prime-agent-daemon"));
        assert!(!is_daemon_transport_path("socket"));
    }

    #[cfg(windows)]
    #[test]
    fn the_default_socket_path_matches_primes_own_layout() {
        assert_eq!(
            default_daemon_socket_path().expect("a pipe path on windows"),
            PathBuf::from(r"\\.\pipe\prime-agent-daemon")
        );
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

    fn image(data: &str) -> PrimeImageContent {
        PrimeImageContent {
            kind: "image".into(),
            data: data.into(),
            mime_type: "image/png".into(),
        }
    }

    /// `get_state` returns the whole Model, `input` included — so whether the
    /// running model takes images is already on the status payload, with no
    /// second round trip and nothing to match by id. The first cut fetched the
    /// catalog and looked the model up, and the warning never fired in the
    /// app; this removes the lookup rather than debugging it.
    #[test]
    fn the_running_models_image_support_is_read_straight_off_get_state() {
        let vision = serde_json::json!({"id": "claude-fable-5", "input": ["text", "image"]});
        let text_only = serde_json::json!({"id": "hy3-free", "input": ["text"]});
        assert_eq!(model_accepts_images(&vision), Some(true));
        assert_eq!(model_accepts_images(&text_only), Some(false));
    }

    /// Silence is not a refusal. A model with no `input` array must not be
    /// reported as text-only, or the composer warns on models that work.
    #[test]
    fn a_model_that_reports_no_modalities_is_unknown_not_text_only() {
        assert_eq!(
            model_accepts_images(&serde_json::json!({"id": "unsaid"})),
            None
        );
        assert_eq!(
            model_accepts_images(&serde_json::json!({"id": "empty", "input": []})),
            None
        );
    }

    /// Prime reports which modalities a model takes. Rhizome dropped the
    /// field, so the composer had no way to tell a vision model from a
    /// text-only one — and images could only ever be offered blindly.
    #[test]
    fn a_models_input_modalities_survive_the_parse() {
        let models = models_from_response(&serde_json::json!({
            "models": [
                {"id": "claude-opus-5", "provider": "anthropic", "input": ["text", "image"]},
                {"id": "text-only", "provider": "opencode", "input": ["text"]},
                {"id": "unsaid", "provider": "opencode"},
            ]
        }));

        assert_eq!(
            models[0].input.as_deref(),
            Some(["text".to_string(), "image".to_string()].as_slice())
        );
        assert_eq!(
            models[1].input.as_deref(),
            Some(["text".to_string()].as_slice())
        );
        // Not "text only" — Prime simply did not say, and a caller that reads
        // silence as a refusal would grey out working models.
        assert_eq!(models[2].input, None);
    }

    /// Real rows from the list, each of which named a session badly.
    #[test]
    fn a_session_is_named_from_what_the_user_asked() {
        assert_eq!(
            session_title_from_exchange(Some("can you look up the youtuber miner45"), None),
            Some("can you look up the youtuber miner45".to_string())
        );
        // A slash command names the command, not the session.
        assert_eq!(
            session_title_from_exchange(Some("/prime-intellect"), None),
            Some("prime-intellect".to_string())
        );
        // One sentence — a pasted brief must not title everything after it.
        assert_eq!(
            session_title_from_exchange(Some("Fix the scroll bug. Then rebuild and check."), None),
            Some("Fix the scroll bug".to_string())
        );
    }

    /// Too short to mean anything is worse than no name: "hi" tells you less
    /// than the timestamp already beside it.
    #[test]
    fn a_greeting_is_not_a_name() {
        assert_eq!(session_title_from_exchange(Some("hi"), None), None);
        assert_eq!(session_title_from_exchange(Some("  "), None), None);
        assert_eq!(session_title_from_exchange(None, None), None);
    }

    /// 7 of 31 sessions here have no user turn at all — agent-started or
    /// heartbeat-driven. Only then does the agent's opening line win.
    #[test]
    fn the_agent_names_a_session_the_user_never_spoke_in() {
        assert_eq!(
            session_title_from_exchange(None, Some("Checking the vault watcher for debounce")),
            Some("Checking the vault watcher for debounce".to_string())
        );
        // But never over the user's own words.
        assert_eq!(
            session_title_from_exchange(Some("why is promote refusing"), Some("Let me look")),
            Some("why is promote refusing".to_string())
        );
    }

    /// A version number is not the end of a sentence. Splitting on every `.`
    /// named a session "Draft the release notes for 0".
    #[test]
    fn a_full_stop_inside_a_number_does_not_end_the_name() {
        assert_eq!(
            session_title_from_exchange(Some("Draft the release notes for 0.8"), None).as_deref(),
            Some("Draft the release notes for 0.8")
        );
        assert_eq!(
            session_title_from_exchange(Some("Rewrite config.toml by hand"), None).as_deref(),
            Some("Rewrite config.toml by hand")
        );
        // A real sentence break still ends it.
        assert_eq!(
            session_title_from_exchange(Some("Fix the search index. Then ship it."), None)
                .as_deref(),
            Some("Fix the search index")
        );
    }

    /// Cut on a word, so the name reads as a phrase and not a slice.
    #[test]
    fn a_long_request_is_cut_at_a_word() {
        let title = session_title_from_exchange(
            Some("investigate why the chat transcript grows without ever scrolling anywhere"),
            None,
        )
        .expect("title");
        assert!(title.ends_with('…'), "{title}");
        assert!(
            title.chars().count() <= MAX_SESSION_TITLE_CHARS + 1,
            "{title}"
        );
        assert!(!title.contains("  "));
        assert!(
            title.starts_with("investigate why the chat transcript grows"),
            "{title}"
        );
    }

    /// A name someone chose must never be overwritten — that is what rename
    /// is for. Only our own placeholder is fair game.
    #[test]
    fn only_our_own_placeholder_may_be_replaced() {
        assert!(is_rhizome_placeholder_name(
            "Rhizome · Rhizome Vault · 8228ec"
        ));
        assert!(!is_rhizome_placeholder_name("Latest handoff plan review"));
        assert!(!is_rhizome_placeholder_name(""));
    }

    /// A text-only turn has to stay byte-identical to what Rhizome sent
    /// before images existed. `None`, not `[]` — an empty array would change
    /// every ordinary chat message on the wire to ship one new feature.
    #[test]
    fn a_turn_with_no_images_carries_no_images_key_at_all() {
        assert_eq!(prompt_images_field(&[]), None);
        assert_eq!(
            build_queue_command("steer", "carry on", &[]),
            serde_json::json!({"type": "steer", "message": "carry on"})
        );
    }

    #[test]
    fn images_go_out_in_primes_image_content_shape() {
        assert_eq!(
            build_queue_command("follow_up", "and this", &[image("QUJD")]),
            serde_json::json!({
                "type": "follow_up",
                "message": "and this",
                "images": [{"type": "image", "data": "QUJD", "mimeType": "image/png"}],
            })
        );
    }

    /// The last gate before a socket that speaks newline-delimited JSON. A
    /// blank payload is not an image, and a fifth one is a stall the whole
    /// session waits behind.
    #[test]
    fn blank_payloads_are_dropped_and_the_count_is_capped() {
        let mut blank = image("   ");
        blank.mime_type = "image/png".into();
        assert_eq!(prompt_images_field(&[blank]), None);

        let many = vec![image("QQ=="); MAX_PROMPT_IMAGES + 3];
        let field = prompt_images_field(&many).expect("images");
        assert_eq!(field.as_array().unwrap().len(), MAX_PROMPT_IMAGES);
    }

    /// Steering is the whole point of this slice: redirect a running turn
    /// without throwing its work away. `abort` was the only interrupt before.
    #[test]
    fn steer_and_follow_up_send_the_message_prime_expects() {
        assert_eq!(
            build_queue_command("steer", "focus on error handling", &[]),
            serde_json::json!({"type": "steer", "message": "focus on error handling"})
        );
        assert_eq!(
            build_queue_command("follow_up", "then summarise", &[]),
            serde_json::json!({"type": "follow_up", "message": "then summarise"})
        );
    }

    #[cfg(unix)]
    #[test]
    fn follow_up_returns_the_daemons_queue_admission_result() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| {
            (command["type"].as_str() == Some("follow_up"))
                .then(|| vec![ok(id, "follow_up", serde_json::json!({ "queued": false }))])
        });
        daemon.install();
        connect_host(vault.path()).unwrap();
        with_host_mut(|host| {
            host.is_streaming = true;
            Ok(())
        })
        .unwrap();

        assert!(!follow_up("then summarise", &[]).unwrap());

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn admitted_follow_ups_and_successful_steers_return_true() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("follow_up") => Some(vec![ok(
                id,
                "follow_up",
                serde_json::json!({ "queued": true }),
            )]),
            Some("steer") => Some(vec![ok(
                id,
                "steer",
                serde_json::json!({ "queued": false }),
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();
        with_host_mut(|host| {
            host.is_streaming = true;
            Ok(())
        })
        .unwrap();

        assert!(follow_up("then summarise", &[]).unwrap());
        assert!(steer("focus on error handling", &[]).unwrap());

        let _ = shutdown_host();
    }

    #[test]
    fn get_queue_reads_follow_up_or_follow_ups() {
        let from_daemon = PrimeQueue::from_data(&serde_json::json!({
            "steering": ["focus on error handling"],
            "followUp": ["then summarise", "  "],
        }));
        assert_eq!(
            from_daemon,
            PrimeQueue {
                steering: vec!["focus on error handling".into()],
                follow_up: vec!["then summarise".into()],
            }
        );

        let from_event = PrimeQueue::from_data(&serde_json::json!({
            "steering": [],
            "followUps": ["after that, ship it"],
        }));
        assert_eq!(from_event.follow_up, vec!["after that, ship it"]);
    }

    #[cfg(unix)]
    #[test]
    fn get_queue_asks_prime_and_clear_drops_both_lanes() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("get_queue") => Some(vec![ok(
                id,
                "get_queue",
                serde_json::json!({
                    "steering": ["focus on error handling"],
                    "followUp": ["then summarise"],
                }),
            )]),
            Some("clear_queue") => Some(vec![ok(
                id,
                "clear_queue",
                serde_json::json!({ "steering": [], "followUp": [] }),
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(
            get_queue().unwrap(),
            PrimeQueue {
                steering: vec!["focus on error handling".into()],
                follow_up: vec!["then summarise".into()],
            }
        );
        assert_eq!(clear_queue().unwrap(), PrimeQueue::default());

        let _ = shutdown_host();
    }

    #[test]
    fn session_tree_reads_user_text_and_uses_label_when_prime_named_the_branch() {
        let tree = PrimeSessionTree::from_data(&serde_json::json!({
            "leafId": "u2",
            "flatNodes": [
                {
                    "entry": {
                        "type": "message",
                        "id": "u1",
                        "parentId": null,
                        "message": {
                            "role": "user",
                            "content": [{ "type": "text", "text": "how should we store this" }]
                        }
                    }
                },
                {
                    "entry": {
                        "type": "message",
                        "id": "u2",
                        "parentId": "u1",
                        "message": {
                            "role": "user",
                            "content": [{ "type": "text", "text": "the unlabeled prompt" }]
                        }
                    },
                    "label": "rust rewrite"
                }
            ]
        }));
        assert_eq!(tree.leaf_id.as_deref(), Some("u2"));
        assert_eq!(tree.nodes[0].kind, "user");
        assert_eq!(tree.nodes[0].title, "how should we store this");
        assert_eq!(tree.nodes[1].title, "rust rewrite");
        assert_eq!(tree.nodes[1].label.as_deref(), Some("rust rewrite"));
    }

    #[test]
    fn navigate_tree_refuses_without_a_branch_id() {
        assert!(navigate_tree("").is_err());
        assert!(navigate_tree("   ").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn get_session_tree_asks_prime_and_navigate_moves_the_leaf() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("get_session_tree") => Some(vec![ok(
                id,
                "get_session_tree",
                serde_json::json!({
                    "leafId": "rust",
                    "flatNodes": [
                        {
                            "entry": {
                                "type": "message",
                                "id": "ts",
                                "parentId": "a1",
                                "message": {
                                    "role": "user",
                                    "content": [{ "type": "text", "text": "stay on typescript" }]
                                }
                            }
                        },
                        {
                            "entry": {
                                "type": "message",
                                "id": "rust",
                                "parentId": "a1",
                                "message": {
                                    "role": "user",
                                    "content": [{ "type": "text", "text": "try rust rewrite" }]
                                }
                            }
                        }
                    ]
                }),
            )]),
            Some("navigate_tree") => {
                assert_eq!(command["targetId"], "ts");
                Some(vec![ok(
                    id,
                    "navigate_tree",
                    serde_json::json!({ "cancelled": false }),
                )])
            }
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let tree = get_session_tree().unwrap();
        assert_eq!(tree.leaf_id.as_deref(), Some("rust"));
        assert_eq!(tree.nodes.len(), 2);

        let after = navigate_tree("ts").unwrap();
        assert_eq!(after.nodes[0].id, "ts");
        assert!(daemon.command("navigate_tree").is_some());

        let _ = shutdown_host();
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

    /// End-to-end against a real daemon holding real scheduled work.
    ///
    /// Ignored by default — needs a live daemon with a session in $HOME that
    /// has at least one cron job or heartbeat. Set one up with:
    ///
    /// ```text
    /// prime-agent schedule add <agent> "0 9 * * 1-5" -- "probe"
    /// ```
    ///
    /// then:
    ///
    /// ```text
    /// cargo test --manifest-path src-tauri/Cargo.toml --lib \
    ///   scheduled_work_against_the_live_daemon -- --ignored --nocapture
    /// ```
    ///
    /// This exists because the previous shape for this data was *inferred*
    /// from a skill's docs rather than observed, and was wrong in two ways
    /// that made every heartbeat parse to all-None. Every other test here
    /// feeds fixtures; only this one proves the real daemon agrees.
    #[cfg(unix)]
    #[test]
    #[ignore = "needs a running prime-agent daemon with scheduled work"]
    fn scheduled_work_against_the_live_daemon() {
        let _guard = host_guard();
        let home = dirs::home_dir().expect("home");
        connect_host(&home).expect("connect");

        let activity = agent_activity().expect("activity");
        println!(
            "heartbeats={} schedules={}",
            activity.heartbeats.len(),
            activity.schedules.len()
        );
        for item in activity.heartbeats.iter().chain(activity.schedules.iter()) {
            println!(
                "  source={:?} status={:?} interval={:?} next={:?} label={:?}",
                item.source, item.status, item.interval, item.next_run_at, item.label
            );
        }

        let all: Vec<_> = activity
            .heartbeats
            .iter()
            .chain(activity.schedules.iter())
            .collect();
        assert!(
            !all.is_empty(),
            "expected at least one scheduled job; add one with `prime-agent schedule add`",
        );
        // The three fields the UI is built on. Any of them coming back None
        // means the shape moved again.
        assert!(
            all.iter().all(|item| item.id.is_some()),
            "every job needs an id to act on"
        );
        assert!(
            all.iter().all(|item| item.interval.is_some()),
            "cadence must parse"
        );
        assert!(
            all.iter().all(|item| item.source.is_some()),
            "source distinguishes the two kinds"
        );

        let _ = shutdown_host();
    }

    // ── The daemon envelope, and what a refusal must not look like ─────────
    //
    // Five call sites used to read `data` without checking `success`, so a
    // `{"success": false}` was indistinguishable from an empty answer. These
    // pin the policy each one now has.

    #[cfg(unix)]
    #[test]
    fn a_failed_streaming_check_refuses_the_goal_instead_of_sending_it_mid_turn() {
        // The dangerous one. `session_is_streaming` answered `false` on any
        // daemon error, so `send_goal_command` skipped its abort and sent
        // `/goal` into a running turn — where, per its own note, the send
        // reports success and nothing happens. Failing closed turns that
        // silent corruption into a bounded wait and a clear error.
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let aborts = Arc::new(Mutex::new(0usize));
        let prompts = Arc::new(Mutex::new(0usize));
        let daemon = {
            let aborts = Arc::clone(&aborts);
            let prompts = Arc::clone(&prompts);
            FakeDaemon::start(move |command, id| match command["type"].as_str() {
                // The state read fails, as a wedged daemon would.
                Some("get_connection_state") => {
                    Some(vec![failed(id, "get_connection_state", "socket wedged")])
                }
                Some("abort") => {
                    *aborts.lock().unwrap() += 1;
                    Some(vec![ok(id, "abort", serde_json::Value::Null)])
                }
                Some("prompt") => {
                    *prompts.lock().unwrap() += 1;
                    Some(vec![ok(id, "prompt", serde_json::Value::Null)])
                }
                _ => None,
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();

        let result = clear_goal();

        assert!(
            result.is_err(),
            "a goal command must not claim success when the session state is unknown",
        );
        assert_eq!(
            *prompts.lock().unwrap(),
            0,
            "no /goal prompt may be sent while the turn state is unknown",
        );
        assert!(
            *aborts.lock().unwrap() > 0,
            "it must try to abort rather than assume the session is idle",
        );

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn call_names_the_command_from_the_payload_it_sent() {
        // Written by hand, the name appears twice per call — in the payload and
        // in the error — with nothing keeping them in step.
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("cron_list") => Some(vec![failed(id, "cron_list", "nope")]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let error = with_host_mut(|host| {
            host.call(serde_json::json!({ "type": "cron_list" }))?;
            Ok(())
        })
        .unwrap_err();
        assert!(error.contains("nope"), "got: {error}");

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn call_returns_the_data_payload_not_the_envelope() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("cron_list") => Some(vec![ok(
                id,
                "cron_list",
                serde_json::json!({ "jobs": [{ "id": "a" }] }),
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let data =
            with_host_mut(|host| host.call(serde_json::json!({ "type": "cron_list" }))).unwrap();
        assert!(data["jobs"].is_array(), "data should be unwrapped: {data}");
        assert!(data.get("success").is_none(), "envelope should be gone");

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn a_refused_state_read_is_not_reported_as_an_absent_goal() {
        // `read_goal_state` returning None on refusal let the confirm loop
        // treat a transport failure as "the goal is cleared".
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("get_connection_state") => {
                Some(vec![failed(id, "get_connection_state", "session gone")])
            }
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let result = agent_activity();
        assert!(
            result.is_err(),
            "a refusal must not render as an idle harness"
        );

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn a_refused_schedule_read_empties_only_its_own_section() {
        // The tolerant policy is deliberate and stays: one failed section must
        // not hide an active goal.
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("get_connection_state") => Some(vec![ok(
                id,
                "get_connection_state",
                serde_json::json!({
                    "thinkingLevel": "high",
                    "goal": { "active": true, "objective": "ship it" }
                }),
            )]),
            Some("cron_list") => Some(vec![failed(id, "cron_list", "cron exploded")]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let activity = agent_activity().expect("goal must survive a cron failure");
        assert!(
            activity.goal.is_some(),
            "the goal section must still render"
        );
        assert_eq!(activity.thinking_level.as_deref(), Some("high"));
        assert!(activity.heartbeats.is_empty());
        assert!(activity.schedules.is_empty());

        let _ = shutdown_host();
    }

    #[test]
    fn managing_a_heartbeat_refuses_an_action_the_daemon_does_not_have() {
        assert!(
            manage_heartbeat("job-1", "cancel").is_err(),
            "the daemon calls it stop"
        );
        assert!(manage_heartbeat("job-1", "delete").is_err());
        assert!(manage_heartbeat("", "pause").is_err(), "an id is required");
        assert!(cancel_scheduled_work("   ").is_err());
        assert!(create_scheduled_work("heartbeat", "", "check in", None).is_err());
        assert!(create_scheduled_work("cron", "0 9 * * 1-5", "  ", None).is_err());
        assert!(create_scheduled_work("goal", "every 5m", "check in", None).is_err());
        assert!(create_scheduled_work("heartbeat", "every 5m", "check in", Some("queue")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn pausing_a_heartbeat_sends_the_job_id_and_action() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let seen: Arc<Mutex<Option<(String, String)>>> = Arc::new(Mutex::new(None));
        let daemon = {
            let seen = Arc::clone(&seen);
            FakeDaemon::start(move |command, id| match command["type"].as_str() {
                Some("heartbeat_manage") => {
                    *seen.lock().unwrap() = Some((
                        command["jobId"].as_str().unwrap_or_default().to_string(),
                        command["action"].as_str().unwrap_or_default().to_string(),
                    ));
                    Some(vec![ok(id, "heartbeat_manage", serde_json::Value::Null)])
                }
                _ => None,
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();

        manage_heartbeat("8a44b0c4", "pause").unwrap();
        assert_eq!(
            seen.lock().unwrap().clone(),
            Some(("8a44b0c4".to_string(), "pause".to_string())),
        );

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn cancelling_scheduled_work_uses_cron_cancel_for_either_kind() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let seen: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
        let daemon = {
            let seen = Arc::clone(&seen);
            FakeDaemon::start(move |command, id| match command["type"].as_str() {
                Some("cron_cancel") => {
                    seen.lock()
                        .unwrap()
                        .push(command["jobId"].as_str().unwrap_or_default().to_string());
                    Some(vec![ok(id, "cron_cancel", serde_json::Value::Null)])
                }
                _ => None,
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();

        // A heartbeat and a plain schedule both cancel through the same call.
        cancel_scheduled_work("heartbeat-job").unwrap();
        cancel_scheduled_work("cron-job").unwrap();
        assert_eq!(*seen.lock().unwrap(), vec!["heartbeat-job", "cron-job"]);

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn creating_a_heartbeat_asks_prime_and_does_not_invent_a_session() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("heartbeat_set") => {
                assert_eq!(command["schedule"], "every 30 minutes");
                assert_eq!(command["prompt"], "check open work");
                assert_eq!(command["deliveryMode"], "steer");
                Some(vec![ok(
                    id,
                    "heartbeat_set",
                    serde_json::json!({ "heartbeat": { "id": "hb-1" } }),
                )])
            }
            Some("cron_add") => {
                assert_eq!(command["schedule"], "0 9 * * 1-5");
                assert_eq!(command["prompt"], "weekday review");
                assert!(command.get("deliveryMode").is_none());
                Some(vec![ok(
                    id,
                    "cron_add",
                    serde_json::json!({ "job": { "id": "cron-1" } }),
                )])
            }
            _ => None,
        });
        daemon.install();
        connect_host_lazy(vault.path()).unwrap();

        let error = create_scheduled_work(
            "heartbeat",
            "every 30 minutes",
            "check open work",
            Some("steer"),
        )
        .unwrap_err();
        assert!(
            error.contains("Start a conversation"),
            "no session, no schedule: {error}"
        );
        assert_eq!(
            daemon.commands(),
            vec!["list"],
            "creating a schedule must not spend a session: {:?}",
            daemon.commands()
        );

        connect_host(vault.path()).unwrap();
        create_scheduled_work(
            "heartbeat",
            "every 30 minutes",
            "check open work",
            Some("steer"),
        )
        .unwrap();
        create_scheduled_work("cron", "0 9 * * 1-5", "weekday review", None).unwrap();
        assert!(daemon.command("heartbeat_set").is_some());
        assert!(daemon.command("cron_add").is_some());

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn a_refused_pause_is_surfaced_not_swallowed() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("heartbeat_manage") => Some(vec![failed(id, "heartbeat_manage", "no such job")]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        // A pause that silently fails leaves the row showing the old state,
        // which reads as the control being broken.
        let error = manage_heartbeat("gone", "pause").unwrap_err();
        assert!(error.contains("no such job"), "got: {error}");

        let _ = shutdown_host();
    }

    /// The envelope check is what stops a refusal from reading as an answer.
    /// Every command that returns a list must fail loudly rather than hand the
    /// UI an empty one: an empty model picker and a refused daemon look
    /// identical on screen, and only one of them is the user's problem.
    #[cfg(unix)]
    #[test]
    fn a_refused_model_list_is_not_reported_as_no_models() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("get_available_models") => Some(vec![failed(
                id,
                "get_available_models",
                "no provider configured",
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let error = get_available_models().unwrap_err();
        assert!(error.contains("no provider configured"), "got: {error}");

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn a_refused_command_list_is_not_reported_as_no_commands() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("get_commands") => Some(vec![failed(id, "get_commands", "session not attached")]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let error = get_commands().unwrap_err();
        assert!(error.contains("session not attached"), "got: {error}");

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn a_refused_compact_surfaces_the_reason_rather_than_no_tokens() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("compact") => Some(vec![failed(id, "compact", "nothing to compact")]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        // `Ok(None)` here would render as "compaction ran, reclaimed nothing".
        let error = compact(None).unwrap_err();
        assert!(error.contains("nothing to compact"), "got: {error}");

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn a_successful_compact_still_reports_the_tokens_it_reclaimed() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("compact") => Some(vec![ok(
                id,
                "compact",
                serde_json::json!({ "tokensBefore": 41_000 }),
            )]),
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert_eq!(compact(None).unwrap(), Some(41_000));

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn cancel_rlm_child_refuses_an_empty_id_before_talking_to_the_daemon() {
        let _guard = host_guard();
        let error = cancel_rlm_child("  ").unwrap_err();
        assert!(
            error.contains("without an id"),
            "empty stop must not hit Prime: {error}"
        );
    }

    #[cfg(unix)]
    #[test]
    fn cancel_rlm_child_asks_prime_with_the_child_id() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("cancel_rlm_child") => {
                assert_eq!(command["childId"], "kid-1");
                Some(vec![ok(
                    id,
                    "cancel_rlm_child",
                    serde_json::json!({ "cancelled": true }),
                )])
            }
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        assert!(cancel_rlm_child("kid-1").unwrap());

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn a_refused_auto_compaction_toggle_is_surfaced_not_swallowed() {
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let daemon = FakeDaemon::start(|command, id| match command["type"].as_str() {
            Some("set_auto_compaction") => {
                Some(vec![failed(id, "set_auto_compaction", "unsupported")])
            }
            _ => None,
        });
        daemon.install();
        connect_host(vault.path()).unwrap();

        let error = set_auto_compaction(true).unwrap_err();
        assert!(error.contains("unsupported"), "got: {error}");

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
    fn setting_a_level_updates_what_the_strip_will_read() {
        // The strip polls `get_status`, which reads a cache rather than asking
        // the daemon. Setting a level must refresh that cache or the label
        // never moves -- which reads as a broken control, not a slow one.
        let _guard = host_guard();
        let vault = tempfile::tempdir().unwrap();
        let level: Arc<Mutex<String>> = Arc::new(Mutex::new("off".to_string()));
        let daemon = {
            let level = Arc::clone(&level);
            FakeDaemon::start(move |command, id| match command["type"].as_str() {
                Some("set_thinking_level") => {
                    *level.lock().unwrap() =
                        command["level"].as_str().unwrap_or_default().to_string();
                    Some(vec![ok(id, "set_thinking_level", serde_json::Value::Null)])
                }
                Some("get_state") => {
                    let current = level.lock().unwrap().clone();
                    Some(vec![ok(
                        id,
                        "get_state",
                        serde_json::json!({
                            "sessionId": "sess-a",
                            "isStreaming": false,
                            "thinkingLevel": current,
                            "model": { "provider": "xai", "id": "grok-4.5", "name": "Grok 4.5" }
                        }),
                    )])
                }
                _ => None,
            })
        };
        daemon.install();
        connect_host(vault.path()).unwrap();
        assert_eq!(get_status().thinking_level.as_deref(), Some("off"));

        set_thinking_level("high").unwrap();

        assert_eq!(
            get_status().thinking_level.as_deref(),
            Some("high"),
            "the strip polls this cache; without a refresh it shows the old level",
        );

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

        // `ensure_host` connects; it no longer creates a session (#28), so the
        // id is empty until something needs one. Materialize it the way a real
        // first command does.
        ensure_host(&vault.path().to_string_lossy()).expect("connect + attach");
        let session_id = with_host_mut(|host| {
            host.ensure_session()?;
            Ok(host.session_id.clone().unwrap_or_default())
        })
        .expect("a session to prompt in");
        println!("session: {session_id}");
        assert!(!session_id.is_empty(), "a live session must report an id");

        let mut events = Vec::new();
        run_prompt_stream(
            PrimePromptRequest {
                images: Vec::new(),
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

    /// #49 against the real daemon. A fake daemon proves we send
    /// `set_session_name`; only the installed daemon proves it accepts the
    /// rename mid-session and writes it into the log the sessions list reads.
    ///
    /// ```sh
    /// cargo test --lib prime_session_host::tests::live_session_naming -- --ignored --nocapture
    /// ```
    #[cfg(unix)]
    #[test]
    #[ignore = "requires a running prime-agent daemon (see `prime-agent status`)"]
    fn live_session_naming() {
        let _guard = host_guard();
        std::env::remove_var(DAEMON_SOCKET_ENV);
        let vault = tempfile::tempdir().unwrap();

        ensure_host(&vault.path().to_string_lossy()).expect("connect + attach");
        let session_id = with_host_mut(|host| {
            host.ensure_session()?;
            Ok(host.session_id.clone().unwrap_or_default())
        })
        .expect("a session to name");
        println!("session: {session_id}");

        // The placeholder is what a fresh session starts with.
        assert!(
            with_host_mut(|host| Ok(host.name_is_placeholder)).unwrap(),
            "a session Rhizome created carries our placeholder"
        );

        let asked = "Explain what a wikilink is in one sentence";
        run_prompt_stream(
            PrimePromptRequest {
                images: Vec::new(),
                message: asked.into(),
                system_prompt: None,
                vault_path: vault.path().to_string_lossy().into_owned(),
                event_name: None,
                provider: None,
                model_id: None,
                new_session: false,
            },
            |_| {},
        )
        .expect("a live turn");

        assert!(
            !with_host_mut(|host| Ok(host.name_is_placeholder)).unwrap(),
            "the first exchange consumes the placeholder"
        );

        // The name is only real if the daemon wrote it where the list reads.
        let log = dirs::home_dir()
            .unwrap()
            .join(".prime/agent/sessions")
            .join(format!("{session_id}.jsonl"));
        let summary = crate::prime_sessions::summarize_file(&log).expect("the session log");
        println!("title: {:?}", summary.title);
        assert_eq!(summary.title.as_deref(), Some(asked));

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
        // A session has to exist before quitting can have a disposition about
        // it — connecting alone no longer creates one (#28), and
        // `settle_session_on_quit` correctly reports `NotConnected` for a host
        // holding nothing.
        let stopped_id = with_host_mut(|host| {
            host.ensure_session()?;
            Ok(host.active_session_id.clone())
        })
        .unwrap();
        assert_eq!(
            settle_session_on_quit().unwrap(),
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
        // The first quit killed the session it was holding, so this half needs
        // its own — reading `active_session_id` off the spent host reports the
        // dead one, and `settle_session_on_quit` then answers `NotConnected`
        // about a session that is indeed not there.
        ensure_host(&vault.path().to_string_lossy()).expect("reconnect for the keep case");
        let kept_id = with_host_mut(|host| {
            host.ensure_session()?;
            Ok(host.active_session_id.clone())
        })
        .unwrap();
        promote_owned_session().expect("keep working is an explicit promote");
        assert_eq!(
            settle_session(SessionCloseIntent::KeepWorking).unwrap(),
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

    /// One roster read at a time.
    ///
    /// This guard is what bounds the cost of a daemon that accepts a
    /// connection and then never speaks. `read_roster_over`'s deadline is
    /// checked *between* reads and cannot interrupt one, so on Windows — where
    /// a named pipe opened as a `File` has no read timeout — that reader parks.
    /// The `recv_timeout` in `list_running_sessions` bounds the *wait*, but the
    /// parked thread stays until the daemon answers or hangs up. Without this
    /// flag the 4s poll in `usePrimeRunningSessionFiles` would park a fresh one
    /// every few seconds, forever.
    ///
    /// The hang itself cannot be reproduced here: on Unix `set_read_timeout`
    /// bounds the read, so macOS and Linux were never affected. This tests the
    /// half that is platform-independent.
    #[test]
    fn only_one_roster_read_runs_at_a_time() {
        let _guard = host_guard();
        // Stand in for a read already parked on a silent daemon.
        ROSTER_IN_FLIGHT.store(true, Ordering::SeqCst);

        let result = list_running_sessions();

        assert_eq!(
            result.expect("a second poll answers rather than queueing"),
            Vec::<serde_json::Value>::new(),
            "a poll that arrives while one is parked reports nothing running"
        );
        assert!(
            ROSTER_IN_FLIGHT.load(Ordering::SeqCst),
            "the parked read still owns the flag; the second poll must not clear it"
        );

        ROSTER_IN_FLIGHT.store(false, Ordering::SeqCst);
    }

    /// And it is released again, or the roster would answer "nothing running"
    /// forever after the first successful poll.
    #[test]
    fn a_finished_roster_read_releases_the_flag() {
        let _guard = host_guard();
        ROSTER_IN_FLIGHT.store(false, Ordering::SeqCst);

        // No daemon on this path, so the thread fails fast and still clears.
        let _ = list_running_sessions();

        let released = (0..50).any(|_| {
            if !ROSTER_IN_FLIGHT.load(Ordering::SeqCst) {
                return true;
            }
            thread::sleep(Duration::from_millis(20));
            false
        });
        assert!(released, "the flag must not latch on");
    }
}
