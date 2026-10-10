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
    Deny,
    Cancelled,
}

type ApprovalWaiter = Box<dyn FnMut(&str) -> ApprovalReply + Send>;

struct Shared {
    inbox: VecDeque<String>,
    log: Vec<DurableEvent>,
    history: Vec<HistoryItem>,
    step_active: bool,
    cancel_cause: Option<String>,
    mode: AiAgentPermissionMode,
    /// Name and args already consumed by an allow-once grant.
    grants: Vec<(String, String)>,
    waiter: Option<ApprovalWaiter>,
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
                waiter: None,
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

    /// True when the inbox is empty and no step is running.
    pub fn when_idle(&self) -> bool {
        let shared = self.lock();
        !shared.step_active && shared.inbox.is_empty()
    }

    pub fn events(&self) -> Vec<DurableEvent> {
        self.lock().log.clone()
    }

    /// Drain the inbox. One turn at a time. A cancel ends that turn only.
    pub fn run_until_idle(&self, model: &mut FakeModel) {
        loop {
            let admitted = self.lock().inbox.pop_front();
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
        loop {
            if self.is_cancelled() {
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
            let mut saw_tool = false;
            for part in parts {
                match part {
                    ScriptPart::Text(chunk) => assistant.push_str(&chunk),
                    ScriptPart::Tool { name, args } => {
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
            offered_tools: policy::offered_tools(shared.mode),
        }
    }

    fn is_cancelled(&self) -> bool {
        self.lock().cancel_cause.is_some()
    }

    fn dispatch_tool(&self, name: &str, args: &str) {
        let (mode, grant_spent) = {
            let shared = self.lock();
            let grant_spent = shared
                .grants
                .iter()
                .any(|(spent_name, spent_args)| spent_name == name && spent_args == args);
            (shared.mode, grant_spent)
        };
        match policy::rule_tool(mode, name, grant_spent) {
            Ruling::Run { spend_grant } => self.record_run(name, args, spend_grant),
            Ruling::Deny { reason } => self.record_denial(name, reason),
            Ruling::Ask => self.ask_then_finish(name, args),
        }
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
