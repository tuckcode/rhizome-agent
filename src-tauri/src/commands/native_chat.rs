//! Native Chat Tauri commands (harness plan step 2b).
//!
//! Chat still talks to Prime. Step 4 adds the Settings toggle.
//! These commands exist so the toggle has a backend to call.

use std::collections::HashMap;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use crate::ai_agents::AiAgentPermissionMode;
use crate::ai_models::AiModelProviderKind;
use crate::engines::{EngineEvent, NativeControl, NativeEngine};
use crate::rhizome_loop::{ApprovalReply, Model};

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

/// Stub: every target looks like an OpenAI catalog model.
pub fn resolve_native_target(target: &str) -> Result<NativeChatTarget, String> {
    Ok(NativeChatTarget::Catalog {
        provider_kind: AiModelProviderKind::OpenAi,
        provider_id: "openai".into(),
        model_id: target.to_string(),
    })
}

pub fn model_kind_for_target(target: &NativeChatTarget) -> &'static str {
    match target {
        NativeChatTarget::FreeTier => "routing",
        NativeChatTarget::Catalog { .. } => "provider",
    }
}

/// Live native chats. Each engine runs on its own thread.
#[derive(Default)]
pub struct NativeChats {
    sessions: Mutex<HashMap<String, LiveNativeChat>>,
}

#[allow(dead_code)]
struct LiveNativeChat {
    control: NativeControl,
    path: String,
    worker: Option<thread::JoinHandle<()>>,
}

impl NativeChats {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start_with_engine<M: Model + Send + 'static>(
        &self,
        prompt: &str,
        engine: NativeEngine<M>,
        _emit: impl FnMut(EngineEvent) + Send + 'static,
    ) -> Result<String, String> {
        let _ = (prompt, engine);
        Ok("unused".into())
    }

    pub fn send(&self, session_id: &str, text: &str) -> Result<(), String> {
        let _ = (session_id, text);
        Err("no session".into())
    }

    pub fn cancel(&self, session_id: &str, cause: &str) -> Result<(), String> {
        let _ = (session_id, cause);
        Err("no session".into())
    }

    pub fn reply_approval(
        &self,
        session_id: &str,
        prompt_id: &str,
        reply: ApprovalReply,
    ) -> Result<(), String> {
        let _ = (session_id, prompt_id, reply);
        Err("no session".into())
    }

    pub fn end(&self, session_id: &str) -> Result<(), String> {
        let _ = session_id;
        Err("no session".into())
    }

    pub fn settle_all(&self, bound: Duration) {
        let _ = bound;
        thread::sleep(Duration::from_millis(500));
    }

    pub fn path_for(&self, session_id: &str) -> Option<String> {
        let _ = session_id;
        None
    }
}

#[cfg(desktop)]
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
    chats: tauri::State<NativeChats>,
    request: NativeChatStartRequest,
) -> Result<String, String> {
    let _ = (chats, request);
    Err("native chat start is not wired".into())
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
pub fn native_chat_end(
    chats: tauri::State<NativeChats>,
    session_id: String,
) -> Result<(), String> {
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
    use std::sync::mpsc;
    use std::time::Instant;

    #[test]
    fn native_chat_start_emits_text_on_the_scoped_channel() {
        let chats = NativeChats::new();
        let (tx, rx) = mpsc::channel();
        let id = chats
            .start_with_engine(
                "hi",
                NativeEngine::saying("hello"),
                move |event| {
                    let _ = tx.send(event);
                },
            )
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
        let mut model = FakeModel::streaming(vec![vec!["one".into(), "two".into()]]);
        model.on_after_chunk(move |index| {
            if index == 0 {
                let _ = chunk_tx.send(());
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
        let mut seen = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if let Ok(event) = rx.recv_timeout(Duration::from_millis(20)) {
                seen.push(event);
            }
            if seen.iter().any(|event| {
                matches!(event, EngineEvent::Cancelled { cause } if cause == "quit")
            }) {
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
                "path must be Rhizome-owned: {path}"
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
            assert!(record.turns.iter().any(|turn| {
                turn.role == "assistant" && turn.text == "ok"
            }));
            let _ = IndexedTranscriptTurn {
                message_index: 0,
                role: "user".into(),
                text: String::new(),
            };
        });
    }

    #[test]
    fn native_chat_writes_nothing_under_prime_home() {
        let home = tempfile::tempdir().unwrap();
        let previous = std::env::var("HOME").ok();
        std::env::set_var("HOME", home.path());
        let chats = NativeChats::new();
        chats
            .start_with_engine("hi", NativeEngine::saying("ok"), |_| {})
            .expect("start");
        thread::sleep(Duration::from_millis(80));
        if let Some(value) = previous {
            std::env::set_var("HOME", value);
        } else {
            std::env::remove_var("HOME");
        }
        assert!(
            !home.path().join(".prime").exists(),
            "native chat must not write under ~/.prime"
        );
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
