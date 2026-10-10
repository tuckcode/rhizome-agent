//! Rhizome loop `Model` backed by an OpenAI-compatible provider (harness
//! plan Phase 4).
//!
//! Test builds only, the same as `rhizome_loop`. Chat does not call it.
//!
//! The adapter forwards provider `ModelEvent`s to the loop unchanged. Tool
//! calls and approvals stay with the loop: its policy decides, and its
//! driver runs the tool. This file maps the loop's `ModelView` to OpenAI
//! chat messages and runs no tools.
//!
//! `ModelView` does not say where the current turn starts, because the
//! driver adds the admitted user message to history only when the turn
//! ends. `ProviderModel` therefore tracks the start itself. See
//! `turn_start`.

use std::collections::HashSet;

use serde_json::{json, Value};

use crate::ai_models::{stream_chat_events_with, AiModelStreamRequest, HttpLimits};
use crate::model_events::ModelEvent;
use crate::rhizome_loop::{HistoryItem, Model, ModelView};

/// Calls the provider once per loop step. Runs no tools.
pub(crate) struct ProviderModel {
    /// Provider, model, API key, and system prompt. `message` is not sent.
    request: AiModelStreamRequest,
    limits: HttpLimits,
    turn: Option<TurnMark>,
}

/// Where the current turn's items start in `ModelView::history`.
struct TurnMark {
    admitted: String,
    start: usize,
}

impl ProviderModel {
    pub(crate) fn new(request: AiModelStreamRequest, limits: HttpLimits) -> Self {
        Self {
            request,
            limits,
            turn: None,
        }
    }

    /// The first history index that belongs to the current turn.
    ///
    /// A new turn starts at the end of history. Within a turn the driver
    /// only appends, so the mark holds. When a turn ends, the driver puts
    /// that turn's user message at the mark. So a `User` item at the mark,
    /// or new admitted text, means a new turn.
    fn turn_start(&mut self, view: &ModelView) -> usize {
        let same_turn = self.turn.as_ref().is_some_and(|mark| {
            mark.admitted == view.admitted
                && mark.start <= view.history.len()
                && !matches!(view.history.get(mark.start), Some(HistoryItem::User { .. }))
        });
        if !same_turn {
            self.turn = Some(TurnMark {
                admitted: view.admitted.clone(),
                start: view.history.len(),
            });
        }
        self.turn.as_ref().map_or(0, |mark| mark.start)
    }
}

impl Model for ProviderModel {
    fn complete(&mut self, view: &ModelView, emit: &mut dyn FnMut(ModelEvent) -> bool) -> bool {
        let start = self.turn_start(view);
        let messages = openai_messages(view, start);
        let tools = tool_definitions(&view.offered_tools);
        // The loop calls this from inside a tokio runtime, and reqwest's
        // blocking client panics when it drops there. So the HTTP call runs
        // on a worker thread. A rendezvous channel hands each event to
        // `emit` here. When `emit` returns false, the receiver drops, the
        // worker's next send fails, and the worker stops reading.
        let (sender, receiver) = std::sync::mpsc::sync_channel::<ModelEvent>(0);
        let request = &self.request;
        let limits = self.limits;
        std::thread::scope(|scope| {
            scope.spawn(move || {
                stream_chat_events_with(request, messages, tools, limits, &mut |event| {
                    sender.send(event).is_ok()
                });
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
pub(crate) fn openai_messages(view: &ModelView, turn_start: usize) -> Vec<Value> {
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
                if !tool_calls.is_empty() {
                    message["tool_calls"] = tool_calls
                        .iter()
                        .map(|call| {
                            let arguments = if call.args.trim().is_empty() {
                                "{}"
                            } else {
                                call.args.as_str()
                            };
                            json!({
                                "id": call.id,
                                "type": "function",
                                "function": { "name": call.name, "arguments": arguments },
                            })
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
            "content": "Not run: the turn stopped first.",
        }));
    }
}

/// OpenAI tool definitions for the names the loop offers.
///
/// `ModelView` carries names only. `create_note` gets its real schema.
/// Any other name gets an open object schema until the loop carries
/// schemas.
fn tool_definitions(names: &[String]) -> Vec<Value> {
    let mut seen = HashSet::new();
    names
        .iter()
        .filter(|name| seen.insert(name.as_str()))
        .map(|name| {
            if name == "create_note" {
                crate::ai_model_tools::openai_create_note_tool()
            } else {
                json!({
                    "type": "function",
                    "function": {
                        "name": name,
                        "parameters": { "type": "object" },
                    },
                })
            }
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
    fn turn_start_follows_the_driver_across_steps_and_turns() {
        let mut model = ProviderModel::new(request("http://127.0.0.1:9/v1"), TEST_LIMITS);
        let calls = HistoryItem::Assistant {
            text: String::new(),
            tool_calls: vec![call("call_1", "echo", "{}")],
        };
        let result = HistoryItem::ToolResult {
            id: "call_1".into(),
            name: "echo".into(),
            output: "{}".into(),
        };
        let reply = HistoryItem::Assistant {
            text: "done".into(),
            tool_calls: vec![],
        };

        // Turn 1, step 1, then step 2 after the tool ran.
        assert_eq!(model.turn_start(&view("go", vec![])), 0);
        assert_eq!(
            model.turn_start(&view("go", vec![calls.clone(), result.clone()])),
            0
        );
        // Turn 2 with the same text. The driver put turn 1's user message
        // at index 0 when turn 1 ended.
        let after_turn_one = vec![
            HistoryItem::User { text: "go".into() },
            calls,
            result,
            reply,
        ];
        assert_eq!(model.turn_start(&view("go", after_turn_one.clone())), 4);
        // Turn 3 with other text.
        let mut after_turn_two = after_turn_one;
        after_turn_two.insert(4, HistoryItem::User { text: "go".into() });
        assert_eq!(model.turn_start(&view("next", after_turn_two)), 5);
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
}
