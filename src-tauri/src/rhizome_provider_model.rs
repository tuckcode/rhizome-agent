//! Rhizome loop `Model` backed by an OpenAI-compatible provider (harness
//! plan Phase 4).
//!
//! Compiles in normal builds, like `rhizome_loop`. Chat does not call it
//! until Phase 6.
//!
//! The adapter forwards provider `ModelEvent`s to the loop unchanged. Tool
//! calls and approvals stay with the loop: its policy decides, and its
//! driver runs the tool. This file maps the loop's `ModelView` to OpenAI
//! chat messages and runs no tools.
//!
//! The driver adds the admitted user message to history only when the turn
//! ends. `ModelView::turn_start` says where it belongs in the meantime.

use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Map, Value};

use crate::ai_models::{
    enter_reasoning_replay_session, recall_reasoning, stream_chat_events_with_params,
    AiModelStreamRequest, HttpLimits,
};
use crate::model_events::ModelEvent;
use crate::rhizome_loop::{HistoryItem, Model, ModelView};

/// Calls the provider once per loop step. Runs no tools.
pub struct ProviderModel {
    /// Provider, model, API key, and system prompt. `message` is not sent.
    request: AiModelStreamRequest,
    /// Body fields sent only when the step offers tools.
    tool_params: Map<String, Value>,
    limits: HttpLimits,
    /// In-memory key for DeepSeek `reasoning_content`. A retarget keeps
    /// it, so a Taproot reroute can still replay thinking from this loop.
    /// A reopened chat builds a new model and starts empty.
    replay_session: String,
}

impl ProviderModel {
    pub fn new(request: AiModelStreamRequest, limits: HttpLimits) -> Self {
        Self {
            request,
            tool_params: Map::new(),
            limits,
            replay_session: next_replay_session(),
        }
    }

    /// Sends later steps to another provider or model. A router can switch
    /// targets inside one turn, because the turn start comes from the view.
    pub fn retarget(&mut self, request: AiModelStreamRequest, tool_params: Map<String, Value>) {
        self.request = request;
        self.tool_params = tool_params;
    }
}

impl Model for ProviderModel {
    fn complete(&mut self, view: &ModelView, emit: &mut dyn FnMut(ModelEvent) -> bool) -> bool {
        let wire = OutboundWire {
            model_id: &self.request.model_id,
            provider_id: &self.request.provider.id,
            base_url: self.request.provider.base_url.as_deref(),
            replay_session: &self.replay_session,
        };
        let messages = openai_messages_for(view, view.turn_start, &wire);
        let tools = tool_definitions(&view.offered_tools);
        // The loop calls this from inside a tokio runtime, and reqwest's
        // blocking client panics when it drops there. So the HTTP call runs
        // on a worker thread. A rendezvous channel hands each event to
        // `emit` here. When `emit` returns false, the receiver drops, the
        // worker's next send fails, and the worker stops reading.
        let (sender, receiver) = std::sync::mpsc::sync_channel::<ModelEvent>(0);
        let request = &self.request;
        let tool_params = &self.tool_params;
        let limits = self.limits;
        let replay_session = self.replay_session.clone();
        std::thread::scope(|scope| {
            scope.spawn(move || {
                let _guard = enter_reasoning_replay_session(replay_session);
                stream_chat_events_with_params(
                    request,
                    messages,
                    tools,
                    tool_params,
                    limits,
                    &mut |event| sender.send(event).is_ok(),
                );
            });
            for event in receiver.iter() {
                if !emit(event) {
                    break;
                }
            }
            drop(receiver);
        });
        // Every call is one round. A failure arrives as `ModelEvent::Error`.
        true
    }
}

/// OpenAI chat messages for one step, in order: history before
/// `turn_start`, the admitted user message, then this turn's items.
///
/// Every assistant tool call gets a `role: "tool"` message, because the
/// provider rejects a call id with no answer. A denied call answers with the
/// reason. A call that never ran answers that the turn stopped first.
pub fn openai_messages(view: &ModelView, turn_start: usize) -> Vec<Value> {
    openai_messages_for(view, turn_start, &OutboundWire::plain())
}

/// Model identity for one outbound chat-completions body.
struct OutboundWire<'a> {
    model_id: &'a str,
    provider_id: &'a str,
    base_url: Option<&'a str>,
    replay_session: &'a str,
}

impl OutboundWire<'static> {
    fn plain() -> Self {
        Self {
            model_id: "",
            provider_id: "",
            base_url: None,
            replay_session: "",
        }
    }
}

fn next_replay_session() -> String {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    format!("replay-{}", NEXT.fetch_add(1, Ordering::Relaxed))
}

/// Gemini 3 and 4 reject a tool step that has no thought signature.
/// The leading number is the generation: `gemini-2.5` is 2, `gemini-3.8` is 3.
fn needs_gemini_thought_placeholder(model_id: &str) -> bool {
    let name = model_id
        .trim()
        .rsplit(['/', ':'])
        .next()
        .unwrap_or(model_id)
        .to_ascii_lowercase();
    let Some(rest) = name.strip_prefix("gemini-") else {
        return false;
    };
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse::<u32>().is_ok_and(|major| major >= 3)
}

fn is_deepseek_target(model_id: &str, provider_id: &str, base_url: Option<&str>) -> bool {
    [model_id, provider_id, base_url.unwrap_or("")]
        .iter()
        .any(|part| part.to_ascii_lowercase().contains("deepseek"))
}

/// `openai_messages` plus Gemini 3+/4 and DeepSeek wire fixes.
///
/// Gemini gets `skip_thought_signature_validator` on the first tool call
/// of each assistant step, including a call that another provider made
/// before a Taproot reroute. DeepSeek gets `reasoning_content` on every
/// assistant message. A step this process did not capture sends `""`.
fn openai_messages_for(view: &ModelView, turn_start: usize, wire: &OutboundWire<'_>) -> Vec<Value> {
    let gemini = needs_gemini_thought_placeholder(wire.model_id);
    let deepseek = is_deepseek_target(wire.model_id, wire.provider_id, wire.base_url);
    let split = turn_start.min(view.history.len());
    let admitted = HistoryItem::User {
        text: view.admitted.clone(),
    };
    let items = view.history[..split]
        .iter()
        .chain(std::iter::once(&admitted))
        .chain(view.history[split..].iter());

    let mut messages = Vec::new();
    let mut unanswered: Vec<String> = Vec::new();
    for item in items {
        let answers_a_call = matches!(
            item,
            HistoryItem::ToolResult { .. } | HistoryItem::ToolDenied { .. }
        );
        if !answers_a_call {
            close_unanswered(&mut unanswered, &mut messages);
        }
        match item {
            HistoryItem::User { text } => {
                messages.push(json!({ "role": "user", "content": text }));
            }
            HistoryItem::Assistant { text, tool_calls } => {
                let mut message = json!({
                    "role": "assistant",
                    "content": if text.is_empty() { Value::Null } else { json!(text) },
                });
                if deepseek {
                    let ids: Vec<String> = if tool_calls.is_empty() {
                        Vec::new()
                    } else {
                        tool_calls.iter().map(|call| call.id.clone()).collect()
                    };
                    let captured = recall_reasoning(
                        wire.replay_session,
                        &ids,
                        if tool_calls.is_empty() {
                            text.as_str()
                        } else {
                            ""
                        },
                    );
                    message["reasoning_content"] = Value::String(captured.unwrap_or_default());
                }
                if !tool_calls.is_empty() {
                    message["tool_calls"] = tool_calls
                        .iter()
                        .enumerate()
                        .map(|(index, call)| {
                            let arguments = if call.args.trim().is_empty() {
                                "{}"
                            } else {
                                call.args.as_str()
                            };
                            let mut value = json!({
                                "id": call.id,
                                "type": "function",
                                "function": { "name": call.name, "arguments": arguments },
                            });
                            if gemini && index == 0 {
                                value["extra_content"] = json!({
                                    "google": {
                                        "thought_signature": "skip_thought_signature_validator"
                                    }
                                });
                            }
                            value
                        })
                        .collect();
                    unanswered = tool_calls.iter().map(|call| call.id.clone()).collect();
                }
                messages.push(message);
            }
            HistoryItem::ToolResult { id, output, .. } => {
                unanswered.retain(|open| open != id);
                messages.push(json!({ "role": "tool", "tool_call_id": id, "content": output }));
            }
            HistoryItem::ToolDenied { id, reason, .. } => {
                unanswered.retain(|open| open != id);
                messages.push(json!({
                    "role": "tool",
                    "tool_call_id": id,
                    "content": format!("Denied: {reason}"),
                }));
            }
        }
    }
    close_unanswered(&mut unanswered, &mut messages);
    messages
}

fn close_unanswered(unanswered: &mut Vec<String>, messages: &mut Vec<Value>) {
    for id in unanswered.drain(..) {
        messages.push(json!({
            "role": "tool",
            "tool_call_id": id,
            "content": crate::rhizome_loop::UNANSWERED_TOOL_OUTPUT,
        }));
    }
}

/// OpenAI tool definitions for the names the loop offers.
///
/// `ModelView` carries names only. Registered tools use the schema from
/// `rhizome_loop` (including `create_note` and the read-only file tools).
/// An extra test name still gets an open object schema.
fn tool_definitions(names: &[String]) -> Vec<Value> {
    let mut seen = HashSet::new();
    names
        .iter()
        .filter(|name| seen.insert(name.as_str()))
        .map(|name| {
            crate::rhizome_loop::openai_tool_definition(name).unwrap_or_else(|| {
                json!({
                    "type": "function",
                    "function": {
                        "name": name,
                        "parameters": { "type": "object" },
                    },
                })
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_models::test_server::{serve, sse, TEST_LIMITS};
    use crate::rhizome_loop::{AgentLoop, DurableEvent, ToolCall};
    use serde_json::json;

    fn call(id: &str, name: &str, args: &str) -> ToolCall {
        ToolCall {
            id: id.into(),
            name: name.into(),
            args: args.into(),
        }
    }

    fn view(admitted: &str, history: Vec<HistoryItem>) -> ModelView {
        ModelView {
            admitted: admitted.into(),
            history,
            turn_start: 0,
            offered_tools: vec!["echo".into()],
        }
    }

    /// A keyless LAN provider. Optional fields that are left out read as
    /// `None`.
    fn request(base_url: &str) -> AiModelStreamRequest {
        serde_json::from_value(json!({
            "provider": {
                "id": "lan",
                "name": "LAN",
                "kind": "open_ai_compatible",
                "base_url": base_url,
                "api_key_storage": "none",
                "models": [{
                    "id": "qwen",
                    "capabilities": {
                        "streaming": true,
                        "tools": true,
                        "vision": false,
                        "json_mode": false,
                        "reasoning": false
                    }
                }]
            },
            "model_id": "qwen",
            "message": ""
        }))
        .expect("test provider request must deserialize")
    }

    #[test]
    fn earlier_turns_then_the_admitted_message_then_this_turn() {
        let history = vec![
            HistoryItem::User {
                text: "earlier".into(),
            },
            HistoryItem::Assistant {
                text: "sure".into(),
                tool_calls: vec![],
            },
            HistoryItem::Assistant {
                text: String::new(),
                tool_calls: vec![call("call_1", "echo", r#"{"text":"ping"}"#)],
            },
            HistoryItem::ToolResult {
                id: "call_1".into(),
                name: "echo".into(),
                output: "pong".into(),
            },
        ];

        let messages = openai_messages(&view("go", history), 2);

        assert_eq!(
            messages,
            vec![
                json!({ "role": "user", "content": "earlier" }),
                json!({ "role": "assistant", "content": "sure" }),
                json!({ "role": "user", "content": "go" }),
                json!({
                    "role": "assistant",
                    "content": null,
                    "tool_calls": [{
                        "id": "call_1",
                        "type": "function",
                        "function": { "name": "echo", "arguments": r#"{"text":"ping"}"# }
                    }]
                }),
                json!({ "role": "tool", "tool_call_id": "call_1", "content": "pong" }),
            ]
        );
    }

    #[test]
    fn denied_and_unanswered_calls_still_get_a_tool_message() {
        // The provider rejects an assistant tool call with no matching
        // tool message, so every id gets one.
        let history = vec![
            HistoryItem::User { text: "a".into() },
            HistoryItem::Assistant {
                text: "trying".into(),
                tool_calls: vec![call("call_1", "bash", "ls"), call("call_2", "echo", "")],
            },
            HistoryItem::ToolDenied {
                id: "call_1".into(),
                name: "bash".into(),
                reason: "not offered".into(),
            },
        ];

        let messages = openai_messages(&view("b", history), 3);

        assert_eq!(
            messages[1]["tool_calls"][1]["function"]["arguments"], "{}",
            "empty arguments go out as an empty object"
        );
        assert_eq!(
            &messages[2..],
            &[
                json!({ "role": "tool", "tool_call_id": "call_1", "content": "Denied: not offered" }),
                json!({ "role": "tool", "tool_call_id": "call_2", "content": "Not run: the turn stopped first." }),
                json!({ "role": "user", "content": "b" }),
            ]
        );
    }

    #[test]
    fn loop_runs_a_tool_round_trip_against_the_local_server() {
        let server = serve(vec![
            sse(&[
                r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"echo","arguments":"{\"text\":\"ping\"}"}}]},"finish_reason":"tool_calls"}]}"#,
                "[DONE]",
            ]),
            sse(&[
                r#"{"choices":[{"delta":{"content":"It said ping."},"finish_reason":"stop"}]}"#,
                "[DONE]",
            ]),
        ]);
        let agent = AgentLoop::new();
        let mut model = ProviderModel::new(request(&server.base_url), TEST_LIMITS);

        agent.submit("say ping");
        agent.run_until_idle(&mut model);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User {
                    text: "say ping".into()
                },
                DurableEvent::ToolCall {
                    id: "call_1".into(),
                    name: "echo".into(),
                    args: r#"{"text":"ping"}"#.into(),
                },
                DurableEvent::ToolResult {
                    id: "call_1".into(),
                    name: "echo".into(),
                    output: r#"{"text":"ping"}"#.into(),
                },
                DurableEvent::Assistant {
                    text: "It said ping.".into()
                },
                DurableEvent::TurnEnd,
            ]
        );

        let requests = server.requests.lock().unwrap();
        assert_eq!(requests.len(), 2);
        let first: serde_json::Value = serde_json::from_str(&requests[0].1).unwrap();
        assert_eq!(
            first["messages"],
            json!([{ "role": "user", "content": "say ping" }])
        );
        assert_eq!(first["tools"][0]["function"]["name"], "echo");
        let second: serde_json::Value = serde_json::from_str(&requests[1].1).unwrap();
        assert_eq!(
            second["messages"],
            json!([
                { "role": "user", "content": "say ping" },
                {
                    "role": "assistant",
                    "content": null,
                    "tool_calls": [{
                        "id": "call_1",
                        "type": "function",
                        "function": { "name": "echo", "arguments": "{\"text\":\"ping\"}" }
                    }]
                },
                { "role": "tool", "tool_call_id": "call_1", "content": "{\"text\":\"ping\"}" },
            ])
        );
    }

    #[test]
    fn emit_returning_false_stops_the_read() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"one"}}]}"#,
            r#"{"choices":[{"delta":{"content":"two"}}]}"#,
            "[DONE]",
        ])]);
        let mut model = ProviderModel::new(request(&server.base_url), TEST_LIMITS);
        let mut events = Vec::new();

        let had_round = model.complete(&view("go", vec![]), &mut |event| {
            events.push(event);
            false
        });

        assert!(had_round);
        assert_eq!(events, vec![ModelEvent::TextDelta { text: "one".into() }]);
    }

    #[test]
    fn a_provider_failure_reaches_the_loop_as_model_failed() {
        let server = serve(vec![crate::ai_models::test_server::http_response(
            "503 Service Unavailable",
            &[],
            "loading model",
        )]);
        let agent = AgentLoop::new();
        let mut model = ProviderModel::new(request(&server.base_url), TEST_LIMITS);

        agent.submit("hi");
        agent.run_until_idle(&mut model);

        let events = agent.events();
        assert!(events.iter().any(|event| matches!(
            event,
            DurableEvent::ModelFailed { message } if message.contains("503")
        )));
        assert_eq!(events.last(), Some(&DurableEvent::TurnEnd));
    }

    #[test]
    fn create_note_is_offered_with_its_real_schema() {
        let definitions = tool_definitions(&["create_note".into(), "echo".into()]);

        assert_eq!(
            definitions[0],
            crate::ai_model_tools::openai_create_note_tool()
        );
        assert_eq!(definitions[1]["function"]["name"], "echo");
        assert_eq!(definitions[1]["function"]["parameters"]["type"], "object");
    }

    #[test]
    fn read_only_file_tools_carry_their_registry_schemas() {
        let definitions = tool_definitions(&[
            "read_file".into(),
            "list_dir".into(),
            "grep".into(),
            "glob".into(),
        ]);
        assert_eq!(definitions[0]["function"]["name"], "read_file");
        assert_eq!(
            definitions[0]["function"]["parameters"]["required"],
            json!(["path"])
        );
        assert_eq!(definitions[1]["function"]["name"], "list_dir");
        assert_eq!(definitions[2]["function"]["name"], "grep");
        assert_eq!(
            definitions[2]["function"]["parameters"]["required"],
            json!(["pattern"])
        );
        assert_eq!(definitions[3]["function"]["name"], "glob");
        assert_eq!(
            definitions[3]["function"]["parameters"]["required"],
            json!(["pattern"])
        );
    }

    #[test]
    fn mutate_file_tools_carry_their_registry_schemas() {
        let definitions = tool_definitions(&["edit_file".into(), "write_file".into()]);
        assert_eq!(definitions[0]["function"]["name"], "edit_file");
        assert_eq!(
            definitions[0]["function"]["parameters"]["required"],
            json!(["path", "old_string", "new_string"])
        );
        assert_eq!(definitions[1]["function"]["name"], "write_file");
        assert_eq!(
            definitions[1]["function"]["parameters"]["required"],
            json!(["path", "content"])
        );
    }

    #[test]
    fn retarget_sends_later_steps_to_the_new_target_with_tool_params() {
        let first = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"a"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let second = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"b"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut model = ProviderModel::new(request(&first.base_url), TEST_LIMITS);
        let history = vec![HistoryItem::User {
            text: "earlier".into(),
        }];
        let step = ModelView {
            turn_start: 1,
            ..view("go", history)
        };
        model.complete(&step, &mut |_| true);

        let mut params = serde_json::Map::new();
        params.insert("parallel_tool_calls".into(), json!(false));
        model.retarget(request(&second.base_url), params);
        model.complete(&step, &mut |_| true);

        let requests = second.requests.lock().unwrap();
        let body: serde_json::Value = serde_json::from_str(&requests[0].1).unwrap();
        assert_eq!(body["parallel_tool_calls"], json!(false));
        assert_eq!(
            body["messages"],
            json!([
                { "role": "user", "content": "earlier" },
                { "role": "user", "content": "go" },
            ])
        );
    }

    #[test]
    fn the_admitted_message_goes_where_the_view_says_the_turn_starts() {
        // A fresh adapter joins mid-turn, for example after a router
        // failover. Only `ModelView::turn_start` knows the turn began at 0.
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut model = ProviderModel::new(request(&server.base_url), TEST_LIMITS);
        let mid_turn = ModelView {
            turn_start: 0,
            ..view(
                "go",
                vec![
                    HistoryItem::Assistant {
                        text: String::new(),
                        tool_calls: vec![call("call_1", "echo", "{}")],
                    },
                    HistoryItem::ToolResult {
                        id: "call_1".into(),
                        name: "echo".into(),
                        output: "{}".into(),
                    },
                ],
            )
        };

        model.complete(&mid_turn, &mut |_| true);

        let requests = server.requests.lock().unwrap();
        let body: serde_json::Value = serde_json::from_str(&requests[0].1).unwrap();
        assert_eq!(
            body["messages"][0],
            json!({ "role": "user", "content": "go" })
        );
    }

    fn wire<'a>(
        model_id: &'a str,
        provider_id: &'a str,
        base_url: Option<&'a str>,
        replay_session: &'a str,
    ) -> OutboundWire<'a> {
        OutboundWire {
            model_id,
            provider_id,
            base_url,
            replay_session,
        }
    }

    fn tool_step(first: &str, second: &str) -> HistoryItem {
        HistoryItem::Assistant {
            text: String::new(),
            tool_calls: vec![
                call(first, "echo", r#"{"text":"one"}"#),
                call(second, "echo", r#"{"text":"two"}"#),
            ],
        }
    }

    fn signed_call(id: &str, arguments: &str) -> Value {
        json!({
            "id": id,
            "type": "function",
            "extra_content": {
                "google": { "thought_signature": "skip_thought_signature_validator" }
            },
            "function": { "name": "echo", "arguments": arguments }
        })
    }

    fn plain_call(id: &str, arguments: &str) -> Value {
        json!({
            "id": id,
            "type": "function",
            "function": { "name": "echo", "arguments": arguments }
        })
    }

    #[test]
    fn gemini_3_and_4_sign_only_the_first_call_of_each_assistant_step() {
        let history = vec![
            HistoryItem::User {
                text: "earlier".into(),
            },
            tool_step("call_a", "call_b"),
            HistoryItem::ToolResult {
                id: "call_a".into(),
                name: "echo".into(),
                output: "one".into(),
            },
            HistoryItem::ToolResult {
                id: "call_b".into(),
                name: "echo".into(),
                output: "two".into(),
            },
            tool_step("call_c", "call_d"),
        ];
        let target = wire("gemini-3.8-flash", "gemini", None, "");

        let messages = openai_messages_for(&view("go", history), 1, &target);

        let first = &messages[2]["tool_calls"];
        let second = &messages[5]["tool_calls"];
        assert_eq!(first[0], signed_call("call_a", r#"{"text":"one"}"#));
        assert_eq!(first[1], plain_call("call_b", r#"{"text":"two"}"#));
        assert_eq!(second[0], signed_call("call_c", r#"{"text":"one"}"#));
        assert_eq!(second[1], plain_call("call_d", r#"{"text":"two"}"#));
        assert!(messages
            .iter()
            .all(|message| message.get("reasoning_content").is_none()));
    }

    #[test]
    fn gemini_signature_follows_the_model_id_generation() {
        let history = vec![tool_step("call_a", "call_b")];
        let view = view("go", history);
        for model_id in [
            "gemini-3.8-flash",
            "gemini-3-pro-preview",
            "GEMINI-4-flash",
            "models/gemini-4.1-pro",
            "google/gemini-3.8-flash",
        ] {
            let messages = openai_messages_for(&view, 0, &wire(model_id, "gemini", None, ""));
            assert_eq!(
                messages[1]["tool_calls"][0]["extra_content"]["google"]["thought_signature"],
                "skip_thought_signature_validator",
                "{model_id}"
            );
            assert!(messages[1]["tool_calls"][1].get("extra_content").is_none());
        }
        for model_id in ["gemini-2.5-flash", "gemini-2.0-flash", "qwen", "gpt-4o"] {
            let messages = openai_messages_for(&view, 0, &wire(model_id, "lan", None, ""));
            assert!(
                messages[1]["tool_calls"][0].get("extra_content").is_none(),
                "{model_id}"
            );
            assert_eq!(messages, openai_messages(&view, 0));
        }
    }

    #[test]
    fn a_reroute_onto_gemini_signs_tool_calls_from_the_previous_provider() {
        // Routing keeps one ProviderModel and retargets it
        // (`rhizome_routing` attempt loop). The calls in history were
        // made by the previous provider. Gemini still requires a signature.
        let first = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"a"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let second = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"b"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut model = ProviderModel::new(request(&first.base_url), TEST_LIMITS);
        let history = vec![
            HistoryItem::User {
                text: "earlier".into(),
            },
            tool_step("foreign_1", "foreign_2"),
            HistoryItem::ToolResult {
                id: "foreign_1".into(),
                name: "echo".into(),
                output: "one".into(),
            },
            HistoryItem::ToolResult {
                id: "foreign_2".into(),
                name: "echo".into(),
                output: "two".into(),
            },
        ];
        let step = ModelView {
            turn_start: history.len(),
            ..view("go", history)
        };
        model.complete(&step, &mut |_| true);

        model.retarget(
            request_for(&second.base_url, "gemini", "gemini-3.8-flash"),
            Map::new(),
        );
        model.complete(&step, &mut |_| true);

        let qwen_body: Value = serde_json::from_str(&first.requests.lock().unwrap()[0].1).unwrap();
        assert!(qwen_body["messages"][1]["tool_calls"][0]
            .get("extra_content")
            .is_none());
        let gemini_body: Value =
            serde_json::from_str(&second.requests.lock().unwrap()[0].1).unwrap();
        assert_eq!(
            gemini_body["messages"][1]["tool_calls"][0]["extra_content"]["google"]
                ["thought_signature"],
            "skip_thought_signature_validator"
        );
        assert!(gemini_body["messages"][1]["tool_calls"][1]
            .get("extra_content")
            .is_none());
        assert!(gemini_body["messages"][1]
            .get("reasoning_content")
            .is_none());
    }

    #[test]
    fn deepseek_replays_reasoning_on_every_prior_assistant_turn() {
        crate::ai_models::note_reasoning(
            "deepseek-unit",
            &["call_1".into()],
            "",
            "because the tool",
        );
        let history = vec![
            HistoryItem::User {
                text: "earlier".into(),
            },
            HistoryItem::Assistant {
                text: "sure".into(),
                tool_calls: vec![],
            },
            HistoryItem::Assistant {
                text: String::new(),
                tool_calls: vec![call("call_1", "echo", r#"{"text":"ping"}"#)],
            },
            HistoryItem::ToolResult {
                id: "call_1".into(),
                name: "echo".into(),
                output: "pong".into(),
            },
        ];
        let target = wire(
            "deepseek-flash",
            "deepseek",
            Some("https://api.deepseek.com"),
            "deepseek-unit",
        );

        let messages = openai_messages_for(&view("go", history), 2, &target);

        assert_eq!(messages[1]["reasoning_content"], "");
        assert_eq!(messages[3]["reasoning_content"], "because the tool");
        assert!(messages[3]["tool_calls"][0].get("extra_content").is_none());
        assert_eq!(messages[0].get("reasoning_content"), None);
        assert_eq!(messages[4].get("reasoning_content"), None);
    }

    #[test]
    fn other_providers_omit_the_deepseek_and_gemini_fields() {
        let history = vec![
            HistoryItem::Assistant {
                text: "sure".into(),
                tool_calls: vec![],
            },
            tool_step("call_a", "call_b"),
        ];
        let seen = view("go", history);
        let plain = openai_messages(&seen, 0);
        let qwen = openai_messages_for(&seen, 0, &wire("qwen", "lan", None, "deepseek-unit"));

        assert_eq!(qwen, plain);
        assert!(plain
            .iter()
            .all(|message| message.get("reasoning_content").is_none()));
        assert!(plain[2]["tool_calls"]
            .as_array()
            .unwrap()
            .iter()
            .all(|call| call.get("extra_content").is_none()));
    }

    #[test]
    fn a_deepseek_tool_round_replays_captured_reasoning_and_leaves_the_log_alone() {
        let server = serve(vec![
            sse(&[
                r#"{"choices":[{"delta":{"reasoning_content":"sigil-reason-"}}]}"#,
                r#"{"choices":[{"delta":{"reasoning_content":"need-the-tool"}}]}"#,
                r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"echo","arguments":"{\"text\":\"ping\"}"}}]},"finish_reason":"tool_calls"}]}"#,
                "[DONE]",
            ]),
            sse(&[
                r#"{"choices":[{"delta":{"content":"It said ping."},"finish_reason":"stop"}]}"#,
                "[DONE]",
            ]),
        ]);
        let agent = AgentLoop::from_log(vec![
            DurableEvent::User {
                text: "earlier".into(),
            },
            DurableEvent::Assistant {
                text: "sure".into(),
            },
            DurableEvent::TurnEnd,
        ]);
        let mut model = ProviderModel::new(
            request_for(&server.base_url, "deepseek", "deepseek-flash"),
            TEST_LIMITS,
        );
        agent.submit("say ping");
        agent.run_until_idle(&mut model);

        let requests = server.requests.lock().unwrap();
        assert_eq!(requests.len(), 2);
        let first: Value = serde_json::from_str(&requests[0].1).unwrap();
        let second: Value = serde_json::from_str(&requests[1].1).unwrap();
        assert_eq!(first["messages"][1]["reasoning_content"], "");
        assert_eq!(second["messages"][1]["reasoning_content"], "");
        assert_eq!(
            second["messages"][3]["reasoning_content"],
            "sigil-reason-need-the-tool"
        );
        assert!(second["messages"][3]["tool_calls"][0]
            .get("extra_content")
            .is_none());

        let logged = serde_json::to_string(&agent.events()).expect("log json");
        assert!(
            !logged.contains("sigil-reason-need-the-tool"),
            "reasoning must stay out of the native log: {logged}"
        );
        assert!(!logged.contains("reasoning_content"));
    }

    fn request_for(base_url: &str, provider_id: &str, model_id: &str) -> AiModelStreamRequest {
        serde_json::from_value(json!({
            "provider": {
                "id": provider_id,
                "name": provider_id,
                "kind": "open_ai_compatible",
                "base_url": base_url,
                "api_key_storage": "none",
                "models": [{
                    "id": model_id,
                    "capabilities": {
                        "streaming": true,
                        "tools": true,
                        "vision": false,
                        "json_mode": false,
                        "reasoning": false
                    }
                }]
            },
            "model_id": model_id,
            "message": ""
        }))
        .expect("test provider request must deserialize")
    }
}
