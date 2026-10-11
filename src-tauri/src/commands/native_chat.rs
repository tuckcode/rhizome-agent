//! Native Chat Tauri commands (harness plan step 2b).
//!
//! Chat still talks to Prime. Step 4 adds the Settings toggle.
//! These commands exist so the toggle has a backend to call.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::ai_agents::AiAgentPermissionMode;
use crate::ai_models::{
    AiModelApiKeyStorage, AiModelProvider, AiModelProviderKind, AiModelStreamRequest, HttpLimits,
};
use crate::engines::{Engine, EngineEvent, NativeControl, NativeEngine};
use crate::provider_keys::ProviderKeys;
use crate::rhizome_loop::{AgentLoop, ApprovalReply, Model};
use crate::rhizome_provider_model::ProviderModel;
use crate::rhizome_routing::{Catalog, RoutingModel, SystemClock};
use crate::session_transcript_index::{self, IndexedTranscriptTurn};
use crate::settings;

/// Scoped event channel for one native session.
pub fn native_chat_channel(session_id: &str) -> String {
    format!("native-chat:{session_id}")
}

/// Target string for "Free tier (auto)" (decision D2).
pub const FREE_TIER_TARGET: &str = "free_tier_auto";
pub const FREE_TIER_LABEL: &str = "Free tier (auto)";

/// Native sessions use a Rhizome-owned transcript path. Nothing under `~/.prime`.
pub const NATIVE_SESSION_PREFIX: &str = "rhizome-native:";

/// Quit must not hang on a slow provider.
pub const NATIVE_QUIT_BOUND: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NativeChatTarget {
    FreeTier,
    Catalog {
        provider_kind: AiModelProviderKind,
        provider_id: String,
        model_id: String,
    },
}

enum ChatOp {
    Turn(String),
    End,
}

pub fn resolve_native_target(target: &str) -> Result<NativeChatTarget, String> {
    let trimmed = target.trim();
    if trimmed.eq_ignore_ascii_case(FREE_TIER_TARGET)
        || trimmed.eq_ignore_ascii_case(FREE_TIER_LABEL)
    {
        return Ok(NativeChatTarget::FreeTier);
    }
    let (provider_id, model_id) = match trimmed.split_once('/') {
        Some((provider, model)) => (provider.to_string(), model.to_string()),
        None => ("openai".into(), trimmed.to_string()),
    };
    let provider_kind = provider_kind_from_id(&provider_id);
    if provider_kind == AiModelProviderKind::Anthropic {
        return Err(
            "Anthropic catalog models are not available on the native engine until 6a.".into(),
        );
    }
    Ok(NativeChatTarget::Catalog {
        provider_kind,
        provider_id,
        model_id,
    })
}

#[cfg(test)]
pub fn model_kind_for_target(target: &NativeChatTarget) -> &'static str {
    match target {
        NativeChatTarget::FreeTier => "routing",
        NativeChatTarget::Catalog { .. } => "provider",
    }
}

fn provider_kind_from_id(id: &str) -> AiModelProviderKind {
    match id.to_ascii_lowercase().as_str() {
        "anthropic" => AiModelProviderKind::Anthropic,
        "openai" => AiModelProviderKind::OpenAi,
        "ollama" => AiModelProviderKind::Ollama,
        "lmstudio" | "lm_studio" => AiModelProviderKind::LmStudio,
        "openrouter" => AiModelProviderKind::OpenRouter,
        "gemini" => AiModelProviderKind::Gemini,
        _ => AiModelProviderKind::OpenAiCompatible,
    }
}

/// Live native chats. Each engine runs on its own thread.
#[derive(Default)]
pub struct NativeChats {
    sessions: Mutex<HashMap<String, LiveNativeChat>>,
    read_only: Mutex<HashMap<String, ()>>,
}

struct LiveNativeChat {
    control: NativeControl,
    ops: mpsc::Sender<ChatOp>,
    worker: Option<thread::JoinHandle<()>>,
    read_only: bool,
    turn_busy: Arc<AtomicBool>,
}

fn claim_turn(busy: &AtomicBool) -> Result<(), String> {
    if busy.swap(true, Ordering::SeqCst) {
        Err("another turn is already running in this chat".into())
    } else {
        Ok(())
    }
}

impl NativeChats {
    pub fn new() -> Self {
        Self::default()
    }

    #[cfg(test)]
    pub fn start_with_engine<M: Model + Send + 'static>(
        &self,
        prompt: &str,
        engine: NativeEngine<M>,
        emit: impl FnMut(EngineEvent) + Send + 'static,
    ) -> Result<String, String> {
        self.start_named(uuid::Uuid::new_v4().to_string(), prompt, engine, emit)
    }

    pub fn start_named<M: Model + Send + 'static>(
        &self,
        id: String,
        prompt: &str,
        engine: NativeEngine<M>,
        emit: impl FnMut(EngineEvent) + Send + 'static,
    ) -> Result<String, String> {
        let path = format!("{NATIVE_SESSION_PREFIX}{id}");
        let control = engine.control();
        let (ops, op_rx) = mpsc::channel();
        let emit = Arc::new(Mutex::new(emit));
        let index_path = path.clone();
        let index_id = id.clone();
        let turn_busy = Arc::new(AtomicBool::new(false));
        let worker_busy = Arc::clone(&turn_busy);
        let worker = thread::spawn(move || {
            let mut engine = engine;
            if let Err(error) = engine.ensure_log(&index_id) {
                (emit.lock().expect("native sink"))(EngineEvent::Error { message: error });
                worker_busy.store(false, Ordering::SeqCst);
                return;
            }
            while let Ok(op) = op_rx.recv() {
                match op {
                    ChatOp::Turn(prompt) => {
                        let emit = Arc::clone(&emit);
                        let index_path = index_path.clone();
                        let index_id = index_id.clone();
                        let user_text = prompt.clone();
                        let assistant = Arc::new(Mutex::new(String::new()));
                        let busy = Arc::clone(&worker_busy);
                        let _ = engine.start(
                            &prompt,
                            Box::new(move |event| {
                                if matches!(
                                    event,
                                    EngineEvent::TurnEnd | EngineEvent::Cancelled { .. }
                                ) {
                                    busy.store(false, Ordering::SeqCst);
                                }
                                match &event {
                                    EngineEvent::TextDelta { text } => {
                                        assistant.lock().expect("assistant").push_str(text);
                                    }
                                    EngineEvent::TurnEnd => {
                                        let assistant =
                                            assistant.lock().expect("assistant").clone();
                                        let _ = session_transcript_index::append_native_turns(
                                            &index_path,
                                            &index_id,
                                            &user_text,
                                            vec![
                                                IndexedTranscriptTurn {
                                                    message_index: 0,
                                                    role: "user".into(),
                                                    text: user_text.clone(),
                                                },
                                                IndexedTranscriptTurn {
                                                    message_index: 1,
                                                    role: "assistant".into(),
                                                    text: assistant,
                                                },
                                            ],
                                        );
                                    }
                                    _ => {}
                                }
                                (emit.lock().expect("native sink"))(event);
                            }),
                        );
                        worker_busy.store(false, Ordering::SeqCst);
                    }
                    ChatOp::End => break,
                }
            }
        });
        claim_turn(&turn_busy)?;
        if ops.send(ChatOp::Turn(prompt.to_string())).is_err() {
            turn_busy.store(false, Ordering::SeqCst);
            return Err("native chat worker closed".into());
        }
        self.sessions.lock().expect("native chats").insert(
            id.clone(),
            LiveNativeChat {
                control,
                ops,
                worker: Some(worker),
                read_only: false,
                turn_busy,
            },
        );
        Ok(id)
    }

    pub fn send(&self, session_id: &str, text: &str) -> Result<(), String> {
        if self
            .read_only
            .lock()
            .expect("read-only native chats")
            .contains_key(session_id)
        {
            return Err(
                "native session is read-only (unknown version or another window holds it)".into(),
            );
        }
        let sessions = self.sessions.lock().expect("native chats");
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("unknown native session {session_id}"))?;
        if session.read_only {
            return Err("native session is read-only".into());
        }
        claim_turn(&session.turn_busy)?;
        if session.ops.send(ChatOp::Turn(text.to_string())).is_err() {
            session.turn_busy.store(false, Ordering::SeqCst);
            return Err("native chat worker closed".into());
        }
        Ok(())
    }

    pub fn is_live(&self, session_id: &str) -> bool {
        self.sessions
            .lock()
            .expect("native chats")
            .contains_key(session_id)
    }

    pub fn open_with_engine<M: Model + Send + 'static>(
        &self,
        id: String,
        engine: NativeEngine<M>,
        emit: impl FnMut(EngineEvent) + Send + 'static,
    ) -> Result<String, String> {
        if self.is_live(&id) {
            return Ok(id);
        }
        let opened = crate::engines::native_log::open_session_log(&id)?;
        if opened.read_only {
            self.note_read_only(&id);
            return Ok(id);
        }
        let path = format!("{NATIVE_SESSION_PREFIX}{id}");
        let control = engine.control();
        let (ops, op_rx) = mpsc::channel();
        let emit = Arc::new(Mutex::new(emit));
        let index_path = path.clone();
        let index_id = id.clone();
        let turn_busy = Arc::new(AtomicBool::new(false));
        let worker_busy = Arc::clone(&turn_busy);
        let worker = thread::spawn(move || {
            let mut engine = engine;
            if let Err(error) = engine.ensure_log(&index_id) {
                (emit.lock().expect("native sink"))(EngineEvent::Error { message: error });
                worker_busy.store(false, Ordering::SeqCst);
                return;
            }
            while let Ok(op) = op_rx.recv() {
                match op {
                    ChatOp::Turn(prompt) => {
                        let emit = Arc::clone(&emit);
                        let index_path = index_path.clone();
                        let index_id = index_id.clone();
                        let user_text = prompt.clone();
                        let assistant = Arc::new(Mutex::new(String::new()));
                        let busy = Arc::clone(&worker_busy);
                        let _ = engine.start(
                            &prompt,
                            Box::new(move |event| {
                                if matches!(
                                    event,
                                    EngineEvent::TurnEnd | EngineEvent::Cancelled { .. }
                                ) {
                                    busy.store(false, Ordering::SeqCst);
                                }
                                match &event {
                                    EngineEvent::TextDelta { text } => {
                                        assistant.lock().expect("assistant").push_str(text);
                                    }
                                    EngineEvent::TurnEnd => {
                                        let assistant =
                                            assistant.lock().expect("assistant").clone();
                                        let _ = session_transcript_index::append_native_turns(
                                            &index_path,
                                            &index_id,
                                            &user_text,
                                            vec![
                                                IndexedTranscriptTurn {
                                                    message_index: 0,
                                                    role: "user".into(),
                                                    text: user_text.clone(),
                                                },
                                                IndexedTranscriptTurn {
                                                    message_index: 1,
                                                    role: "assistant".into(),
                                                    text: assistant,
                                                },
                                            ],
                                        );
                                    }
                                    _ => {}
                                }
                                (emit.lock().expect("native sink"))(event);
                            }),
                        );
                        worker_busy.store(false, Ordering::SeqCst);
                    }
                    ChatOp::End => break,
                }
            }
        });
        self.sessions.lock().expect("native chats").insert(
            id.clone(),
            LiveNativeChat {
                control,
                ops,
                worker: Some(worker),
                read_only: false,
                turn_busy,
            },
        );
        Ok(id)
    }

    pub fn note_read_only(&self, session_id: &str) {
        self.read_only
            .lock()
            .expect("read-only native chats")
            .insert(session_id.to_string(), ());
    }

    pub fn note_open(&self, opened: &NativeChatOpenResult) {
        if opened.read_only && !self.is_live(&opened.session_id) {
            self.note_read_only(&opened.session_id);
        }
    }

    /// Display an existing chat. A chat that is already open stays writable.
    /// An unknown log version is the case that stays read-only.
    pub fn attach_open(&self, session_id: &str) -> Result<NativeChatOpenResult, String> {
        let record = open_native_session_record(session_id)?;
        let live_id = record
            .successor_id
            .clone()
            .unwrap_or_else(|| session_id.to_string());
        if self.is_live(session_id) || self.is_live(&live_id) {
            return Ok(record);
        }
        self.note_open(&record);
        Ok(record)
    }

    pub fn cancel(&self, session_id: &str, cause: &str) -> Result<(), String> {
        let sessions = self.sessions.lock().expect("native chats");
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("unknown native session {session_id}"))?;
        session.control.cancel(cause);
        Ok(())
    }

    pub fn reply_approval(
        &self,
        session_id: &str,
        prompt_id: &str,
        reply: ApprovalReply,
    ) -> Result<(), String> {
        let sessions = self.sessions.lock().expect("native chats");
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("unknown native session {session_id}"))?;
        session.control.reply_approval(prompt_id, reply);
        Ok(())
    }

    pub fn end(&self, session_id: &str) -> Result<(), String> {
        let mut session = self
            .sessions
            .lock()
            .expect("native chats")
            .remove(session_id)
            .ok_or_else(|| format!("unknown native session {session_id}"))?;
        session.control.settle_on_quit();
        let _ = session.ops.send(ChatOp::End);
        if let Some(worker) = session.worker.take() {
            join_with_bound(worker, NATIVE_QUIT_BOUND);
        }
        Ok(())
    }

    pub fn settle_all(&self, bound: Duration) {
        let sessions: Vec<LiveNativeChat> = {
            let mut guard = self.sessions.lock().expect("native chats");
            guard.drain().map(|(_, session)| session).collect()
        };
        for mut session in sessions {
            session.control.settle_on_quit();
            let _ = session.ops.send(ChatOp::End);
            if let Some(worker) = session.worker.take() {
                join_with_bound(worker, bound);
            }
        }
    }

    #[cfg(test)]
    pub fn path_for(&self, session_id: &str) -> Option<String> {
        self.sessions
            .lock()
            .expect("native chats")
            .contains_key(session_id)
            .then(|| format!("{NATIVE_SESSION_PREFIX}{session_id}"))
    }
}

fn join_with_bound(worker: thread::JoinHandle<()>, bound: Duration) -> bool {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = worker.join();
        let _ = tx.send(());
    });
    rx.recv_timeout(bound).is_ok()
}

fn composed_system_prompt(existing: Option<&str>) -> Option<String> {
    settings::compose_agent_profile(settings::saved_agent_profile().as_deref(), existing)
}

/// Free-tier keys come from the OS keychain (step 3a, ADR-0184).
fn free_tier_routing_model(
    system: Option<String>,
    observer: impl FnMut(crate::rhizome_routing::ProviderAttempt) + Send + 'static,
) -> Result<RoutingModel<ProviderKeys, SystemClock>, String> {
    Ok(RoutingModel::new(
        Catalog::pinned(),
        ProviderKeys::for_app()?,
        SystemClock,
        HttpLimits::STREAM,
    )
    .with_observer(observer)
    .with_system_prompt(system))
}

fn catalog_provider(kind: AiModelProviderKind, id: &str) -> AiModelProvider {
    AiModelProvider {
        id: id.to_string(),
        name: id.to_string(),
        kind,
        base_url: None,
        api_key_storage: Some(AiModelApiKeyStorage::LocalFile),
        api_key_env_var: None,
        headers: None,
        models: Vec::new(),
    }
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeChatStartRequest {
    pub target: String,
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub vault_path: Option<String>,
    #[serde(default)]
    pub vault_paths: Vec<String>,
    #[serde(default)]
    pub permission_mode: AiAgentPermissionMode,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeChatListItem {
    pub session_id: String,
    pub created_at: String,
    pub target: String,
    pub title: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeChatOpenResult {
    pub session_id: String,
    pub events: Vec<crate::rhizome_loop::DurableEvent>,
    pub warning: Option<String>,
    pub read_only: bool,
    pub error: Option<String>,
    pub successor_id: Option<String>,
}

pub fn list_native_sessions() -> Result<Vec<NativeChatListItem>, String> {
    let headers = crate::engines::native_log::list_session_headers()?;
    Ok(headers
        .into_iter()
        .map(|header| NativeChatListItem {
            session_id: header.session_id,
            created_at: header.created_at,
            target: header.target,
            title: String::new(),
        })
        .collect())
}

pub fn open_native_session_record(session_id: &str) -> Result<NativeChatOpenResult, String> {
    let opened = crate::engines::native_log::open_session_log(session_id)?;
    let mut error = None;
    if let Err(err) = resolve_native_target(&opened.header.target) {
        error = Some(err);
    }
    let warning = Some(match &opened.warning {
        Some(damage) => format!("{} {damage}", crate::engines::native_log::REOPEN_WARNING),
        None => crate::engines::native_log::REOPEN_WARNING.to_string(),
    });
    Ok(NativeChatOpenResult {
        session_id: session_id.to_string(),
        events: opened.events,
        warning,
        read_only: opened.read_only || error.is_some(),
        error,
        successor_id: opened.successor_id,
    })
}

pub fn delete_native_session(chats: &NativeChats, session_id: &str) -> Result<(), String> {
    let _ = chats.end(session_id);
    let path = format!("{NATIVE_SESSION_PREFIX}{session_id}");
    session_transcript_index::remove_session(&path)?;
    crate::engines::native_log::delete_session_log(session_id)?;
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
pub fn native_chat_start(
    app: tauri::AppHandle,
    chats: tauri::State<NativeChats>,
    request: NativeChatStartRequest,
) -> Result<String, String> {
    use tauri::Emitter;
    let id = uuid::Uuid::new_v4().to_string();
    let channel = native_chat_channel(&id);
    start_named_request(&chats, id, request, move |event| {
        let _ = app.emit(&channel, &event);
    })
}

fn start_named_request(
    chats: &NativeChats,
    id: String,
    request: NativeChatStartRequest,
    emit: impl FnMut(EngineEvent) + Send + 'static,
) -> Result<String, String> {
    let target = resolve_native_target(&request.target)?;
    let system = composed_system_prompt(request.system_prompt.as_deref());
    let vault_path = request
        .vault_path
        .as_deref()
        .map(|path| crate::commands::expand_tilde(path).into_owned());
    let vault_paths = request.vault_paths.clone();
    let mode = request.permission_mode;
    match target {
        NativeChatTarget::FreeTier => {
            let (tx, rx) = mpsc::channel();
            let reporter = tx.clone();
            let model = free_tier_routing_model(system.clone(), move |attempt| {
                let _ = reporter.send(attempt);
            })?;
            let mut engine = NativeEngine::with_provider_pair(AgentLoop::new(), model, tx, rx);
            engine.set_vault(vault_path.clone(), vault_paths.clone());
            engine.set_permission_mode(mode);
            engine.set_log_meta(
                &id,
                FREE_TIER_TARGET,
                mode,
                vault_path.clone(),
                vault_paths.clone(),
                system.clone(),
            );
            chats.start_named(id, &request.prompt, engine, emit)
        }
        NativeChatTarget::Catalog {
            provider_kind,
            provider_id,
            model_id,
        } => {
            let stream = AiModelStreamRequest {
                provider: catalog_provider(provider_kind, &provider_id),
                model_id,
                message: request.prompt.clone(),
                system_prompt: system.clone(),
                vault_path: vault_path.clone(),
                vault_paths: vault_paths.clone(),
                api_key_override: None,
                event_name: None,
            };
            let mut engine = NativeEngine::new(ProviderModel::new(stream, HttpLimits::STREAM));
            engine.set_vault(vault_path.clone(), vault_paths.clone());
            engine.set_permission_mode(mode);
            engine.set_log_meta(
                &id,
                &request.target,
                mode,
                vault_path.clone(),
                vault_paths.clone(),
                system.clone(),
            );
            chats.start_named(id, &request.prompt, engine, emit)
        }
    }
}

#[cfg(desktop)]
#[tauri::command]
pub fn native_chat_send(
    chats: tauri::State<NativeChats>,
    session_id: String,
    text: String,
) -> Result<(), String> {
    chats.send(&session_id, &text)
}

#[cfg(desktop)]
#[tauri::command]
pub fn native_chat_cancel(
    chats: tauri::State<NativeChats>,
    session_id: String,
) -> Result<(), String> {
    chats.cancel(&session_id, "user")
}

#[cfg(desktop)]
#[tauri::command]
pub fn native_chat_approval_reply(
    chats: tauri::State<NativeChats>,
    session_id: String,
    prompt_id: String,
    reply: ApprovalReply,
) -> Result<(), String> {
    chats.reply_approval(&session_id, &prompt_id, reply)
}

#[cfg(desktop)]
#[tauri::command]
pub fn native_chat_end(chats: tauri::State<NativeChats>, session_id: String) -> Result<(), String> {
    chats.end(&session_id)
}

#[cfg(desktop)]
#[tauri::command]
pub fn native_chat_list() -> Result<Vec<NativeChatListItem>, String> {
    list_native_sessions()
}

#[cfg(desktop)]
#[tauri::command]
pub fn native_chat_open(
    app: tauri::AppHandle,
    chats: tauri::State<NativeChats>,
    session_id: String,
) -> Result<NativeChatOpenResult, String> {
    use tauri::Emitter;
    let record = chats.attach_open(&session_id)?;
    if record.read_only || record.error.is_some() {
        return Ok(record);
    }
    let live_id = record
        .successor_id
        .clone()
        .unwrap_or_else(|| session_id.clone());
    if chats.is_live(&session_id) || chats.is_live(&live_id) {
        return Ok(record);
    }
    let opened = crate::engines::native_log::open_session_log(&live_id).unwrap_or_else(|_| {
        crate::engines::native_log::OpenedNativeLog {
            header: crate::engines::native_log::SessionHeader {
                version: crate::engines::native_log::NATIVE_LOG_VERSION,
                session_id: live_id.clone(),
                created_at: String::new(),
                target: String::new(),
                permission_mode: "safe".into(),
                vault_path: None,
                vault_paths: Vec::new(),
                system_prompt: None,
            },
            events: record.events.clone(),
            warning: record.warning.clone(),
            read_only: false,
            successor_id: None,
        }
    });
    let agent = AgentLoop::from_log(opened.events.clone());
    let channel = native_chat_channel(&live_id);
    let request = NativeChatStartRequest {
        target: opened.header.target.clone(),
        prompt: String::new(),
        system_prompt: opened.header.system_prompt.clone(),
        vault_path: opened.header.vault_path.clone(),
        vault_paths: opened.header.vault_paths.clone(),
        permission_mode: match opened.header.permission_mode.as_str() {
            "power_user" => AiAgentPermissionMode::PowerUser,
            _ => AiAgentPermissionMode::Safe,
        },
    };
    let target = match resolve_native_target(&request.target) {
        Ok(target) => target,
        Err(error) => {
            return Ok(NativeChatOpenResult {
                error: Some(error),
                read_only: true,
                ..record
            });
        }
    };
    let system = opened
        .header
        .system_prompt
        .clone()
        .or_else(|| composed_system_prompt(None));
    let emit = {
        let app = app.clone();
        move |event| {
            let _ = app.emit(&channel, &event);
        }
    };
    match target {
        NativeChatTarget::FreeTier => {
            let (tx, rx) = mpsc::channel();
            let reporter = tx.clone();
            let model = match free_tier_routing_model(system.clone(), move |attempt| {
                let _ = reporter.send(attempt);
            }) {
                Ok(model) => model,
                Err(error) => {
                    return Ok(NativeChatOpenResult {
                        error: Some(error),
                        read_only: true,
                        ..record
                    });
                }
            };
            let mut engine = NativeEngine::with_provider_pair(agent, model, tx, rx);
            engine.set_vault(request.vault_path.clone(), request.vault_paths.clone());
            engine.set_permission_mode(request.permission_mode);
            engine.set_log_meta(
                &live_id,
                FREE_TIER_TARGET,
                request.permission_mode,
                request.vault_path.clone(),
                request.vault_paths.clone(),
                request.system_prompt.clone(),
            );
            chats.open_with_engine(live_id, engine, emit)?;
        }
        NativeChatTarget::Catalog {
            provider_kind,
            provider_id,
            model_id,
        } => {
            let stream = AiModelStreamRequest {
                provider: catalog_provider(provider_kind, &provider_id),
                model_id,
                message: String::new(),
                system_prompt: system.clone(),
                vault_path: request.vault_path.clone(),
                vault_paths: request.vault_paths.clone(),
                api_key_override: None,
                event_name: None,
            };
            let mut engine =
                NativeEngine::from_parts(agent, ProviderModel::new(stream, HttpLimits::STREAM));
            engine.set_vault(request.vault_path.clone(), request.vault_paths.clone());
            engine.set_permission_mode(request.permission_mode);
            engine.set_log_meta(
                &live_id,
                &request.target,
                request.permission_mode,
                request.vault_path.clone(),
                request.vault_paths.clone(),
                request.system_prompt.clone(),
            );
            chats.open_with_engine(live_id, engine, emit)?;
        }
    }
    Ok(record)
}

#[cfg(desktop)]
#[tauri::command]
pub fn native_chat_delete(
    chats: tauri::State<NativeChats>,
    session_id: String,
) -> Result<(), String> {
    delete_native_session(&chats, &session_id)
}

pub fn settle_native_chats_on_quit(chats: &NativeChats) {
    chats.settle_all(NATIVE_QUIT_BOUND);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engines::{EngineEvent, NativeEngine, PrimeEngine};
    use crate::rhizome_loop::{AgentLoop, DurableEvent, FakeModel, ModelView};
    use crate::session_transcript_index::{self, IndexedTranscriptTurn};
    use std::panic::{catch_unwind, AssertUnwindSafe};
    use std::sync::mpsc;
    use std::time::Instant;

    static HOME_LOCK: Mutex<()> = Mutex::new(());

    fn with_temp_home<T>(body: impl FnOnce(&tempfile::TempDir) -> T) -> T {
        let _shared = crate::app_config::TEST_CONFIG_ENV
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let _guard = HOME_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let home = tempfile::tempdir().unwrap();
        let previous = std::env::var("HOME").ok();
        std::env::set_var("HOME", home.path());
        let result = catch_unwind(AssertUnwindSafe(|| body(&home)));
        if let Some(value) = previous {
            std::env::set_var("HOME", value);
        } else {
            std::env::remove_var("HOME");
        }
        match result {
            Ok(value) => value,
            Err(panic) => std::panic::resume_unwind(panic),
        }
    }

    #[test]
    fn native_chat_start_emits_text_on_the_scoped_channel() {
        with_temp_home(|_| {
            let chats = NativeChats::new();
            let (tx, rx) = mpsc::channel();
            let id = chats
                .start_with_engine("hi", NativeEngine::saying("hello"), move |event| {
                    let _ = tx.send(event);
                })
                .expect("start");
            assert_eq!(native_chat_channel(&id), format!("native-chat:{id}"));
            let mut seen = Vec::new();
            let deadline = Instant::now() + Duration::from_secs(2);
            while Instant::now() < deadline {
                if let Ok(event) = rx.recv_timeout(Duration::from_millis(20)) {
                    seen.push(event);
                }
                if seen
                    .iter()
                    .any(|event| matches!(event, EngineEvent::TurnEnd))
                {
                    break;
                }
            }
            assert!(
                seen.iter().any(
                    |event| matches!(event, EngineEvent::TextDelta { text } if text == "hello")
                ),
                "scoped channel missing text: {seen:?}"
            );
            assert!(
                seen.iter()
                    .any(|event| matches!(event, EngineEvent::TurnEnd)),
                "scoped channel missing turn end: {seen:?}"
            );
        });
    }

    #[test]
    fn free_tier_target_builds_a_routing_model() {
        let target = resolve_native_target(FREE_TIER_LABEL).expect("label");
        assert_eq!(target, NativeChatTarget::FreeTier);
        assert_eq!(model_kind_for_target(&target), "routing");
        let auto = resolve_native_target(FREE_TIER_TARGET).expect("id");
        assert_eq!(auto, NativeChatTarget::FreeTier);
    }

    #[test]
    fn free_tier_start_sends_composed_system_prompt() {
        with_temp_home(|_| {
            let request = NativeChatStartRequest {
                target: FREE_TIER_LABEL.to_string(),
                prompt: "hi".into(),
                system_prompt: Some("Use the vault.".into()),
                vault_path: None,
                vault_paths: Vec::new(),
                permission_mode: AiAgentPermissionMode::default(),
            };
            let expected = composed_system_prompt(request.system_prompt.as_deref());
            assert!(
                expected
                    .as_deref()
                    .is_some_and(|text| text.contains("Use the vault.")),
                "compose must keep the turn system prompt"
            );
            let model = free_tier_routing_model(expected.clone(), |_| {}).unwrap();
            assert_eq!(model.system_prompt(), expected.as_deref());
        });
    }

    #[test]
    fn anthropic_target_is_refused_until_6a() {
        let err = resolve_native_target("anthropic/claude-opus-4").expect_err("refuse");
        assert!(
            err.to_lowercase().contains("anthropic"),
            "error must name Anthropic: {err}"
        );
    }

    #[test]
    fn quit_cancels_native_chat_turn() {
        with_temp_home(|_| {
            let chats = NativeChats::new();
            let (chunk_tx, chunk_rx) = mpsc::channel();
            let (hold_tx, hold_rx) = mpsc::channel::<()>();
            let mut model = FakeModel::streaming(vec![vec!["one".into(), "two".into()]]);
            model.on_after_chunk(move |index| {
                if index == 0 {
                    let _ = chunk_tx.send(());
                    let _ = hold_rx.recv();
                }
            });
            let (tx, rx) = mpsc::channel();
            let id = chats
                .start_with_engine(
                    "hi",
                    NativeEngine::from_parts(AgentLoop::new(), model),
                    move |event| {
                        let _ = tx.send(event);
                    },
                )
                .expect("start");
            chunk_rx
                .recv_timeout(Duration::from_secs(2))
                .expect("first chunk");
            chats.cancel(&id, "quit").expect("cancel");
            drop(hold_tx);
            let mut seen = Vec::new();
            let deadline = Instant::now() + Duration::from_secs(2);
            while Instant::now() < deadline {
                if let Ok(event) = rx.recv_timeout(Duration::from_millis(20)) {
                    seen.push(event);
                }
                if seen.iter().any(
                    |event| matches!(event, EngineEvent::Cancelled { cause } if cause == "quit"),
                ) {
                    break;
                }
            }
            assert!(
                seen.iter().any(
                    |event| matches!(event, EngineEvent::Cancelled { cause } if cause == "quit")
                ),
                "quit must cancel the native turn: {seen:?}"
            );
        });
    }

    #[test]
    fn quit_does_not_wait_past_the_bound() {
        with_temp_home(|_| {
            let chats = NativeChats::new();
            let mut model = FakeModel::streaming(vec![vec!["one".into(), "two".into()]]);
            model.on_after_chunk(|_| {
                thread::sleep(Duration::from_secs(2));
            });
            chats
                .start_with_engine(
                    "hi",
                    NativeEngine::from_parts(AgentLoop::new(), model),
                    |_| {},
                )
                .expect("start");
            let started = Instant::now();
            chats.settle_all(Duration::from_millis(80));
            let elapsed = started.elapsed();
            assert!(
                elapsed < Duration::from_millis(400),
                "quit bound leaked: {elapsed:?}"
            );
        });
    }

    fn with_temp_home_and_cache<T>(body: impl FnOnce(&tempfile::TempDir) -> T) -> T {
        with_temp_home(|home| session_transcript_index::with_temp_cache(|| body(home)))
    }

    fn wait_for_indexed_session(
        path: &str,
    ) -> crate::session_transcript_index::PersistedSessionRecord {
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            if let Ok(document) = session_transcript_index::load() {
                if let Some(record) = document
                    .sessions
                    .iter()
                    .find(|session| session.path == path)
                {
                    return record.clone();
                }
            }
            assert!(
                Instant::now() < deadline,
                "index never got the native session"
            );
            thread::sleep(Duration::from_millis(20));
        }
    }

    fn wait_for_path(path: &std::path::Path) {
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            if path.exists() {
                return;
            }
            assert!(Instant::now() < deadline, "path never appeared");
            thread::sleep(Duration::from_millis(20));
        }
    }

    #[test]
    fn transcript_index_contains_native_turn() {
        with_temp_home_and_cache(|_| {
            let chats = NativeChats::new();
            let id = chats
                .start_with_engine("hello vault", NativeEngine::saying("ok"), |_| {})
                .expect("start");
            let path = chats.path_for(&id).expect("native path");
            assert!(
                path.starts_with(NATIVE_SESSION_PREFIX),
                "path must be Rhizome-owned"
            );
            let record = wait_for_indexed_session(&path);
            assert!(record
                .turns
                .iter()
                .any(|turn| turn.role == "user" && turn.text.contains("hello vault")));
            assert!(record
                .turns
                .iter()
                .any(|turn| { turn.role == "assistant" && turn.text == "ok" }));
            let _ = IndexedTranscriptTurn {
                message_index: 0,
                role: "user".into(),
                text: String::new(),
            };
        });
    }

    #[test]
    fn native_chat_writes_nothing_under_prime_home() {
        with_temp_home(|home| {
            let chats = NativeChats::new();
            chats
                .start_with_engine("hi", NativeEngine::saying("ok"), |_| {})
                .expect("start");
            thread::sleep(Duration::from_millis(80));
            assert!(
                !home.path().join(".prime").exists(),
                "native chat must not write under ~/.prime"
            );
        });
    }

    #[test]
    fn prime_engine_detaches_never_shutdown_on_exit() {
        let seen = std::sync::Arc::new(Mutex::new(Vec::<String>::new()));
        let log = std::sync::Arc::clone(&seen);
        {
            let engine = PrimeEngine::with_settle(move |intent| {
                log.lock()
                    .expect("prime settle log")
                    .push(format!("{intent:?}"));
                Ok(crate::prime_session_host::QuitDisposition::KeepSessionRunning)
            });
            drop(engine);
        }
        let commands = seen.lock().expect("prime settle log").clone();
        assert_eq!(commands, vec!["Detach".to_string()]);
        assert!(
            !commands.iter().any(|command| command.contains("Shutdown")),
            "drop must detach, never shutdown: {commands:?}"
        );
    }

    fn log_id(label: &str) -> String {
        if crate::engines::native_log::validate_session_id(label).is_ok() {
            return label.to_string();
        }
        use sha2::Digest;
        let digest = sha2::Sha256::digest(label.as_bytes());
        let bytes = &digest[..16];
        format!(
            "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
            bytes[0],
            bytes[1],
            bytes[2],
            bytes[3],
            bytes[4],
            bytes[5],
            0x40 | (bytes[6] & 0x0f),
            bytes[7],
            0x80 | (bytes[8] & 0x3f),
            bytes[9],
            bytes[10],
            bytes[11],
            bytes[12],
            bytes[13],
            bytes[14],
            bytes[15]
        )
    }

    fn write_native_log(name: &str, version: u32, target: &str, event_json: &[&str]) {
        write_native_log_lines(name, version, target, event_json, &[]);
    }

    fn write_native_log_lines(
        name: &str,
        version: u32,
        target: &str,
        event_json: &[&str],
        extra_lines: &[&str],
    ) {
        let events: Vec<DurableEvent> = event_json
            .iter()
            .map(|line| serde_json::from_str(line).expect("event json"))
            .collect();
        let header = crate::engines::native_log::SessionHeader {
            version,
            session_id: log_id(name),
            created_at: "2026-10-10T00:00:00Z".into(),
            target: target.to_string(),
            permission_mode: "safe".into(),
            vault_path: None,
            vault_paths: Vec::new(),
            system_prompt: None,
        };
        crate::engines::native_log::write_fixture(&header, &events, extra_lines).expect("fixture");
    }

    fn two_turn_events() -> [&'static str; 6] {
        [
            r#"{"User":{"text":"one"}}"#,
            r#"{"Assistant":{"text":"first"}}"#,
            r#""TurnEnd""#,
            r#"{"User":{"text":"two"}}"#,
            r#"{"Assistant":{"text":"second"}}"#,
            r#""TurnEnd""#,
        ]
    }

    fn wait_for_turn_end(rx: &mpsc::Receiver<EngineEvent>) -> Vec<EngineEvent> {
        let mut seen = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if let Ok(event) = rx.recv_timeout(Duration::from_millis(20)) {
                seen.push(event);
            }
            if seen
                .iter()
                .any(|event| matches!(event, EngineEvent::TurnEnd))
            {
                break;
            }
        }
        seen
    }

    #[test]
    fn resume_sends_earlier_turns_to_the_model() {
        with_temp_home(|_| {
            write_native_log(
                "resume-history",
                1,
                "openai/gpt-4o-mini",
                &two_turn_events(),
            );
            let opened = crate::engines::native_log::open_session_log(&log_id("resume-history"))
                .expect("open log");
            let agent = AgentLoop::from_log(opened.events);
            let seen = std::sync::Arc::new(Mutex::new(Vec::<ModelView>::new()));
            let model = FakeModel::saying("third").share_seen(std::sync::Arc::clone(&seen));
            let chats = NativeChats::new();
            let (tx, rx) = mpsc::channel();
            let id = log_id("resume-history");
            chats
                .open_with_engine(
                    id.clone(),
                    NativeEngine::from_parts(agent, model),
                    move |event| {
                        let _ = tx.send(event);
                    },
                )
                .expect("open");
            chats.send(&id, "three").expect("send");
            let events = wait_for_turn_end(&rx);
            assert!(
                events.iter().any(
                    |event| matches!(event, EngineEvent::TextDelta { text } if text == "third")
                ),
                "third turn missing: {events:?}"
            );
            let views = seen.lock().expect("seen").clone();
            let last = views.last().expect("model saw the resumed turn");
            let users: Vec<&str> = last
                .history
                .iter()
                .filter_map(|item| match item {
                    crate::rhizome_loop::HistoryItem::User { text } => Some(text.as_str()),
                    _ => None,
                })
                .collect();
            assert!(
                users.contains(&"one") && users.contains(&"two"),
                "resumed model must see both earlier turns: {users:?}"
            );
        });
    }

    #[test]
    fn restart_mid_turn_closes_the_turn_as_cancelled() {
        with_temp_home(|_| {
            write_native_log(
                "cut-off",
                1,
                "openai/gpt-4o-mini",
                &[
                    r#"{"User":{"text":"hi"}}"#,
                    r#"{"Assistant":{"text":"partial"}}"#,
                ],
            );
            let opened =
                crate::engines::native_log::open_session_log(&log_id("cut-off")).expect("open");
            let agent = AgentLoop::from_log(opened.events);
            assert!(
                agent.events().iter().any(|event| {
                    matches!(event, DurableEvent::Cancelled { cause } if cause == "restart")
                }),
                "cut-off turn must close as cancelled restart"
            );
        });
    }

    #[test]
    fn resume_restores_no_session_grants() {
        with_temp_home(|_| {
            write_native_log(
                "no-grants",
                1,
                "openai/gpt-4o-mini",
                &[
                    r#"{"User":{"text":"run ls"}}"#,
                    r#"{"ToolCall":{"id":"call_1","name":"bash","args":"ls"}}"#,
                    r#"{"ToolResult":{"id":"call_1","name":"bash","output":"ok"}}"#,
                    r#"{"Assistant":{"text":"done"}}"#,
                    r#""TurnEnd""#,
                ],
            );
            let opened =
                crate::engines::native_log::open_session_log(&log_id("no-grants")).expect("open");
            let agent = AgentLoop::from_log(opened.events);
            assert!(
                agent.session_grants().is_empty(),
                "D13: grants must not come back"
            );
        });
    }

    #[test]
    fn reopen_warning_says_grants_do_not_carry_over() {
        with_temp_home(|_| {
            write_native_log("d13", 1, "openai/gpt-4o-mini", &two_turn_events());
            let opened = super::open_native_session_record(&log_id("d13")).expect("open record");
            let warning = opened.warning.expect("D13 warning");
            assert_eq!(warning, crate::engines::native_log::REOPEN_WARNING);
        });
    }

    #[test]
    fn pending_approval_is_not_restored() {
        with_temp_home(|_| {
            write_native_log(
                "pending",
                1,
                "openai/gpt-4o-mini",
                &[
                    r#"{"User":{"text":"write"}}"#,
                    r#"{"ToolCall":{"id":"call_1","name":"create_note","args":"{\"path\":\"a.md\"}"}}"#,
                ],
            );
            let opened =
                crate::engines::native_log::open_session_log(&log_id("pending")).expect("open");
            let agent = AgentLoop::from_log(opened.events);
            assert!(
                !agent.has_live_approval(),
                "pending approval must not come back"
            );
            assert!(agent.events().iter().any(|event| {
                matches!(event, DurableEvent::Cancelled { cause } if cause == "restart")
            }));
        });
    }

    #[test]
    fn unanswered_tool_call_gets_the_stopped_answer() {
        with_temp_home(|_| {
            write_native_log(
                "stopped-tool",
                1,
                "openai/gpt-4o-mini",
                &[
                    r#"{"User":{"text":"hi"}}"#,
                    r#"{"ToolCall":{"id":"call_9","name":"echo","args":"ping"}}"#,
                ],
            );
            let opened = crate::engines::native_log::open_session_log(&log_id("stopped-tool"))
                .expect("open");
            let agent = AgentLoop::from_log(opened.events);
            let view = agent.model_view_for_resume();
            let messages = crate::rhizome_provider_model::openai_messages(&view, view.turn_start);
            assert!(
                messages.iter().any(|message| {
                    message.get("content").and_then(|value| value.as_str())
                        == Some("Not run: the turn stopped first.")
                }),
                "unanswered tool must get the stopped answer"
            );
        });
    }

    #[test]
    fn bad_tail_line_is_ignored() {
        with_temp_home(|_| {
            write_native_log_lines(
                "bad-tail",
                1,
                "openai/gpt-4o-mini",
                &[
                    r#"{"User":{"text":"hi"}}"#,
                    r#"{"Assistant":{"text":"ok"}}"#,
                    r#""TurnEnd""#,
                ],
                &["this is not json{{{"],
            );
            let path =
                crate::engines::native_log::session_log_path(&log_id("bad-tail")).expect("path");
            let before = std::fs::read(&path).expect("original");
            let opened =
                crate::engines::native_log::open_session_log(&log_id("bad-tail")).expect("open");
            assert!(opened.warning.is_some(), "damaged tail must warn");
            assert!(
                opened
                    .events
                    .iter()
                    .any(|event| matches!(event, DurableEvent::Assistant { text } if text == "ok")),
                "must keep the last good line"
            );
            assert!(
                opened.successor_id.is_some(),
                "tail damage continues in a new session"
            );
            assert_eq!(
                std::fs::read(&path).expect("preserved"),
                before,
                "tail damage must leave the original file untouched"
            );
        });
    }

    #[test]
    fn middle_damage_stops_and_continues_in_a_new_session() {
        with_temp_home(|_| {
            write_native_log_lines(
                "middle-damage",
                1,
                "openai/gpt-4o-mini",
                &[
                    r#"{"User":{"text":"keep"}}"#,
                    r#"{"Assistant":{"text":"prefix"}}"#,
                    r#""TurnEnd""#,
                ],
                &[
                    "@@@not-a-record@@@",
                    r#"{"seq":4,"checksum":"dead","event":{"User":{"text":"after-damage"}}}"#,
                    r#"{"seq":5,"checksum":"beef","event":{"Assistant":{"text":"should-not-load"}}}"#,
                ],
            );
            let original = crate::engines::native_log::session_log_path(&log_id("middle-damage"))
                .expect("path");
            let before = std::fs::read_to_string(&original).expect("original");
            let opened = crate::engines::native_log::open_session_log(&log_id("middle-damage"))
                .expect("open");
            assert!(opened.warning.is_some(), "middle damage must warn");
            assert!(
                !opened.events.iter().any(
                    |event| matches!(event, DurableEvent::User { text } if text == "after-damage")
                ),
                "must stop at the first invalid line"
            );
            assert!(
                opened
                    .events
                    .iter()
                    .any(|event| matches!(event, DurableEvent::User { text } if text == "keep")),
                "verified prefix must remain"
            );
            let after = std::fs::read_to_string(&original).expect("preserved");
            assert_eq!(before, after, "original damaged file must be preserved");
            let successor = opened
                .successor_id
                .expect("middle damage continues in a new session");
            assert_ne!(successor, "middle-damage");
            let successor_opened =
                crate::engines::native_log::open_session_log(&successor).expect("successor");
            assert!(successor_opened
                .events
                .iter()
                .any(|event| matches!(event, DurableEvent::User { text } if text == "keep")));
            assert!(!successor_opened.events.iter().any(
                |event| matches!(event, DurableEvent::User { text } if text == "after-damage")
            ));
        });
    }

    #[test]
    fn unknown_version_opens_read_only() {
        with_temp_home(|_| {
            write_native_log("future", 99, "openai/gpt-4o-mini", &two_turn_events());
            let opened =
                crate::engines::native_log::open_session_log(&log_id("future")).expect("open");
            assert!(opened.read_only, "unknown version must be read-only");
            let record = super::open_native_session_record(&log_id("future")).expect("open record");
            assert!(record.read_only);
            let chats = NativeChats::new();
            chats.note_open(&record);
            let err = chats
                .send(&log_id("future"), "later")
                .expect_err("read-only session rejects send");
            assert!(
                err.to_lowercase().contains("read-only")
                    || err.to_lowercase().contains("unknown version"),
                "send error must name read-only"
            );
        });
    }

    #[test]
    fn missing_target_returns_the_events_and_an_error() {
        with_temp_home(|_| {
            write_native_log(
                "missing-target",
                1,
                "anthropic/claude-opus-4",
                &two_turn_events(),
            );
            let opened =
                super::open_native_session_record(&log_id("missing-target")).expect("open");
            assert!(
                opened
                    .events
                    .iter()
                    .any(|event| matches!(event, DurableEvent::User { text } if text == "one")),
                "events must still come back"
            );
            let error = opened.error.expect("missing target error");
            assert!(
                error.contains("anthropic/claude-opus-4")
                    || error.to_lowercase().contains("anthropic"),
                "error must name the missing target"
            );
        });
    }

    #[test]
    fn native_log_is_never_written_under_prime_home() {
        with_temp_home(|home| {
            let chats = NativeChats::new();
            let id = chats
                .start_with_engine("hi", NativeEngine::saying("ok"), |_| {})
                .expect("start");
            let log_path = crate::engines::native_log::session_log_path(&id).expect("path");
            wait_for_path(&log_path);
            assert!(
                !home.path().join(".prime").exists(),
                "native log must not be written under ~/.prime"
            );
            let log_text = std::fs::read_to_string(&log_path).expect("read log");
            assert!(
                !log_path.starts_with(home.path().join(".prime")),
                "log path leaked into Prime home"
            );
            assert!(log_text.contains(&id), "header must name the session");
        });
    }

    #[test]
    fn delete_removes_the_log_and_the_index_entry() {
        with_temp_home_and_cache(|_| {
            let chats = NativeChats::new();
            let id = chats
                .start_with_engine("delete me", NativeEngine::saying("ok"), |_| {})
                .expect("start");
            let path = chats.path_for(&id).expect("native path");
            let _indexed = wait_for_indexed_session(&path);
            let log_path = crate::engines::native_log::session_log_path(&id).expect("log");
            assert!(log_path.exists(), "log should exist before delete");
            super::delete_native_session(&chats, &id).expect("delete");
            assert!(!log_path.exists(), "delete must remove the log file");
            let document = session_transcript_index::load().expect("load");
            assert!(
                document
                    .sessions
                    .iter()
                    .all(|session| session.path != path && session.id != id),
                "delete must drop the index entry"
            );
        });
    }

    #[test]
    fn second_window_can_display_while_one_writer_holds_the_lock() {
        with_temp_home(|_| {
            write_native_log("locked", 1, "openai/gpt-4o-mini", &two_turn_events());
            let first = crate::engines::native_log::try_lock_session(&log_id("locked"))
                .expect("first window lock");
            let second =
                crate::engines::native_log::open_session_log(&log_id("locked")).expect("second");
            assert!(!second.read_only, "a second window may display the chat");
            assert!(second
                .events
                .iter()
                .any(|event| matches!(event, DurableEvent::User { text } if text == "one")));
            assert!(
                crate::engines::native_log::try_lock_session(&log_id("locked")).is_err(),
                "a second writer is refused"
            );
            drop(first);
        });
    }

    #[test]
    fn opening_a_live_chat_does_not_freeze_send() {
        with_temp_home(|_| {
            let chats = NativeChats::new();
            let (tx, rx) = mpsc::channel();
            let id = chats
                .start_with_engine("hi", NativeEngine::saying("ok"), move |event| {
                    let _ = tx.send(event);
                })
                .expect("start");
            let _ = wait_for_turn_end(&rx);
            let record = chats.attach_open(&id).expect("open");
            assert!(!record.read_only, "a live chat stays writable");
            chats.send(&id, "still open").expect("send");
        });
    }

    #[test]
    fn second_turn_is_refused_while_one_runs() {
        with_temp_home(|_| {
            let chats = NativeChats::new();
            let (chunk_tx, chunk_rx) = mpsc::channel();
            let (hold_tx, hold_rx) = mpsc::channel::<()>();
            let mut model = FakeModel::streaming(vec![vec!["one".into()]]);
            model.on_after_chunk(move |_| {
                let _ = chunk_tx.send(());
                let _ = hold_rx.recv();
            });
            let id = chats
                .start_with_engine(
                    "hi",
                    NativeEngine::from_parts(AgentLoop::new(), model),
                    |_| {},
                )
                .expect("start");
            chunk_rx
                .recv_timeout(Duration::from_secs(2))
                .expect("first chunk");
            let error = chats.send(&id, "second").expect_err("second turn");
            assert!(
                error.to_lowercase().contains("turn"),
                "a concurrent second turn must be refused"
            );
            drop(hold_tx);
        });
    }

    #[test]
    fn path_traversal_is_rejected() {
        let open_error = super::open_native_session_record("../x").expect_err("open");
        assert!(open_error.to_lowercase().contains("uuid"));
        let delete_error =
            super::delete_native_session(&NativeChats::new(), "../x").expect_err("delete");
        assert!(delete_error.to_lowercase().contains("uuid"));
    }

    #[test]
    fn resumed_log_keeps_vault_folders_and_system_prompt() {
        with_temp_home(|_| {
            let id = uuid::Uuid::new_v4().to_string();
            let mut engine = NativeEngine::saying("ok");
            engine.set_log_meta(
                &id,
                "openai/gpt-4o-mini",
                AiAgentPermissionMode::Safe,
                Some("/vault".into()),
                vec!["/extra".into()],
                Some("Be brief".into()),
            );
            engine.ensure_log(&id).expect("log");
            drop(engine);
            let opened = crate::engines::native_log::open_session_log(&id).expect("open");
            assert_eq!(opened.header.vault_path.as_deref(), Some("/vault"));
            assert_eq!(opened.header.vault_paths, vec!["/extra".to_string()]);
            assert_eq!(opened.header.system_prompt.as_deref(), Some("Be brief"));
        });
    }
}
