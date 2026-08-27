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
        "compaction_start" | "compaction_end" => emit_compaction(json, emit),
        "session_action_update" => emit_queue_update(json, emit),
        // agent_end / turn_end / message_end / response are host-lifecycle
        // signals handled by prime_session_host, not UI stream events.
        _ => {}
    }
}

/// The provider's own reason for a turn that produced no assistant text.
///
/// Prime records `stopReason: "error"` and a human-readable `errorMessage` on
/// the assistant message — a 429 rate limit, a 402 for an account that never
/// bought credits, a 404 for a retired model. Rhizome used to discard both and
/// let the UI substitute "… finished without returning a reply", which is
/// indistinguishable from a model that legitimately had nothing to say.
///
/// That one sentence hid three unrelated failures for days (C51, C53, and
/// silent provider refusals), so the reason is surfaced verbatim rather than
/// rewritten: the provider's own words name the account, model or limit at
/// fault, and we cannot say it better.
///
/// Returns `None` when the turn produced text, or when nothing errored — a
/// genuinely empty turn keeps the placeholder.
pub(crate) fn provider_error_from_agent_end(json: &serde_json::Value) -> Option<String> {
    let messages = json["messages"].as_array()?;
    messages.iter().rev().find_map(|entry| {
        // Prime sends the message bare in some shapes and wrapped in others.
        let message = if entry["message"].is_object() {
            &entry["message"]
        } else {
            entry
        };
        if message["role"].as_str()? != "assistant" {
            return None;
        }
        if message["stopReason"].as_str()? != "error" {
            return None;
        }
        // A late failure after partial output is not an empty turn; the user
        // already has the text, so do not replace it with an error.
        if message["content"]
            .as_array()
            .is_some_and(|content| !content.is_empty())
        {
            return None;
        }
        let reason = message["errorMessage"].as_str()?.trim();
        (!reason.is_empty()).then(|| reason.to_string())
    })
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

/// Depth of Prime's steering/follow-up queue. Prefers the reported
/// `queuedCount`; falls back to the combined list lengths so a payload
/// without the count still yields an honest number rather than nothing.
pub(crate) fn queued_action_count(json: &serde_json::Value) -> Option<u64> {
    let actions = &json["actions"];
    if let Some(count) = actions["queuedCount"].as_u64() {
        return Some(count);
    }
    let steering = actions["steering"].as_array().map(Vec::len).unwrap_or(0);
    let follow_ups = actions["followUps"].as_array().map(Vec::len).unwrap_or(0);
    if actions["steering"].is_null() && actions["followUps"].is_null() {
        return None;
    }
    Some((steering + follow_ups) as u64)
}

fn emit_queue_update<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    if let Some(queued) = queued_action_count(json) {
        emit(AiAgentStreamEvent::QueueUpdate { queued });
    }
}

/// Prime signals compaction with a start/end pair; an aborted run still
/// arrives as `compaction_end` with `aborted: true`, which is NOT a completed
/// compaction and must not be reported as one.
fn emit_compaction<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    let aborted = json["aborted"].as_bool().unwrap_or(false);
    let phase = match json["type"].as_str().unwrap_or_default() {
        "compaction_start" => "start",
        _ if aborted => "aborted",
        _ => "end",
    };
    emit(AiAgentStreamEvent::Compaction {
        phase: phase.to_string(),
        reason: json["reason"].as_str().map(str::to_string),
        tokens_before: json["result"]["tokensBefore"].as_u64(),
    });
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
    let args = json.get("args").cloned().unwrap_or(serde_json::Value::Null);
    // The vault skill shells out through ipython, so the reported name is the
    // wrapper. Recover the real operation before it reaches a card.
    let unwrapped = crate::prime_tool_unwrap::unwrap_tool(&tool_name(json), &args);

    emit(AiAgentStreamEvent::ToolStart {
        tool_name: unwrapped.tool.clone(),
        tool_id: tool_id(json),
        input: tool_input_with_recovery(
            &args,
            unwrapped.path.as_deref(),
            unwrapped.detail.as_deref(),
            &unwrapped.tool,
        ),
    });
}

/// Merge a recovered note path into the tool arguments.
///
/// The frontend already offers **Open** for any tool whose input parses to an
/// object carrying `path` (`notePathFromToolInput`). Putting the unwrapped path
/// there means the affordance works for shelled-out calls without the UI
/// needing to know wrappers exist.
fn tool_input_with_recovery(
    args: &serde_json::Value,
    path: Option<&str>,
    detail: Option<&str>,
    tool: &str,
) -> Option<String> {
    if path.is_none() && detail.is_none() {
        return (!args.is_null()).then(|| args.to_string());
    }

    let mut merged = args.clone();
    match merged.as_object_mut() {
        Some(object) => {
            if let Some(path) = path {
                object.insert("path".into(), serde_json::Value::String(path.to_string()));
            }
            if let Some(detail) = detail {
                let key = if tool.eq_ignore_ascii_case("bash") {
                    "command"
                } else {
                    "preview"
                };
                object.insert(key.into(), serde_json::Value::String(detail.to_string()));
            }
            Some(merged.to_string())
        }
        None => {
            let mut wrapped = serde_json::Map::new();
            if let Some(path) = path {
                wrapped.insert("path".into(), serde_json::Value::String(path.to_string()));
            }
            if let Some(detail) = detail {
                let key = if tool.eq_ignore_ascii_case("bash") {
                    "command"
                } else {
                    "preview"
                };
                wrapped.insert(key.into(), serde_json::Value::String(detail.to_string()));
            }
            wrapped.insert("raw".into(), args.clone());
            Some(serde_json::Value::Object(wrapped).to_string())
        }
    }
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

    /// Long-running sessions compact silently today — Prime emits
    /// compaction_start/end and nothing surfaced them, so the transcript
    /// would lose context with no explanation visible to the user.
    #[test]
    fn surfaces_compaction_so_context_loss_is_never_silent() {
        let start = collect(serde_json::json!({
            "type": "compaction_start",
            "reason": "threshold"
        }));
        assert!(
            matches!(
                &start[0],
                AiAgentStreamEvent::Compaction { phase, reason, tokens_before }
                    if phase == "start" && reason.as_deref() == Some("threshold")
                        && tokens_before.is_none()
            ),
            "start={start:?}"
        );

        let end = collect(serde_json::json!({
            "type": "compaction_end",
            "reason": "threshold",
            "result": {"summary": "...", "tokensBefore": 150000},
            "aborted": false
        }));
        assert!(
            matches!(
                &end[0],
                AiAgentStreamEvent::Compaction { phase, tokens_before, .. }
                    if phase == "end" && *tokens_before == Some(150_000)
            ),
            "end={end:?}"
        );
    }

    /// An aborted compaction is not a completed one — reporting it as `end`
    /// would tell the user context was compacted when it was not.
    #[test]
    fn aborted_compaction_reports_aborted_not_end() {
        let events = collect(serde_json::json!({
            "type": "compaction_end",
            "reason": "threshold",
            "aborted": true
        }));
        assert!(
            matches!(&events[0], AiAgentStreamEvent::Compaction { phase, .. } if phase == "aborted"),
            "events={events:?}"
        );
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
    fn a_shelled_out_vault_call_reaches_the_ui_named_and_openable() {
        // Exactly what the rhizome-vault skill emits: the operation is a shell
        // command inside ipython, so the card used to read "ipython" with no
        // path and therefore no Open button.
        let code = "VAULT_PATH='/v' node '/r/mcp-server/cli-call.mjs' get_note '{\"path\":\"wiki/foo.md\"}'";
        let events = collect(serde_json::json!({
            "type": "tool_execution_start",
            "toolName": "ipython",
            "toolCallId": "call-1",
            "args": {"code": code},
        }));

        match &events[0] {
            AiAgentStreamEvent::ToolStart {
                tool_name, input, ..
            } => {
                assert_eq!(tool_name, "get_note", "the wrapper must not be the label");
                let parsed: serde_json::Value =
                    serde_json::from_str(input.as_deref().unwrap()).expect("input is json");
                // What `notePathFromToolInput` reads to offer Open.
                assert_eq!(parsed["path"], "wiki/foo.md");
                // The original call survives for the card's detail view.
                assert!(parsed["code"].as_str().unwrap().contains("cli-call.mjs"));
            }
            other => panic!("expected a tool start, got {other:?}"),
        }
    }

    #[test]
    fn a_bash_cell_reaches_the_ui_as_the_command() {
        let events = collect(serde_json::json!({
            "type": "tool_execution_start",
            "toolName": "ipython",
            "toolCallId": "call-bash",
            "args": {"code": "%%bash\nrg foo wiki/\n"},
        }));

        match &events[0] {
            AiAgentStreamEvent::ToolStart {
                tool_name, input, ..
            } => {
                assert_eq!(tool_name, "bash");
                let parsed: serde_json::Value =
                    serde_json::from_str(input.as_deref().unwrap()).expect("input is json");
                assert_eq!(parsed["command"], "rg foo wiki/");
            }
            other => panic!("expected a tool start, got {other:?}"),
        }
    }

    /// A wrapper doing something unrelated keeps its own name and offers no
    /// Open — a card pointing at a note it never touched is worse than none.
    #[test]
    fn an_unrelated_wrapper_call_gains_no_path() {
        let events = collect(serde_json::json!({
            "type": "tool_execution_start",
            "toolName": "ipython",
            "toolCallId": "call-2",
            "args": {"code": "print(1 + 1)"},
        }));

        match &events[0] {
            AiAgentStreamEvent::ToolStart {
                tool_name, input, ..
            } => {
                assert_eq!(tool_name, "ipython");
                let parsed: serde_json::Value =
                    serde_json::from_str(input.as_deref().unwrap()).expect("input is json");
                assert!(parsed.get("path").is_none());
                assert_eq!(parsed["preview"], "print(1 + 1)");
            }
            other => panic!("expected a tool start, got {other:?}"),
        }
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

    // C51/C53 both hid behind the same sentence for days. Prime records the
    // real reason; these lock in that we read it.
    #[test]
    fn reads_the_provider_error_off_an_empty_errored_turn() {
        let end = serde_json::json!({
            "type": "agent_end",
            "messages": [{
                "role": "assistant",
                "content": [],
                "stopReason": "error",
                "provider": "opencode",
                "errorMessage": "429 Error from provider (Console): Rate limit exceeded. Please try again later."
            }]
        });
        assert_eq!(
            provider_error_from_agent_end(&end).as_deref(),
            Some("429 Error from provider (Console): Rate limit exceeded. Please try again later.")
        );
    }

    #[test]
    fn unwraps_a_nested_message_envelope() {
        let end = serde_json::json!({
            "type": "agent_end",
            "messages": [{ "message": {
                "role": "assistant",
                "content": [],
                "stopReason": "error",
                "errorMessage": "402 Insufficient credits."
            }}]
        });
        assert_eq!(
            provider_error_from_agent_end(&end).as_deref(),
            Some("402 Insufficient credits.")
        );
    }

    #[test]
    fn a_genuinely_empty_turn_is_not_a_provider_error() {
        // No stopReason: the model simply said nothing. Must stay the
        // placeholder, not be dressed up as a provider failure.
        let end = serde_json::json!({
            "type": "agent_end",
            "messages": [{ "role": "assistant", "content": [] }]
        });
        assert!(provider_error_from_agent_end(&end).is_none());
    }

    #[test]
    fn a_turn_that_produced_text_is_not_a_provider_error() {
        let end = serde_json::json!({
            "type": "agent_end",
            "messages": [{
                "role": "assistant",
                "content": [{ "type": "text", "text": "hi" }],
                "stopReason": "error",
                "errorMessage": "late failure after partial output"
            }]
        });
        assert!(provider_error_from_agent_end(&end).is_none());
    }

    #[test]
    fn prefers_the_last_errored_assistant_message() {
        let end = serde_json::json!({
            "type": "agent_end",
            "messages": [
                { "role": "assistant", "content": [], "stopReason": "error", "errorMessage": "first" },
                { "role": "user", "content": [] },
                { "role": "assistant", "content": [], "stopReason": "error", "errorMessage": "second" }
            ]
        });
        assert_eq!(
            provider_error_from_agent_end(&end).as_deref(),
            Some("second")
        );
    }

    #[test]
    fn blank_error_text_is_not_surfaced() {
        let end = serde_json::json!({
            "type": "agent_end",
            "messages": [{
                "role": "assistant", "content": [], "stopReason": "error", "errorMessage": "   "
            }]
        });
        assert!(provider_error_from_agent_end(&end).is_none());
    }

    #[test]
    fn session_id_from_state_prefers_session_id() {
        let data = serde_json::json!({"sessionId": "abc", "id": "other"});
        assert_eq!(session_id_from_state(&data), Some("abc"));
    }
}
