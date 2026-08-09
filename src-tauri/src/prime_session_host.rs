//! Long-lived Prime Agent RPC session host.
//!
//! Spawns `prime-agent --mode rpc` once and keeps it alive across turns.
//! Commands are LF-delimited JSONL on stdin; events/responses come back on
//! stdout (strict `\n` framing — never Unicode line separators).
//!
//! Spike surface (slice 1 of `docs/plans/2026-08-09-prime-harness-chat-spike.md`):
//! ensure host → prompt → abort → new_session → map events → `AiAgentStreamEvent`.

use crate::ai_agents::{AiAgentAvailability, AiAgentStreamEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

const RPC_RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);
const TURN_IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

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
    child: Child,
    stdin: ChildStdin,
    /// Correlates RPC `id` → oneshot response channel.
    pending: Arc<Mutex<HashMap<String, PendingResponse>>>,
    /// Fan-out of non-response stdout lines (agent events).
    /// Kept so the sender side of the channel outlives the reader thread join.
    #[allow(dead_code)]
    event_tx: Sender<OutboundLine>,
    event_rx: Arc<Mutex<Receiver<OutboundLine>>>,
    session_id: Option<String>,
    model_provider: Option<String>,
    model_id: Option<String>,
    model_name: Option<String>,
    binary: PathBuf,
    cwd: PathBuf,
    is_streaming: bool,
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
            binary_path: Some(host.binary.to_string_lossy().into_owned()),
            model_provider: host.model_provider.clone(),
            model_id: host.model_id.clone(),
            model_name: host.model_name.clone(),
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
            // Dead or wrong cwd → tear down and respawn.
            let _ = host.shutdown();
            *guard = None;
        }
    }
    spawn_and_store(cwd)
}

fn spawn_and_store(cwd: PathBuf) -> Result<String, String> {
    let binary = crate::prime_discovery::find_binary()
        .map_err(|error| crate::prime_events::format_spawn_error(&error))?;
    let host = PrimeHost::spawn(binary, cwd)?;
    let session_id = host.session_id.clone().unwrap_or_default();
    let slot = host_slot();
    let mut guard = slot.host.lock().map_err(poison)?;
    // If something raced us, shut the loser down.
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
                // Extension UI requests are not supported in the spike —
                // auto-cancel so the agent doesn't hang forever.
                if ty.starts_with("extension_ui_") {
                    let id = json.get("id").cloned().unwrap_or(serde_json::Value::Null);
                    let _ = with_host_mut(|host| {
                        // Best-effort: many UI requests want a response with cancelled.
                        let _ = host.write_raw(&serde_json::json!({
                            "id": id,
                            "type": "response",
                            "success": false,
                            "error": "extension UI not supported in Rhizome Agent spike",
                        }));
                        Ok(())
                    });
                    continue;
                }
                on_event(&json);
            }
        }
    }
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
    fn spawn(binary: PathBuf, cwd: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&cwd).map_err(|error| {
            format!(
                "Failed to create Prime host working directory {}: {error}",
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

        let target = crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(&binary)?;
        let mut command = crate::hidden_command(&target.program);
        crate::cli_agent_runtime::configure_agent_command_environment(&mut command, &binary);
        if let Some(first_arg) = target.first_arg {
            command.arg(first_arg);
        }
        command
            .arg("--mode")
            .arg("rpc")
            .arg("--cwd")
            .arg(&cwd)
            // Session persistence is fine (Prime owns ~/.prime/agent). Spike
            // keeps default so multi-turn works; callers can new_session.
            .current_dir(&cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command.spawn().map_err(|error| {
            crate::prime_events::format_spawn_error(&format!(
                "Failed to spawn prime-agent: {error}"
            ))
        })?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to open prime-agent stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to open prime-agent stdout".to_string())?;
        // Drain stderr so the child never blocks on a full pipe.
        if let Some(stderr) = child.stderr.take() {
            thread::Builder::new()
                .name("prime-rpc-stderr".into())
                .spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines().map_while(Result::ok) {
                        let trimmed = line.trim();
                        if !trimmed.is_empty() {
                            log::debug!("prime-agent stderr: {trimmed}");
                        }
                    }
                })
                .map_err(|error| format!("Failed to spawn prime stderr reader: {error}"))?;
        }

        let pending: Arc<Mutex<HashMap<String, PendingResponse>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let (event_tx, event_rx) = mpsc::channel::<OutboundLine>();
        let event_rx = Arc::new(Mutex::new(event_rx));

        spawn_stdout_reader(stdout, Arc::clone(&pending), event_tx.clone())?;

        let mut host = Self {
            child,
            stdin,
            pending,
            event_tx,
            event_rx,
            session_id: None,
            model_provider: None,
            model_id: None,
            model_name: None,
            binary,
            cwd,
            is_streaming: false,
        };

        // Warm-up: get_state confirms the RPC loop is alive and yields sessionId.
        match host.send_command(serde_json::json!({ "type": "get_state" })) {
            Ok(response) if response["success"].as_bool() == Some(true) => {
                if let Some(data) = response.get("data") {
                    host.apply_state_data(data);
                }
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

    fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(None) => true,
            Ok(Some(_)) => false,
            Err(_) => false,
        }
    }

    fn shutdown(&mut self) -> Result<(), String> {
        // Drop stdin first so the child sees EOF and exits cleanly.
        // (ChildStdin is dropped when we replace... we can't easily drop field.
        // Kill instead if still alive.)
        let _ = self.child.kill();
        let _ = self.child.wait();
        Ok(())
    }

    fn write_raw(&mut self, value: &serde_json::Value) -> Result<(), String> {
        let mut line = serde_json::to_string(value)
            .map_err(|error| format!("Failed to serialize Prime RPC command: {error}"))?;
        line.push('\n');
        self.stdin
            .write_all(line.as_bytes())
            .and_then(|_| self.stdin.flush())
            .map_err(|error| format!("Failed to write Prime RPC command: {error}"))
    }

    fn send_command(
        &mut self,
        mut command: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let id = next_id();
        command
            .as_object_mut()
            .ok_or_else(|| "Prime RPC command must be a JSON object".to_string())?
            .insert("id".into(), serde_json::Value::String(id.clone()));

        let (tx, rx) = mpsc::channel();
        {
            let mut pending = self.pending.lock().map_err(poison)?;
            pending.insert(id.clone(), PendingResponse { tx });
        }

        if let Err(error) = self.write_raw(&command) {
            let mut pending = self.pending.lock().map_err(poison)?;
            pending.remove(&id);
            return Err(error);
        }

        match rx.recv_timeout(RPC_RESPONSE_TIMEOUT) {
            Ok(response) => Ok(response),
            Err(RecvTimeoutError::Timeout) => {
                let mut pending = self.pending.lock().map_err(poison)?;
                pending.remove(&id);
                Err(format!(
                    "Prime RPC command timed out after {}s (id={id})",
                    RPC_RESPONSE_TIMEOUT.as_secs()
                ))
            }
            Err(RecvTimeoutError::Disconnected) => {
                Err("Prime RPC response channel closed (host died?)".into())
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

fn spawn_stdout_reader(
    stdout: ChildStdout,
    pending: Arc<Mutex<HashMap<String, PendingResponse>>>,
    event_tx: Sender<OutboundLine>,
) -> Result<(), String> {
    thread::Builder::new()
        .name("prime-rpc-stdout".into())
        .spawn(move || {
            // Strict LF framing: BufRead::read_until(b'\n') only splits on \n,
            // never on U+2028/U+2029 (the trap Node's readline hits).
            let mut reader = BufReader::new(stdout);
            let mut buffer = Vec::new();
            loop {
                buffer.clear();
                match reader.read_until(b'\n', &mut buffer) {
                    Ok(0) => {
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
                            log::debug!("prime-agent non-json stdout: {line}");
                            continue;
                        };
                        route_stdout_line(json, &pending, &event_tx);
                    }
                    Err(error) => {
                        let _ = event_tx.send(OutboundLine::Closed(Some(format!(
                            "prime-agent stdout read error: {error}"
                        ))));
                        break;
                    }
                }
            }
        })
        .map_err(|error| format!("Failed to spawn prime stdout reader: {error}"))?;
    Ok(())
}

fn route_stdout_line(
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
    let _ = event_tx.send(OutboundLine::Event(json));
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use std::sync::atomic::AtomicBool;

    #[cfg(unix)]
    fn mock_rpc_script(dir: &Path, body: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let script = dir.join("prime-agent");
        // Minimal fake: read JSONL commands, write scripted responses/events.
        let full = format!(
            r#"#!/usr/bin/env python3
import sys, json, time
{body}
"#
        );
        std::fs::write(&script, full).unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
        script
    }

    #[cfg(unix)]
    #[test]
    fn host_prompt_maps_events_and_survives_two_turns() {
        let dir = tempfile::tempdir().unwrap();
        let vault = tempfile::tempdir().unwrap();
        let binary = mock_rpc_script(
            dir.path(),
            r#"
# State
session_id = "sess-1"
turn = 0

def respond(cmd, **extra):
    out = {"type": "response", "command": cmd.get("type"), "success": True, "id": cmd.get("id")}
    out.update(extra)
    sys.stdout.write(json.dumps(out) + "\n")
    sys.stdout.flush()

def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    cmd = json.loads(line)
    ty = cmd.get("type")
    if ty == "get_state":
        respond(cmd, data={"sessionId": session_id, "isStreaming": False, "messageCount": turn})
    elif ty == "new_session":
        session_id = "sess-2"
        respond(cmd, data={"cancelled": False})
    elif ty == "abort":
        respond(cmd)
    elif ty == "prompt":
        turn += 1
        respond(cmd)
        emit({"type": "agent_start"})
        emit({
            "type": "message_update",
            "assistantMessageEvent": {"type": "text_delta", "delta": f"turn-{turn}"}
        })
        emit({
            "type": "tool_execution_start",
            "toolCallId": f"t{turn}",
            "toolName": "read",
            "args": {"path": "a.md"}
        })
        emit({
            "type": "tool_execution_end",
            "toolCallId": f"t{turn}",
            "result": "ok"
        })
        emit({"type": "agent_end", "messages": []})
    else:
        respond(cmd)
"#,
        );

        // Bypass discovery: inject host directly.
        let host = PrimeHost::spawn(binary.clone(), vault.path().to_path_buf()).unwrap();
        assert_eq!(host.session_id.as_deref(), Some("sess-1"));
        {
            let slot = host_slot();
            let mut guard = slot.host.lock().unwrap();
            *guard = Some(host);
        }

        let mut events = Vec::new();
        let session = run_prompt_stream(
            PrimePromptRequest {
                message: "hello".into(),
                system_prompt: None,
                vault_path: vault.path().to_string_lossy().into_owned(),
                event_name: None,
                provider: None,
                model_id: None,
                new_session: false,
            },
            |event| events.push(event),
        )
        .unwrap();

        assert_eq!(session, "sess-1");
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

        // Second turn on the SAME process — multi-turn is the whole point.
        let mut events2 = Vec::new();
        let session2 = run_prompt_stream(
            PrimePromptRequest {
                message: "again".into(),
                system_prompt: None,
                vault_path: vault.path().to_string_lossy().into_owned(),
                event_name: None,
                provider: None,
                model_id: None,
                new_session: false,
            },
            |event| events2.push(event),
        )
        .unwrap();
        assert_eq!(session2, "sess-1");
        assert!(events2
            .iter()
            .any(|e| matches!(e, AiAgentStreamEvent::TextDelta { text } if text == "turn-2")));

        // new_session flips id
        let sid = new_session().unwrap();
        assert_eq!(sid, "sess-2");

        let _ = shutdown_host();
    }

    #[cfg(unix)]
    #[test]
    fn abort_returns_false_when_no_host() {
        let _ = shutdown_host();
        assert_eq!(abort_turn().unwrap(), false);
    }

    #[test]
    fn next_id_is_unique() {
        let a = next_id();
        let b = next_id();
        assert_ne!(a, b);
        assert!(a.starts_with("rhizome-"));
    }

    #[test]
    fn status_reports_not_running_without_host() {
        let _ = shutdown_host();
        let status = get_status();
        assert!(!status.running);
        assert!(!status.is_streaming);
    }

    // Silence unused import warning on non-unix where mock isn't compiled.
    #[allow(dead_code)]
    static _KEEP: AtomicBool = AtomicBool::new(false);
}
