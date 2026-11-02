//! Streaming client for ChatGPT plan usage on `POST /v1/responses`.
//!
//! The bearer token and the one-shot refresh callback come from the caller.
//! This module does not import the sign-in types. A turn is complete only
//! when `response.completed` arrives. `store` is always false and `stream`
//! is always true. The system prompt is `instructions`. `temperature` and
//! `max_output_tokens` are never sent.
//!
//! Tools go out inside one `rhizome` namespace and come back as the bare
//! name the loop already uses. With `store: false`, a finished reasoning
//! item is kept in memory and sent again on the next step of this process.
//! It is not a `ModelEvent`.

use std::collections::{BTreeMap, HashMap, VecDeque};
use std::sync::{Mutex, OnceLock};

use serde_json::{json, Map, Value};

use crate::ai_models::HttpLimits;
use crate::model_events::{FinishReason, ModelError, ModelErrorKind, ModelEvent};

/// Namespace for every tool this client offers. ChatGPT plan usage rejects
/// a bare function tool.
const TOOL_NAMESPACE: &str = "rhizome";
const TOOL_NAMESPACE_DESCRIPTION: &str = "Tools Rhizome runs for this chat.";

/// Shown when the access token cannot be renewed.
pub(crate) use crate::provider_oauth::SIGN_IN_AGAIN;

const USAGE_LIMIT: &str = "You've reached the ChatGPT usage limit for Rhizome. Open ChatGPT settings, then Usage, to review it.";
const USAGE_UNAVAILABLE: &str = "ChatGPT couldn't check your usage just now. Try again later.";
const QUOTA_EMPTY: &str = "This ChatGPT account has no usage left for Rhizome right now.";
const QUOTA_OTHER: &str = "ChatGPT blocked this reply because of a usage or quota limit.";
const INCOMPLETE: &str = "ChatGPT stopped before the reply finished.";
const MISSING_COMPLETED: &str = "ChatGPT ended the reply before it was complete.";

const MAX_REPLAY_TURNS: usize = 32;
const MAX_REPLAY_BYTES: usize = 1024 * 1024;

/// One Responses request built from chat-completions messages.
pub(crate) struct ChatGptTurn<'a> {
    pub(crate) base_url: &'a str,
    pub(crate) model: &'a str,
    pub(crate) instructions: Option<&'a str>,
    /// Prepended to `instructions`. The chat path calls this a system prefix.
    pub(crate) system_prefix: Option<&'a str>,
    /// Sent as `reasoning.effort`. Empty omits the field.
    pub(crate) reasoning_effort: Option<&'a str>,
    pub(crate) messages: &'a [Value],
    pub(crate) tools: &'a [Value],
    /// In-memory key for reasoning items. Empty skips replay.
    pub(crate) replay_session: &'a str,
}

/// Bearer token plus one refresh for the current turn.
pub(crate) struct BearerSession<R> {
    token: String,
    refresh: R,
    tried_refresh: bool,
}

impl<R> BearerSession<R> {
    pub(crate) fn new(token: impl Into<String>, refresh: R) -> Self {
        Self {
            token: token.into(),
            refresh,
            tried_refresh: false,
        }
    }

    fn token(&self) -> &str {
        &self.token
    }
}

impl<R> BearerSession<R>
where
    R: FnMut() -> Result<String, String>,
{
    /// Remembers the first attempt. A second call in the same turn does nothing.
    /// The callback's error is kept. An empty token means the sign-in is gone.
    fn refresh_once(&mut self) -> Result<(), String> {
        if self.tried_refresh {
            return Err(SIGN_IN_AGAIN.to_string());
        }
        self.tried_refresh = true;
        match (self.refresh)() {
            Ok(token) => {
                let token = token.trim().to_string();
                if token.is_empty() {
                    return Err(SIGN_IN_AGAIN.to_string());
                }
                self.token = token;
                Ok(())
            }
            Err(error) => {
                let error = error.trim().to_string();
                if error.is_empty() {
                    Err(SIGN_IN_AGAIN.to_string())
                } else {
                    Err(error)
                }
            }
        }
    }
}

/// A model the signed-in account can show in a picker.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatGptModel {
    pub(crate) slug: String,
    pub(crate) display_name: String,
}

/// Built-in picker rows when `GET /v1/models` fails or returns no
/// `visibility: "list"` rows. A failed list cannot turn the provider off.
///
/// Slugs checked 2026-10-24 against OpenAI's published pages, not a live
/// `GET /v1/models` call. Flagship ids are on
/// <https://developers.openai.com/api/docs/models> (`gpt-6-astra`,
/// `gpt-6.1-sol`, `gpt-6-luna`). `gpt-6-sol`, `gpt-5.5`, and `gpt-5.4`
/// are still model ids on <https://developers.openai.com/api/docs/pricing>.
/// `gpt-5.6` is not an id there; the published ids are `gpt-5.6-sol` and kin.
pub(crate) fn fallback_chatgpt_models() -> Vec<ChatGptModel> {
    [
        ("gpt-6-astra", "GPT-6 Astra"),
        ("gpt-6.1-sol", "GPT-6.1 Sol"),
        ("gpt-6-luna", "GPT-6 Luna"),
        ("gpt-6-sol", "GPT-6 Sol"),
        ("gpt-5.5", "GPT-5.5"),
        ("gpt-5.4", "GPT-5.4"),
    ]
    .into_iter()
    .map(|(slug, display_name)| ChatGptModel {
        slug: slug.to_string(),
        display_name: display_name.to_string(),
    })
    .collect()
}

/// `GET {base}/models`. A transport, HTTP, or parse failure, or a 200
/// with no `visibility: "list"` rows, returns [`fallback_chatgpt_models`].
/// This function has no error return.
pub(crate) fn list_chatgpt_models<R>(
    base_url: &str,
    auth: &BearerSession<R>,
    limits: HttpLimits,
) -> Vec<ChatGptModel> {
    fetch_models(base_url, auth.token(), limits).unwrap_or_else(|_| fallback_chatgpt_models())
}

/// Streams one Responses turn into `ModelEvent`s.
///
/// An expired token before any text or tool call refreshes once and retries
/// the same body. After output has started, or when refresh fails, the turn
/// ends with [`SIGN_IN_AGAIN`].
pub(crate) fn stream_chatgpt_turn<R>(
    turn: &ChatGptTurn<'_>,
    auth: &mut BearerSession<R>,
    limits: HttpLimits,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) where
    R: FnMut() -> Result<String, String>,
{
    if auth.token().trim().is_empty() {
        let _ = emit(ModelEvent::Error(sign_in_again(None)));
        return;
    }
    let body = match request_body(turn) {
        Ok(body) => body,
        Err(error) => {
            let _ = emit(ModelEvent::Error(error));
            return;
        }
    };
    for _ in 0..2 {
        match post_responses(
            turn.base_url,
            turn.replay_session,
            &body,
            auth.token(),
            limits,
            emit,
        ) {
            PostResult::Done => return,
            PostResult::Retry => match auth.refresh_once() {
                Ok(()) => {}
                Err(message) => {
                    let _ = emit(ModelEvent::Error(refresh_failure(message)));
                    return;
                }
            },
        }
    }
    let _ = emit(ModelEvent::Error(sign_in_again(None)));
}

enum PostResult {
    Done,
    Retry,
}

fn post_responses(
    base_url: &str,
    session: &str,
    body: &Value,
    token: &str,
    limits: HttpLimits,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) -> PostResult {
    let url = match endpoint(base_url, "responses") {
        Ok(url) => url,
        Err(error) => {
            let _ = emit(ModelEvent::Error(error));
            return PostResult::Done;
        }
    };
    let client = match http_client(limits) {
        Ok(client) => client,
        Err(error) => {
            let _ = emit(ModelEvent::Error(error));
            return PostResult::Done;
        }
    };
    let response = match client.post(url).bearer_auth(token).json(body).send() {
        Ok(response) => response,
        Err(error) => {
            let _ = emit(ModelEvent::Error(model_error(
                ModelErrorKind::Unavailable,
                None,
                redact(&format!("ChatGPT request failed: {error}"), token),
            )));
            return PostResult::Done;
        }
    };
    let status = response.status();
    if !status.is_success() {
        let retry_after = response
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().parse::<u64>().ok());
        let status = status.as_u16();
        let response_body = response.text().unwrap_or_default();
        if status == 401 {
            return PostResult::Retry;
        }
        let _ = emit(ModelEvent::Error(http_failure(
            status,
            &response_body,
            token,
            retry_after,
        )));
        return PostResult::Done;
    }
    read_sse(response, session, emit)
}

fn read_sse(
    response: impl std::io::Read,
    session: &str,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) -> PostResult {
    let mut reader = std::io::BufReader::new(response);
    let mut parser = ResponsesParser::new(session);
    let mut retry = false;
    for line in std::io::BufRead::lines(&mut reader) {
        let line = match line {
            Ok(line) => line,
            Err(error) => {
                let _ = emit(ModelEvent::Error(model_error(
                    ModelErrorKind::Unavailable,
                    None,
                    format!("ChatGPT stream failed: {error}"),
                )));
                return PostResult::Done;
            }
        };
        match parser.push_line(&line) {
            Step::Retry => {
                retry = true;
                break;
            }
            Step::Events(events) => {
                if !emit_all(events, emit) || parser.is_finished() {
                    return PostResult::Done;
                }
            }
        }
    }
    if retry {
        // Drop the socket. Do not read the rest of the stream.
        drop(reader);
        return PostResult::Retry;
    }
    match parser.end_of_stream() {
        Step::Retry => PostResult::Retry,
        Step::Events(events) => {
            let _ = emit_all(events, emit);
            PostResult::Done
        }
    }
}

fn emit_all(events: Vec<ModelEvent>, emit: &mut dyn FnMut(ModelEvent) -> bool) -> bool {
    events.into_iter().all(emit)
}

fn fetch_models(base_url: &str, token: &str, limits: HttpLimits) -> Result<Vec<ChatGptModel>, ()> {
    let url = endpoint(base_url, "models").map_err(|_| ())?;
    let client = http_client(limits).map_err(|_| ())?;
    let response = client.get(url).bearer_auth(token).send().map_err(|_| ())?;
    if !response.status().is_success() {
        let _ = response.text();
        return Err(());
    }
    let json = response.json::<Value>().map_err(|_| ())?;
    let models = json.get("models").and_then(Value::as_array).ok_or(())?;
    let listed = parse_listed_models(models);
    if listed.is_empty() {
        return Err(());
    }
    Ok(listed)
}

fn parse_listed_models(models: &[Value]) -> Vec<ChatGptModel> {
    models
        .iter()
        .filter(|model| model.get("visibility").and_then(Value::as_str) == Some("list"))
        .filter_map(|model| {
            let slug = model.get("slug").and_then(Value::as_str)?.trim();
            let display_name = model.get("display_name").and_then(Value::as_str)?.trim();
            if slug.is_empty() || display_name.is_empty() {
                return None;
            }
            Some(ChatGptModel {
                slug: slug.to_string(),
                display_name: display_name.to_string(),
            })
        })
        .collect()
}

fn request_body(turn: &ChatGptTurn<'_>) -> Result<Value, ModelError> {
    if turn.model.trim().is_empty() {
        return Err(model_error(
            ModelErrorKind::Rejected,
            None,
            "ChatGPT request is missing a model.",
        ));
    }
    let instructions = prefixed_instructions(turn.system_prefix, turn.instructions);
    let (instructions, input) =
        responses_input(instructions.as_deref(), turn.messages, turn.replay_session);
    let mut body = Map::new();
    body.insert("model".to_string(), Value::String(turn.model.to_string()));
    body.insert("input".to_string(), Value::Array(input));
    body.insert("store".to_string(), Value::Bool(false));
    body.insert("stream".to_string(), Value::Bool(true));
    // With store:false, encrypted reasoning is omitted unless asked for.
    // https://developers.openai.com/api/docs/guides/reasoning
    body.insert(
        "include".to_string(),
        json!(["reasoning.encrypted_content"]),
    );
    if let Some(effort) = turn
        .reasoning_effort
        .map(str::trim)
        .filter(|effort| !effort.is_empty())
    {
        body.insert("reasoning".to_string(), json!({ "effort": effort }));
    }
    if let Some(instructions) = instructions {
        body.insert("instructions".to_string(), Value::String(instructions));
    }
    let tools = namespace_tools(turn.tools);
    if !tools.is_empty() {
        body.insert("tools".to_string(), Value::Array(tools));
    }
    Ok(Value::Object(body))
}

fn responses_input(
    instructions: Option<&str>,
    messages: &[Value],
    session: &str,
) -> (Option<String>, Vec<Value>) {
    let mut extra = Vec::new();
    let mut input = Vec::new();
    let mut replay = ReplayCursor::load(session);
    let mut call_names: HashMap<String, String> = HashMap::new();
    for message in messages {
        if message.get("role").is_none() {
            if message.get("type").is_some() {
                input.push(message.clone());
            }
            continue;
        }
        let role = message.get("role").and_then(Value::as_str).unwrap_or("");
        match role {
            "system" | "developer" => {
                if let Some(text) = message_text(message.get("content").unwrap_or(&Value::Null)) {
                    extra.push(text);
                }
            }
            "user" => input.push(json!({
                "role": "user",
                "content": responses_user_content(message.get("content").unwrap_or(&Value::Null)),
            })),
            "assistant" => push_assistant(message, &mut replay, &mut call_names, &mut input),
            "tool" => input.push(function_call_output(message, &call_names)),
            _ => {}
        }
    }
    (merge_instructions(instructions, &extra), input)
}

fn push_assistant(
    message: &Value,
    replay: &mut ReplayCursor,
    call_names: &mut HashMap<String, String>,
    input: &mut Vec<Value>,
) {
    let calls = message.get("tool_calls").and_then(Value::as_array);
    let call_ids = calls
        .map(|calls| {
            calls
                .iter()
                .filter_map(|call| call.get("id").and_then(Value::as_str).map(str::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let text = message_text(message.get("content").unwrap_or(&Value::Null));
    let match_text = if call_ids.is_empty() {
        text.as_deref()
    } else {
        None
    };
    input.extend(replay.take(&call_ids, match_text));
    if let Some(text) = text {
        input.push(json!({ "role": "assistant", "content": text }));
    }
    let Some(calls) = calls else {
        return;
    };
    for call in calls {
        let item = function_call_item(call);
        if let Some(id) = item.get("call_id").and_then(Value::as_str) {
            if let Some(name) = item.get("name").and_then(Value::as_str) {
                call_names.insert(id.to_string(), name.to_string());
            }
        }
        input.push(item);
    }
}

fn function_call_item(call: &Value) -> Value {
    let function = call
        .get("function")
        .filter(|value| value.is_object())
        .unwrap_or(call);
    let raw_name = function.get("name").and_then(Value::as_str).unwrap_or("");
    let (name, namespace) = wire_tool_name(raw_name);
    let mut arguments = output_text(function.get("arguments").unwrap_or(&Value::Null));
    if arguments.is_empty() {
        arguments = "{}".to_string();
    }
    json!({
        "type": "function_call",
        "name": name,
        "namespace": namespace,
        "arguments": arguments,
        "call_id": call.get("id").and_then(Value::as_str).unwrap_or(""),
    })
}

fn function_call_output(message: &Value, call_names: &HashMap<String, String>) -> Value {
    let call_id = message
        .get("tool_call_id")
        .and_then(Value::as_str)
        .unwrap_or("");
    let mut item = json!({
        "type": "function_call_output",
        "call_id": call_id,
        "output": output_text(message.get("content").unwrap_or(&Value::Null)),
        "namespace": TOOL_NAMESPACE,
    });
    if let Some(name) = call_names.get(call_id) {
        item["name"] = Value::String(name.clone());
    }
    item
}

fn wire_tool_name(name: &str) -> (String, &'static str) {
    let prefix = format!("{TOOL_NAMESPACE}.");
    let bare = name.strip_prefix(&prefix).unwrap_or(name);
    (bare.to_string(), TOOL_NAMESPACE)
}

fn namespace_tools(tools: &[Value]) -> Vec<Value> {
    let functions = tools
        .iter()
        .filter_map(namespaced_function)
        .collect::<Vec<_>>();
    if functions.is_empty() {
        return Vec::new();
    }
    vec![json!({
        "type": "namespace",
        "name": TOOL_NAMESPACE,
        "description": TOOL_NAMESPACE_DESCRIPTION,
        "tools": functions,
    })]
}

fn namespaced_function(tool: &Value) -> Option<Value> {
    let function = tool
        .get("function")
        .filter(|value| value.is_object())
        .unwrap_or(tool);
    let name = function
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.is_empty())?;
    let (name, _) = wire_tool_name(name);
    let mut item = json!({
        "type": "function",
        "name": name,
    });
    if let Some(description) = function.get("description").and_then(Value::as_str) {
        if !description.is_empty() {
            item["description"] = Value::String(description.to_string());
        }
    }
    if let Some(parameters) = function.get("parameters") {
        if !parameters.is_null() {
            item["parameters"] = parameters.clone();
        }
    }
    Some(item)
}

fn responses_user_content(content: &Value) -> Value {
    match content {
        Value::Array(parts) => Value::Array(parts.iter().filter_map(responses_part).collect()),
        Value::String(text) => Value::String(text.clone()),
        Value::Null => Value::String(String::new()),
        other => Value::String(other.to_string()),
    }
}

fn responses_part(part: &Value) -> Option<Value> {
    match part.get("type").and_then(Value::as_str) {
        Some("text") => Some(json!({
            "type": "input_text",
            "text": part.get("text").and_then(Value::as_str).unwrap_or(""),
        })),
        Some("input_text") | Some("input_image") => Some(part.clone()),
        Some("image_url") => {
            let url = part
                .get("image_url")
                .and_then(|image| image.get("url").and_then(Value::as_str))
                .or_else(|| part.get("image_url").and_then(Value::as_str))?;
            Some(json!({
                "type": "input_image",
                "image_url": url,
            }))
        }
        _ => None,
    }
}

fn message_text(content: &Value) -> Option<String> {
    let text = match content {
        Value::String(text) => text.clone(),
        Value::Array(parts) => parts
            .iter()
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join(""),
        Value::Null => return None,
        other => other.to_string(),
    };
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn output_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn prefixed_instructions(prefix: Option<&str>, instructions: Option<&str>) -> Option<String> {
    let prefix = prefix.map(str::trim).filter(|text| !text.is_empty());
    let instructions = instructions.map(str::trim).filter(|text| !text.is_empty());
    match (prefix, instructions) {
        (Some(prefix), Some(instructions)) => Some(format!("{prefix}\n{instructions}")),
        (Some(prefix), None) => Some(prefix.to_string()),
        (None, Some(instructions)) => Some(instructions.to_string()),
        (None, None) => None,
    }
}

fn merge_instructions(base: Option<&str>, extra: &[String]) -> Option<String> {
    let mut parts = Vec::new();
    if let Some(base) = base.map(str::trim).filter(|text| !text.is_empty()) {
        parts.push(base.to_string());
    }
    parts.extend(extra.iter().cloned());
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

enum Step {
    Events(Vec<ModelEvent>),
    Retry,
}

#[derive(Default)]
struct CallState {
    id: Option<String>,
    name: Option<String>,
    item_id: Option<String>,
    started: bool,
    ended: bool,
    sent_args: bool,
    pending_args: String,
}

struct ResponsesParser {
    session: String,
    calls: BTreeMap<u64, CallState>,
    by_item: HashMap<String, u64>,
    assistant_text: String,
    reasoning_items: Vec<Value>,
    /// Joined `data:` lines for the SSE event still being read.
    data_buf: String,
    saw_output: bool,
    finished: bool,
    completed: bool,
}

impl ResponsesParser {
    fn new(session: &str) -> Self {
        Self {
            session: session.to_string(),
            calls: BTreeMap::new(),
            by_item: HashMap::new(),
            assistant_text: String::new(),
            reasoning_items: Vec::new(),
            data_buf: String::new(),
            saw_output: false,
            finished: false,
            completed: false,
        }
    }

    fn is_finished(&self) -> bool {
        self.finished
    }

    fn push_line(&mut self, line: &str) -> Step {
        if self.finished {
            return Step::Events(Vec::new());
        }
        let line = line.trim_end_matches('\r');
        if line.is_empty() {
            return self.dispatch_data();
        }
        let Some(rest) = line.strip_prefix("data:") else {
            return Step::Events(Vec::new());
        };
        // One leading space is the SSE field separator, not payload.
        let chunk = rest.strip_prefix(' ').unwrap_or(rest);
        if !self.data_buf.is_empty() {
            self.data_buf.push('\n');
        }
        self.data_buf.push_str(chunk);
        Step::Events(Vec::new())
    }

    fn dispatch_data(&mut self) -> Step {
        if self.data_buf.is_empty() {
            return Step::Events(Vec::new());
        }
        let data = std::mem::take(&mut self.data_buf);
        let data = data.trim();
        if data.is_empty() {
            return Step::Events(Vec::new());
        }
        if data == "[DONE]" {
            return self.missing_completed();
        }
        match serde_json::from_str::<Value>(data) {
            Ok(event) => self.push_event(&event),
            Err(error) => Step::Events(self.fail(model_error(
                ModelErrorKind::Protocol,
                None,
                format!("Failed to parse ChatGPT stream: {error}"),
            ))),
        }
    }

    fn end_of_stream(&mut self) -> Step {
        match self.dispatch_data() {
            Step::Retry => Step::Retry,
            Step::Events(events) if self.finished => Step::Events(events),
            Step::Events(mut events) => {
                if let Step::Events(tail) = self.missing_completed() {
                    events.extend(tail);
                }
                Step::Events(events)
            }
        }
    }

    fn missing_completed(&mut self) -> Step {
        if self.finished {
            return Step::Events(Vec::new());
        }
        Step::Events(self.fail(model_error(
            ModelErrorKind::Protocol,
            None,
            MISSING_COMPLETED,
        )))
    }

    fn push_event(&mut self, event: &Value) -> Step {
        let kind = event.get("type").and_then(Value::as_str).unwrap_or("");
        let mut events = Vec::new();
        match kind {
            "response.output_text.delta" => self.push_text(event, &mut events),
            "response.output_text.done" => self.push_text_done(event, &mut events),
            "response.output_item.added" | "response.output_item.done" => {
                self.push_output_item(kind, event, &mut events);
            }
            "response.function_call_arguments.delta" => {
                self.push_argument_delta(event, &mut events);
            }
            "response.function_call_arguments.done" => {
                self.push_argument_done(event, &mut events);
            }
            "response.completed" => return Step::Events(self.push_completed(event)),
            "response.failed" => return self.push_failed(event),
            "response.incomplete" => {
                return Step::Events(self.fail(model_error(
                    ModelErrorKind::Protocol,
                    None,
                    INCOMPLETE,
                )));
            }
            "error" | "response.error" => return self.push_error_event(event),
            _ => {}
        }
        Step::Events(events)
    }

    fn push_text(&mut self, event: &Value, events: &mut Vec<ModelEvent>) {
        let Some(text) = event.get("delta").and_then(Value::as_str) else {
            return;
        };
        if text.is_empty() {
            return;
        }
        self.assistant_text.push_str(text);
        self.saw_output = true;
        events.push(ModelEvent::TextDelta {
            text: text.to_string(),
        });
    }

    fn push_text_done(&mut self, event: &Value, events: &mut Vec<ModelEvent>) {
        if !self.assistant_text.is_empty() {
            return;
        }
        let Some(text) = event.get("text").and_then(Value::as_str) else {
            return;
        };
        if text.is_empty() {
            return;
        }
        self.assistant_text.push_str(text);
        self.saw_output = true;
        events.push(ModelEvent::TextDelta {
            text: text.to_string(),
        });
    }

    fn push_output_item(&mut self, kind: &str, event: &Value, events: &mut Vec<ModelEvent>) {
        let Some(item) = event.get("item") else {
            return;
        };
        let item_type = item.get("type").and_then(Value::as_str).unwrap_or("");
        if item_type == "reasoning" {
            if kind.ends_with(".done") {
                if let Some(kept) = replayable_reasoning(item) {
                    self.remember_reasoning(kept);
                }
            }
            return;
        }
        if item_type != "function_call" {
            return;
        }
        let index = event
            .get("output_index")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        self.note_function(index, item);
        self.flush_start(index, events);
        if kind.ends_with(".done") {
            let arguments = output_text(item.get("arguments").unwrap_or(&Value::Null));
            self.push_args_if_new(index, &arguments, events);
            self.flush_end(index, events);
        }
    }

    fn push_argument_delta(&mut self, event: &Value, events: &mut Vec<ModelEvent>) {
        let index = self.index_of(event);
        let delta = event.get("delta").and_then(Value::as_str).unwrap_or("");
        if delta.is_empty() {
            return;
        }
        self.calls
            .entry(index)
            .or_default()
            .pending_args
            .push_str(delta);
        self.flush_start(index, events);
    }

    fn push_argument_done(&mut self, event: &Value, events: &mut Vec<ModelEvent>) {
        let index = self.index_of(event);
        let arguments = output_text(event.get("arguments").unwrap_or(&Value::Null));
        self.push_args_if_new(index, &arguments, events);
    }

    fn push_completed(&mut self, event: &Value) -> Vec<ModelEvent> {
        let response = event.get("response").unwrap_or(event);
        let status = response.get("status").and_then(Value::as_str);
        if status == Some("failed") {
            return self.fail(failure_from_response(response));
        }
        if status == Some("incomplete") {
            return self.fail(model_error(ModelErrorKind::Protocol, None, INCOMPLETE));
        }
        if let Some(output) = response.get("output").and_then(Value::as_array) {
            for item in output {
                if item.get("type").and_then(Value::as_str) == Some("reasoning") {
                    if let Some(kept) = replayable_reasoning(item) {
                        self.remember_reasoning(kept);
                    }
                }
            }
        }
        self.finish_ok()
    }

    fn push_failed(&mut self, event: &Value) -> Step {
        let response = event.get("response").unwrap_or(event);
        let code = error_code(response);
        let message = error_message(response);
        if is_token_expired(&code, &message) && !self.saw_output {
            return Step::Retry;
        }
        Step::Events(self.fail(failure_from_response(response)))
    }

    fn push_error_event(&mut self, event: &Value) -> Step {
        let code = error_code(event);
        let message = error_message(event);
        if is_token_expired(&code, &message) {
            if !self.saw_output {
                return Step::Retry;
            }
            return Step::Events(self.fail(sign_in_again(None)));
        }
        if let Some((text, kind)) = plain_quota_message(&code) {
            return Step::Events(self.fail(model_error(kind, None, text)));
        }
        let text = if message.is_empty() {
            "ChatGPT couldn't finish this reply.".to_string()
        } else {
            message
        };
        Step::Events(self.fail(model_error(ModelErrorKind::Unavailable, None, text)))
    }

    fn index_of(&mut self, event: &Value) -> u64 {
        if let Some(index) = event.get("output_index").and_then(Value::as_u64) {
            return index;
        }
        if let Some(item_id) = event.get("item_id").and_then(Value::as_str) {
            if let Some(index) = self.by_item.get(item_id).copied() {
                return index;
            }
        }
        0
    }

    fn note_function(&mut self, index: u64, item: &Value) {
        if let Some(item_id) = item
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| !id.is_empty())
        {
            self.by_item.insert(item_id.to_string(), index);
            self.calls.entry(index).or_default().item_id = Some(item_id.to_string());
        }
        let state = self.calls.entry(index).or_default();
        if let Some(call_id) = item
            .get("call_id")
            .and_then(Value::as_str)
            .filter(|id| !id.is_empty())
        {
            state.id = Some(call_id.to_string());
        }
        if let Some(name) = bare_tool_name(item) {
            state.name = Some(name);
        }
    }

    fn flush_start(&mut self, index: u64, events: &mut Vec<ModelEvent>) {
        let started_now = {
            let state = self.calls.entry(index).or_default();
            if state.started {
                false
            } else {
                let Some(name) = state.name.clone() else {
                    return;
                };
                let id = state
                    .id
                    .get_or_insert_with(|| format!("call_{index}"))
                    .clone();
                state.started = true;
                events.push(ModelEvent::ToolCallStart { id, name });
                true
            }
        };
        if started_now {
            self.saw_output = true;
        }
        let state = self.calls.entry(index).or_default();
        if state.pending_args.is_empty() || !state.started {
            return;
        }
        state.sent_args = true;
        let delta = std::mem::take(&mut state.pending_args);
        let id = state.id.clone().unwrap_or_default();
        events.push(ModelEvent::ToolCallArgsDelta { id, delta });
    }

    fn push_args_if_new(&mut self, index: u64, arguments: &str, events: &mut Vec<ModelEvent>) {
        if arguments.is_empty() {
            return;
        }
        let state = self.calls.entry(index).or_default();
        if state.sent_args || !state.pending_args.is_empty() {
            return;
        }
        state.pending_args.push_str(arguments);
        self.flush_start(index, events);
    }

    fn flush_end(&mut self, index: u64, events: &mut Vec<ModelEvent>) {
        let needs_empty = self.calls.get(&index).is_some_and(|state| {
            state.started && !state.ended && !state.sent_args && state.pending_args.is_empty()
        });
        if needs_empty {
            let id = self
                .calls
                .get(&index)
                .and_then(|state| state.id.clone())
                .unwrap_or_default();
            if let Some(state) = self.calls.get_mut(&index) {
                state.sent_args = true;
            }
            events.push(ModelEvent::ToolCallArgsDelta {
                id,
                delta: "{}".to_string(),
            });
        }
        let Some(state) = self.calls.get_mut(&index) else {
            return;
        };
        if state.ended || !state.started {
            return;
        }
        state.ended = true;
        let id = state.id.clone().unwrap_or_default();
        events.push(ModelEvent::ToolCallEnd { id });
    }

    fn finish_ok(&mut self) -> Vec<ModelEvent> {
        if self.calls.values().any(|call| !call.started) {
            return self.fail(model_error(
                ModelErrorKind::Protocol,
                None,
                "ChatGPT sent a tool call without a name.",
            ));
        }
        let replay = self.snapshot_for_replay();
        let mut events = Vec::new();
        let indexes = self.calls.keys().copied().collect::<Vec<_>>();
        let called = !indexes.is_empty();
        for index in indexes {
            self.flush_start(index, &mut events);
            self.flush_end(index, &mut events);
        }
        self.finished = true;
        self.completed = true;
        if let Some(replay) = replay {
            store_replay(&self.session, replay);
        }
        events.push(ModelEvent::Finish {
            reason: if called {
                FinishReason::ToolCalls
            } else {
                FinishReason::Stop
            },
        });
        events
    }

    fn snapshot_for_replay(&self) -> Option<ReplayTurn> {
        if self.reasoning_items.is_empty() {
            return None;
        }
        let call_ids = self
            .calls
            .values()
            .filter_map(|call| call.id.clone())
            .collect::<Vec<_>>();
        let text = if call_ids.is_empty() && !self.assistant_text.is_empty() {
            Some(self.assistant_text.clone())
        } else {
            None
        };
        if call_ids.is_empty() && text.is_none() {
            return None;
        }
        Some(ReplayTurn {
            items: self.reasoning_items.clone(),
            call_ids,
            text,
        })
    }

    fn remember_reasoning(&mut self, item: Value) {
        if let Some(id) = item.get("id").and_then(Value::as_str) {
            if let Some(existing) = self
                .reasoning_items
                .iter_mut()
                .find(|existing| existing.get("id").and_then(Value::as_str) == Some(id))
            {
                *existing = item;
                return;
            }
        }
        self.reasoning_items.push(item);
    }

    fn fail(&mut self, error: ModelError) -> Vec<ModelEvent> {
        self.finished = true;
        vec![ModelEvent::Error(error)]
    }
}

fn replayable_reasoning(item: &Value) -> Option<Value> {
    let encrypted = item
        .get("encrypted_content")
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())?;
    let mut kept = json!({
        "type": "reasoning",
        "encrypted_content": encrypted,
        "summary": item.get("summary").filter(|value| value.is_array()).cloned().unwrap_or_else(|| json!([])),
    });
    if let Some(id) = item
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
    {
        kept["id"] = Value::String(id.to_string());
    }
    if let Some(content) = item.get("content").filter(|value| !value.is_null()) {
        kept["content"] = content.clone();
    }
    if let Some(status) = item.get("status").and_then(Value::as_str) {
        kept["status"] = Value::String(status.to_string());
    }
    Some(kept)
}

fn bare_tool_name(item: &Value) -> Option<String> {
    let name = item
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.is_empty())?;
    if let Some(namespace) = item
        .get("namespace")
        .and_then(Value::as_str)
        .filter(|ns| !ns.is_empty())
    {
        let prefix = format!("{namespace}.");
        if let Some(rest) = name.strip_prefix(&prefix) {
            if !rest.is_empty() {
                return Some(rest.to_string());
            }
        }
        return Some(name.to_string());
    }
    let prefix = format!("{TOOL_NAMESPACE}.");
    if let Some(rest) = name.strip_prefix(&prefix) {
        if !rest.is_empty() {
            return Some(rest.to_string());
        }
    }
    Some(name.to_string())
}

fn failure_from_response(response: &Value) -> ModelError {
    let code = error_code(response);
    let message = error_message(response);
    if is_token_expired(&code, &message) {
        return sign_in_again(None);
    }
    if let Some((text, kind)) = plain_quota_message(&code) {
        return model_error(kind, None, text);
    }
    let kind = match code.as_str() {
        "rate_limit_exceeded" => ModelErrorKind::RateLimited {
            retry_after_secs: None,
        },
        "server_error" => ModelErrorKind::Unavailable,
        _ => ModelErrorKind::Rejected,
    };
    let text = if message.is_empty() {
        "ChatGPT couldn't finish this reply.".to_string()
    } else {
        message
    };
    model_error(kind, None, text)
}

fn error_code(value: &Value) -> String {
    value
        .get("code")
        .and_then(Value::as_str)
        .or_else(|| value.pointer("/error/code").and_then(Value::as_str))
        .or_else(|| {
            value
                .pointer("/response/error/code")
                .and_then(Value::as_str)
        })
        .unwrap_or("")
        .to_string()
}

fn error_message(value: &Value) -> String {
    value
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| value.pointer("/error/message").and_then(Value::as_str))
        .or_else(|| {
            value
                .pointer("/response/error/message")
                .and_then(Value::as_str)
        })
        .unwrap_or("")
        .to_string()
}

fn is_token_expired(code: &str, message: &str) -> bool {
    const CODES: &[&str] = &[
        "invalid_api_key",
        "invalid_token",
        "token_expired",
        "expired_token",
        "session_expired",
    ];
    if CODES.contains(&code) {
        return true;
    }
    let message = message.to_ascii_lowercase();
    message.contains("token") && (message.contains("expired") || message.contains("expire"))
}

fn plain_quota_message(code: &str) -> Option<(&'static str, ModelErrorKind)> {
    let exact = match code {
        "subscription_sharing_usage_limit_exceeded" => {
            Some((USAGE_LIMIT, ModelErrorKind::QuotaExhausted))
        }
        "subscription_sharing_usage_unavailable" | "subscription_sharing_user_unavailable" => {
            Some((USAGE_UNAVAILABLE, ModelErrorKind::Unavailable))
        }
        "insufficient_quota" | "billing_hard_limit_reached" => {
            Some((QUOTA_EMPTY, ModelErrorKind::QuotaExhausted))
        }
        _ => None,
    };
    if exact.is_some() {
        return exact;
    }
    let lower = code.to_ascii_lowercase();
    if lower.contains("usage_limit") || lower.contains("quota") || lower.contains("billing") {
        return Some((QUOTA_OTHER, ModelErrorKind::QuotaExhausted));
    }
    None
}

fn http_failure(status: u16, body: &str, token: &str, retry_after_secs: Option<u64>) -> ModelError {
    let code = code_in_body(body);
    if let Some((text, kind)) = plain_quota_message(&code).or_else(|| quota_code_in_text(body)) {
        return model_error(kind, Some(status), text);
    }
    let kind = match status {
        402 => ModelErrorKind::QuotaExhausted,
        403 => ModelErrorKind::Auth,
        429 => ModelErrorKind::RateLimited { retry_after_secs },
        408 | 500..=599 => ModelErrorKind::Unavailable,
        _ => ModelErrorKind::Rejected,
    };
    let message = match status {
        402 => QUOTA_EMPTY.to_string(),
        403 => "ChatGPT refused this request.".to_string(),
        429 => "ChatGPT is rate limiting requests.".to_string(),
        408 | 500..=599 => "ChatGPT is unavailable right now.".to_string(),
        _ => {
            let detail = error_message(&serde_json::from_str::<Value>(body).unwrap_or(Value::Null));
            if detail.is_empty() {
                format!("ChatGPT returned {status}.")
            } else {
                format!("ChatGPT returned {status}: {}", redact(&detail, token))
            }
        }
    };
    model_error(kind, Some(status), message)
}

fn code_in_body(body: &str) -> String {
    serde_json::from_str::<Value>(body)
        .ok()
        .map(|json| error_code(&json))
        .unwrap_or_default()
}

fn quota_code_in_text(body: &str) -> Option<(&'static str, ModelErrorKind)> {
    const CODES: &[&str] = &[
        "subscription_sharing_usage_limit_exceeded",
        "subscription_sharing_usage_unavailable",
        "subscription_sharing_user_unavailable",
        "insufficient_quota",
        "billing_hard_limit_reached",
    ];
    CODES
        .iter()
        .find(|code| body.contains(**code))
        .and_then(|code| plain_quota_message(code))
}

/// A refresh failure keeps its own words. Sign-in-again is only the case
/// where the sign-in itself is gone. A token-endpoint or network failure
/// stays a temporary error.
fn refresh_failure(message: String) -> ModelError {
    let auth = message == SIGN_IN_AGAIN
        || message == crate::provider_oauth::NOT_USABLE
        || message == crate::provider_oauth::TURNED_OFF;
    model_error(
        if auth {
            ModelErrorKind::Auth
        } else {
            ModelErrorKind::Unavailable
        },
        None,
        message,
    )
}

fn sign_in_again(status: Option<u16>) -> ModelError {
    model_error(ModelErrorKind::Auth, status, SIGN_IN_AGAIN)
}

fn model_error(
    kind: ModelErrorKind,
    status: Option<u16>,
    message: impl Into<String>,
) -> ModelError {
    ModelError {
        kind,
        status,
        message: message.into(),
    }
}

fn redact(message: &str, token: &str) -> String {
    let token = token.trim();
    if token.is_empty() {
        return message.to_string();
    }
    message.replace(token, "[token]")
}

fn endpoint(base_url: &str, suffix: &str) -> Result<String, ModelError> {
    let base = base_url.trim().trim_end_matches('/');
    if !(base.starts_with("http://") || base.starts_with("https://")) {
        return Err(model_error(
            ModelErrorKind::Rejected,
            None,
            "ChatGPT base URL must start with http:// or https://.",
        ));
    }
    Ok(format!("{base}/{suffix}"))
}

fn http_client(limits: HttpLimits) -> Result<reqwest::blocking::Client, ModelError> {
    reqwest::blocking::Client::builder()
        .connect_timeout(limits.connect)
        .timeout(limits.total)
        .build()
        .map_err(|error| {
            model_error(
                ModelErrorKind::Unavailable,
                None,
                format!("Failed to create HTTP client: {error}"),
            )
        })
}

#[derive(Clone)]
struct ReplayTurn {
    items: Vec<Value>,
    call_ids: Vec<String>,
    text: Option<String>,
}

struct ReplayCursor {
    turns: Vec<ReplayTurn>,
    used: Vec<bool>,
}

impl ReplayCursor {
    fn load(session: &str) -> Self {
        let turns = load_replay(session);
        let used = vec![false; turns.len()];
        Self { turns, used }
    }

    fn take(&mut self, call_ids: &[String], text: Option<&str>) -> Vec<Value> {
        let Some(index) = self
            .turns
            .iter()
            .enumerate()
            .find(|(index, turn)| !self.used[*index] && turn.matches(call_ids, text))
            .map(|(index, _)| index)
        else {
            return Vec::new();
        };
        self.used[index] = true;
        self.turns[index].items.clone()
    }
}

impl ReplayTurn {
    fn matches(&self, call_ids: &[String], text: Option<&str>) -> bool {
        if !self.call_ids.is_empty() {
            if call_ids.is_empty() {
                return false;
            }
            let mut left = self.call_ids.clone();
            let mut right = call_ids.to_vec();
            left.sort();
            right.sort();
            return left == right;
        }
        match (&self.text, text) {
            (Some(stored), Some(text)) => stored == text,
            _ => false,
        }
    }
}

struct ReplayBook {
    sessions: HashMap<String, VecDeque<ReplayTurn>>,
    /// Oldest session id first. Drop removes a chat; this cap covers a
    /// session whose model was never dropped.
    order: VecDeque<String>,
}

const MAX_REPLAY_SESSIONS: usize = 64;

fn replay_book() -> &'static Mutex<ReplayBook> {
    static BOOK: OnceLock<Mutex<ReplayBook>> = OnceLock::new();
    BOOK.get_or_init(|| {
        Mutex::new(ReplayBook {
            sessions: HashMap::new(),
            order: VecDeque::new(),
        })
    })
}

/// Drops one chat's Responses reasoning items. Safe to call twice.
pub(crate) fn clear_responses_replay(session: &str) {
    if session.is_empty() {
        return;
    }
    let mut book = replay_book()
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    book.sessions.remove(session);
    book.order.retain(|id| id != session);
}

fn store_replay(session: &str, turn: ReplayTurn) {
    if session.is_empty() {
        return;
    }
    let mut book = replay_book()
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let bucket = book.sessions.entry(session.to_string()).or_default();
    bucket.push_back(turn);
    while bucket.len() > MAX_REPLAY_TURNS {
        bucket.pop_front();
    }
    let mut bytes = bucket.iter().map(replay_bytes).sum::<usize>();
    while bytes > MAX_REPLAY_BYTES && bucket.len() > 1 {
        if let Some(old) = bucket.pop_front() {
            bytes = bytes.saturating_sub(replay_bytes(&old));
        }
    }
    book.order.retain(|id| id != session);
    book.order.push_back(session.to_string());
    while book.order.len() > MAX_REPLAY_SESSIONS {
        if let Some(old) = book.order.pop_front() {
            book.sessions.remove(&old);
        }
    }
}

fn replay_bytes(turn: &ReplayTurn) -> usize {
    turn.items
        .iter()
        .map(|item| item.to_string().len())
        .sum::<usize>()
        + turn.call_ids.iter().map(String::len).sum::<usize>()
        + turn.text.as_ref().map(String::len).unwrap_or(0)
}

fn load_replay(session: &str) -> Vec<ReplayTurn> {
    if session.is_empty() {
        return Vec::new();
    }
    let book = replay_book()
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    book.sessions
        .get(session)
        .map(|turns| turns.iter().cloned().collect())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_models::test_server::{
        http_response, json_response, responses_sse, serve, serve_mapped, TEST_LIMITS,
    };
    use std::cell::Cell;
    use std::rc::Rc;

    fn auth(token: &str) -> BearerSession<impl FnMut() -> Result<String, String>> {
        BearerSession::new(token, || Err("refresh is not expected".into()))
    }

    fn collect<R>(turn: &ChatGptTurn<'_>, auth: &mut BearerSession<R>) -> Vec<ModelEvent>
    where
        R: FnMut() -> Result<String, String>,
    {
        let mut events = Vec::new();
        stream_chatgpt_turn(turn, auth, TEST_LIMITS, &mut |event| {
            events.push(event);
            true
        });
        events
    }

    fn turn<'a>(
        base: &'a str,
        instructions: Option<&'a str>,
        messages: &'a [Value],
        tools: &'a [Value],
        session: &'a str,
    ) -> ChatGptTurn<'a> {
        ChatGptTurn {
            base_url: base,
            model: "gpt-6.1-sol",
            instructions,
            system_prefix: None,
            reasoning_effort: None,
            messages,
            tools,
            replay_session: session,
        }
    }

    fn body_of(server: &crate::ai_models::test_server::TestServer, index: usize) -> Value {
        let requests = server.requests.lock().unwrap();
        serde_json::from_str(&requests[index].1).unwrap()
    }

    fn assert_common_body(body: &Value) {
        assert_eq!(body["store"], false);
        assert_eq!(body["stream"], true);
        assert_eq!(body["model"], "gpt-6.1-sol");
        assert_eq!(body["include"], json!(["reasoning.encrypted_content"]));
        for key in [
            "temperature",
            "max_output_tokens",
            "max_tokens",
            "max_completion_tokens",
            "previous_response_id",
        ] {
            assert!(body.get(key).is_none(), "{key} must stay off the body");
        }
    }

    fn text(value: &str) -> ModelEvent {
        ModelEvent::TextDelta { text: value.into() }
    }

    fn error_of(events: &[ModelEvent]) -> &ModelError {
        match events.last() {
            Some(ModelEvent::Error(error)) => error,
            other => panic!("expected a terminal error, got {other:?}"),
        }
    }

    #[test]
    fn plain_text_puts_the_system_prompt_in_instructions() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"Hello"}"#,
            r#"{"type":"response.output_text.delta","delta":"!"}"#,
            r#"{"type":"response.completed","response":{"status":"completed"}}"#,
        ])]);
        let messages = vec![
            json!({"role": "system", "content": "Extra rule"}),
            json!({"role": "user", "content": "Hi"}),
        ];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, Some("Be brief"), &messages, &[], ""),
            &mut session,
        );
        assert_eq!(
            events,
            vec![
                text("Hello"),
                text("!"),
                ModelEvent::Finish {
                    reason: FinishReason::Stop,
                },
            ]
        );
        let body = body_of(&server, 0);
        assert_common_body(&body);
        assert_eq!(body["instructions"], "Be brief\nExtra rule");
        assert_eq!(body["input"], json!([{"role": "user", "content": "Hi"}]));
        let headers = server.headers.lock().unwrap();
        assert!(headers[0].contains("authorization: bearer token-1"));
    }

    #[test]
    fn tool_call_round_trip_namespaces_both_ways() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","id":"fc_9","call_id":"call_9","name":"create_note","namespace":"rhizome","arguments":""}}"#,
            r#"{"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\"path\":\"b.md\"}"}"#,
            r#"{"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call_9","name":"rhizome.create_note","namespace":"rhizome","arguments":"{\"path\":\"b.md\"}"}}"#,
            r#"{"type":"response.completed","response":{"status":"completed"}}"#,
        ])]);
        let messages = vec![
            json!({"role": "user", "content": "make a note"}),
            json!({
                "role": "assistant",
                "content": null,
                "tool_calls": [{
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "create_note", "arguments": "{\"path\":\"a.md\"}"}
                }]
            }),
            json!({"role": "tool", "tool_call_id": "call_1", "content": "wrote a.md"}),
        ];
        let tools = vec![json!({
            "type": "function",
            "function": {
                "name": "create_note",
                "description": "Create a note",
                "parameters": {"type": "object"}
            }
        })];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &tools, ""),
            &mut session,
        );
        assert_eq!(
            events,
            vec![
                ModelEvent::ToolCallStart {
                    id: "call_9".into(),
                    name: "create_note".into(),
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_9".into(),
                    delta: "{\"path\":\"b.md\"}".into(),
                },
                ModelEvent::ToolCallEnd {
                    id: "call_9".into(),
                },
                ModelEvent::Finish {
                    reason: FinishReason::ToolCalls,
                },
            ]
        );
        let body = body_of(&server, 0);
        assert_common_body(&body);
        assert_eq!(
            body["tools"],
            json!([{
                "type": "namespace",
                "name": "rhizome",
                "description": TOOL_NAMESPACE_DESCRIPTION,
                "tools": [{
                    "type": "function",
                    "name": "create_note",
                    "description": "Create a note",
                    "parameters": {"type": "object"}
                }]
            }])
        );
        assert_eq!(
            body["input"],
            json!([
                {"role": "user", "content": "make a note"},
                {
                    "type": "function_call",
                    "name": "create_note",
                    "namespace": "rhizome",
                    "arguments": "{\"path\":\"a.md\"}",
                    "call_id": "call_1"
                },
                {
                    "type": "function_call_output",
                    "call_id": "call_1",
                    "output": "wrote a.md",
                    "namespace": "rhizome",
                    "name": "create_note"
                }
            ])
        );
    }

    #[test]
    fn reasoning_item_is_replayed_when_store_is_false() {
        let mut calls = 0usize;
        let server = serve_mapped(2, move |_target, body| {
            calls += 1;
            if calls > 1 {
                return responses_sse(&[
                    r#"{"type":"response.output_text.delta","delta":"Next"}"#,
                    r#"{"type":"response.completed","response":{"status":"completed"}}"#,
                ]);
            }
            let asked = serde_json::from_str::<Value>(body)
                .ok()
                .is_some_and(|json| {
                    json["include"].as_array().is_some_and(|items| {
                        items
                            .iter()
                            .any(|item| item.as_str() == Some("reasoning.encrypted_content"))
                    })
                });
            let item = if asked {
                r#"{"type":"reasoning","id":"rs_test","summary":[],"encrypted_content":"enc-payload","status":"completed"}"#
            } else {
                r#"{"type":"reasoning","id":"rs_test","summary":[],"status":"completed"}"#
            };
            let done =
                format!(r#"{{"type":"response.output_item.done","output_index":0,"item":{item}}}"#);
            responses_sse(&[
                &done,
                r#"{"type":"response.output_text.delta","delta":"Hello"}"#,
                r#"{"type":"response.completed","response":{"status":"completed"}}"#,
            ])
        });
        let session = "reasoning-round-trip";
        let first = vec![json!({"role": "user", "content": "Hi"})];
        let mut bearer = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &first, &[], session),
            &mut bearer,
        );
        assert_eq!(
            events,
            vec![
                text("Hello"),
                ModelEvent::Finish {
                    reason: FinishReason::Stop,
                },
            ]
        );
        assert_common_body(&body_of(&server, 0));
        let second = vec![
            json!({"role": "user", "content": "Hi"}),
            json!({"role": "assistant", "content": "Hello"}),
        ];
        let events = collect(
            &turn(&server.base_url, None, &second, &[], session),
            &mut bearer,
        );
        assert_eq!(events[0], text("Next"));
        let replay = body_of(&server, 1);
        assert_eq!(replay["input"][1]["type"], "reasoning");
        assert_eq!(replay["input"][1]["id"], "rs_test");
        assert_eq!(replay["input"][1]["encrypted_content"], "enc-payload");
        assert_eq!(replay["input"][2]["role"], "assistant");
        assert_eq!(replay["input"][2]["content"], "Hello");
        assert!(replay["store"] == false);
    }

    #[test]
    fn image_input_keeps_the_data_url() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"A png"}"#,
            r#"{"type":"response.completed","response":{"status":"completed"}}"#,
        ])]);
        let messages = vec![json!({
            "role": "user",
            "content": [
                {"type": "text", "text": "what is this"},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,aaaa"}}
            ]
        })];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(
            events.last(),
            Some(&ModelEvent::Finish {
                reason: FinishReason::Stop,
            })
        );
        let body = body_of(&server, 0);
        assert_eq!(
            body["input"][0]["content"],
            json!([
                {"type": "input_text", "text": "what is this"},
                {"type": "input_image", "image_url": "data:image/png;base64,aaaa"}
            ])
        );
        let raw = body.to_string();
        assert!(!raw.contains("\"type\":\"image_url\""));
    }

    #[test]
    fn response_failed_is_an_error() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"partial"}"#,
            r#"{"type":"response.failed","response":{"status":"failed","error":{"code":"server_error","message":"boom"}}}"#,
        ])]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(events[0], text("partial"));
        assert_eq!(events.iter().filter(|event| event.is_terminal()).count(), 1);
        let error = error_of(&events);
        assert_eq!(error.kind, ModelErrorKind::Unavailable);
        assert_eq!(error.message, "boom");
        assert!(events
            .iter()
            .all(|event| !matches!(event, ModelEvent::Finish { .. })));
    }

    #[test]
    fn missing_completed_event_is_an_error() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"Hi"}"#,
        ])]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(events[0], text("Hi"));
        assert_eq!(events.iter().filter(|event| event.is_terminal()).count(), 1);
        let error = error_of(&events);
        assert_eq!(error.kind, ModelErrorKind::Protocol);
        assert_eq!(error.message, MISSING_COMPLETED);
    }

    #[test]
    fn usage_limit_error_is_plain_english() {
        let server = serve(vec![
            responses_sse(&[
                r#"{"type":"response.failed","response":{"status":"failed","error":{"code":"subscription_sharing_usage_limit_exceeded","message":"raw internal"}}}"#,
            ]),
            json_response(
                "429 Too Many Requests",
                r#"{"error":{"code":"insufficient_quota","message":"raw quota"}}"#,
            ),
        ]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        let error = error_of(&events);
        assert_eq!(error.kind, ModelErrorKind::QuotaExhausted);
        assert_eq!(error.message, USAGE_LIMIT);
        assert!(!error.message.contains("raw"));
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        let error = error_of(&events);
        assert_eq!(error.kind, ModelErrorKind::QuotaExhausted);
        assert_eq!(error.message, QUOTA_EMPTY);
        assert!(!error.message.contains("token-1"));
    }

    #[test]
    fn expired_token_refreshes_once_before_output() {
        let server = serve(vec![
            json_response(
                "401 Unauthorized",
                r#"{"error":{"code":"invalid_api_key","message":"token expired secret-token-value"}}"#,
            ),
            responses_sse(&[
                r#"{"type":"response.output_text.delta","delta":"ok"}"#,
                r#"{"type":"response.completed","response":{"status":"completed"}}"#,
            ]),
        ]);
        let refreshes = Rc::new(Cell::new(0));
        let counter = Rc::clone(&refreshes);
        let mut session = BearerSession::new("secret-token-value", move || {
            counter.set(counter.get() + 1);
            Ok("token-2".into())
        });
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(refreshes.get(), 1);
        assert_eq!(
            events,
            vec![
                text("ok"),
                ModelEvent::Finish {
                    reason: FinishReason::Stop,
                },
            ]
        );
        let headers = server.headers.lock().unwrap();
        assert!(headers[0].contains("authorization: bearer secret-token-value"));
        assert!(headers[1].contains("authorization: bearer token-2"));
        let requests = server.requests.lock().unwrap();
        assert_eq!(requests.len(), 2);
        assert_eq!(requests[0].1, requests[1].1);
    }

    #[test]
    fn expired_token_after_output_says_sign_in_again() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"Hi"}"#,
            r#"{"type":"error","code":"invalid_api_key","message":"access token expired"}"#,
        ])]);
        let refreshes = Rc::new(Cell::new(0));
        let counter = Rc::clone(&refreshes);
        let mut session = BearerSession::new("old", move || {
            counter.set(counter.get() + 1);
            Ok("new".into())
        });
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(refreshes.get(), 0);
        assert_eq!(events[0], text("Hi"));
        let error = error_of(&events);
        assert_eq!(error.kind, ModelErrorKind::Auth);
        assert_eq!(error.message, SIGN_IN_AGAIN);
        assert_eq!(server.requests.lock().unwrap().len(), 1);
    }

    #[test]
    fn model_list_keeps_visibility_list_and_falls_back_when_the_call_fails() {
        let server = serve(vec![
            json_response(
                "200 OK",
                r#"{"models":[{"slug":"gpt-6.1-sol","display_name":"GPT-6.1 Sol","visibility":"list"},{"slug":"hidden-one","display_name":"Hidden","visibility":"hide"}]}"#,
            ),
            json_response("500 Internal Server Error", r#"{"error":"down"}"#),
        ]);
        let session = auth("token-1");
        let listed = list_chatgpt_models(&server.base_url, &session, TEST_LIMITS);
        assert_eq!(
            listed,
            vec![ChatGptModel {
                slug: "gpt-6.1-sol".into(),
                display_name: "GPT-6.1 Sol".into(),
            }]
        );
        let fallback = list_chatgpt_models(&server.base_url, &session, TEST_LIMITS);
        assert_eq!(fallback, fallback_chatgpt_models());
        assert!(!fallback.is_empty());
        let headers = server.headers.lock().unwrap();
        assert!(headers[0].contains("authorization: bearer token-1"));
        assert!(headers[1].contains("authorization: bearer token-1"));
    }

    #[test]
    fn model_list_with_no_visible_rows_uses_the_fallback() {
        let server = serve(vec![json_response(
            "200 OK",
            r#"{"models":[{"slug":"hidden-one","display_name":"Hidden","visibility":"hide"}]}"#,
        )]);
        let session = auth("token-1");
        let listed = list_chatgpt_models(&server.base_url, &session, TEST_LIMITS);
        assert_eq!(listed, fallback_chatgpt_models());
    }

    #[test]
    fn system_prefix_and_reasoning_effort_go_on_the_request() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"ok"}"#,
            r#"{"type":"response.completed","response":{"status":"completed"}}"#,
        ])]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut gpt = turn(&server.base_url, Some("Be brief"), &messages, &[], "");
        gpt.system_prefix = Some("Prefix");
        gpt.reasoning_effort = Some("high");
        let mut session = auth("token-1");
        let events = collect(&gpt, &mut session);
        assert!(matches!(
            events.last(),
            Some(ModelEvent::Finish {
                reason: FinishReason::Stop
            })
        ));
        let body = body_of(&server, 0);
        assert_eq!(body["instructions"], "Prefix\nBe brief");
        assert_eq!(body["reasoning"]["effort"], "high");
        assert_eq!(body["include"], json!(["reasoning.encrypted_content"]));
        assert!(body.get("max_output_tokens").is_none());
        assert!(body.get("temperature").is_none());
    }

    #[test]
    fn multi_line_sse_data_is_one_event() {
        let wire = responses_sse(&[r#"{"type":"response.output_text.delta","delta":"Hi"}"#]);
        assert!(wire.contains("data: {\n"), "{wire}");
        assert!(wire.matches("data: ").count() >= 2, "{wire}");
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"Hi"}"#,
            r#"{"type":"response.completed","response":{"status":"completed"}}"#,
        ])]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(
            events,
            vec![
                text("Hi"),
                ModelEvent::Finish {
                    reason: FinishReason::Stop,
                },
            ]
        );
    }

    #[test]
    fn two_parallel_tool_calls_keep_interleaved_arguments() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"call_a","name":"one","namespace":"rhizome","arguments":""}}"#,
            r#"{"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","call_id":"call_b","name":"two","namespace":"rhizome","arguments":""}}"#,
            r#"{"type":"response.function_call_arguments.delta","output_index":0,"delta":"{"}"#,
            r#"{"type":"response.function_call_arguments.delta","output_index":1,"delta":"{"}"#,
            r#"{"type":"response.function_call_arguments.delta","output_index":0,"delta":"\"a\":1}"}"#,
            r#"{"type":"response.function_call_arguments.delta","output_index":1,"delta":"\"b\":2}"}"#,
            r#"{"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call_a","name":"one","namespace":"rhizome","arguments":"{\"a\":1}"}}"#,
            r#"{"type":"response.output_item.done","output_index":1,"item":{"type":"function_call","call_id":"call_b","name":"two","namespace":"rhizome","arguments":"{\"b\":2}"}}"#,
            r#"{"type":"response.completed","response":{"status":"completed"}}"#,
        ])]);
        let messages = vec![json!({"role": "user", "content": "go"})];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(
            events,
            vec![
                ModelEvent::ToolCallStart {
                    id: "call_a".into(),
                    name: "one".into(),
                },
                ModelEvent::ToolCallStart {
                    id: "call_b".into(),
                    name: "two".into(),
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_a".into(),
                    delta: "{".into(),
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_b".into(),
                    delta: "{".into(),
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_a".into(),
                    delta: "\"a\":1}".into(),
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_b".into(),
                    delta: "\"b\":2}".into(),
                },
                ModelEvent::ToolCallEnd {
                    id: "call_a".into(),
                },
                ModelEvent::ToolCallEnd {
                    id: "call_b".into(),
                },
                ModelEvent::Finish {
                    reason: FinishReason::ToolCalls,
                },
            ]
        );
    }

    #[test]
    fn unknown_event_types_are_ignored() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.widget.frob","note":"ignore me"}"#,
            r#"{"type":"response.output_text.delta","delta":"Hi"}"#,
            r#"{"type":"response.completed","response":{"status":"completed"}}"#,
        ])]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(
            events,
            vec![
                text("Hi"),
                ModelEvent::Finish {
                    reason: FinishReason::Stop,
                },
            ]
        );
    }

    #[test]
    fn response_incomplete_is_an_error() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.incomplete","response":{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}}"#,
        ])]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        let error = error_of(&events);
        assert_eq!(error.kind, ModelErrorKind::Protocol);
        assert_eq!(error.message, INCOMPLETE);
        assert!(events
            .iter()
            .all(|event| !matches!(event, ModelEvent::Finish { .. })));
    }

    #[test]
    fn refresh_error_or_empty_token_says_sign_in_again() {
        let server = serve(vec![
            json_response(
                "401 Unauthorized",
                r#"{"error":{"code":"invalid_api_key"}}"#,
            ),
            json_response(
                "401 Unauthorized",
                r#"{"error":{"code":"invalid_api_key"}}"#,
            ),
        ]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut denied = BearerSession::new("old", || Err("nope".into()));
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut denied,
        );
        assert_eq!(error_of(&events).message, "nope");
        assert_ne!(error_of(&events).message, SIGN_IN_AGAIN);
        let mut blank = BearerSession::new("old", || Ok("   ".into()));
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut blank,
        );
        assert_eq!(error_of(&events).message, SIGN_IN_AGAIN);
        assert_eq!(server.requests.lock().unwrap().len(), 2);
    }

    #[test]
    fn second_unauthorized_response_does_not_refresh_again() {
        let server = serve(vec![
            json_response(
                "401 Unauthorized",
                r#"{"error":{"code":"invalid_api_key"}}"#,
            ),
            json_response(
                "401 Unauthorized",
                r#"{"error":{"code":"invalid_api_key"}}"#,
            ),
        ]);
        let refreshes = Rc::new(Cell::new(0));
        let counter = Rc::clone(&refreshes);
        let mut session = BearerSession::new("old", move || {
            counter.set(counter.get() + 1);
            Ok("token-2".into())
        });
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(refreshes.get(), 1);
        assert_eq!(server.requests.lock().unwrap().len(), 2);
        assert_eq!(error_of(&events).message, SIGN_IN_AGAIN);
        let headers = server.headers.lock().unwrap();
        assert!(headers[0].contains("authorization: bearer old"));
        assert!(headers[1].contains("authorization: bearer token-2"));
    }

    #[test]
    fn emit_false_stops_the_stream() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"Hello"}"#,
            r#"{"type":"response.output_text.delta","delta":"!"}"#,
            r#"{"type":"response.completed","response":{"status":"completed"}}"#,
        ])]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = auth("token-1");
        let mut events = Vec::new();
        stream_chatgpt_turn(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
            TEST_LIMITS,
            &mut |event| {
                events.push(event);
                false
            },
        );
        assert_eq!(events, vec![text("Hello")]);
    }

    #[test]
    fn a_token_endpoint_failure_stays_a_temporary_error() {
        let server = serve(vec![json_response(
            "401 Unauthorized",
            r#"{"error":{"code":"invalid_api_key"}}"#,
        )]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = BearerSession::new("old", || Err("The token request failed.".into()));
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        let error = error_of(&events);
        assert_eq!(error.kind, ModelErrorKind::Unavailable);
        assert_eq!(error.message, "The token request failed.");
        assert_ne!(error.message, SIGN_IN_AGAIN);
    }

    #[test]
    fn empty_bearer_token_says_sign_in_again() {
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = BearerSession::new("   ", || Ok("later".into()));
        let events = collect(
            &turn("http://127.0.0.1:9/v1", None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(error_of(&events).kind, ModelErrorKind::Auth);
        assert_eq!(error_of(&events).message, SIGN_IN_AGAIN);
    }

    #[test]
    fn expired_failure_before_output_refreshes_once() {
        let server = serve(vec![
            responses_sse(&[
                r#"{"type":"response.failed","response":{"status":"failed","error":{"code":"invalid_api_key","message":"access token expired"}}}"#,
            ]),
            responses_sse(&[
                r#"{"type":"response.output_text.delta","delta":"ok"}"#,
                r#"{"type":"response.completed","response":{"status":"completed"}}"#,
            ]),
        ]);
        let refreshes = Rc::new(Cell::new(0));
        let counter = Rc::clone(&refreshes);
        let mut session = BearerSession::new("old", move || {
            counter.set(counter.get() + 1);
            Ok("token-2".into())
        });
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(refreshes.get(), 1);
        assert_eq!(server.requests.lock().unwrap().len(), 2);
        assert_eq!(
            events,
            vec![
                text("ok"),
                ModelEvent::Finish {
                    reason: FinishReason::Stop,
                },
            ]
        );
    }

    #[test]
    fn rate_limit_keeps_retry_after() {
        let server = serve(vec![http_response(
            "429 Too Many Requests",
            &["Content-Type: application/json", "Retry-After: 7"],
            r#"{"error":{"message":"slow down"}}"#,
        )]);
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let mut session = auth("token-1");
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(
            error_of(&events).kind,
            ModelErrorKind::RateLimited {
                retry_after_secs: Some(7),
            }
        );
    }

    #[test]
    fn clear_responses_replay_drops_the_chat() {
        let mut calls = 0usize;
        let server = serve_mapped(2, move |_target, body| {
            calls += 1;
            if calls > 1 {
                return responses_sse(&[
                    r#"{"type":"response.output_text.delta","delta":"Next"}"#,
                    r#"{"type":"response.completed","response":{"status":"completed"}}"#,
                ]);
            }
            let asked = body.contains("reasoning.encrypted_content");
            let item = if asked {
                r#"{"type":"reasoning","id":"rs_clear","summary":[],"encrypted_content":"enc-clear","status":"completed"}"#
            } else {
                r#"{"type":"reasoning","id":"rs_clear","summary":[],"status":"completed"}"#
            };
            let done =
                format!(r#"{{"type":"response.output_item.done","output_index":0,"item":{item}}}"#);
            responses_sse(&[
                &done,
                r#"{"type":"response.output_text.delta","delta":"Hello"}"#,
                r#"{"type":"response.completed","response":{"status":"completed"}}"#,
            ])
        });
        let session = "clear-replay";
        let first = vec![json!({"role": "user", "content": "Hi"})];
        let mut bearer = auth("token-1");
        let _ = collect(
            &turn(&server.base_url, None, &first, &[], session),
            &mut bearer,
        );
        clear_responses_replay(session);
        let second = vec![
            json!({"role": "user", "content": "Hi"}),
            json!({"role": "assistant", "content": "Hello"}),
        ];
        let _ = collect(
            &turn(&server.base_url, None, &second, &[], session),
            &mut bearer,
        );
        let replay = body_of(&server, 1);
        let input = replay["input"].as_array().unwrap();
        assert!(input.iter().all(|item| item["type"] != "reasoning"));
    }

    #[test]
    fn replay_map_drops_the_oldest_chat_after_64() {
        let sessions = (0..=MAX_REPLAY_SESSIONS)
            .map(|index| format!("evict-chat-{index}"))
            .collect::<Vec<_>>();
        for session in &sessions {
            store_replay(
                session,
                ReplayTurn {
                    items: vec![json!({
                        "type": "reasoning",
                        "encrypted_content": "enc",
                    })],
                    call_ids: Vec::new(),
                    text: Some("hello".into()),
                },
            );
        }
        assert!(load_replay(&sessions[0]).is_empty());
        assert_eq!(load_replay(&sessions[1]).len(), 1);
        assert_eq!(load_replay(sessions.last().unwrap()).len(), 1);
        for session in &sessions {
            clear_responses_replay(session);
        }
    }

    #[test]
    fn expired_failure_after_output_does_not_refresh() {
        let server = serve(vec![responses_sse(&[
            r#"{"type":"response.output_text.delta","delta":"Hi"}"#,
            r#"{"type":"response.failed","response":{"status":"failed","error":{"code":"invalid_api_key","message":"access token expired"}}}"#,
        ])]);
        let refreshes = Rc::new(Cell::new(0));
        let counter = Rc::clone(&refreshes);
        let mut session = BearerSession::new("old", move || {
            counter.set(counter.get() + 1);
            Ok("token-2".into())
        });
        let messages = vec![json!({"role": "user", "content": "Hi"})];
        let events = collect(
            &turn(&server.base_url, None, &messages, &[], ""),
            &mut session,
        );
        assert_eq!(refreshes.get(), 0);
        assert_eq!(events[0], text("Hi"));
        assert_eq!(error_of(&events).message, SIGN_IN_AGAIN);
        assert_eq!(error_of(&events).kind, ModelErrorKind::Auth);
        assert_eq!(server.requests.lock().unwrap().len(), 1);
    }
}
