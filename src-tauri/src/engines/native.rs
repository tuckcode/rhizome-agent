use crate::rhizome_loop::{AgentLoop, DurableEvent, Model};

use super::{Engine, EngineEvent};

/// Native Rhizome loop behind the engine trait.
/// Chat does not call this yet.
pub struct NativeEngine<M: Model> {
    agent: AgentLoop,
    model: M,
}

#[cfg(test)]
impl NativeEngine<crate::rhizome_loop::FakeModel> {
    pub fn saying(text: impl Into<String>) -> Self {
        Self::new(crate::rhizome_loop::FakeModel::saying(text))
    }

    pub fn from_parts(agent: AgentLoop, model: crate::rhizome_loop::FakeModel) -> Self {
        Self { agent, model }
    }

    pub fn agent(&self) -> &AgentLoop {
        &self.agent
    }

    pub fn loop_events(&self) -> Vec<DurableEvent> {
        self.agent.events()
    }
}

impl<M: Model> NativeEngine<M> {
    pub fn new(model: M) -> Self {
        Self {
            agent: AgentLoop::new(),
            model,
        }
    }
}

impl<M: Model> Engine for NativeEngine<M> {
    fn kind(&self) -> &'static str {
        "native"
    }

    fn start(&mut self, prompt: &str) -> Result<(), String> {
        self.agent.submit(prompt);
        self.agent.run_until_idle(&mut self.model);
        Ok(())
    }

    fn stop(&mut self) {
        self.agent.stop_and_drain("quit");
    }

    fn events(&self) -> Vec<EngineEvent> {
        self.agent
            .events()
            .into_iter()
            .filter_map(|event| match event {
                DurableEvent::Assistant { text } => Some(EngineEvent::Text(text)),
                DurableEvent::Cancelled { cause } => Some(EngineEvent::Cancelled { cause }),
                _ => None,
            })
            .collect()
    }
}
