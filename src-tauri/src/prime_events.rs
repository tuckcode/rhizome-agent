//! Map Prime Agent RPC JSONL events → [`AiAgentStreamEvent`].
//!
//! Prime's RPC event surface for streaming (`message_update` with
//! `assistantMessageEvent`, `tool_execution_start`/`end`) is the same shape
//! Pi emits, so the mappers stay aligned. Keep this module separate so a
//! Prime-only field can diverge without touching Pi.

use crate::ai_agents::AiAgentStreamEvent;

const LOCALIZED_ERROR_PREFIX: &str = "rhizome:i18n-error:";
const PRIME_EMPTY_OUTPUT_KEY: &str = "ai.error.prime.emptyOutput";

/// Dispatch one already-parsed RPC stdout line into stream events.
pub(crate) fn dispatch_event<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    match json["type"].as_str().unwrap_or_default() {
        // Some RPC builds emit a session envelope; treat it like Pi.
        "session" => emit_session_event(json, emit),
        "message_update" => emit_message_update(json, emit),
        "tool_execution_start" => emit_tool_start(json, emit),
        "tool_execution_end" => emit_tool_done(json, emit),
        "error" | "extension_error" => emit_error_event(json, emit),
        // agent_end / turn_end / message_end / response are host-lifecycle
        // signals handled by prime_session_host, not UI stream events.
        _ => {}
    }
}

pub(crate) fn session_id_from_state(data: &serde_json::Value) -> Option<&str> {
    data["sessionId"]
        .as_str()
        .or_else(|| data["session_id"].as_str())
        .or_else(|| data["id"].as_str())
}

pub(crate) fn format_spawn_error(message: &str) -> String {
    let lower = message.to_ascii_lowercase();
    if is_auth_error(&lower) {
        return "Prime Agent is not authenticated. Run `prime-agent` once in a terminal and complete login (including xAI OAuth if needed), then retry.".into();
    }
    if lower.contains("not found") || lower.contains("no such file") {
        return "Prime Agent not found. Install it (`npm i -g prime-agent`) and ensure `prime-agent` is on PATH.".into();
    }
    message.lines().take(3).collect::<Vec<_>>().join("\n")
}

#[allow(dead_code)]
pub(crate) fn format_empty_turn() -> String {
    let payload = serde_json::json!({
        "key": PRIME_EMPTY_OUTPUT_KEY,
        "values": {},
    });
    format!("{LOCALIZED_ERROR_PREFIX}{payload}")
}

fn emit_session_event<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    if let Some(session_id) = json["id"]
        .as_str()
        .or_else(|| json["session_id"].as_str())
        .or_else(|| json["session"]["id"].as_str())
    {
        emit(AiAgentStreamEvent::Init {
            session_id: session_id.to_string(),
        });
    }
}

fn emit_message_update<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    let event = &json["assistantMessageEvent"];
    match event["type"].as_str().unwrap_or_default() {
        "text_delta" => emit_delta(event, emit, |text| AiAgentStreamEvent::TextDelta { text }),
        "thinking_delta" => emit_delta(event, emit, |text| AiAgentStreamEvent::ThinkingDelta {
            text,
        }),
        _ => {}
    }
}

fn emit_delta<F>(
    json: &serde_json::Value,
    emit: &mut F,
    build: impl FnOnce(String) -> AiAgentStreamEvent,
) where
    F: FnMut(AiAgentStreamEvent),
{
    if let Some(delta) = json["delta"].as_str() {
        if !delta.is_empty() {
            emit(build(delta.to_string()));
        }
    }
}

fn emit_tool_start<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    emit(AiAgentStreamEvent::ToolStart {
        tool_name: tool_name(json),
        tool_id: tool_id(json),
        input: json.get("args").map(|args| args.to_string()),
    });
}

fn emit_tool_done<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    emit(AiAgentStreamEvent::ToolDone {
        tool_id: tool_id(json),
        output: json.get("result").map(|result| result.to_string()),
    });
}

fn emit_error_event<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    if let Some(message) = message_value(json) {
        emit(AiAgentStreamEvent::Error {
            message: message.to_string(),
        });
    }
}

fn tool_name(json: &serde_json::Value) -> String {
    json["toolName"].as_str().unwrap_or("tool").to_string()
}

fn tool_id(json: &serde_json::Value) -> String {
    json["toolCallId"].as_str().unwrap_or("tool").to_string()
}

fn message_value(json: &serde_json::Value) -> Option<&str> {
    json["message"]
        .as_str()
        .or_else(|| json["error"].as_str())
        .or_else(|| json["text"].as_str())
}

fn is_auth_error(lower: &str) -> bool {
    [
        "auth",
        "login",
        "sign in",
        "oauth",
        "api key",
        "api.key",
        "unauthorized",
        "401",
    ]
    .iter()
    .any(|pattern| lower.contains(pattern))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn collect(json: serde_json::Value) -> Vec<AiAgentStreamEvent> {
        let mut events = Vec::new();
        dispatch_event(&json, &mut |event| events.push(event));
        events
    }

    #[test]
    fn maps_text_and_thinking_deltas() {
        let text = collect(serde_json::json!({
            "type": "message_update",
            "assistantMessageEvent": {"type": "text_delta", "delta": "Hello"}
        }));
        assert!(matches!(
            &text[0],
            AiAgentStreamEvent::TextDelta { text } if text == "Hello"
        ));

        let think = collect(serde_json::json!({
            "type": "message_update",
            "assistantMessageEvent": {"type": "thinking_delta", "delta": "hmm"}
        }));
        assert!(matches!(
            &think[0],
            AiAgentStreamEvent::ThinkingDelta { text } if text == "hmm"
        ));
    }

    #[test]
    fn maps_tool_start_and_done() {
        let start = collect(serde_json::json!({
            "type": "tool_execution_start",
            "toolCallId": "t1",
            "toolName": "bash",
            "args": {"command": "ls"}
        }));
        assert!(matches!(
            &start[0],
            AiAgentStreamEvent::ToolStart { tool_id, tool_name, .. }
                if tool_id == "t1" && tool_name == "bash"
        ));

        let done = collect(serde_json::json!({
            "type": "tool_execution_end",
            "toolCallId": "t1",
            "result": {"ok": true}
        }));
        assert!(matches!(
            &done[0],
            AiAgentStreamEvent::ToolDone { tool_id, .. } if tool_id == "t1"
        ));
    }

    #[test]
    fn ignores_lifecycle_events() {
        assert!(collect(serde_json::json!({"type": "agent_start"})).is_empty());
        assert!(collect(serde_json::json!({"type": "agent_end", "messages": []})).is_empty());
        assert!(collect(serde_json::json!({
            "type": "response",
            "command": "prompt",
            "success": true
        }))
        .is_empty());
    }

    #[test]
    fn session_id_from_state_prefers_session_id() {
        let data = serde_json::json!({"sessionId": "abc", "id": "other"});
        assert_eq!(session_id_from_state(&data), Some("abc"));
    }
}
