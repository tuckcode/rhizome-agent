use crate::ai_agents::AiAgentStreamEvent;
use serde_json::Value;

/// Map one ACP `session/update` notification into zero or more stream events.
///
/// Unknown update kinds are ignored. Replay during `session/load` is filtered
/// by the caller so Rhizome's own transcript is not duplicated.
pub(crate) fn map_session_update(update: &Value) -> Vec<AiAgentStreamEvent> {
    let kind = update
        .get("sessionUpdate")
        .and_then(Value::as_str)
        .unwrap_or("");

    match kind {
        "agent_message_chunk" | "user_message_chunk" => text_event(update, false),
        "agent_thought_chunk" => text_event(update, true),
        "tool_call" => vec![tool_start(update)],
        "tool_call_update" => tool_update(update).into_iter().collect(),
        _ => Vec::new(),
    }
}

fn text_event(update: &Value, thinking: bool) -> Vec<AiAgentStreamEvent> {
    let Some(text) = content_text(update.get("content")) else {
        return Vec::new();
    };
    if text.is_empty() {
        return Vec::new();
    }
    if thinking {
        vec![AiAgentStreamEvent::ThinkingDelta { text }]
    } else {
        vec![AiAgentStreamEvent::TextDelta { text }]
    }
}

fn tool_start(update: &Value) -> AiAgentStreamEvent {
    let tool_id = string_field(update, "toolCallId").unwrap_or_else(|| "tool".into());
    let tool_name = string_field(update, "name")
        .or_else(|| string_field(update, "title"))
        .or_else(|| string_field(update, "kind"))
        .unwrap_or_else(|| "tool".into());
    let input = update.get("rawInput").map(compact_json);

    AiAgentStreamEvent::ToolStart {
        tool_name,
        tool_id,
        input,
    }
}

fn tool_update(update: &Value) -> Option<AiAgentStreamEvent> {
    let status = string_field(update, "status").unwrap_or_default();
    if status != "completed" && status != "failed" {
        return None;
    }
    let tool_id = string_field(update, "toolCallId")?;
    let output = tool_output(update);
    Some(AiAgentStreamEvent::ToolDone { tool_id, output })
}

fn tool_output(update: &Value) -> Option<String> {
    if let Some(raw) = update.get("rawOutput") {
        return Some(compact_json(raw));
    }
    let content = update.get("content")?.as_array()?;
    let mut parts = Vec::new();
    for item in content {
        if let Some(text) = content_text(item.get("content")) {
            parts.push(text);
        } else if item.get("type").and_then(Value::as_str) == Some("diff") {
            if let Some(path) = item.get("path").and_then(Value::as_str) {
                parts.push(format!("diff {path}"));
            }
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

fn content_text(content: Option<&Value>) -> Option<String> {
    let content = content?;
    if let Some(text) = content.get("text").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }
    None
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(ToOwned::to_owned)
}

fn compact_json(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| value.to_string())
}

pub(crate) fn permission_tool_events(
    tool_call: Option<&Value>,
    decision: &str,
) -> Vec<AiAgentStreamEvent> {
    let tool_id = tool_call
        .and_then(|value| string_field(value, "toolCallId"))
        .unwrap_or_else(|| "permission".into());
    let title = tool_call
        .and_then(|value| string_field(value, "title"))
        .unwrap_or_else(|| "Permission request".into());
    vec![
        AiAgentStreamEvent::ToolStart {
            tool_name: format!("permission:{title}"),
            tool_id: tool_id.clone(),
            input: Some(decision.to_string()),
        },
        AiAgentStreamEvent::ToolDone {
            tool_id,
            output: Some(decision.to_string()),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_agent_text_and_thoughts() {
        let text = map_session_update(&serde_json::json!({
            "sessionUpdate": "agent_message_chunk",
            "content": { "type": "text", "text": "Hello" }
        }));
        let thought = map_session_update(&serde_json::json!({
            "sessionUpdate": "agent_thought_chunk",
            "content": { "type": "text", "text": "Hmm" }
        }));

        assert!(matches!(
            &text[0],
            AiAgentStreamEvent::TextDelta { text } if text == "Hello"
        ));
        assert!(matches!(
            &thought[0],
            AiAgentStreamEvent::ThinkingDelta { text } if text == "Hmm"
        ));
    }

    #[test]
    fn maps_tool_start_and_completion() {
        let start = map_session_update(&serde_json::json!({
            "sessionUpdate": "tool_call",
            "toolCallId": "c1",
            "name": "read_file",
            "rawInput": { "path": "/tmp/a" }
        }));
        let done = map_session_update(&serde_json::json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "c1",
            "status": "completed",
            "content": [{
                "type": "content",
                "content": { "type": "text", "text": "ok" }
            }]
        }));

        assert!(matches!(
            &start[0],
            AiAgentStreamEvent::ToolStart { tool_name, tool_id, .. }
                if tool_name == "read_file" && tool_id == "c1"
        ));
        assert!(matches!(
            &done[0],
            AiAgentStreamEvent::ToolDone { tool_id, output }
                if tool_id == "c1" && output.as_deref() == Some("ok")
        ));
    }

    #[test]
    fn ignores_unknown_and_in_progress_updates() {
        assert!(map_session_update(&serde_json::json!({
            "sessionUpdate": "plan",
            "entries": []
        }))
        .is_empty());
        assert!(map_session_update(&serde_json::json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "c1",
            "status": "in_progress"
        }))
        .is_empty());
    }
}
