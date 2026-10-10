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
}

struct LiveNativeChat {
    control: NativeControl,
    ops: mpsc::Sender<ChatOp>,
    worker: Option<thread::JoinHandle<()>>,
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
            },
        );
        Ok(id)
    }

    pub fn send(&self, session_id: &str, text: &str) -> Result<(), String> {
        let sessions = self.sessions.lock().expect("native chats");
        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("unknown native session {session_id}"))?;
        session
            .ops
            .send(ChatOp::Turn(text.to_string()))
            .map_err(|_| "native chat worker closed".to_string())?;
        Ok(())
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
            })?;
            let mut engine = NativeEngine::with_provider_pair(AgentLoop::new(), model, tx, rx);
            engine.set_vault(vault_path, vault_paths);
            engine.set_permission_mode(mode);
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
            engine.set_vault(vault_path, vault_paths);
            engine.set_permission_mode(mode);
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

pub fn settle_native_chats_on_quit(chats: &NativeChats) {
    chats.settle_all(NATIVE_QUIT_BOUND);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engines::{NativeEngine, PrimeEngine};
    use crate::rhizome_loop::{AgentLoop, FakeModel};
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
}
