use std::path::PathBuf;

use crate::acp_client::{run_acp_prompt, AcpLaunch, AcpSessionRequest};
use crate::ai_agents::{AiAgentPermissionMode, AiAgentStreamEvent};

use super::{Engine, EngineEvent};

/// Hermes via the generic ACP client. Not `hermes chat --quiet`.
pub struct HermesEngine {
    launch: AcpLaunch,
    events: Vec<EngineEvent>,
}

impl HermesEngine {
    pub(crate) fn new(launch: AcpLaunch) -> Self {
        Self {
            launch,
            events: Vec::new(),
        }
    }

    pub fn fake_agent() -> Self {
        let fixture =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/acp_fake_agent.cjs");
        Self::new(AcpLaunch {
            program: PathBuf::from("node"),
            args: vec![fixture.to_string_lossy().into_owned()],
            extra_env: Vec::new(),
        })
    }
}

impl Engine for HermesEngine {
    fn kind(&self) -> &'static str {
        "hermes"
    }

    fn start(&mut self, prompt: &str) -> Result<(), String> {
        let vault = tempfile::tempdir().map_err(|err| err.to_string())?;
        let request = AcpSessionRequest {
            cwd: vault.path().to_string_lossy().into_owned(),
            prompt: prompt.to_string(),
            resumed_prompt: None,
            resume_session_id: None,
            mcp_servers: Vec::new(),
            permission_mode: AiAgentPermissionMode::Safe,
        };
        let mut events = Vec::new();
        run_acp_prompt(self.launch.clone(), request, |event| {
            if let AiAgentStreamEvent::TextDelta { text } = event {
                events.push(EngineEvent::Text(text));
            }
        })?;
        self.events = events;
        Ok(())
    }

    fn stop(&mut self) {
        // run_acp_prompt already detaches when the prompt returns.
    }

    fn events(&self) -> Vec<EngineEvent> {
        self.events.clone()
    }
}
