use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard};

use super::fake_model::FakeModel;
use super::types::DurableEvent;

struct Shared {
    inbox: VecDeque<String>,
    log: Vec<DurableEvent>,
    step_active: bool,
    cancel_cause: Option<String>,
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

    pub fn run_until_idle(&self, model: &mut FakeModel) {
        // The behavior tests name the contract. The driver is still empty.
        let _ = model;
    }

    fn lock(&self) -> MutexGuard<'_, Shared> {
        self.shared.lock().expect("rhizome loop")
    }
}
