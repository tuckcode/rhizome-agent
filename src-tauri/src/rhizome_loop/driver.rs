use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard};

use super::fake_model::FakeModel;
use super::types::{DurableEvent, ModelView};

struct Shared {
    inbox: VecDeque<String>,
    log: Vec<DurableEvent>,
    step_active: bool,
    cancel_cause: Option<String>,
    /// User texts whose turns already logged `TurnEnd`.
    prior_users: Vec<String>,
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
                step_active: false,
                cancel_cause: None,
                prior_users: Vec::new(),
            })),
        }
    }

    pub fn submit(&self, text: impl Into<String>) {
        self.lock().inbox.push_back(text.into());
    }

    pub fn cancel(&self, cause: impl Into<String>) {
        let mut shared = self.lock();
        if shared.cancel_cause.is_none() {
            shared.cancel_cause = Some(cause.into());
        }
    }

    /// True when the inbox is empty and no step is running.
    pub fn when_idle(&self) -> bool {
        let shared = self.lock();
        !shared.step_active && shared.inbox.is_empty()
    }

    pub fn events(&self) -> Vec<DurableEvent> {
        self.lock().log.clone()
    }

    /// Drain the inbox. One turn at a time. Cancel stops this run.
    pub fn run_until_idle(&self, model: &mut FakeModel) {
        loop {
            let admitted = self.lock().inbox.pop_front();
            let Some(admitted) = admitted else {
                return;
            };
            if self.drive_turn(model, admitted) {
                return;
            }
        }
    }

    /// Returns true when the turn was cancelled.
    fn drive_turn(&self, model: &mut FakeModel, admitted: String) -> bool {
        let _step = StepGuard::enter(&self.shared);
        let view = {
            let mut shared = self.lock();
            let view = ModelView {
                admitted: admitted.clone(),
                prior_users: shared.prior_users.clone(),
            };
            shared.log.push(DurableEvent::User { text: admitted });
            view
        };

        let mut chunks = Vec::new();
        let shared = Arc::clone(&self.shared);
        model.complete(&view, &mut |chunk| {
            let cancelled = shared.lock().expect("rhizome loop").cancel_cause.is_some();
            if cancelled {
                return false;
            }
            chunks.push(chunk.to_string());
            true
        });

        let mut shared = self.lock();
        let text = chunks.concat();
        shared.log.push(DurableEvent::Assistant { text });
        if let Some(cause) = shared.cancel_cause.clone() {
            shared.log.push(DurableEvent::Cancelled { cause });
            return true;
        }
        shared.prior_users.push(view.admitted);
        shared.log.push(DurableEvent::TurnEnd);
        false
    }

    fn lock(&self) -> MutexGuard<'_, Shared> {
        self.shared.lock().expect("rhizome loop")
    }
}
