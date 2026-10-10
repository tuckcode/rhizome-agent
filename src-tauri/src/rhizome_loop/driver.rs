use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard};

use crate::ai_agents::AiAgentPermissionMode;

use super::fake_model::{FakeModel, ScriptPart};
use super::policy::{self, Ruling};
use super::tools;
use super::types::{DurableEvent, HistoryItem, ModelView};

/// Reply from a human approval wait. `Cancelled` is timeout or no UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApprovalReply {
    AllowOnce,
    AllowSession,
    Deny,
    Cancelled,
}

/// Default model rounds in one turn. A runaway tool loop stops here.
pub const DEFAULT_STEP_CAP: usize = 8;

type ApprovalWaiter = Box<dyn FnMut(&str) -> ApprovalReply + Send>;
type AfterToolHook = Box<dyn FnMut(&str, &str) + Send>;

struct Shared {
    inbox: VecDeque<String>,
    log: Vec<DurableEvent>,
    history: Vec<HistoryItem>,
    step_active: bool,
    cancel_cause: Option<String>,
    mode: AiAgentPermissionMode,
    /// Name and args already consumed by an allow-once grant.
    grants: Vec<(String, String)>,
    /// Session grants. Echo and other tools match by name; bash
    /// matches the exact command. Cleared by `end_session`.
    session_grants: Vec<(String, String)>,
    /// Names a test adds on top of `policy::offered_tools`. Production
    /// modes do not use this list.
    extra_offered: Vec<String>,
    waiter: Option<ApprovalWaiter>,
    stopped: bool,
    step_cap: usize,
    after_tool: Option<AfterToolHook>,
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

/// One inbox and one driver. A follow-up waits in the inbox.
#[derive(Clone)]
pub struct AgentLoop {
    shared: Arc<Mutex<Shared>>,
}

impl AgentLoop {
    pub fn new() -> Self {
        Self {
            shared: Arc::new(Mutex::new(Shared {
                inbox: VecDeque::new(),
                log: Vec::new(),
                history: Vec::new(),
                step_active: false,
                cancel_cause: None,
                mode: AiAgentPermissionMode::Safe,
                grants: Vec::new(),
                session_grants: Vec::new(),
                extra_offered: Vec::new(),
                waiter: None,
                stopped: false,
                step_cap: DEFAULT_STEP_CAP,
                after_tool: None,
            })),
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
    }

    pub fn set_permission_mode(&self, mode: AiAgentPermissionMode) {
        self.lock().mode = mode;
    }

    pub fn set_approval_waiter(&self, waiter: impl FnMut(&str) -> ApprovalReply + Send + 'static) {
        self.lock().waiter = Some(Box::new(waiter));
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
    }

    pub fn set_step_cap(&self, cap: usize) {
        self.lock().step_cap = cap;
    }

    pub fn on_after_tool_for_test(&self, hook: impl FnMut(&str, &str) + Send + 'static) {
        self.lock().after_tool = Some(Box::new(hook));
    }

    /// Adds a name to this loop's offered set. Production `offered_tools`
    /// stays Safe = echo, Power User = echo and bash.
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
    pub fn run_until_idle(&self, model: &mut FakeModel) {
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
            self.drive_turn(model, admitted);
        }
    }

    fn drive_turn(&self, model: &mut FakeModel, admitted: String) {
        {
            let mut shared = self.lock();
            shared.cancel_cause = None;
        }
        let _step = StepGuard::enter(&self.shared);
        let history_mark = {
            let mut shared = self.lock();
            let mark = shared.history.len();
            shared.log.push(DurableEvent::User {
                text: admitted.clone(),
            });
            mark
        };

        let mut assistant = String::new();
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
            let mut parts = Vec::new();
            let shared = Arc::clone(&self.shared);
            let had_round = model.complete(&view, &mut |part| {
                let cancelled = shared.lock().expect("rhizome loop").cancel_cause.is_some();
                if cancelled {
                    return false;
                }
                parts.push(part);
                true
            });
            if !had_round {
                break;
            }
            steps += 1;
            let mut saw_tool = false;
            for part in parts {
                match part {
                    ScriptPart::Text(chunk) => assistant.push_str(&chunk),
                    ScriptPart::Tool { name, args } => {
                        if self.is_cancelled() {
                            break;
                        }
                        saw_tool = true;
                        self.dispatch_tool(&name, &args);
                    }
                }
            }
            if self.is_cancelled() || !saw_tool {
                break;
            }
        }

        let mut shared = self.lock();
        let cause = shared.cancel_cause.take();
        if !assistant.is_empty() {
            shared.history.push(HistoryItem::Assistant {
                text: assistant.clone(),
            });
            shared.log.push(DurableEvent::Assistant { text: assistant });
        }
        shared
            .history
            .insert(history_mark, HistoryItem::User { text: admitted });
        if let Some(cause) = cause {
            shared.log.push(DurableEvent::Cancelled { cause });
        } else {
            shared.log.push(DurableEvent::TurnEnd);
        }
    }

    fn model_view(&self, admitted: &str) -> ModelView {
        let shared = self.lock();
        ModelView {
            admitted: admitted.to_string(),
            history: shared.history.clone(),
            offered_tools: offered_names(&shared),
        }
    }

    fn is_cancelled(&self) -> bool {
        self.lock().cancel_cause.is_some()
    }

    fn dispatch_tool(&self, name: &str, args: &str) {
        let (mode, offered) = {
            let shared = self.lock();
            (shared.mode, offered_names(&shared))
        };
        if !offered.iter().any(|tool| tool == name) {
            self.record_denial(name, "not offered".into());
            self.fire_after_tool(name, args);
            return;
        }
        if self.session_allows(name, args) {
            self.record_run(name, args, false);
            self.fire_after_tool(name, args);
            return;
        }
        let grant_spent = self
            .lock()
            .grants
            .iter()
            .any(|(spent_name, spent_args)| spent_name == name && spent_args == args);
        match policy::rule_tool(mode, name, grant_spent) {
            Ruling::Run { spend_grant } => self.record_run(name, args, spend_grant),
            Ruling::Deny { reason } => self.record_denial(name, reason),
            Ruling::Ask => self.ask_then_finish(name, args),
        }
        self.fire_after_tool(name, args);
    }

    fn session_allows(&self, name: &str, args: &str) -> bool {
        self.lock()
            .session_grants
            .iter()
            .any(|(granted_name, granted_args)| {
                granted_name == name && policy::session_matches(name, granted_args, args)
            })
    }

    fn fire_after_tool(&self, name: &str, args: &str) {
        let mut hook = self.lock().after_tool.take();
        if let Some(callback) = hook.as_mut() {
            callback(name, args);
        }
        self.lock().after_tool = hook;
    }

    fn ask_then_finish(&self, name: &str, args: &str) {
        let mut waiter = self.lock().waiter.take();
        let reply = match waiter.as_mut() {
            Some(wait) => wait(name),
            None => ApprovalReply::Cancelled,
        };
        self.lock().waiter = waiter;
        match reply {
            ApprovalReply::AllowOnce => self.record_run(name, args, true),
            ApprovalReply::AllowSession => {
                self.grant_for_session(name, args);
                self.record_run(name, args, false);
            }
            ApprovalReply::Deny | ApprovalReply::Cancelled => {
                self.record_denial(name, "approval cancelled".into());
            }
        }
    }

    fn record_run(&self, name: &str, args: &str, spend_grant: bool) {
        let output = tools::execute_allowed(args);
        let mut shared = self.lock();
        if spend_grant {
            shared.grants.push((name.to_string(), args.to_string()));
        }
        shared.log.push(DurableEvent::ToolResult {
            name: name.to_string(),
            output: output.clone(),
        });
        shared.history.push(HistoryItem::ToolResult {
            name: name.to_string(),
            output,
        });
    }

    fn record_denial(&self, name: &str, reason: String) {
        let mut shared = self.lock();
        shared.log.push(DurableEvent::ToolDenied {
            name: name.to_string(),
            reason: reason.clone(),
        });
        shared.history.push(HistoryItem::ToolDenied {
            name: name.to_string(),
            reason,
        });
    }

    fn lock(&self) -> MutexGuard<'_, Shared> {
        self.shared.lock().expect("rhizome loop")
    }
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
