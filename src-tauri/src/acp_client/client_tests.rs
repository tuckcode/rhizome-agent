use crate::ai_agents::{AiAgentPermissionMode, AiAgentStreamEvent};
use std::path::PathBuf;

use super::client::{run_acp_prompt, AcpLaunch, AcpSessionRequest};

fn fixture() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/acp_fake_agent.cjs")
}

fn launch() -> AcpLaunch {
    AcpLaunch {
        program: PathBuf::from("node"),
        args: vec![fixture().to_string_lossy().into_owned()],
        extra_env: Vec::new(),
    }
}

fn request(permission_mode: AiAgentPermissionMode) -> AcpSessionRequest {
    AcpSessionRequest {
        cwd: std::env::temp_dir().to_string_lossy().into_owned(),
        prompt: "Summarize the note".into(),
        resume_session_id: None,
        mcp_servers: Vec::new(),
        permission_mode,
    }
}

fn run(
    launch: AcpLaunch,
    request: AcpSessionRequest,
) -> (Result<String, String>, Vec<AiAgentStreamEvent>) {
    let mut events = Vec::new();
    let result = run_acp_prompt(launch, request, |event| events.push(event));
    (result, events)
}

fn texts(events: &[AiAgentStreamEvent]) -> Vec<&str> {
    events
        .iter()
        .filter_map(|event| match event {
            AiAgentStreamEvent::TextDelta { text } => Some(text.as_str()),
            _ => None,
        })
        .collect()
}

#[test]
fn acp_prompt_streams_text_and_returns_session_id() {
    let (result, events) = run(launch(), request(AiAgentPermissionMode::Safe));

    assert_eq!(result.unwrap(), "sess_fake_1");
    assert!(matches!(
        &events[0],
        AiAgentStreamEvent::Init { session_id } if session_id == "sess_fake_1"
    ));
    assert_eq!(texts(&events), ["Hello from ACP"]);
    assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
}

#[test]
fn acp_prompt_maps_thoughts_and_tool_calls() {
    let mut launch = launch();
    launch
        .extra_env
        .push(("ACP_FAKE_THOUGHT".into(), "planning".into()));
    launch
        .extra_env
        .push(("ACP_FAKE_TOOL".into(), "read_file".into()));

    let (_result, events) = run(launch, request(AiAgentPermissionMode::Safe));

    assert!(events.iter().any(|event| matches!(
        event,
        AiAgentStreamEvent::ThinkingDelta { text } if text == "planning"
    )));
    assert!(events.iter().any(|event| matches!(
        event,
        AiAgentStreamEvent::ToolStart { tool_name, tool_id, .. }
            if tool_name == "read_file" && tool_id == "call_1"
    )));
    assert!(events.iter().any(|event| matches!(
        event,
        AiAgentStreamEvent::ToolDone { tool_id, output }
            if tool_id == "call_1" && output.as_deref() == Some("ok")
    )));
}

#[test]
fn acp_safe_mode_denies_permission_requests() {
    let mut launch = launch();
    launch
        .extra_env
        .push(("ACP_FAKE_PERMISSION".into(), "1".into()));

    let (_result, events) = run(launch, request(AiAgentPermissionMode::Safe));

    assert!(events.iter().any(|event| matches!(
        event,
        AiAgentStreamEvent::ToolStart { tool_name, input, .. }
            if tool_name.contains("permission") && input.as_deref() == Some("deny")
    )));
    assert_eq!(texts(&events), ["Hello from ACP"]);
}

#[test]
fn acp_power_user_allows_permission_requests() {
    let mut launch = launch();
    launch
        .extra_env
        .push(("ACP_FAKE_PERMISSION".into(), "1".into()));

    let (_result, events) = run(launch, request(AiAgentPermissionMode::PowerUser));

    assert!(events.iter().any(|event| matches!(
        event,
        AiAgentStreamEvent::ToolDone { output, .. } if output.as_deref() == Some("allow_once")
    )));
}

#[test]
fn acp_resume_does_not_replay_history_into_the_stream() {
    let mut launch = launch();
    launch
        .extra_env
        .push(("ACP_FAKE_LOAD_REPLAY".into(), "1".into()));
    launch
        .extra_env
        .push(("ACP_FAKE_REPLY".into(), "fresh turn".into()));

    let request = AcpSessionRequest {
        resume_session_id: Some("sess_existing".into()),
        ..request(AiAgentPermissionMode::Safe)
    };
    let (result, events) = run(launch, request);

    assert_eq!(result.unwrap(), "sess_existing");
    assert_eq!(texts(&events), ["fresh turn"]);
    assert!(events.iter().all(|event| match event {
        AiAgentStreamEvent::TextDelta { text } => text != "replayed-should-be-silent",
        _ => true,
    }));
}

#[test]
fn acp_rejects_an_unknown_protocol_version() {
    let mut launch = launch();
    launch
        .extra_env
        .push(("ACP_FAKE_UNKNOWN_VERSION".into(), "1".into()));

    let (result, _events) = run(launch, request(AiAgentPermissionMode::Safe));

    assert!(result.unwrap_err().contains("protocol version 99"));
}
