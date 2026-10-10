use crate::prime_session_host::{settle_session, QuitDisposition, SessionCloseIntent};

use super::{Engine, EngineEvent};

/// Thin Prime wrapper. Chat still calls `prime_session_host` directly.
/// Drop / stop detach. Never send `shutdown`.
pub struct PrimeEngine {
    settle: Box<dyn FnMut(SessionCloseIntent) -> Result<QuitDisposition, String> + Send>,
    events: Vec<EngineEvent>,
    settled: bool,
}

impl PrimeEngine {
    pub fn new() -> Self {
        Self {
            settle: Box::new(settle_session),
            events: Vec::new(),
            settled: false,
        }
    }

    #[cfg(test)]
    pub fn with_settle(
        settle: impl FnMut(SessionCloseIntent) -> Result<QuitDisposition, String> + Send + 'static,
    ) -> Self {
        Self {
            settle: Box::new(settle),
            events: Vec::new(),
            settled: false,
        }
    }

    #[cfg(test)]
    pub fn with_text(text: impl Into<String>) -> Self {
        Self {
            settle: Box::new(|_| Ok(QuitDisposition::KeepSessionRunning)),
            events: vec![EngineEvent::TextDelta { text: text.into() }],
            settled: false,
        }
    }

    fn detach(&mut self) {
        if self.settled {
            return;
        }
        self.settled = true;
        let _ = (self.settle)(SessionCloseIntent::Detach);
    }
}

impl Default for PrimeEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for PrimeEngine {
    fn drop(&mut self) {
        self.detach();
    }
}

impl Engine for PrimeEngine {
    fn kind(&self) -> &'static str {
        "prime"
    }

    fn start(
        &mut self,
        _prompt: &str,
        mut sink: Box<dyn FnMut(EngineEvent) + Send>,
    ) -> Result<(), String> {
        for event in &self.events {
            sink(event.clone());
        }
        Ok(())
    }

    fn stop(&mut self) {
        self.detach();
    }

    fn events(&self) -> Vec<EngineEvent> {
        self.events.clone()
    }

    fn steer(&mut self, _text: &str) {}

    fn cancel(&mut self, _cause: &str) {}

    fn reply_approval(&mut self, _prompt_id: &str, _reply: crate::rhizome_loop::ApprovalReply) {}

    fn settle_on_quit(&mut self) {
        self.detach();
    }
}
