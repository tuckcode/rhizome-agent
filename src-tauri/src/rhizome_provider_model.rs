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
//! Signed-in ChatGPT is a separate client (`ai_models/openai_responses.rs`).
//! `complete` stays on chat completions until `chat_auth_kind_for_provider`
//! returns `SignedInChatGpt`.
//!
//! The driver adds the admitted user message to history only when the turn
//! ends. `ModelView::turn_start` says where it belongs in the meantime.

use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Map, Value};

use crate::ai_models::{
    clear_reasoning_session, enter_reasoning_replay_session, recall_call_reasoning,
    recall_text_reasoning, stream_chat_events_with_params, AiModelStreamRequest, HttpLimits,
};
use crate::model_events::ModelEvent;
use crate::rhizome_loop::{HistoryItem, Model, ModelView};

/// Which client a chat step uses. PR 1's OAuth types stay out of this file.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ChatAuthKind {
    /// An API key, or a local OpenAI-compatible server.
    ApiKey,
    /// Signed-in ChatGPT. `POST /v1/responses`.
    SignedInChatGpt,
}

/// The HTTP client for one chat step.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ChatTransport {
    ChatCompletions,
    Responses,
}

/// `true` selects the Responses client.
pub(crate) fn chat_auth_kind(signed_in_chatgpt: bool) -> ChatAuthKind {
    if signed_in_chatgpt {
        ChatAuthKind::SignedInChatGpt
    } else {
        ChatAuthKind::ApiKey
    }
}

/// Signed-in ChatGPT uses the Responses client. Every other kind stays on
/// chat completions.
pub(crate) fn chat_transport(kind: ChatAuthKind) -> ChatTransport {
    match kind {
        ChatAuthKind::SignedInChatGpt => ChatTransport::Responses,
        ChatAuthKind::ApiKey => ChatTransport::ChatCompletions,
    }
}

/// Always `ApiKey` until PR 1.
///
/// Hookup: replace `chat_auth_kind(false)` below with
/// `chat_auth_kind(provider_is_signed_in_chatgpt(provider))`
/// where `provider_is_signed_in_chatgpt` is true when that provider's auth
/// kind is the signed-in ChatGPT record from PR 1. `complete` already calls
/// this function, so that line is the whole switch.
pub(crate) fn chat_auth_kind_for_provider(
    _provider: &crate::ai_models::AiModelProvider,
) -> ChatAuthKind {
    chat_auth_kind(false)
}

/// The Responses body fields that come from a chat-completions turn.
/// Token caps stay off this path.
fn responses_turn_fields(
    extras: &crate::ai_models::TurnExtras,
) -> (Option<String>, Option<String>) {
    let prefix = extras
        .system_prefix
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string);
    let effort = extras
        .body
        .get("reasoning_effort")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|effort| !effort.is_empty())
        .map(str::to_string);
    (prefix, effort)
}

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

fn note_image_skip(request: &AiModelStreamRequest, error: &crate::model_events::ModelError) {
    if request.defer_image_skip {
        return;
    }
    let current = request
        .chat_images
        .last()
        .is_some_and(|turn| !turn.is_empty());
    if !current
        || !crate::chat_images::image_client_status(error.status)
        || !crate::chat_images::error_mentions_image(&error.message)
    {
        return;
    }
    if let Some(session) = &request.image_session_id {
        let _ = crate::chat_images::skip_current_turn_images(session);
    }
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
    fn set_chat_images(&mut self, images: Vec<Vec<crate::chat_images::ChatImage>>) {
        self.request.chat_images = images;
        if let Some((session, send_anyway)) = crate::chat_images::armed_image_turn() {
            self.request.image_session_id = Some(session);
            self.request.send_anyway = send_anyway;
        }
    }

    fn complete(&mut self, view: &ModelView, emit: &mut dyn FnMut(ModelEvent) -> bool) -> bool {
        let wire = OutboundWire {
            model_id: &self.request.model_id,
            provider_id: &self.request.provider.id,
            base_url: self.request.provider.base_url.as_deref(),
            replay_session: &self.replay_session,
        };
        let accepts = self.request.vision_state == crate::chat_images::VisionState::Yes
            || self.request.send_anyway;
        let messages = openai_messages_for(
            view,
            view.turn_start,
            &wire,
            &self.request.chat_images,
            accepts,
        );
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
        let (extras, thinking) = crate::ai_models::user_turn_reasoning(request);
        let forced_off = !tools.is_empty()
            && crate::ai_model_tools::chat_tools_reasoning(
                &request.provider.kind,
                request.provider.base_url.as_deref(),
                &request.model_id,
                true,
            ) == crate::ai_model_tools::ChatToolsReasoning::None;
        let transport = chat_transport(chat_auth_kind_for_provider(&request.provider));
        std::thread::scope(|scope| {
            scope.spawn(move || {
                let replay_for_responses = replay_session.clone();
                let _guard = enter_reasoning_replay_session(replay_session);
                let mut saw_text = false;
                let mut saw_tools = false;
                let mut emit_step = |event: ModelEvent| {
                    let event = match event {
                        ModelEvent::TextDelta { ref text } if !text.trim().is_empty() => {
                            saw_text = true;
                            event
                        }
                        ModelEvent::ToolCallStart { .. } => {
                            saw_tools = true;
                            event
                        }
                        ModelEvent::Finish { .. }
                            if thinking && !forced_off && !saw_text && !saw_tools =>
                        {
                            ModelEvent::Error(crate::model_events::ModelError {
                                kind: crate::model_events::ModelErrorKind::Rejected,
                                status: None,
                                message: crate::ai_models::REASONING_EMPTY_REPLY.into(),
                            })
                        }
                        ModelEvent::Finish { .. } if forced_off && !saw_text && !saw_tools => {
                            ModelEvent::Error(crate::model_events::ModelError {
                                kind: crate::model_events::ModelErrorKind::Rejected,
                                status: None,
                                message: "AI provider response did not include assistant text."
                                    .into(),
                            })
                        }
                        other => other,
                    };
                    sender.send(event).is_ok()
                };
                match transport {
                    ChatTransport::ChatCompletions => {
                        stream_chat_events_with_params(
                            request,
                            messages,
                            tools,
                            tool_params,
                            &extras,
                            limits,
                            &mut emit_step,
                        );
                    }
                    ChatTransport::Responses => {
                        // Reached only after the PR 1 hookup in
                        // `chat_auth_kind_for_provider`. The refresh callback
                        // stays empty until that PR passes its own.
                        let Some(token) = request
                            .api_key_override
                            .as_deref()
                            .map(str::trim)
                            .filter(|token| !token.is_empty())
                        else {
                            let _ = emit_step(ModelEvent::Error(crate::model_events::ModelError {
                                kind: crate::model_events::ModelErrorKind::Auth,
                                status: None,
                                message: crate::ai_models::openai_responses::SIGN_IN_AGAIN.into(),
                            }));
                            return;
                        };
                        let (system_prefix, reasoning_effort) = responses_turn_fields(&extras);
                        let mut auth = crate::ai_models::openai_responses::BearerSession::new(
                            token.to_string(),
                            || Err(String::new()),
                        );
                        crate::ai_models::openai_responses::stream_chatgpt_turn(
                            &crate::ai_models::openai_responses::ChatGptTurn {
                                base_url: request.provider.base_url.as_deref().unwrap_or(""),
                                model: &request.model_id,
                                instructions: request.system_prompt.as_deref(),
                                system_prefix: system_prefix.as_deref(),
                                reasoning_effort: reasoning_effort.as_deref(),
                                messages: &messages,
                                tools: &tools,
                                replay_session: &replay_for_responses,
                            },
                            &mut auth,
                            limits,
                            &mut emit_step,
                        );
                    }
                }
            });
            for event in receiver.iter() {
                if let crate::model_events::ModelEvent::Error(error) = &event {
                    note_image_skip(&self.request, error);
                }
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

impl Drop for ProviderModel {
    fn drop(&mut self) {
        clear_reasoning_session(&self.replay_session);
        crate::ai_models::openai_responses::clear_responses_replay(&self.replay_session);
    }
}

/// OpenAI chat messages for one step, in order: history before
/// `turn_start`, the admitted user message, then this turn's items.
///
/// Every assistant tool call gets a `role: "tool"` message, because the
/// provider rejects a call id with no answer. A denied call answers with the
/// reason. A call that never ran answers that the turn stopped first.
pub fn openai_messages(view: &ModelView, turn_start: usize) -> Vec<Value> {
    openai_messages_for(view, turn_start, &OutboundWire::plain(), &[], true)
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

/// Last `/` segment, then the text before the first `:`.
///
/// `google/gemini-3.8-flash:free` becomes `gemini-3.8-flash`. A dash
/// inside the name stays. Any OpenRouter-style tag (`:free`, `:floor`)
/// is dropped the same way.
fn normalized_model_name(model_id: &str) -> String {
    let name = model_id.trim().to_ascii_lowercase();
    let segment = name.rsplit('/').next().unwrap_or(name.as_str());
    segment
        .split_once(':')
        .map(|(name, _tag)| name)
        .unwrap_or(segment)
        .to_string()
}

/// Gemini rejects a tool step that has no thought signature, except
/// Gemini 1 and Gemini 2. A versionless alias such as
/// `gemini-flash-latest` needs the placeholder too. The generation is
/// the leading number: `gemini-2.5` is 2, `gemini-3.8` is 3. No leading
/// number is not 1 or 2.
fn needs_gemini_thought_placeholder(model_id: &str) -> bool {
    let name = normalized_model_name(model_id);
    let Some(rest) = name.strip_prefix("gemini-") else {
        return false;
    };
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    match digits.parse::<u32>() {
        Ok(major) => major >= 3,
        Err(_) => true,
    }
}

fn is_deepseek_target(model_id: &str, provider_id: &str, base_url: Option<&str>) -> bool {
    [model_id, provider_id, base_url.unwrap_or("")]
        .iter()
        .any(|part| part.to_ascii_lowercase().contains("deepseek"))
}

/// `openai_messages` plus Gemini 3+/4 and DeepSeek wire fixes.
///
/// Gemini, other than Gemini 1 and Gemini 2, gets
/// `skip_thought_signature_validator` on the first tool call of each
/// assistant step, including a call that another provider made before a
/// Taproot reroute. DeepSeek gets `reasoning_content` on every
/// assistant message. A step this process did not capture sends `""`.
fn openai_messages_for(
    view: &ModelView,
    turn_start: usize,
    wire: &OutboundWire<'_>,
    ledger: &[Vec<crate::chat_images::ChatImage>],
    accepts_images: bool,
) -> Vec<Value> {
    let gemini = needs_gemini_thought_placeholder(wire.model_id);
    let deepseek = is_deepseek_target(wire.model_id, wire.provider_id, wire.base_url);
    let split = turn_start.min(view.history.len());
    let admitted = HistoryItem::User {
        text: view.admitted.clone(),
    };
    let items: Vec<&HistoryItem> = view.history[..split]
        .iter()
        .chain(std::iter::once(&admitted))
        .chain(view.history[split..].iter())
        .collect();
    let text_only: Vec<&str> = items
        .iter()
        .filter_map(|item| match item {
            HistoryItem::Assistant { text, tool_calls } if tool_calls.is_empty() => {
                Some(text.as_str())
            }
            _ => None,
        })
        .collect();
    let text_reasoning = if deepseek {
        recall_text_reasoning(wire.replay_session, &text_only)
    } else {
        Vec::new()
    };
    let mut text_cursor = 0usize;

    let user_count = items
        .iter()
        .filter(|item| matches!(item, HistoryItem::User { .. }))
        .count();
    let aligned = crate::chat_images::image_sets_for_users(user_count, ledger);
    let user_images = crate::chat_images::budget_turns(&aligned, accepts_images);
    let mut user_index = 0usize;

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
                let turn = user_images.get(user_index).cloned().unwrap_or(
                    crate::chat_images::BudgetedTurn {
                        images: Vec::new(),
                        omitted: false,
                    },
                );
                user_index += 1;
                messages.push(json!({
                    "role": "user",
                    "content": crate::chat_images::openai_turn_content(text, &turn)
                }));
            }
            HistoryItem::Assistant { text, tool_calls } => {
                let mut message = json!({
                    "role": "assistant",
                    "content": if text.is_empty() { Value::Null } else { json!(text) },
                });
                if deepseek {
                    let captured = if tool_calls.is_empty() {
                        let found = text_reasoning.get(text_cursor).cloned().unwrap_or(None);
                        text_cursor += 1;
                        found
                    } else {
                        let ids: Vec<String> =
                            tool_calls.iter().map(|call| call.id.clone()).collect();
                        recall_call_reasoning(wire.replay_session, &ids)
                    };
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
    use crate::ai_models::test_server::{http_response, serve, sse, TEST_LIMITS};
    use crate::ai_models::{clear_reasoning_session, recall_call_reasoning};
    use crate::rhizome_loop::{AgentLoop, DurableEvent, ToolCall};
    use serde_json::json;

    fn call(id: &str, name: &str, args: &str) -> ToolCall {
        ToolCall {
            id: id.into(),
            name: name.into(),
            args: args.into(),
        }
    }

    #[test]
    fn signed_in_chatgpt_selects_the_responses_client() {
        assert_eq!(
            chat_transport(ChatAuthKind::ApiKey),
            ChatTransport::ChatCompletions
        );
        assert_eq!(
            chat_transport(ChatAuthKind::SignedInChatGpt),
            ChatTransport::Responses
        );
        let request = request("http://127.0.0.1:9/v1");
        assert_eq!(
            chat_auth_kind_for_provider(&request.provider),
            ChatAuthKind::ApiKey
        );
        assert_eq!(chat_auth_kind(false), ChatAuthKind::ApiKey);
        assert_eq!(chat_auth_kind(true), ChatAuthKind::SignedInChatGpt);
        let mut body = serde_json::Map::new();
        body.insert("reasoning_effort".into(), json!("medium"));
        body.insert("max_completion_tokens".into(), json!(128));
        let extras = crate::ai_models::TurnExtras {
            system_prefix: Some(" Prefix ".into()),
            body,
        };
        let (prefix, effort) = responses_turn_fields(&extras);
        assert_eq!(prefix.as_deref(), Some("Prefix"));
        assert_eq!(effort.as_deref(), Some("medium"));
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

        let messages = openai_messages_for(&view("go", history), 1, &target, &[], true);

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
            "google/gemini-3.8-flash:free",
            "gemini-3.8-flash:free",
        ] {
            let messages =
                openai_messages_for(&view, 0, &wire(model_id, "gemini", None, ""), &[], true);
            assert_eq!(
                messages[1]["tool_calls"][0]["extra_content"]["google"]["thought_signature"],
                "skip_thought_signature_validator",
                "{model_id}"
            );
            assert!(messages[1]["tool_calls"][1].get("extra_content").is_none());
        }
        for model_id in ["gemini-2.5-flash", "gemini-2.0-flash", "qwen", "gpt-4o"] {
            let messages =
                openai_messages_for(&view, 0, &wire(model_id, "lan", None, ""), &[], true);
            assert!(
                messages[1]["tool_calls"][0].get("extra_content").is_none(),
                "{model_id}"
            );
            assert_eq!(messages, openai_messages(&view, 0));
        }
    }

    #[test]
    fn versionless_gemini_aliases_need_the_thought_signature() {
        let history = vec![tool_step("call_a", "call_b")];
        let view = view("go", history);
        for model_id in [
            "gemini-flash-latest",
            "gemini-pro-latest",
            "models/gemini-flash-latest",
            "google/gemini-pro-latest:free",
        ] {
            let messages =
                openai_messages_for(&view, 0, &wire(model_id, "gemini", None, ""), &[], true);
            assert_eq!(
                messages[1]["tool_calls"][0]["extra_content"]["google"]["thought_signature"],
                "skip_thought_signature_validator",
                "{model_id}"
            );
        }
        for model_id in ["gemini-2.5-flash", "gemini-1.5-pro"] {
            let messages =
                openai_messages_for(&view, 0, &wire(model_id, "lan", None, ""), &[], true);
            assert!(
                messages[1]["tool_calls"][0].get("extra_content").is_none(),
                "{model_id}"
            );
        }
    }

    #[test]
    fn model_name_keeps_the_last_segment_and_drops_the_first_tag() {
        assert_eq!(
            normalized_model_name("gemini-3.8-flash"),
            "gemini-3.8-flash"
        );
        assert_eq!(
            normalized_model_name("google/gemini-3.8-flash"),
            "gemini-3.8-flash"
        );
        assert_eq!(
            normalized_model_name("google/gemini-3.8-flash:free"),
            "gemini-3.8-flash"
        );
        assert_eq!(normalized_model_name("a/b/model:tag"), "model");
        assert_eq!(
            normalized_model_name("gemini-2.5-flash"),
            "gemini-2.5-flash"
        );
        assert!(needs_gemini_thought_placeholder("a/b/gemini-3-pro:tag"));
        assert!(needs_gemini_thought_placeholder(
            "google/gemini-3.8-flash:floor"
        ));
        assert!(!needs_gemini_thought_placeholder("a/b/model:tag"));
        assert!(!needs_gemini_thought_placeholder("gemini-2.5-flash"));
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

        let messages = openai_messages_for(&view("go", history), 2, &target, &[], true);

        assert_eq!(messages[1]["reasoning_content"], "");
        assert_eq!(messages[3]["reasoning_content"], "because the tool");
        assert!(messages[3]["tool_calls"][0].get("extra_content").is_none());
        assert_eq!(messages[0].get("reasoning_content"), None);
        assert_eq!(messages[4].get("reasoning_content"), None);
    }

    #[test]
    fn identical_text_only_turns_replay_in_capture_order() {
        crate::ai_models::note_reasoning("deepseek-order", &[], "Done.", "first thought");
        crate::ai_models::note_reasoning("deepseek-order", &[], "Done.", "second thought");
        let history = vec![
            HistoryItem::Assistant {
                text: "Done.".into(),
                tool_calls: vec![],
            },
            HistoryItem::User {
                text: "again".into(),
            },
            HistoryItem::Assistant {
                text: "Done.".into(),
                tool_calls: vec![],
            },
        ];
        let target = wire("deepseek-flash", "deepseek", None, "deepseek-order");

        let messages = openai_messages_for(&view("go", history), 3, &target, &[], true);

        assert_eq!(messages[0]["reasoning_content"], "first thought");
        assert_eq!(messages[2]["reasoning_content"], "second thought");
        clear_reasoning_session("deepseek-order");
    }

    #[test]
    fn a_missing_middle_text_turn_sends_empty_reasoning() {
        crate::ai_models::note_reasoning("deepseek-gap", &[], "alpha", "first");
        crate::ai_models::note_reasoning("deepseek-gap", &[], "gamma", "third");
        let history = vec![
            HistoryItem::Assistant {
                text: "alpha".into(),
                tool_calls: vec![],
            },
            HistoryItem::User { text: "mid".into() },
            HistoryItem::Assistant {
                text: "beta".into(),
                tool_calls: vec![],
            },
            HistoryItem::User {
                text: "next".into(),
            },
            HistoryItem::Assistant {
                text: "gamma".into(),
                tool_calls: vec![],
            },
        ];
        let target = wire("deepseek-flash", "deepseek", None, "deepseek-gap");

        let messages = openai_messages_for(&view("go", history), 5, &target, &[], true);

        assert_eq!(messages[0]["reasoning_content"], "first");
        assert_eq!(messages[2]["reasoning_content"], "");
        assert_eq!(messages[4]["reasoning_content"], "third");
        clear_reasoning_session("deepseek-gap");
    }

    #[test]
    fn dropping_the_provider_model_clears_its_reasoning_session() {
        let kept = ProviderModel::new(request("http://127.0.0.1:9"), TEST_LIMITS);
        let dropped = ProviderModel::new(request("http://127.0.0.1:9"), TEST_LIMITS);
        let kept_session = kept.replay_session.clone();
        let dropped_session = dropped.replay_session.clone();
        crate::ai_models::note_reasoning(&kept_session, &["keep".into()], "", "stay");
        crate::ai_models::note_reasoning(&dropped_session, &["gone".into()], "", "leave");

        drop(dropped);

        assert_eq!(
            recall_call_reasoning(&kept_session, &["keep".into()]),
            Some("stay".into())
        );
        assert_eq!(
            recall_call_reasoning(&dropped_session, &["gone".into()]),
            None
        );
        drop(kept);
        assert_eq!(recall_call_reasoning(&kept_session, &["keep".into()]), None);
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
        let qwen = openai_messages_for(
            &seen,
            0,
            &wire("qwen", "lan", None, "deepseek-unit"),
            &[],
            true,
        );

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

    fn isolate_catalog() {
        thread_local! {
            static DIR: std::cell::RefCell<Option<tempfile::TempDir>> = const { std::cell::RefCell::new(None) };
        }
        DIR.with(|slot| {
            if slot.borrow().is_none() {
                *slot.borrow_mut() = Some(tempfile::tempdir().unwrap());
            }
            let path = slot.borrow().as_ref().unwrap().path().to_path_buf();
            crate::reasoning_levels::reset_reasoning_state_for_test(Some(path));
        });
    }

    fn reasoned(
        base_url: &str,
        provider: &str,
        model_id: &str,
        level: &str,
    ) -> AiModelStreamRequest {
        isolate_catalog();
        let mut request = request(base_url);
        request.provider.id = provider.into();
        request.model_id = model_id.into();
        request.provider.models[0].id = model_id.into();
        request.reasoning_level = Some(level.into());
        request
    }

    fn one_turn(model: &mut ProviderModel) -> Vec<ModelEvent> {
        let mut events = Vec::new();
        model.complete(&view("go", Vec::new()), &mut |event| {
            let terminal = event.is_terminal();
            events.push(event);
            !terminal
        });
        events
    }

    #[test]
    fn an_empty_reply_with_a_reasoning_level_is_an_error() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":""},"finish_reason":"length"}]}"#,
            "[DONE]",
        ])]);
        let mut model = ProviderModel::new(
            reasoned(&server.base_url, "xai", "grok-4.7", "high"),
            TEST_LIMITS,
        );
        let events = one_turn(&mut model);
        match events.last() {
            Some(ModelEvent::Error(error)) => {
                assert_eq!(error.message, crate::ai_models::REASONING_EMPTY_REPLY);
            }
            other => panic!("expected the empty-reply error, got {other:?}"),
        }
        let raw = server.requests.lock().unwrap()[0].1.clone();
        let body: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(body["reasoning_effort"], json!("high"));
        assert!(body.get("max_tokens").is_none());
        assert!(body.get("max_completion_tokens").is_none());
    }

    #[test]
    fn a_saved_level_the_model_cannot_use_steps_down_and_notifies() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let (tx, rx) = std::sync::mpsc::channel();
        let slot = std::sync::Arc::new(std::sync::Mutex::new(Some("max".to_string())));
        let mut request = reasoned(&server.base_url, "xai", "grok-4.7", "max");
        request.reasoning_slot = Some(std::sync::Arc::clone(&slot));
        request.reasoning_notice_tx = Some(tx);
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let events = one_turn(&mut model);
        assert!(matches!(events.last(), Some(ModelEvent::Finish { .. })));
        let notice = rx.try_recv().expect("downgrade notice");
        assert_eq!(notice.code, "downgraded");
        assert_eq!(notice.from.as_deref(), Some("max"));
        assert_eq!(notice.to.as_deref(), Some("xhigh"));
        let raw = server.requests.lock().unwrap()[0].1.clone();
        let body: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(body["reasoning_effort"], json!("xhigh"));
        assert_eq!(slot.lock().unwrap().as_deref(), Some("max"));
    }

    #[test]
    fn an_unknown_model_sends_no_reasoning_params() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let (tx, rx) = std::sync::mpsc::channel();
        let mut request = reasoned(&server.base_url, "llm7", "not-a-real-model", "high");
        request.reasoning_notice_tx = Some(tx);
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let _ = one_turn(&mut model);
        let notice = rx.try_recv().expect("unsupported notice");
        assert_eq!(notice.code, "unsupported");
        assert_eq!(notice.from.as_deref(), Some("high"));
        assert!(notice.to.is_none());
        let raw = server.requests.lock().unwrap()[0].1.clone();
        let body: serde_json::Value = serde_json::from_str(&raw).unwrap();
        for key in [
            "reasoning_effort",
            "reasoning",
            "thinking",
            "chat_template_kwargs",
            "max_tokens",
        ] {
            assert!(body.get(key).is_none(), "{key} was sent: {body}");
        }
    }

    #[test]
    fn a_tool_turn_forces_reasoning_off_and_keeps_the_saved_level() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let (tx, rx) = std::sync::mpsc::channel();
        let slot = std::sync::Arc::new(std::sync::Mutex::new(Some("high".to_string())));
        let mut request = reasoned(&server.base_url, "openai", "gpt-5.4", "high");
        request.reasoning_slot = Some(std::sync::Arc::clone(&slot));
        request.reasoning_notice_tx = Some(tx);
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let _ = one_turn(&mut model);
        let notices: Vec<_> = rx.try_iter().collect();
        let notice = notices
            .iter()
            .find(|notice| notice.code == "forced_off_for_tools")
            .expect("forced_off_for_tools notice");
        assert_eq!(notice.from.as_deref(), Some("high"));
        assert_eq!(notice.to.as_deref(), Some("none"));
        assert_eq!(slot.lock().unwrap().as_deref(), Some("high"));
        let raw = server.requests.lock().unwrap()[0].1.clone();
        let body: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(body["reasoning_effort"], json!("none"));
        assert!(body.get("max_tokens").is_none());
        assert!(body.get("max_completion_tokens").is_none());
        assert!(body.get("tools").is_some());
    }

    #[test]
    fn a_configured_output_cap_is_sent_as_stated() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut request = reasoned(&server.base_url, "groq", "llama-3.3-70b", "high");
        request.provider.models[0].max_output_tokens = Some(1024);
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let _ = one_turn(&mut model);
        let raw = server.requests.lock().unwrap()[0].1.clone();
        let body: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(body["max_tokens"], json!(1024));
        assert!(body.get("max_completion_tokens").is_none());
    }

    #[test]
    fn gpt_5_4_uses_max_completion_tokens_on_a_forced_none_tool_turn() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut request = reasoned(&server.base_url, "openai", "gpt-5.4", "high");
        request.provider.models[0].max_output_tokens = Some(2048);
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let _ = one_turn(&mut model);
        let raw = server.requests.lock().unwrap()[0].1.clone();
        let body: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(body["max_completion_tokens"], json!(2048));
        assert!(body.get("max_tokens").is_none());
        assert_eq!(body["reasoning_effort"], json!("none"));
    }

    #[test]
    fn an_empty_forced_none_reply_does_not_blame_the_reasoning_level() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":""},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut model = ProviderModel::new(
            reasoned(&server.base_url, "openai", "gpt-5.4", "high"),
            TEST_LIMITS,
        );
        let events = one_turn(&mut model);
        match events.last() {
            Some(ModelEvent::Error(error)) => {
                assert_eq!(
                    error.message,
                    "AI provider response did not include assistant text."
                );
            }
            other => panic!("expected the plain empty reply, got {other:?}"),
        }
    }

    fn seen_notices() -> std::sync::Arc<std::sync::Mutex<std::collections::HashSet<String>>> {
        std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashSet::new()))
    }

    #[test]
    fn a_tool_loop_emits_the_forced_off_notice_once() {
        let server = serve(vec![
            sse(&[
                r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"echo","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}"#,
                "[DONE]",
            ]),
            sse(&[
                r#"{"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}"#,
                "[DONE]",
            ]),
        ]);
        let (tx, rx) = std::sync::mpsc::channel();
        let mut request = reasoned(&server.base_url, "openai", "gpt-5.4", "high");
        request.reasoning_notice_tx = Some(tx);
        request.reasoning_notices_seen = Some(seen_notices());
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let agent = AgentLoop::new();
        agent.submit("go");
        agent.run_until_idle(&mut model);
        let notices: Vec<_> = rx
            .try_iter()
            .filter(|notice| notice.code == "forced_off_for_tools")
            .collect();
        assert_eq!(notices.len(), 1);
        assert_eq!(server.requests.lock().unwrap().len(), 2);
    }

    #[test]
    fn two_turns_emit_the_forced_off_notice_once() {
        let server = serve(vec![
            sse(&[
                r#"{"choices":[{"delta":{"content":"one"},"finish_reason":"stop"}]}"#,
                "[DONE]",
            ]),
            sse(&[
                r#"{"choices":[{"delta":{"content":"two"},"finish_reason":"stop"}]}"#,
                "[DONE]",
            ]),
        ]);
        let (tx, rx) = std::sync::mpsc::channel();
        let mut request = reasoned(&server.base_url, "openai", "gpt-6-sol", "high");
        request.reasoning_notice_tx = Some(tx);
        request.reasoning_notices_seen = Some(seen_notices());
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let _ = one_turn(&mut model);
        let _ = one_turn(&mut model);
        let notices: Vec<_> = rx
            .try_iter()
            .filter(|notice| notice.code == "forced_off_for_tools")
            .collect();
        assert_eq!(notices.len(), 1);
    }

    fn tiny_png() -> crate::chat_images::ChatImage {
        use base64::Engine;
        crate::chat_images::ChatImage {
            mime_type: "image/png".into(),
            data: base64::engine::general_purpose::STANDARD.encode(b"png"),
        }
    }

    #[test]
    fn a_vision_model_gets_an_openai_image_part() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"a cat"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut request = request(&server.base_url);
        request.vision_state = crate::chat_images::VisionState::Yes;
        let image = tiny_png();
        request.chat_images = vec![vec![image.clone()]];
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let mut events = Vec::new();
        model.complete(&view("what is this", vec![]), &mut |event| {
            events.push(event);
            true
        });
        let body: serde_json::Value =
            serde_json::from_str(&server.requests.lock().unwrap()[0].1).unwrap();
        assert_eq!(body["messages"][0]["content"][0]["text"], "what is this");
        assert_eq!(body["messages"][0]["content"][1]["type"], "image_url");
        assert!(body["messages"][0]["content"][1]["image_url"]["url"]
            .as_str()
            .unwrap()
            .starts_with("data:image/png;base64,"));
        assert!(events.iter().any(|event| matches!(
            event,
            crate::model_events::ModelEvent::TextDelta { text } if text == "a cat"
        )));
    }

    #[test]
    fn a_text_only_model_does_not_receive_stripped_text() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"should not run"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut request = request(&server.base_url);
        request.vision_state = crate::chat_images::VisionState::No;
        request.chat_images = vec![vec![tiny_png()]];
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let mut events = Vec::new();
        model.complete(&view("what is this", vec![]), &mut |event| {
            events.push(event);
            true
        });
        let body: serde_json::Value =
            serde_json::from_str(&server.requests.lock().unwrap()[0].1).unwrap();
        let content = body["messages"][0]["content"].as_str().unwrap();
        assert!(content.contains("what is this"));
        assert!(content.contains(crate::chat_images::OMITTED_IMAGE_NOTE));
        assert!(body["messages"][0].get("image_url").is_none());
        assert!(events
            .iter()
            .any(|event| matches!(event, crate::model_events::ModelEvent::TextDelta { .. })));
    }

    #[test]
    fn an_unknown_model_with_send_anyway_gets_the_image_part() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"a square"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut request = request(&server.base_url);
        request.vision_state = crate::chat_images::VisionState::Unknown;
        request.send_anyway = true;
        request.chat_images = vec![vec![tiny_png()]];
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let _ = model.complete(&view("what is this", vec![]), &mut |_| true);
        let body: serde_json::Value =
            serde_json::from_str(&server.requests.lock().unwrap()[0].1).unwrap();
        assert_eq!(body["messages"][0]["content"][1]["type"], "image_url");
    }

    fn with_home<T>(body: impl FnOnce() -> T) -> T {
        let _lock = crate::app_config::TEST_CONFIG_ENV
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let home = tempfile::tempdir().expect("home");
        let previous = std::env::var("HOME").ok();
        let previous_xdg = std::env::var("XDG_CONFIG_HOME").ok();
        std::env::set_var("HOME", home.path());
        std::env::remove_var("XDG_CONFIG_HOME");
        let result = body();
        match previous {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match previous_xdg {
            Some(value) => std::env::set_var("XDG_CONFIG_HOME", value),
            None => std::env::remove_var("XDG_CONFIG_HOME"),
        }
        result
    }

    #[test]
    fn a_context_length_400_keeps_an_earlier_image() {
        with_home(|| {
            let session = uuid::Uuid::new_v4().to_string();
            crate::chat_images::push_turn(&session, vec![stored_png()]).unwrap();
            crate::chat_images::push_turn(&session, Vec::new()).unwrap();
            let kept = crate::chat_images::read_turns(&session).unwrap();
            let server = serve(vec![http_response(
                "400 Bad Request",
                &[],
                "maximum context length exceeded",
            )]);
            let mut request = request(&server.base_url);
            request.vision_state = crate::chat_images::VisionState::Yes;
            request.image_session_id = Some(session.clone());
            request.chat_images = kept;
            let mut model = ProviderModel::new(request, TEST_LIMITS);
            let _ = model.complete(&view("hello", vec![]), &mut |_| true);
            let turns = crate::chat_images::read_turns(&session).unwrap();
            assert_eq!(turns[0].len(), 1, "an earlier image stays");
            assert!(turns[1].is_empty());
        });
    }

    #[test]
    fn an_image_400_skips_resend_without_deleting_the_file() {
        with_home(|| {
            let session = uuid::Uuid::new_v4().to_string();
            crate::chat_images::push_turn(&session, vec![stored_png()]).unwrap();
            let server = serve(vec![http_response(
                "400 Bad Request",
                &[],
                "invalid image_url payload",
            )]);
            let mut request = request(&server.base_url);
            request.vision_state = crate::chat_images::VisionState::Yes;
            request.image_session_id = Some(session.clone());
            request.chat_images = crate::chat_images::read_turns(&session).unwrap();
            let mut model = ProviderModel::new(request, TEST_LIMITS);
            let _ = model.complete(&view("what is this", vec![]), &mut |_| true);
            let turns = crate::chat_images::read_turns(&session).unwrap();
            assert!(turns[0].is_empty(), "the rejected image is not resent");
            let dir = home_images(&session);
            assert!(
                dir.read_dir().unwrap().next().is_some(),
                "the file stays on disk"
            );
        });
    }

    fn stored_png() -> crate::chat_images::ChatImage {
        use base64::Engine;
        crate::chat_images::ChatImage {
            mime_type: "image/png".into(),
            data: base64::engine::general_purpose::STANDARD.encode(b"\x89PNG\r\n\x1a\nA"),
        }
    }

    fn home_images(session: &str) -> std::path::PathBuf {
        crate::app_config::preferred_app_config_path("native-sessions")
            .unwrap()
            .join(format!("{session}-images"))
    }

    #[test]
    fn send_anyway_keeps_an_earlier_image_on_a_text_follow_up() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"still there"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        let mut request = request(&server.base_url);
        request.vision_state = crate::chat_images::VisionState::Unknown;
        request.send_anyway = true;
        request.chat_images = vec![vec![tiny_png()], Vec::new()];
        let mut model = ProviderModel::new(request, TEST_LIMITS);
        let history = vec![
            crate::rhizome_loop::HistoryItem::User {
                text: "what is this".into(),
            },
            crate::rhizome_loop::HistoryItem::Assistant {
                text: "a square".into(),
                tool_calls: vec![],
            },
        ];
        let _ = model.complete(&view("and now", history), &mut |_| true);
        let body: serde_json::Value =
            serde_json::from_str(&server.requests.lock().unwrap()[0].1).unwrap();
        let messages = body["messages"].as_array().unwrap();
        let first = &messages[0]["content"];
        assert_eq!(first[1]["type"], "image_url");
    }
}
