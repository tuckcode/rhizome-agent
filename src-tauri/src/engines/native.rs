use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crate::ai_agents::AiAgentPermissionMode;
use crate::rhizome_loop::{approval_options, AgentLoop, ApprovalReply, DurableEvent, Model};
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
}

#[cfg(test)]
impl NativeEngine<crate::rhizome_loop::FakeModel> {
    pub fn saying(text: impl Into<String>) -> Self {
        Self::new(crate::rhizome_loop::FakeModel::saying(text))
    }
}

#[cfg(test)]
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
        }
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
            DurableEvent::ModelFailed { message } => Some(EngineEvent::Error { message }),
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
        self.agent.set_durable_listener(move |event| {
            if let Some(mapped) = Self::map_durable(event) {
                live_emit(mapped);
            }
        });

        let stop_drain = Arc::new(AtomicBool::new(false));
        let drain_flag = Arc::clone(&stop_drain);
        let drain_rx = Arc::clone(&self.provider_rx);
        let drain_emit = emit.clone();
        let drain = thread::spawn(move || {
            loop {
                if drain_flag.load(Ordering::SeqCst) {
                    break;
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
        self.agent.set_approval_waiter(move |name, args| {
            let id = format!("prompt_{}", prompt_seq.fetch_add(1, Ordering::SeqCst) + 1);
            *wait_prompt.lock().expect("live prompt") = Some(id.clone());
            emit_for_wait(EngineEvent::ApprovalRequested {
                prompt_id: id.clone(),
                tool: name.to_string(),
                args: args.to_string(),
                options: approval_options(mode, name),
            });
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
            *wait_prompt.lock().expect("live prompt") = None;
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
