use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use tokio::sync::{oneshot, Notify};

use crate::ai_agents::AiAgentPermissionMode;
use crate::model_events::ModelEvent;

use super::model::Model;
use super::policy::{self, Ruling};
use super::tools;
use super::types::{DurableEvent, HistoryItem, ModelView, ToolCall, UNANSWERED_TOOL_OUTPUT};

/// Reply from a human approval wait. `Cancelled` is timeout or no UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalReply {
    AllowOnce,
    AllowSession,
    Deny,
    Cancelled,
}

/// Default model rounds in one turn. A runaway tool loop stops here.
pub const DEFAULT_STEP_CAP: usize = 8;

type ApprovalWaiter =
    Arc<dyn Fn(&str, &str, Option<&tools::ApprovalPreview>, &str) -> ApprovalReply + Send + Sync>;
type ApprovalDismiss = Arc<dyn Fn() + Send + Sync>;
type AfterToolHook = Box<dyn FnMut(&str, &str) + Send>;
type DurableHook = Arc<dyn Fn(DurableEvent) + Send + Sync>;

struct Shared {
    inbox: VecDeque<String>,
    log: Vec<DurableEvent>,
    history: Vec<HistoryItem>,
    turn_start: usize,
    step_active: bool,
    cancel_cause: Option<String>,
    mode: AiAgentPermissionMode,
    /// Name and args already consumed by an allow-once grant.
    grants: Vec<(String, String)>,
    /// Session grants. Echo matches by name. Mutate matches the
    /// path. Bash has no session grant. Cleared by `end_session`
    /// and `set_vault`.
    session_grants: Vec<(String, String)>,
    /// Hash of the file as it was when the approval card opened,
    /// keyed by tool-call id.
    pending_stamp: Option<(String, String)>,
    /// Names a test adds on top of `policy::offered_tools`. Production
    /// modes do not use this list.
    extra_offered: Vec<String>,
    /// Vault roots for this run. Set once when the engine starts.
    /// Not part of `ModelView`.
    vault_path: Option<String>,
    vault_paths: Vec<String>,
    /// Shared and not mutexed for the whole wait. A cancelled prompt
    /// must not block the next ask.
    waiter: Option<ApprovalWaiter>,
    /// Host closes a cancelled approval UI. Invoked once per live prompt.
    dismiss: Option<ApprovalDismiss>,
    /// Bumped for each wait. A late reply from a dismissed prompt
    /// does not run the tool.
    prompt_gen: u64,
    live_prompt: Option<u64>,
    stopped: bool,
    step_cap: usize,
    after_tool: Option<AfterToolHook>,
    /// Live sink for the native engine. Fired after each log push.
    on_durable: Option<DurableHook>,
}

/// Clears `step_active` when the step returns, including on cancel.
struct StepGuard<'a> {
    shared: &'a Mutex<Shared>,
}

impl<'a> StepGuard<'a> {
    fn enter(shared: &'a Mutex<Shared>) -> Self {
        shared.lock().expect("rhizome loop").step_active = true;
        Self { shared }
    }
}

impl Drop for StepGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut shared) = self.shared.lock() {
            shared.step_active = false;
        }
    }
}

struct OpenCall {
    id: String,
    name: String,
    args: String,
    ended: bool,
}

/// One inbox and one driver. A follow-up waits in the inbox.
#[derive(Clone)]
pub struct AgentLoop {
    shared: Arc<Mutex<Shared>>,
    /// Wakes an approval wait when cancel or quit lands. The wait itself
    /// does not block a tokio worker.
    cancel_notify: Arc<Notify>,
}

impl Default for AgentLoop {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentLoop {
    /// Rebuild history from a durable log. Grants and pending approvals
    /// are not restored. An unfinished last turn is closed as
    /// `Cancelled { cause: "restart" }`. Unpaired tool calls get a
    /// synthetic result so OpenAI-style providers see a matching
    /// `role: "tool"` message. Unpaired results and denials are dropped.
    pub fn from_log(events: Vec<DurableEvent>) -> Self {
        let agent = Self::new();
        let mut history = Vec::new();
        let mut log = Vec::new();
        let mut last_assistant: Option<usize> = None;
        let mut open_calls: Vec<(String, String)> = Vec::new();
        let mut turn_closed = true;

        for event in events {
            match &event {
                DurableEvent::User { text } => {
                    close_open_tool_calls(&mut open_calls, &mut history, &mut log);
                    log.push(event.clone());
                    history.push(HistoryItem::User { text: text.clone() });
                    last_assistant = None;
                    turn_closed = false;
                }
                DurableEvent::Assistant { text } => {
                    close_open_tool_calls(&mut open_calls, &mut history, &mut log);
                    log.push(event.clone());
                    history.push(HistoryItem::Assistant {
                        text: text.clone(),
                        tool_calls: Vec::new(),
                    });
                    last_assistant = Some(history.len() - 1);
                    turn_closed = false;
                }
                DurableEvent::ToolCall { id, name, args } => {
                    log.push(event.clone());
                    let call = ToolCall {
                        id: id.clone(),
                        name: name.clone(),
                        args: args.clone(),
                    };
                    if let Some(index) = last_assistant {
                        if let HistoryItem::Assistant { tool_calls, .. } = &mut history[index] {
                            tool_calls.push(call);
                        }
                    } else {
                        history.push(HistoryItem::Assistant {
                            text: String::new(),
                            tool_calls: vec![call],
                        });
                        last_assistant = Some(history.len() - 1);
                    }
                    open_calls.push((id.clone(), name.clone()));
                    turn_closed = false;
                }
                DurableEvent::ToolResult { id, name, output } => {
                    if !take_open_call(&mut open_calls, id) {
                        continue;
                    }
                    log.push(event.clone());
                    history.push(HistoryItem::ToolResult {
                        id: id.clone(),
                        name: name.clone(),
                        output: output.clone(),
                    });
                    turn_closed = false;
                }
                DurableEvent::ToolDenied { id, name, reason } => {
                    if !take_open_call(&mut open_calls, id) {
                        continue;
                    }
                    log.push(event.clone());
                    history.push(HistoryItem::ToolDenied {
                        id: id.clone(),
                        name: name.clone(),
                        reason: reason.clone(),
                    });
                    turn_closed = false;
                }
                DurableEvent::ModelFailed { .. } => {
                    log.push(event.clone());
                    turn_closed = false;
                }
                DurableEvent::TurnEnd | DurableEvent::Cancelled { .. } => {
                    close_open_tool_calls(&mut open_calls, &mut history, &mut log);
                    log.push(event.clone());
                    turn_closed = true;
                    last_assistant = None;
                }
            }
        }

        close_open_tool_calls(&mut open_calls, &mut history, &mut log);
        if !turn_closed {
            log.push(DurableEvent::Cancelled {
                cause: "restart".into(),
            });
        }

        {
            let mut shared = agent.lock();
            shared.log = log;
            shared.history = history;
            shared.turn_start = shared.history.len();
            shared.grants.clear();
            shared.session_grants.clear();
            shared.live_prompt = None;
        }
        agent
    }

    pub fn session_grants(&self) -> Vec<(String, String)> {
        self.lock().session_grants.clone()
    }

    pub fn has_live_approval(&self) -> bool {
        self.lock().live_prompt.is_some()
    }

    /// Model view of the restored history. Used to check unanswered tools.
    pub fn model_view_for_resume(&self) -> ModelView {
        self.model_view("")
    }

    pub fn new() -> Self {
        Self {
            shared: Arc::new(Mutex::new(Shared {
                inbox: VecDeque::new(),
                log: Vec::new(),
                history: Vec::new(),
                turn_start: 0,
                step_active: false,
                cancel_cause: None,
                mode: AiAgentPermissionMode::Safe,
                grants: Vec::new(),
                session_grants: Vec::new(),
                extra_offered: Vec::new(),
                pending_stamp: None,
                vault_path: None,
                vault_paths: Vec::new(),
                waiter: None,
                dismiss: None,
                prompt_gen: 0,
                live_prompt: None,
                stopped: false,
                step_cap: DEFAULT_STEP_CAP,
                after_tool: None,
                on_durable: None,
            })),
            cancel_notify: Arc::new(Notify::new()),
        }
    }

    pub fn submit(&self, text: impl Into<String>) {
        self.lock().inbox.push_back(text.into());
    }

    /// Sets a cancel cause while a step is running.
    /// A cancel while idle does not stick.
    pub fn cancel(&self, cause: impl Into<String>) {
        let mut shared = self.lock();
        if !shared.step_active {
            return;
        }
        if shared.cancel_cause.is_none() {
            shared.cancel_cause = Some(cause.into());
        }
        drop(shared);
        self.cancel_notify.notify_waiters();
        self.dismiss_live_prompt();
    }

    pub fn set_permission_mode(&self, mode: AiAgentPermissionMode) {
        self.lock().mode = mode;
    }

    /// Vault for this run. `create_note` uses it; it is not on `ModelView`.
    /// Changing vaults drops session grants so a path in the old vault
    /// cannot cover a file in the new one.
    pub fn set_vault(&self, vault_path: Option<String>, vault_paths: Vec<String>) {
        let mut shared = self.lock();
        let changed = shared.vault_path != vault_path || shared.vault_paths != vault_paths;
        shared.vault_path = vault_path;
        shared.vault_paths = vault_paths;
        if changed {
            shared.session_grants.clear();
            shared.pending_stamp = None;
        }
    }

    pub fn set_approval_waiter(
        &self,
        waiter: impl Fn(&str, &str) -> ApprovalReply + Send + Sync + 'static,
    ) {
        self.set_approval_waiter_preview(move |name, args, _preview, _call_id| waiter(name, args));
    }

    pub fn set_approval_waiter_preview(
        &self,
        waiter: impl Fn(&str, &str, Option<&tools::ApprovalPreview>, &str) -> ApprovalReply
            + Send
            + Sync
            + 'static,
    ) {
        self.lock().waiter = Some(Arc::new(waiter));
    }

    /// Called once when cancel or quit ends a live approval. The host
    /// should drop the prompt so a later turn cannot accept it.
    pub fn set_approval_dismiss(&self, dismiss: impl Fn() + Send + Sync + 'static) {
        self.lock().dismiss = Some(Arc::new(dismiss));
    }

    /// Records a session grant. The waiter uses this when the human
    /// picks allow-for-this-session. Tests may call it directly.
    pub fn grant_for_session(&self, name: impl Into<String>, args: impl Into<String>) {
        self.lock().session_grants.push((name.into(), args.into()));
    }

    /// Drops session grants. Allow-once spends stay until they are used.
    pub fn end_session(&self) {
        self.lock().session_grants.clear();
    }

    /// Quit path: cancel an in-flight turn, drop the inbox, and refuse
    /// later submits. Distinct from `cancel`, which ends one turn only.
    pub fn stop_and_drain(&self, cause: impl Into<String>) {
        let mut shared = self.lock();
        shared.stopped = true;
        shared.inbox.clear();
        if shared.step_active && shared.cancel_cause.is_none() {
            shared.cancel_cause = Some(cause.into());
        }
        drop(shared);
        self.cancel_notify.notify_waiters();
        self.dismiss_live_prompt();
    }

    pub fn set_step_cap(&self, cap: usize) {
        self.lock().step_cap = cap;
    }

    pub fn on_after_tool_for_test(&self, hook: impl FnMut(&str, &str) + Send + 'static) {
        self.lock().after_tool = Some(Box::new(hook));
    }

    /// Called after each durable log push. The native engine uses this
    /// so Chat sees text and tools while the turn is still running.
    pub fn set_durable_listener(&self, hook: impl Fn(DurableEvent) + Send + Sync + 'static) {
        self.lock().on_durable = Some(Arc::new(hook));
    }

    pub fn clear_durable_listener(&self) {
        self.lock().on_durable = None;
    }

    fn push_log(&self, event: DurableEvent) {
        let hook = {
            let mut shared = self.lock();
            shared.log.push(event.clone());
            shared.on_durable.clone()
        };
        if let Some(hook) = hook {
            hook(event);
        }
    }

    /// Adds a name to this loop's offered set. Production `offered_tools`
    /// comes from the tool registry: Safe = echo, read-only file tools,
    /// edit_file, write_file, and create_note. Power User also offers bash.
    pub fn offer_extra_tool_for_test(&self, name: impl Into<String>) {
        self.lock().extra_offered.push(name.into());
    }

    /// True when the inbox is empty and no step is running.
    pub fn when_idle(&self) -> bool {
        let shared = self.lock();
        !shared.step_active && shared.inbox.is_empty()
    }

    pub fn events(&self) -> Vec<DurableEvent> {
        self.lock().log.clone()
    }

    /// Drain the inbox. One turn at a time. A cancel ends that turn only.
    /// `stop_and_drain` ends the agent: no further inbox item runs.
    pub fn run_until_idle(&self, model: &mut impl Model) {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("rhizome loop runtime");
        runtime.block_on(self.run_until_idle_async(model));
    }

    /// Async form. Cancel is checked between events and between tools.
    /// Stopping the read drops unread model events; the model does not
    /// emit `Cancelled`.
    pub async fn run_until_idle_async(&self, model: &mut impl Model) {
        loop {
            let admitted = {
                let mut shared = self.lock();
                if shared.stopped {
                    return;
                }
                shared.inbox.pop_front()
            };
            let Some(admitted) = admitted else {
                return;
            };
            self.drive_turn(model, admitted).await;
        }
    }

    async fn drive_turn(&self, model: &mut impl Model, admitted: String) {
        {
            let mut shared = self.lock();
            shared.cancel_cause = None;
        }
        let _step = StepGuard::enter(&self.shared);
        let history_mark = {
            let mut shared = self.lock();
            let mark = shared.history.len();
            shared.turn_start = mark;
            mark
        };
        self.push_log(DurableEvent::User {
            text: admitted.clone(),
        });

        let cap = self.lock().step_cap;
        let mut steps = 0;
        loop {
            if self.is_cancelled() {
                break;
            }
            if steps >= cap {
                break;
            }
            let view = self.model_view(&admitted);
            let Some(accepted) = self.take_round(model, &view) else {
                break;
            };
            steps += 1;
            tokio::task::yield_now().await;
            if !self.apply_round(accepted).await {
                break;
            }
        }

        let cause = {
            let mut shared = self.lock();
            let cause = shared.cancel_cause.take();
            shared
                .history
                .insert(history_mark, HistoryItem::User { text: admitted });
            cause
        };
        if let Some(cause) = cause {
            self.push_log(DurableEvent::Cancelled { cause });
        } else {
            self.push_log(DurableEvent::TurnEnd);
        }
    }

    fn take_round(&self, model: &mut impl Model, view: &ModelView) -> Option<Vec<ModelEvent>> {
        let mut accepted = Vec::new();
        let shared = Arc::clone(&self.shared);
        let had_round = model.complete(view, &mut |event| {
            if shared.lock().expect("rhizome loop").cancel_cause.is_some() {
                return false;
            }
            let terminal = event.is_terminal();
            accepted.push(event);
            !terminal && shared.lock().expect("rhizome loop").cancel_cause.is_none()
        });
        had_round.then_some(accepted)
    }

    /// Returns true when another model round should run (tools ran).
    async fn apply_round(&self, events: Vec<ModelEvent>) -> bool {
        let mut text = String::new();
        let mut calls: Vec<OpenCall> = Vec::new();
        let mut failed: Option<String> = None;
        // Apply every event the loop already accepted. Cancel stops
        // the next read and later tools, not text that already arrived.
        for event in events {
            match event {
                ModelEvent::TextDelta { text: delta } => text.push_str(&delta),
                ModelEvent::ToolCallStart { id, name } => calls.push(OpenCall {
                    id,
                    name,
                    args: String::new(),
                    ended: false,
                }),
                ModelEvent::ToolCallArgsDelta { id, delta } => {
                    if let Some(call) = calls.iter_mut().rev().find(|call| call.id == id) {
                        call.args.push_str(&delta);
                    }
                }
                ModelEvent::ToolCallEnd { id } => {
                    if let Some(call) = calls.iter_mut().rev().find(|call| call.id == id) {
                        call.ended = true;
                    }
                }
                ModelEvent::Finish { .. } => {}
                ModelEvent::Error(error) => failed = Some(error.message),
            }
        }

        let completed: Vec<OpenCall> = calls.into_iter().filter(|call| call.ended).collect();
        let tool_calls: Vec<ToolCall> = completed
            .iter()
            .map(|call| ToolCall {
                id: call.id.clone(),
                name: call.name.clone(),
                args: call.args.clone(),
            })
            .collect();

        if !text.is_empty() || !tool_calls.is_empty() {
            self.lock().history.push(HistoryItem::Assistant {
                text: text.clone(),
                tool_calls,
            });
        }
        if !text.is_empty() {
            self.push_log(DurableEvent::Assistant { text: text.clone() });
        }

        if let Some(message) = failed {
            self.push_log(DurableEvent::ModelFailed { message });
            return false;
        }
        if self.is_cancelled() || completed.is_empty() {
            return false;
        }

        for call in completed {
            if self.is_cancelled() {
                return false;
            }
            self.push_log(DurableEvent::ToolCall {
                id: call.id.clone(),
                name: call.name.clone(),
                args: call.args.clone(),
            });
            self.dispatch_tool(&call.id, &call.name, &call.args).await;
        }
        !self.is_cancelled()
    }

    fn model_view(&self, admitted: &str) -> ModelView {
        let shared = self.lock();
        ModelView {
            admitted: admitted.to_string(),
            history: shared.history.clone(),
            turn_start: shared.turn_start,
            offered_tools: offered_names(&shared),
        }
    }

    fn is_cancelled(&self) -> bool {
        self.lock().cancel_cause.is_some()
    }

    async fn dispatch_tool(&self, id: &str, name: &str, args: &str) {
        if let Err(reason) = parsed_tool_args(args) {
            self.record_denial(id, name, reason);
            self.fire_after_tool(name, args);
            return;
        }
        let (mode, offered) = {
            let shared = self.lock();
            (shared.mode, offered_names(&shared))
        };
        if !offered.iter().any(|tool| tool == name) {
            self.record_denial(id, name, "not offered".into());
            self.fire_after_tool(name, args);
            return;
        }
        if self.session_allows(name, args) {
            self.record_run(id, name, args, false).await;
            self.fire_after_tool(name, args);
            return;
        }
        let grant_spent = self
            .lock()
            .grants
            .iter()
            .any(|(spent_name, spent_args)| spent_name == name && spent_args == args);
        match policy::rule_tool(mode, name, grant_spent) {
            Ruling::Run { spend_grant } => self.record_run(id, name, args, spend_grant).await,
            Ruling::Deny { reason } => self.record_denial(id, name, reason),
            Ruling::Ask => self.ask_then_finish(id, name, args).await,
        }
        self.fire_after_tool(name, args);
    }

    fn session_allows(&self, name: &str, args: &str) -> bool {
        let shared = self.lock();
        shared
            .session_grants
            .iter()
            .any(|(granted_name, granted_args)| {
                granted_name == name
                    && policy::session_matches_in(
                        name,
                        granted_args,
                        args,
                        shared.vault_path.as_deref(),
                        &shared.vault_paths,
                    )
            })
    }

    fn fire_after_tool(&self, name: &str, args: &str) {
        let mut hook = self.lock().after_tool.take();
        if let Some(callback) = hook.as_mut() {
            callback(name, args);
        }
        self.lock().after_tool = hook;
    }

    async fn ask_then_finish(&self, id: &str, name: &str, args: &str) {
        if self.is_cancelled() {
            self.record_denial(id, name, "cancelled".into());
            return;
        }
        let policy = tools::lookup(name).map(|tool| tool.policy);
        let is_bash = matches!(policy, Some(tools::ToolPolicy::Bash));
        let shown_args;
        let prepared = if matches!(policy, Some(tools::ToolPolicy::Mutate)) {
            let (vault_path, vault_paths) = {
                let shared = self.lock();
                (shared.vault_path.clone(), shared.vault_paths.clone())
            };
            match tools::mutate_prepare(name, args, vault_path.as_deref(), &vault_paths) {
                Ok(preview) => {
                    self.lock().pending_stamp =
                        Some((id.to_string(), preview.content_hash.clone()));
                    shown_args = args.to_string();
                    Some(preview)
                }
                Err(error) => {
                    self.clear_pending_stamp(id);
                    self.record_tool_output(id, name, error);
                    return;
                }
            }
        } else if is_bash {
            match tools::bash_command(args) {
                Ok(command) => {
                    let stamp = tools::bash_stamp(id, &command);
                    self.lock().pending_stamp = Some((id.to_string(), stamp));
                    shown_args = command;
                    None
                }
                Err(error) => {
                    self.clear_pending_stamp(id);
                    self.record_tool_output(id, name, error);
                    return;
                }
            }
        } else {
            shown_args = args.to_string();
            None
        };
        let reply = self
            .wait_for_approval(name, &shown_args, prepared.as_ref(), id)
            .await;
        // Cancel or quit can land while the waiter is blocked, or just
        // after it returns. Either way the tool does not run.
        if self.is_cancelled() {
            self.record_denial(id, name, "cancelled".into());
            return;
        }
        match reply {
            ApprovalReply::AllowOnce => {
                self.record_run(id, name, args, spend_allow_once(name))
                    .await
            }
            ApprovalReply::AllowSession => {
                if name != "create_note" && !is_bash {
                    self.grant_for_session(name, args);
                }
                self.record_run(id, name, args, false).await;
            }
            ApprovalReply::Deny | ApprovalReply::Cancelled => {
                self.record_denial(id, name, "approval cancelled".into());
            }
        }
    }

    /// The waiter runs on its own thread. This task awaits that reply,
    /// or cancel, without blocking a tokio worker. The tool run stays
    /// on `spawn_blocking`.
    async fn wait_for_approval(
        &self,
        name: &str,
        args: &str,
        preview: Option<&tools::ApprovalPreview>,
        call_id: &str,
    ) -> ApprovalReply {
        let Some(waiter) = self.lock().waiter.clone() else {
            return ApprovalReply::Cancelled;
        };
        let gen = {
            let mut shared = self.lock();
            shared.prompt_gen += 1;
            shared.live_prompt = Some(shared.prompt_gen);
            shared.prompt_gen
        };
        let (tx, mut rx) = oneshot::channel();
        let asked = name.to_string();
        let asked_args = args.to_string();
        let call_id = call_id.to_string();
        let preview = preview.cloned();
        thread::spawn(move || {
            let reply = waiter(&asked, &asked_args, preview.as_ref(), &call_id);
            let _ = tx.send((gen, reply));
        });
        let notify = Arc::clone(&self.cancel_notify);
        loop {
            // Register the waiter before reading the cancel flag.
            // `notify_waiters` misses a cancel that lands after the
            // check and before `notified()` is created.
            let notified = notify.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            if self.is_cancelled() {
                self.dismiss_live_prompt();
                return ApprovalReply::Cancelled;
            }
            tokio::select! {
                result = &mut rx => {
                    match result {
                        Ok((reply_gen, reply)) => {
                            let live = self.lock().live_prompt;
                            if live == Some(reply_gen) {
                                self.lock().live_prompt = None;
                                return reply;
                            }
                            // The oneshot is finished. Polling it again
                            // panics, and a newer prompt may own `live_prompt`.
                            return ApprovalReply::Cancelled;
                        }
                        Err(_) => {
                            self.dismiss_live_prompt();
                            return ApprovalReply::Cancelled;
                        }
                    }
                }
                _ = notified => {}
            }
        }
    }

    fn dismiss_live_prompt(&self) {
        let hook = {
            let mut shared = self.lock();
            if shared.live_prompt.take().is_none() {
                return;
            }
            shared.dismiss.clone()
        };
        if let Some(hook) = hook {
            hook();
        }
    }

    fn record_tool_output(&self, id: &str, name: &str, output: String) {
        {
            let mut shared = self.lock();
            shared.history.push(HistoryItem::ToolResult {
                id: id.to_string(),
                name: name.to_string(),
                output: output.clone(),
            });
        }
        self.push_log(DurableEvent::ToolResult {
            id: id.to_string(),
            name: name.to_string(),
            output,
        });
    }

    async fn record_run(&self, id: &str, name: &str, args: &str, spend_grant: bool) {
        let expected_hash = self.take_pending_stamp(id);
        let (vault_path, vault_paths) = {
            let shared = self.lock();
            (shared.vault_path.clone(), shared.vault_paths.clone())
        };
        let name_owned = name.to_string();
        let args_owned = args.to_string();
        let id_owned = id.to_string();
        let cancel_loop = self.clone();
        let joined = tokio::task::spawn_blocking(move || {
            tools::execute_stamped(
                &name_owned,
                &args_owned,
                vault_path.as_deref(),
                &vault_paths,
                expected_hash.as_deref(),
                &id_owned,
                &|| cancel_loop.is_cancelled(),
            )
        })
        .await;
        let output = match joined {
            Ok(Ok(output)) => output,
            Ok(Err(error)) => error,
            Err(_) => "tool task failed".into(),
        };
        {
            let mut shared = self.lock();
            if spend_grant {
                shared.grants.push((name.to_string(), args.to_string()));
            }
            shared.history.push(HistoryItem::ToolResult {
                id: id.to_string(),
                name: name.to_string(),
                output: output.clone(),
            });
        }
        self.push_log(DurableEvent::ToolResult {
            id: id.to_string(),
            name: name.to_string(),
            output,
        });
    }

    fn take_pending_stamp(&self, id: &str) -> Option<String> {
        let mut shared = self.lock();
        match shared.pending_stamp.take() {
            Some((stamp_id, hash)) if stamp_id == id => Some(hash),
            Some(other) => {
                shared.pending_stamp = Some(other);
                None
            }
            None => None,
        }
    }

    fn clear_pending_stamp(&self, id: &str) {
        let _ = self.take_pending_stamp(id);
    }

    fn record_denial(&self, id: &str, name: &str, reason: String) {
        self.clear_pending_stamp(id);
        {
            let mut shared = self.lock();
            shared.history.push(HistoryItem::ToolDenied {
                id: id.to_string(),
                name: name.to_string(),
                reason: reason.clone(),
            });
        }
        self.push_log(DurableEvent::ToolDenied {
            id: id.to_string(),
            name: name.to_string(),
            reason,
        });
    }

    fn lock(&self) -> MutexGuard<'_, Shared> {
        self.shared.lock().expect("rhizome loop")
    }
}

fn take_open_call(open_calls: &mut Vec<(String, String)>, id: &str) -> bool {
    let Some(index) = open_calls.iter().position(|(open_id, _)| open_id == id) else {
        return false;
    };
    open_calls.remove(index);
    true
}

fn close_open_tool_calls(
    open_calls: &mut Vec<(String, String)>,
    history: &mut Vec<HistoryItem>,
    log: &mut Vec<DurableEvent>,
) {
    for (id, name) in open_calls.drain(..) {
        let output = UNANSWERED_TOOL_OUTPUT.to_string();
        history.push(HistoryItem::ToolResult {
            id: id.clone(),
            name: name.clone(),
            output: output.clone(),
        });
        log.push(DurableEvent::ToolResult { id, name, output });
    }
}

/// Raw args stay a string. JSON that does not parse is a tool error
/// the model can see, not a stream error.
fn parsed_tool_args(raw: &str) -> Result<(), String> {
    let trimmed = raw.trim();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        serde_json::from_str::<serde_json::Value>(trimmed)
            .map(|_| ())
            .map_err(|err| format!("malformed arguments: {err}"))
    } else {
        Ok(())
    }
}

fn spend_allow_once(name: &str) -> bool {
    !matches!(
        tools::lookup(name).map(|tool| tool.policy),
        Some(tools::ToolPolicy::Bash)
            | Some(tools::ToolPolicy::CreateNote)
            | Some(tools::ToolPolicy::Mutate)
    )
}

fn offered_names(shared: &Shared) -> Vec<String> {
    let mut names = policy::offered_tools(shared.mode);
    for extra in &shared.extra_offered {
        if !names.iter().any(|name| name == extra) {
            names.push(extra.clone());
        }
    }
    names
}

#[cfg(test)]
mod approval_wait_tests {
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::time::{Duration, Instant};

    use super::*;

    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
    }

    #[test]
    fn cancel_while_the_waiter_is_blocked_returns_without_the_reply() {
        let agent = AgentLoop::new();
        agent.lock().step_active = true;
        let entered = Arc::new(AtomicBool::new(false));
        let entered_flag = Arc::clone(&entered);
        agent.set_approval_waiter_preview(move |_, _, _, _| {
            entered_flag.store(true, Ordering::SeqCst);
            thread::sleep(Duration::from_secs(30));
            ApprovalReply::AllowOnce
        });
        let runtime = runtime();
        let waiting = agent.clone();
        let cancelling = agent.clone();
        let reply = runtime.block_on(async move {
            let task = tokio::spawn(async move {
                waiting
                    .wait_for_approval("bash", "echo hi", None, "call-1")
                    .await
            });
            let started = Instant::now();
            while !entered.load(Ordering::SeqCst) {
                assert!(
                    started.elapsed() < Duration::from_secs(2),
                    "waiter did not start"
                );
                tokio::task::yield_now().await;
            }
            cancelling.cancel("quit");
            tokio::time::timeout(Duration::from_secs(2), task)
                .await
                .expect("cancel did not wake the approval wait")
                .expect("task")
        });
        assert_eq!(reply, ApprovalReply::Cancelled);
    }

    #[test]
    fn a_stale_approval_generation_returns_cancelled_without_panicking() {
        let agent = AgentLoop::new();
        agent.lock().step_active = true;
        let release = Arc::new(AtomicBool::new(false));
        let first_in = Arc::new(AtomicBool::new(false));
        let release_flag = Arc::clone(&release);
        let first_flag = Arc::clone(&first_in);
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_flag = Arc::clone(&calls);
        agent.set_approval_waiter_preview(move |_, _, _, _| {
            if calls_flag.fetch_add(1, Ordering::SeqCst) == 0 {
                first_flag.store(true, Ordering::SeqCst);
                while !release_flag.load(Ordering::SeqCst) {
                    thread::sleep(Duration::from_millis(5));
                }
                ApprovalReply::AllowOnce
            } else {
                ApprovalReply::Deny
            }
        });
        let runtime = runtime();
        let first_agent = agent.clone();
        let second_agent = agent.clone();
        let first_reply = runtime.block_on(async move {
            let first = tokio::spawn(async move {
                first_agent
                    .wait_for_approval("edit", "one", None, "c1")
                    .await
            });
            let started = Instant::now();
            while !first_in.load(Ordering::SeqCst) {
                assert!(started.elapsed() < Duration::from_secs(2));
                tokio::task::yield_now().await;
            }
            let second = tokio::time::timeout(
                Duration::from_secs(2),
                second_agent.wait_for_approval("edit", "two", None, "c2"),
            )
            .await
            .expect("second wait");
            assert_eq!(second, ApprovalReply::Deny);
            release.store(true, Ordering::SeqCst);
            tokio::time::timeout(Duration::from_secs(2), first)
                .await
                .expect("stale wait")
                .expect("task")
        });
        assert_eq!(first_reply, ApprovalReply::Cancelled);
    }
}
