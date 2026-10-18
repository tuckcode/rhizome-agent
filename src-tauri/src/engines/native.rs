use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crate::ai_agents::AiAgentPermissionMode;
use crate::engines::native_log::{self, SharedWriter};
use crate::rhizome_loop::{
    approval_options, require_mutate_card, AgentLoop, ApprovalReply, DurableEvent, Model,
};
use crate::rhizome_routing::ProviderAttempt;

use super::{Engine, EngineEvent};

type ApprovalTx = Arc<Mutex<Option<mpsc::Sender<(String, ApprovalReply)>>>>;

/// Default wait for a Chat approval. Tests shorten this.
const DEFAULT_APPROVAL_TIMEOUT: Duration = Duration::from_secs(10 * 60);

/// Native Rhizome loop behind the engine trait.
/// Chat does not call this yet. Phase 6 adds the toggle.
pub struct NativeEngine<M: Model> {
    agent: AgentLoop,
    model: M,
    vault_path: Option<String>,
    vault_paths: Vec<String>,
    mode: AiAgentPermissionMode,
    approval_timeout: Duration,
    approval_tx: ApprovalTx,
    live_prompt: Arc<Mutex<Option<String>>>,
    provider_tx: mpsc::Sender<ProviderAttempt>,
    provider_rx: Arc<Mutex<mpsc::Receiver<ProviderAttempt>>>,
    prompt_seq: Arc<AtomicU64>,
    events: Vec<EngineEvent>,
    session_log: Option<SharedWriter>,
    log_meta: Option<native_log::SessionHeader>,
    reasoning_notice_rx:
        Option<Arc<Mutex<mpsc::Receiver<crate::reasoning_levels::ReasoningLevelNotice>>>>,
}

#[cfg(test)]
impl NativeEngine<crate::rhizome_loop::FakeModel> {
    pub fn saying(text: impl Into<String>) -> Self {
        Self::new(crate::rhizome_loop::FakeModel::saying(text))
    }
}

impl<M: Model> NativeEngine<M> {
    pub fn from_parts(agent: AgentLoop, model: M) -> Self {
        Self::from_model(agent, model)
    }
}

impl<M: Model> NativeEngine<M> {
    pub(crate) fn with_provider_pair(
        agent: AgentLoop,
        model: M,
        provider_tx: mpsc::Sender<ProviderAttempt>,
        provider_rx: mpsc::Receiver<ProviderAttempt>,
    ) -> Self {
        let mut engine = Self::from_model(agent, model);
        engine.provider_tx = provider_tx;
        engine.provider_rx = Arc::new(Mutex::new(provider_rx));
        engine
    }
}

impl<M: Model> NativeEngine<M> {
    pub fn new(model: M) -> Self {
        Self::from_model(AgentLoop::new(), model)
    }

    fn from_model(agent: AgentLoop, model: M) -> Self {
        let (provider_tx, provider_rx) = mpsc::channel();
        Self {
            agent,
            model,
            vault_path: None,
            vault_paths: Vec::new(),
            mode: AiAgentPermissionMode::Safe,
            approval_timeout: DEFAULT_APPROVAL_TIMEOUT,
            approval_tx: Arc::new(Mutex::new(None)),
            live_prompt: Arc::new(Mutex::new(None)),
            provider_tx,
            provider_rx: Arc::new(Mutex::new(provider_rx)),
            prompt_seq: Arc::new(AtomicU64::new(0)),
            events: Vec::new(),
            session_log: None,
            log_meta: None,
            reasoning_notice_rx: None,
        }
    }

    pub fn set_reasoning_notice_rx(
        &mut self,
        rx: mpsc::Receiver<crate::reasoning_levels::ReasoningLevelNotice>,
    ) {
        self.reasoning_notice_rx = Some(Arc::new(Mutex::new(rx)));
    }

    pub fn set_log_meta(
        &mut self,
        session_id: &str,
        target: &str,
        mode: AiAgentPermissionMode,
        vault_path: Option<String>,
        vault_paths: Vec<String>,
        system_prompt: Option<String>,
    ) {
        self.log_meta = Some(native_log::SessionHeader {
            version: native_log::NATIVE_LOG_VERSION,
            session_id: session_id.to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            target: target.to_string(),
            permission_mode: native_log::permission_mode_label(mode),
            vault_path,
            vault_paths,
            system_prompt,
            reasoning_level: None,
        });
    }

    pub fn set_saved_reasoning_level(&mut self, level: Option<String>) {
        if let Some(meta) = &mut self.log_meta {
            meta.reasoning_level = level;
        }
    }

    #[cfg(test)]
    pub fn fail_next_session_log_io(&self) {
        if let Some(log) = &self.session_log {
            log.lock().expect("session log").fail_next_io();
        }
    }

    pub fn ensure_log(&mut self, session_id: &str) -> Result<(), String> {
        if self.session_log.is_some() {
            return Ok(());
        }
        let header = self
            .log_meta
            .clone()
            .unwrap_or_else(|| native_log::SessionHeader {
                version: native_log::NATIVE_LOG_VERSION,
                session_id: session_id.to_string(),
                created_at: chrono::Utc::now().to_rfc3339(),
                target: "test/fake".into(),
                permission_mode: native_log::permission_mode_label(self.mode),
                vault_path: self.vault_path.clone(),
                vault_paths: self.vault_paths.clone(),
                system_prompt: None,
                reasoning_level: None,
            });
        let path = native_log::session_log_path(session_id)?;
        let writer = if path.exists() {
            let opened = native_log::open_session_log(session_id)?;
            let live_id = opened
                .successor_id
                .clone()
                .unwrap_or_else(|| session_id.to_string());
            let disk = if live_id == session_id {
                opened.events
            } else {
                native_log::open_session_log(&live_id)?.events
            };
            native_log::persist_missing_suffix(&live_id, &disk, &self.agent.events())?;
            native_log::open_session_writer(
                &live_id,
                native_log::next_seq_after(&self.agent.events()),
            )?
        } else {
            native_log::create_session_log(&header)?
        };
        self.session_log = Some(Arc::new(Mutex::new(writer)));
        Ok(())
    }

    pub fn agent(&self) -> &AgentLoop {
        &self.agent
    }

    pub fn loop_events(&self) -> Vec<DurableEvent> {
        self.agent.events()
    }

    /// Vault for this Chat run. Applied when `start` runs.
    pub fn set_vault(&mut self, vault_path: Option<String>, vault_paths: Vec<String>) {
        self.vault_path = vault_path;
        self.vault_paths = vault_paths;
    }

    pub fn set_permission_mode(&mut self, mode: AiAgentPermissionMode) {
        self.mode = mode;
    }

    pub fn set_approval_timeout(&mut self, timeout: Duration) {
        self.approval_timeout = timeout;
    }

    /// Non-blocking reporter for `RoutingModel::with_observer`.
    /// Unbounded `send` plus a drain thread keep every report.
    pub fn provider_reporter(&self) -> impl FnMut(ProviderAttempt) + Send + 'static {
        let tx = self.provider_tx.clone();
        move |attempt| {
            let _ = tx.send(attempt);
        }
    }

    fn map_durable(event: DurableEvent) -> Option<EngineEvent> {
        match event {
            DurableEvent::Assistant { text } => Some(EngineEvent::TextDelta { text }),
            DurableEvent::ToolCall { id, name, args } => {
                Some(EngineEvent::ToolCall { id, name, args })
            }
            DurableEvent::ToolResult { id, name, output } => {
                Some(EngineEvent::ToolResult { id, name, output })
            }
            DurableEvent::ToolDenied { id, name, reason } => {
                Some(EngineEvent::ToolDenied { id, name, reason })
            }
            DurableEvent::ModelFailed { message } => Some(EngineEvent::error(message, true)),
            DurableEvent::TurnEnd => Some(EngineEvent::TurnEnd),
            DurableEvent::Cancelled { cause } => Some(EngineEvent::Cancelled { cause }),
            DurableEvent::User { .. } => None,
        }
    }
}

impl<M: Model> Engine for NativeEngine<M> {
    fn kind(&self) -> &'static str {
        "native"
    }

    fn start(
        &mut self,
        prompt: &str,
        sink: Box<dyn FnMut(EngineEvent) + Send>,
    ) -> Result<(), String> {
        if let Some(meta) = &self.log_meta {
            let send_anyway = crate::chat_images::noted_send_anyway(&meta.session_id);
            crate::chat_images::arm_image_turn(&meta.session_id, send_anyway);
            if let Ok(images) = crate::chat_images::read_turns(&meta.session_id) {
                self.model.set_chat_images(images);
            }
            crate::chat_images::clear_armed_image_turn();
        }
        self.events.clear();
        let collected = Arc::new(Mutex::new(Vec::new()));
        let emit_live = Arc::new(Mutex::new(sink));
        let emit = {
            let emit_live = Arc::clone(&emit_live);
            let collected = Arc::clone(&collected);
            move |event: EngineEvent| {
                collected.lock().expect("engine events").push(event.clone());
                (emit_live.lock().expect("engine sink"))(event);
            }
        };

        self.agent
            .set_vault(self.vault_path.clone(), self.vault_paths.clone());
        self.agent.set_permission_mode(self.mode);

        let live_emit = emit.clone();
        let session_log = self.session_log.clone();
        self.agent.set_durable_listener(move |event| {
            if let Some(log) = &session_log {
                if let Ok(mut writer) = log.lock() {
                    match native_log::append_or_roll(&mut writer, &event) {
                        Ok(None) => {}
                        Ok(Some(message)) => live_emit(EngineEvent::error(message, false)),
                        Err(message) => live_emit(EngineEvent::error(message, false)),
                    }
                }
            }
            if let Some(mapped) = Self::map_durable(event) {
                live_emit(mapped);
            }
        });

        let stop_drain = Arc::new(AtomicBool::new(false));
        let drain_flag = Arc::clone(&stop_drain);
        let drain_rx = Arc::clone(&self.provider_rx);
        let notice_rx = self.reasoning_notice_rx.clone();
        let drain_emit = emit.clone();
        let notice_emit = drain_emit.clone();
        let drain = thread::spawn(move || {
            let emit_notice = move |notice: crate::reasoning_levels::ReasoningLevelNotice| {
                notice_emit(EngineEvent::ReasoningLevelNotice {
                    code: notice.code,
                    from: notice.from,
                    to: notice.to,
                });
            };
            loop {
                if drain_flag.load(Ordering::SeqCst) {
                    break;
                }
                if let Some(rx) = &notice_rx {
                    while let Ok(notice) = rx.lock().expect("reasoning notice").try_recv() {
                        emit_notice(notice);
                    }
                }
                let attempt = drain_rx
                    .lock()
                    .expect("provider rx")
                    .recv_timeout(Duration::from_millis(50));
                match attempt {
                    Ok(attempt) => drain_emit(EngineEvent::Provider(attempt)),
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
            let rx = drain_rx.lock().expect("provider rx");
            while let Ok(attempt) = rx.try_recv() {
                drain_emit(EngineEvent::Provider(attempt));
            }
            if let Some(rx) = &notice_rx {
                while let Ok(notice) = rx.lock().expect("reasoning notice").try_recv() {
                    emit_notice(notice);
                }
            }
        });

        let (approval_tx, approval_rx) = mpsc::channel();
        *self.approval_tx.lock().expect("approval tx") = Some(approval_tx);
        let approval_rx = Arc::new(Mutex::new(approval_rx));
        let live_prompt = Arc::clone(&self.live_prompt);
        let mode = self.mode;
        let timeout = self.approval_timeout;
        let prompt_seq = Arc::clone(&self.prompt_seq);
        let emit_for_wait = emit.clone();
        let wait_prompt = Arc::clone(&live_prompt);
        self.agent
            .set_approval_waiter_preview(move |name, args, prepared, call_id| {
                let id = format!("prompt_{}", prompt_seq.fetch_add(1, Ordering::SeqCst) + 1);
                *wait_prompt.lock().expect("live prompt") = Some(id.clone());
                if matches!(name, "edit_file" | "write_file") {
                    match require_mutate_card(name, prepared.cloned().map(Ok)) {
                        Ok(card) => {
                            emit_for_wait(EngineEvent::ApprovalRequested {
                                prompt_id: id.clone(),
                                tool: name.to_string(),
                                args: args.to_string(),
                                options: approval_options(mode, name),
                                path: Some(card.path),
                                preview: Some(card.diff),
                                created: Some(card.created),
                                overwrite: Some(card.overwrite),
                                notes: if card.notes.is_empty() {
                                    None
                                } else {
                                    Some(card.notes)
                                },
                                capped: if card.capped { Some(true) } else { None },
                                call_id: call_id.to_string(),
                            });
                        }
                        Err(_) => {
                            release_live_prompt(&wait_prompt, &id);
                            return ApprovalReply::Deny;
                        }
                    }
                } else {
                    emit_for_wait(EngineEvent::ApprovalRequested {
                        prompt_id: id.clone(),
                        tool: name.to_string(),
                        args: args.to_string(),
                        options: approval_options(mode, name),
                        path: None,
                        preview: None,
                        created: None,
                        overwrite: None,
                        notes: None,
                        capped: None,
                        call_id: call_id.to_string(),
                    });
                }
                let deadline = Instant::now() + timeout;
                let reply = loop {
                    let left = deadline.saturating_duration_since(Instant::now());
                    if left.is_zero() {
                        break ApprovalReply::Cancelled;
                    }
                    match approval_rx.lock().expect("approval rx").recv_timeout(left) {
                        Ok((reply_id, reply)) if reply_id == id => break reply,
                        Ok(_) => {}
                        Err(RecvTimeoutError::Timeout) | Err(RecvTimeoutError::Disconnected) => {
                            break ApprovalReply::Cancelled;
                        }
                    }
                };
                release_live_prompt(&wait_prompt, &id);
                reply
            });
        let dismiss_prompt = Arc::clone(&live_prompt);
        let emit_dismiss = emit;
        self.agent.set_approval_dismiss(move || {
            if let Some(prompt_id) = dismiss_prompt.lock().expect("live prompt").take() {
                emit_dismiss(EngineEvent::ApprovalDismissed { prompt_id });
            }
        });

        self.agent.submit(prompt);
        self.agent.run_until_idle(&mut self.model);
        stop_drain.store(true, Ordering::SeqCst);
        let _ = drain.join();
        self.agent.clear_durable_listener();
        *self.approval_tx.lock().expect("approval tx") = None;
        self.events = collected.lock().expect("engine events").clone();
        Ok(())
    }

    fn stop(&mut self) {
        self.settle_on_quit();
    }

    fn events(&self) -> Vec<EngineEvent> {
        self.events.clone()
    }

    fn steer(&mut self, text: &str) {
        self.agent.submit(text);
    }

    fn cancel(&mut self, cause: &str) {
        self.agent.cancel(cause);
    }

    fn reply_approval(&mut self, prompt_id: &str, reply: ApprovalReply) {
        enqueue_approval(&self.approval_tx, &self.live_prompt, prompt_id, reply);
    }

    fn settle_on_quit(&mut self) {
        self.agent.stop_and_drain("quit");
    }
}

/// Cloneable control plane so Chat can steer while `start` blocks.
#[derive(Clone)]
pub struct NativeControl {
    agent: AgentLoop,
    approval_tx: ApprovalTx,
    live_prompt: Arc<Mutex<Option<String>>>,
}

impl<M: Model> NativeEngine<M> {
    pub fn control(&self) -> NativeControl {
        NativeControl {
            agent: self.agent.clone(),
            approval_tx: Arc::clone(&self.approval_tx),
            live_prompt: Arc::clone(&self.live_prompt),
        }
    }
}

impl NativeControl {
    pub fn steer(&self, text: &str) {
        self.agent.submit(text);
    }

    pub fn cancel(&self, cause: &str) {
        self.agent.cancel(cause);
    }

    pub fn reply_approval(&self, prompt_id: &str, reply: ApprovalReply) {
        enqueue_approval(&self.approval_tx, &self.live_prompt, prompt_id, reply);
    }

    pub fn settle_on_quit(&self) {
        self.agent.stop_and_drain("quit");
    }
}

fn enqueue_approval(
    approval_tx: &ApprovalTx,
    live_prompt: &Arc<Mutex<Option<String>>>,
    prompt_id: &str,
    reply: ApprovalReply,
) {
    let live = live_prompt.lock().expect("live prompt").clone();
    if live.as_deref() != Some(prompt_id) {
        return;
    }
    if let Some(tx) = approval_tx.lock().expect("approval tx").as_ref() {
        let _ = tx.send((prompt_id.to_string(), reply));
    }
}

/// Drop the live id only when it is still this waiter's prompt.
/// An abandoned waiter must not clear a newer turn's id.
fn release_live_prompt(live_prompt: &Arc<Mutex<Option<String>>>, prompt_id: &str) {
    let mut live = live_prompt.lock().expect("live prompt");
    if live.as_deref() == Some(prompt_id) {
        *live = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model_events::{ModelError, ModelErrorKind};
    use crate::rhizome_loop::{AgentLoop, FakeModel, ScriptPart};
    use std::panic::{catch_unwind, AssertUnwindSafe};

    fn with_temp_home<T>(body: impl FnOnce() -> T) -> T {
        let _lock = crate::app_config::TEST_CONFIG_ENV
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let home = tempfile::tempdir().unwrap();
        let previous_home = std::env::var("HOME").ok();
        let previous_xdg = std::env::var("XDG_CONFIG_HOME").ok();
        std::env::set_var("HOME", home.path());
        std::env::remove_var("XDG_CONFIG_HOME");
        let result = catch_unwind(AssertUnwindSafe(body));
        if let Some(value) = previous_home {
            std::env::set_var("HOME", value);
        } else {
            std::env::remove_var("HOME");
        }
        if let Some(value) = previous_xdg {
            std::env::set_var("XDG_CONFIG_HOME", value);
        } else {
            std::env::remove_var("XDG_CONFIG_HOME");
        }
        match result {
            Ok(value) => value,
            Err(panic) => std::panic::resume_unwind(panic),
        }
    }

    #[test]
    fn log_save_failure_mid_turn_is_non_fatal_and_the_turn_completes() {
        with_temp_home(|| {
            let mut engine = NativeEngine::saying("hello");
            let session_id = uuid::Uuid::new_v4().to_string();
            engine.ensure_log(&session_id).expect("log");
            engine.fail_next_session_log_io();
            engine.start("hi", Box::new(|_| {})).expect("start");
            let events = engine.events();
            assert!(
                events.iter().any(|event| {
                    matches!(
                        event,
                        EngineEvent::Error {
                            fatal: false,
                            message
                        } if message == native_log::LOG_SAVE_NOTICE
                    )
                }),
                "log-save failure must be a non-fatal error: {events:?}"
            );
            assert!(
                events.iter().any(
                    |event| matches!(event, EngineEvent::TextDelta { text } if text == "hello")
                ),
                "the reply must continue after a log-save failure: {events:?}"
            );
            assert!(
                events
                    .iter()
                    .any(|event| matches!(event, EngineEvent::TurnEnd)),
                "the turn must still complete: {events:?}"
            );
        });
    }

    #[test]
    fn model_failure_emits_a_fatal_error_and_ends_the_turn() {
        let mut engine = NativeEngine::from_parts(
            AgentLoop::new(),
            FakeModel::script(vec![vec![ScriptPart::Fail(ModelError {
                kind: ModelErrorKind::Unavailable,
                status: Some(503),
                message: "down".into(),
            })]]),
        );
        engine.start("hi", Box::new(|_| {})).expect("start");
        let events = engine.events();
        assert!(
            events.iter().any(|event| {
                matches!(
                    event,
                    EngineEvent::Error {
                        fatal: true,
                        message
                    } if message == "down"
                )
            }),
            "a provider failure must be fatal: {events:?}"
        );
        assert!(
            events
                .iter()
                .any(|event| matches!(event, EngineEvent::TurnEnd)),
            "a fatal model error must end the turn: {events:?}"
        );
    }

    #[test]
    fn release_live_prompt_keeps_a_newer_id() {
        let live = Arc::new(Mutex::new(Some("prompt_2".to_string())));
        release_live_prompt(&live, "prompt_1");
        assert_eq!(
            live.lock().expect("live prompt").as_deref(),
            Some("prompt_2")
        );
    }

    #[test]
    fn release_live_prompt_clears_its_own_id() {
        let live = Arc::new(Mutex::new(Some("prompt_1".to_string())));
        release_live_prompt(&live, "prompt_1");
        assert_eq!(live.lock().expect("live prompt").as_deref(), None);
    }
}
