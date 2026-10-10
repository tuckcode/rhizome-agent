//! Native Chat Tauri commands (harness plan step 2b).
//!
//! Chat still talks to Prime. Step 4 adds the Settings toggle.
//! These commands exist so the toggle has a backend to call.

use std::collections::HashMap;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::ai_agents::AiAgentPermissionMode;
use crate::ai_models::{
    AiModelApiKeyStorage, AiModelProvider, AiModelProviderKind, AiModelStreamRequest, HttpLimits,
};
use crate::engines::{Engine, EngineEvent, NativeControl, NativeEngine};
use crate::rhizome_loop::{AgentLoop, ApprovalReply, Model};
use crate::rhizome_provider_model::ProviderModel;
use crate::rhizome_routing::{Catalog, Credential, KeyStore, RoutingModel, SystemClock};
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
        let user_text = prompt.to_string();
        let worker = thread::spawn(move || {
            let mut engine = engine;
            if let Err(error) = engine.ensure_log(&index_id) {
                (emit.lock().expect("native sink"))(EngineEvent::Error { message: error });
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
                        let _ = engine.start(
                            &prompt,
                            Box::new(move |event| {
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
                    }
                    ChatOp::End => break,
                }
            }
        });
        ops.send(ChatOp::Turn(user_text))
            .map_err(|_| "native chat worker closed".to_string())?;
        self.sessions.lock().expect("native chats").insert(
            id.clone(),
            LiveNativeChat {
                control,
                ops,
                worker: Some(worker),
                read_only: false,
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
        session
            .ops
            .send(ChatOp::Turn(text.to_string()))
            .map_err(|_| "native chat worker closed".to_string())?;
        Ok(())
    }

    pub fn open_with_engine<M: Model + Send + 'static>(
        &self,
        id: String,
        engine: NativeEngine<M>,
        emit: impl FnMut(EngineEvent) + Send + 'static,
    ) -> Result<String, String> {
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
        let worker = thread::spawn(move || {
            let mut engine = engine;
            if let Err(error) = engine.ensure_log(&index_id) {
                (emit.lock().expect("native sink"))(EngineEvent::Error { message: error });
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
                        let _ = engine.start(
                            &prompt,
                            Box::new(move |event| {
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
        if opened.read_only {
            self.note_read_only(&opened.session_id);
        }
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

struct SecretsKeyStore;

impl KeyStore for SecretsKeyStore {
    fn credential(&self, provider_id: &str) -> Option<Credential> {
        let path = settings::preferred_app_config_path("ai-provider-secrets.json").ok()?;
        let data = std::fs::read_to_string(path).ok()?;
        let parsed: serde_json::Value = serde_json::from_str(&data).ok()?;
        let key = parsed
            .get("provider_api_keys")?
            .get(provider_id)?
            .as_str()?
            .trim();
        if key.is_empty() {
            None
        } else {
            Some(Credential {
                api_key: key.to_string(),
                account_id: None,
            })
        }
    }
}

fn composed_system_prompt(existing: Option<&str>) -> Option<String> {
    settings::compose_agent_profile(settings::saved_agent_profile().as_deref(), existing)
}

fn free_tier_routing_model(
    system: Option<String>,
    observer: impl FnMut(crate::rhizome_routing::ProviderAttempt) + Send + 'static,
) -> RoutingModel<SecretsKeyStore, SystemClock> {
    RoutingModel::new(
        Catalog::pinned(),
        SecretsKeyStore,
        SystemClock,
        HttpLimits::STREAM,
    )
    .with_observer(observer)
    .with_system_prompt(system)
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
            let model = free_tier_routing_model(system, move |attempt| {
                let _ = reporter.send(attempt);
            });
            let mut engine = NativeEngine::with_provider_pair(AgentLoop::new(), model, tx, rx);
            engine.set_vault(vault_path.clone(), vault_paths.clone());
            engine.set_permission_mode(mode);
            engine.set_log_meta(&id, FREE_TIER_TARGET, mode, vault_path);
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
                system_prompt: system,
                vault_path: vault_path.clone(),
                vault_paths: vault_paths.clone(),
                api_key_override: None,
                event_name: None,
            };
            let mut engine = NativeEngine::new(ProviderModel::new(stream, HttpLimits::STREAM));
            engine.set_vault(vault_path.clone(), vault_paths);
            engine.set_permission_mode(mode);
            engine.set_log_meta(&id, &request.target, mode, vault_path);
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
    let record = open_native_session_record(&session_id)?;
    chats.note_open(&record);
    if record.read_only || record.error.is_some() {
        return Ok(record);
    }
    let live_id = record
        .successor_id
        .clone()
        .unwrap_or_else(|| session_id.clone());
    let opened = crate::engines::native_log::open_session_log(&live_id).unwrap_or_else(|_| {
        crate::engines::native_log::OpenedNativeLog {
            header: crate::engines::native_log::SessionHeader {
                version: crate::engines::native_log::NATIVE_LOG_VERSION,
                session_id: live_id.clone(),
                created_at: String::new(),
                target: String::new(),
                permission_mode: "safe".into(),
                vault_path: None,
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
        system_prompt: None,
        vault_path: opened.header.vault_path.clone(),
        vault_paths: Vec::new(),
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
    let system = composed_system_prompt(None);
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
            let model = free_tier_routing_model(system, move |attempt| {
                let _ = reporter.send(attempt);
            });
            let mut engine = NativeEngine::with_provider_pair(agent, model, tx, rx);
            engine.set_vault(request.vault_path.clone(), request.vault_paths.clone());
            engine.set_permission_mode(request.permission_mode);
            engine.set_log_meta(
                &live_id,
                FREE_TIER_TARGET,
                request.permission_mode,
                request.vault_path,
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
                system_prompt: system,
                vault_path: request.vault_path.clone(),
                vault_paths: request.vault_paths.clone(),
                api_key_override: None,
                event_name: None,
            };
            let mut engine =
                NativeEngine::from_parts(agent, ProviderModel::new(stream, HttpLimits::STREAM));
            engine.set_vault(request.vault_path.clone(), request.vault_paths);
            engine.set_permission_mode(request.permission_mode);
            engine.set_log_meta(
                &live_id,
                &request.target,
                request.permission_mode,
                request.vault_path,
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
        let _guard = HOME_LOCK.lock().expect("home lock");
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
            seen.iter()
                .any(|event| matches!(event, EngineEvent::TextDelta { text } if text == "hello")),
            "scoped channel missing text: {seen:?}"
        );
        assert!(
            seen.iter()
                .any(|event| matches!(event, EngineEvent::TurnEnd)),
            "scoped channel missing turn end: {seen:?}"
        );
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
            let model = free_tier_routing_model(expected.clone(), |_| {});
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
            if seen
                .iter()
                .any(|event| matches!(event, EngineEvent::Cancelled { cause } if cause == "quit"))
            {
                break;
            }
        }
        assert!(
            seen.iter()
                .any(|event| matches!(event, EngineEvent::Cancelled { cause } if cause == "quit")),
            "quit must cancel the native turn: {seen:?}"
        );
    }

    #[test]
    fn quit_does_not_wait_past_the_bound() {
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
    }

    #[test]
    fn transcript_index_contains_native_turn() {
        session_transcript_index::with_temp_cache(|| {
            let chats = NativeChats::new();
            let id = chats
                .start_with_engine("hello vault", NativeEngine::saying("ok"), |_| {})
                .expect("start");
            thread::sleep(Duration::from_millis(80));
            let path = chats.path_for(&id).expect("native path");
            assert!(
                path.starts_with(NATIVE_SESSION_PREFIX),
                "path must be Rhizome-owned"
            );
            let document = session_transcript_index::load().expect("load");
            let record = document
                .sessions
                .iter()
                .find(|session| session.path == path)
                .expect("indexed native session");
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

    fn write_native_log(session_id: &str, version: u32, target: &str, event_json: &[&str]) {
        write_native_log_lines(session_id, version, target, event_json, &[]);
    }

    fn write_native_log_lines(
        session_id: &str,
        version: u32,
        target: &str,
        event_json: &[&str],
        extra_lines: &[&str],
    ) {
        let path = crate::engines::native_log::session_log_path(session_id).expect("log path");
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("native-sessions dir");
        }
        let header = serde_json::json!({
            "version": version,
            "session_id": session_id,
            "created_at": "2026-10-10T00:00:00Z",
            "target": target,
            "permission_mode": "safe",
            "vault_path": null,
        });
        let mut lines = vec![header.to_string()];
        for (index, event) in event_json.iter().enumerate() {
            let seq = (index as u64) + 1;
            let checksum = crate::engines::native_log::checksum_event(seq, event);
            lines.push(
                serde_json::json!({
                    "seq": seq,
                    "checksum": checksum,
                    "event": serde_json::from_str::<serde_json::Value>(event).expect("event json"),
                })
                .to_string(),
            );
        }
        for extra in extra_lines {
            lines.push((*extra).to_string());
        }
        std::fs::write(&path, format!("{}\n", lines.join("\n"))).expect("write log");
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
            let opened =
                crate::engines::native_log::open_session_log("resume-history").expect("open log");
            let agent = AgentLoop::from_log(opened.events);
            let seen = std::sync::Arc::new(Mutex::new(Vec::<ModelView>::new()));
            let model = FakeModel::saying("third").share_seen(std::sync::Arc::clone(&seen));
            let chats = NativeChats::new();
            let (tx, rx) = mpsc::channel();
            chats
                .open_with_engine(
                    "resume-history".into(),
                    NativeEngine::from_parts(agent, model),
                    move |event| {
                        let _ = tx.send(event);
                    },
                )
                .expect("open");
            chats.send("resume-history", "three").expect("send");
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
            let opened = crate::engines::native_log::open_session_log("cut-off").expect("open");
            let agent = AgentLoop::from_log(opened.events);
            assert!(
                agent.events().iter().any(|event| {
                    matches!(event, DurableEvent::Cancelled { cause } if cause == "restart")
                }),
                "cut-off turn must close as cancelled restart: {:?}",
                agent.events()
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
            let opened = crate::engines::native_log::open_session_log("no-grants").expect("open");
            let agent = AgentLoop::from_log(opened.events);
            assert!(
                agent.session_grants().is_empty(),
                "D13: grants must not come back: {:?}",
                agent.session_grants()
            );
        });
    }

    #[test]
    fn reopen_warning_says_grants_do_not_carry_over() {
        with_temp_home(|_| {
            write_native_log("d13", 1, "openai/gpt-4o-mini", &two_turn_events());
            let opened = super::open_native_session_record("d13").expect("open record");
            let warning = opened.warning.expect("D13 warning");
            assert!(
                warning.to_lowercase().contains("permission")
                    && warning.to_lowercase().contains("no longer apply"),
                "D13 warning missing: {warning}"
            );
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
            let opened = crate::engines::native_log::open_session_log("pending").expect("open");
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
            let opened =
                crate::engines::native_log::open_session_log("stopped-tool").expect("open");
            let agent = AgentLoop::from_log(opened.events);
            let view = agent.model_view_for_resume();
            let messages = crate::rhizome_provider_model::openai_messages(&view, view.turn_start);
            assert!(
                messages.iter().any(|message| {
                    message.get("content").and_then(|value| value.as_str())
                        == Some("Not run: the turn stopped first.")
                }),
                "unanswered tool must get the stopped answer: {messages:?}"
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
            let opened = crate::engines::native_log::open_session_log("bad-tail").expect("open");
            assert!(
                opened.warning.is_some(),
                "damaged tail must warn: {:?}",
                opened.warning
            );
            assert!(
                opened
                    .events
                    .iter()
                    .any(|event| matches!(event, DurableEvent::Assistant { text } if text == "ok")),
                "must keep the last good line: {:?}",
                opened.events
            );
            assert!(
                opened.successor_id.is_none(),
                "tail damage stays on the same session"
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
            let original =
                crate::engines::native_log::session_log_path("middle-damage").expect("path");
            let before = std::fs::read_to_string(&original).expect("original");
            let opened =
                crate::engines::native_log::open_session_log("middle-damage").expect("open");
            assert!(opened.warning.is_some(), "middle damage must warn");
            assert!(
                !opened.events.iter().any(
                    |event| matches!(event, DurableEvent::User { text } if text == "after-damage")
                ),
                "must stop at the first invalid line: {:?}",
                opened.events
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
            let opened = crate::engines::native_log::open_session_log("future").expect("open");
            assert!(opened.read_only, "unknown version must be read-only");
            let record = super::open_native_session_record("future").expect("open record");
            assert!(record.read_only);
            let chats = NativeChats::new();
            chats.note_open(&record);
            let err = chats
                .send("future", "later")
                .expect_err("read-only session rejects send");
            assert!(
                err.to_lowercase().contains("read-only")
                    || err.to_lowercase().contains("unknown version"),
                "send error must name read-only: {err}"
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
            let opened = super::open_native_session_record("missing-target").expect("open");
            assert!(
                opened
                    .events
                    .iter()
                    .any(|event| matches!(event, DurableEvent::User { text } if text == "one")),
                "events must still come back: {:?}",
                opened.events
            );
            let error = opened.error.expect("missing target error");
            assert!(
                error.contains("anthropic/claude-opus-4")
                    || error.to_lowercase().contains("anthropic"),
                "error must name the missing target: {error}"
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
            thread::sleep(Duration::from_millis(80));
            let log_path = crate::engines::native_log::session_log_path(&id).expect("path");
            assert!(
                log_path.exists(),
                "native session must write a log in the app config folder: {log_path:?}"
            );
            assert!(
                !home.path().join(".prime").exists(),
                "native log must not be written under ~/.prime"
            );
            let log_text = std::fs::read_to_string(&log_path).expect("read log");
            assert!(
                !log_path.starts_with(home.path().join(".prime")),
                "log path leaked into Prime home: {log_path:?}"
            );
            assert!(
                log_text.contains(&id),
                "header must name the session: {log_text}"
            );
        });
    }

    #[test]
    fn delete_removes_the_log_and_the_index_entry() {
        session_transcript_index::with_temp_cache(|| {
            with_temp_home(|_| {
                let chats = NativeChats::new();
                let id = chats
                    .start_with_engine("delete me", NativeEngine::saying("ok"), |_| {})
                    .expect("start");
                thread::sleep(Duration::from_millis(80));
                let path = chats.path_for(&id).expect("native path");
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
                    "delete must drop the index entry: {:?}",
                    document.sessions
                );
            });
        });
    }

    #[test]
    fn second_window_opens_read_only() {
        with_temp_home(|_| {
            write_native_log("locked", 1, "openai/gpt-4o-mini", &two_turn_events());
            let first =
                crate::engines::native_log::try_lock_session("locked").expect("first window lock");
            let second = crate::engines::native_log::open_session_log("locked").expect("second");
            assert!(
                second.read_only,
                "second window must be read-only while the first holds the lock"
            );
            drop(first);
        });
    }
}
