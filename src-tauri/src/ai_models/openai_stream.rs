//! OpenAI-compatible chat-completions output parsed into `ModelEvent`
//! (harness plan Phase 4). This module runs no tools.
//!
//! Rules beyond the `model_events` stream contract:
//! - Arguments always reach the loop as `ToolCallArgsDelta`, also when a
//!   server sends them whole on the first chunk. A call that gets no
//!   arguments at all gets one `{}` delta before its end.
//! - An object sent as `arguments` (some local servers) becomes JSON text.
//! - A call with no `id` gets `call_<index>`.
//! - `stop` after a tool call reports `ToolCalls`. Some local servers send
//!   `stop` for a step that called tools.
//! - An error after partial text or tool calls is the single terminal event.
//!   Open calls get no `ToolCallEnd`.

use std::collections::BTreeMap;

use serde_json::Value;

use crate::model_events::{FinishReason, ModelError, ModelErrorKind, ModelEvent};

#[derive(Default)]
struct ToolCallState {
    id: Option<String>,
    name: Option<String>,
    started: bool,
    /// Arguments that arrived before the name. Sent after the start.
    pending_args: String,
    sent_args: bool,
}

/// Turns one chat-completions response into model events.
#[derive(Default)]
pub(crate) struct OpenAiStreamParser {
    /// Keyed by the wire `index`, so ends come out in index order.
    calls: BTreeMap<u64, ToolCallState>,
    finished: bool,
}

impl OpenAiStreamParser {
    /// True after the terminal event. Later input is ignored.
    pub(crate) fn is_finished(&self) -> bool {
        self.finished
    }

    /// One SSE `data:` payload, without the `data:` prefix.
    pub(crate) fn push_data(&mut self, data: &str) -> Vec<ModelEvent> {
        if self.finished {
            return Vec::new();
        }
        let data = data.trim();
        if data == "[DONE]" {
            return self.finish(None);
        }
        match serde_json::from_str::<Value>(data) {
            Ok(chunk) => self.push_chunk(&chunk),
            Err(error) => self.fail(ModelError {
                kind: ModelErrorKind::Protocol,
                status: None,
                message: format!("Failed to parse AI provider stream: {error}"),
            }),
        }
    }

    /// A whole non-streamed completion. Some servers ignore `stream: true`.
    /// The message has the same fields as a stream delta.
    pub(crate) fn push_completion(&mut self, json: &Value) -> Vec<ModelEvent> {
        let choice = &json["choices"][0];
        let mut message = choice["message"].clone();
        if let Some(calls) = message["tool_calls"].as_array_mut() {
            for (position, call) in calls.iter_mut().enumerate() {
                if call.get("index").is_none() {
                    call["index"] = Value::from(position);
                }
            }
        }
        let chunk = serde_json::json!({
            "error": json.get("error"),
            "choices": [{ "delta": message, "finish_reason": choice["finish_reason"] }],
        });
        let mut events = self.push_chunk(&chunk);
        if !self.finished {
            events.extend(self.finish(None));
        }
        events
    }

    /// The byte stream ended.
    pub(crate) fn end_of_stream(&mut self) -> Vec<ModelEvent> {
        if self.finished {
            return Vec::new();
        }
        self.fail(protocol_error(
            "AI provider stream ended before it finished.",
        ))
    }

    fn push_chunk(&mut self, chunk: &Value) -> Vec<ModelEvent> {
        if let Some(error) = chunk.get("error").filter(|error| !error.is_null()) {
            return self.fail(stream_error(error));
        }
        let mut events = Vec::new();
        let choice = &chunk["choices"][0];
        let delta = &choice["delta"];
        if let Some(text) = delta["content"].as_str().filter(|text| !text.is_empty()) {
            events.push(ModelEvent::TextDelta { text: text.into() });
        }
        if let Some(calls) = delta["tool_calls"].as_array() {
            for (position, call) in calls.iter().enumerate() {
                let index = call["index"].as_u64().unwrap_or(position as u64);
                self.push_tool_call(index, call, &mut events);
            }
        }
        if let Some(reason) = choice["finish_reason"].as_str() {
            events.extend(self.finish(Some(reason)));
        }
        events
    }

    fn push_tool_call(&mut self, index: u64, call: &Value, events: &mut Vec<ModelEvent>) {
        let state = self.calls.entry(index).or_default();
        if let Some(id) = call["id"].as_str().filter(|id| !id.is_empty()) {
            state.id.get_or_insert_with(|| id.to_string());
        }
        let function = &call["function"];
        if let Some(name) = function["name"].as_str().filter(|name| !name.is_empty()) {
            state.name.get_or_insert_with(|| name.to_string());
        }
        state
            .pending_args
            .push_str(&argument_text(&function["arguments"]));

        if !state.started {
            let Some(name) = state.name.clone() else {
                return;
            };
            let id = state
                .id
                .get_or_insert_with(|| format!("call_{index}"))
                .clone();
            state.started = true;
            events.push(ModelEvent::ToolCallStart { id, name });
        }
        if !state.pending_args.is_empty() {
            state.sent_args = true;
            events.push(ModelEvent::ToolCallArgsDelta {
                id: state.id.clone().unwrap_or_default(),
                delta: std::mem::take(&mut state.pending_args),
            });
        }
    }

    fn finish(&mut self, reason: Option<&str>) -> Vec<ModelEvent> {
        let calls = std::mem::take(&mut self.calls);
        let called_tools = !calls.is_empty();
        let mut events = Vec::new();
        for (index, call) in calls {
            if !call.started {
                events.extend(self.fail(protocol_error(&format!(
                    "AI provider sent tool call {index} without a function name."
                ))));
                return events;
            }
            let id = call.id.unwrap_or_default();
            if !call.sent_args {
                events.push(ModelEvent::ToolCallArgsDelta {
                    id: id.clone(),
                    delta: "{}".into(),
                });
            }
            events.push(ModelEvent::ToolCallEnd { id });
        }
        self.finished = true;
        events.push(ModelEvent::Finish {
            reason: finish_reason(reason, called_tools),
        });
        events
    }

    fn fail(&mut self, error: ModelError) -> Vec<ModelEvent> {
        self.finished = true;
        vec![ModelEvent::Error(error)]
    }
}

fn argument_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn finish_reason(reason: Option<&str>, called_tools: bool) -> FinishReason {
    match reason {
        Some("tool_calls" | "function_call") => FinishReason::ToolCalls,
        Some("stop") | None if called_tools => FinishReason::ToolCalls,
        Some("stop") | None => FinishReason::Stop,
        Some("length") => FinishReason::Length,
        Some("content_filter") => FinishReason::ContentFilter,
        Some(other) => FinishReason::Other(other.to_string()),
    }
}

fn stream_error(error: &Value) -> ModelError {
    let code = [&error["code"], &error["type"]]
        .iter()
        .filter_map(|value| value.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let kind = if code.contains("insufficient_quota") {
        ModelErrorKind::QuotaExhausted
    } else if code.contains("rate_limit") {
        ModelErrorKind::RateLimited {
            retry_after_secs: None,
        }
    } else {
        ModelErrorKind::Unavailable
    };
    let message = error["message"]
        .as_str()
        .unwrap_or("AI provider stream reported an error.")
        .to_string();
    ModelError {
        kind,
        status: None,
        message,
    }
}

fn protocol_error(message: &str) -> ModelError {
    ModelError {
        kind: ModelErrorKind::Protocol,
        status: None,
        message: message.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model_events::{FinishReason, ModelError, ModelErrorKind};
    use serde_json::json;

    fn text(value: &str) -> ModelEvent {
        ModelEvent::TextDelta { text: value.into() }
    }

    fn start(id: &str, name: &str) -> ModelEvent {
        ModelEvent::ToolCallStart {
            id: id.into(),
            name: name.into(),
        }
    }

    fn args(id: &str, delta: &str) -> ModelEvent {
        ModelEvent::ToolCallArgsDelta {
            id: id.into(),
            delta: delta.into(),
        }
    }

    fn end(id: &str) -> ModelEvent {
        ModelEvent::ToolCallEnd { id: id.into() }
    }

    fn finish(reason: FinishReason) -> ModelEvent {
        ModelEvent::Finish { reason }
    }

    fn run(lines: &[&str]) -> Vec<ModelEvent> {
        let mut parser = OpenAiStreamParser::default();
        let mut events = Vec::new();
        for line in lines {
            events.extend(parser.push_data(line));
        }
        events.extend(parser.end_of_stream());
        events
    }

    fn error_kind(events: &[ModelEvent]) -> Option<ModelErrorKind> {
        match events.last() {
            Some(ModelEvent::Error(ModelError { kind, .. })) => Some(kind.clone()),
            _ => None,
        }
    }

    fn assert_one_terminal_at_end(events: &[ModelEvent]) {
        let terminals = events.iter().filter(|event| event.is_terminal()).count();
        assert_eq!(terminals, 1, "{events:?}");
        assert!(events.last().is_some_and(ModelEvent::is_terminal));
    }

    #[test]
    fn text_deltas_then_stop() {
        let events = run(&[
            r#"{"choices":[{"delta":{"role":"assistant","content":""}}]}"#,
            r#"{"choices":[{"delta":{"content":"Hel"}}]}"#,
            r#"{"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ]);

        assert_eq!(
            events,
            vec![text("Hel"), text("lo"), finish(FinishReason::Stop)]
        );
    }

    #[test]
    fn openai_tool_call_delta_becomes_loop_event() {
        // Qwen / LM Studio shape: id and name first, then argument fragments
        // that carry only the index.
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","type":"function","function":{"name":"create_note","arguments":""}}]}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"path\":"}}]}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"a.md\"}"}}]}}]}"#,
            r#"{"choices":[{"delta":{},"finish_reason":"tool_calls"}]}"#,
            "[DONE]",
        ]);

        assert_eq!(
            events,
            vec![
                start("call_a", "create_note"),
                args("call_a", "{\"path\":"),
                args("call_a", "\"a.md\"}"),
                end("call_a"),
                finish(FinishReason::ToolCalls),
            ]
        );
    }

    #[test]
    fn whole_arguments_on_the_first_chunk_still_arrive_as_an_args_delta() {
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"create_note","arguments":"{\"path\":\"a.md\"}"}}]},"finish_reason":"tool_calls"}]}"#,
        ]);

        assert_eq!(
            events,
            vec![
                start("call_a", "create_note"),
                args("call_a", "{\"path\":\"a.md\"}"),
                end("call_a"),
                finish(FinishReason::ToolCalls),
            ]
        );
    }

    #[test]
    fn object_arguments_are_sent_as_json_text() {
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"create_note","arguments":{"path":"a.md"}}}]},"finish_reason":"tool_calls"}]}"#,
        ]);

        assert_eq!(events[1], args("call_a", "{\"path\":\"a.md\"}"));
    }

    #[test]
    fn a_call_with_no_arguments_gets_an_empty_object() {
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"list_notes"}}]},"finish_reason":"tool_calls"}]}"#,
        ]);

        assert_eq!(
            events,
            vec![
                start("call_a", "list_notes"),
                args("call_a", "{}"),
                end("call_a"),
                finish(FinishReason::ToolCalls),
            ]
        );
    }

    #[test]
    fn interleaved_calls_keep_their_own_ids() {
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"one","arguments":""}},{"index":1,"id":"call_b","function":{"name":"two","arguments":""}}]}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{}"}}]}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]}}]}"#,
            "[DONE]",
        ]);

        assert_eq!(
            events,
            vec![
                start("call_a", "one"),
                start("call_b", "two"),
                args("call_b", "{}"),
                args("call_a", "{}"),
                end("call_a"),
                end("call_b"),
                finish(FinishReason::ToolCalls),
            ]
        );
    }

    #[test]
    fn a_missing_id_gets_a_stable_one_from_the_index() {
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":2,"function":{"name":"one","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}"#,
        ]);

        assert_eq!(events[0], start("call_2", "one"));
        assert_eq!(events[2], end("call_2"));
    }

    #[test]
    fn arguments_before_the_name_wait_for_the_start() {
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"a\""}}]}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"one","arguments":":1}"}}]}}]}"#,
            "[DONE]",
        ]);

        // The held fragment goes out with the next one, after the start.
        assert_eq!(
            &events[..2],
            &[start("call_a", "one"), args("call_a", "{\"a\":1}")]
        );
    }

    #[test]
    fn stop_with_tool_calls_reports_tool_calls() {
        // Some local servers send `stop` even when the step called tools.
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"one","arguments":"{}"}}]},"finish_reason":"stop"}]}"#,
        ]);

        assert_eq!(events.last(), Some(&finish(FinishReason::ToolCalls)));
    }

    #[test]
    fn other_finish_reasons_map_or_pass_through() {
        for (wire, reason) in [
            ("length", FinishReason::Length),
            ("content_filter", FinishReason::ContentFilter),
            ("eos", FinishReason::Other("eos".into())),
        ] {
            let line = format!(r#"{{"choices":[{{"delta":{{}},"finish_reason":"{wire}"}}]}}"#);
            assert_eq!(run(&[&line]), vec![finish(reason)]);
        }
    }

    #[test]
    fn done_without_a_finish_reason_still_finishes() {
        let events = run(&[r#"{"choices":[{"delta":{"content":"hi"}}]}"#, "[DONE]"]);

        assert_eq!(events, vec![text("hi"), finish(FinishReason::Stop)]);
    }

    #[test]
    fn input_after_the_terminal_event_is_ignored() {
        let events = run(&[
            r#"{"choices":[{"delta":{},"finish_reason":"stop"}]}"#,
            r#"{"choices":[],"usage":{"total_tokens":3}}"#,
            r#"{"choices":[{"delta":{"content":"late"}}]}"#,
            "[DONE]",
        ]);

        assert_eq!(events, vec![finish(FinishReason::Stop)]);
    }

    #[test]
    fn an_error_after_partials_is_the_single_terminal_event() {
        let events = run(&[
            r#"{"choices":[{"delta":{"content":"part"}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"one","arguments":"{\"a\""}}]}}]}"#,
            r#"{"error":{"message":"slow down","type":"rate_limit_exceeded"}}"#,
            r#"{"choices":[{"delta":{},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ]);

        assert_eq!(
            &events[..3],
            &[
                text("part"),
                start("call_a", "one"),
                args("call_a", "{\"a\""),
            ]
        );
        assert_eq!(events.len(), 4, "no ToolCallEnd after an error: {events:?}");
        assert_one_terminal_at_end(&events);
        assert_eq!(
            error_kind(&events),
            Some(ModelErrorKind::RateLimited {
                retry_after_secs: None
            })
        );
    }

    #[test]
    fn stream_errors_are_classified() {
        let quota = run(&[r#"{"error":{"message":"out","code":"insufficient_quota"}}"#]);
        let other = run(&[r#"{"error":{"message":"boom"}}"#]);

        assert_eq!(error_kind(&quota), Some(ModelErrorKind::QuotaExhausted));
        assert_eq!(error_kind(&other), Some(ModelErrorKind::Unavailable));
    }

    #[test]
    fn malformed_json_is_a_protocol_error() {
        let events = run(&[r#"{"choices":[{"delta":{"content":"ok"}}]}"#, "{not json"]);

        assert_eq!(events[0], text("ok"));
        assert_one_terminal_at_end(&events);
        assert_eq!(error_kind(&events), Some(ModelErrorKind::Protocol));
    }

    #[test]
    fn a_stream_that_stops_early_is_a_protocol_error() {
        let events = run(&[r#"{"choices":[{"delta":{"content":"cut"}}]}"#]);

        assert_eq!(events[0], text("cut"));
        assert_eq!(error_kind(&events), Some(ModelErrorKind::Protocol));
    }

    #[test]
    fn a_tool_call_without_a_name_is_a_protocol_error() {
        let events = run(&[
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]},"finish_reason":"tool_calls"}]}"#,
        ]);

        assert_one_terminal_at_end(&events);
        assert_eq!(error_kind(&events), Some(ModelErrorKind::Protocol));
    }

    #[test]
    fn a_whole_completion_becomes_the_same_events() {
        let mut parser = OpenAiStreamParser::default();
        let events = parser.push_completion(&json!({
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "Creating it.",
                    "tool_calls": [{
                        "id": "call_a",
                        "type": "function",
                        "function": { "name": "create_note", "arguments": "{\"path\":\"a.md\"}" }
                    }]
                },
                "finish_reason": "tool_calls"
            }]
        }));

        assert_eq!(
            events,
            vec![
                text("Creating it."),
                start("call_a", "create_note"),
                args("call_a", "{\"path\":\"a.md\"}"),
                end("call_a"),
                finish(FinishReason::ToolCalls),
            ]
        );
        assert!(parser.is_finished());
        assert!(parser.end_of_stream().is_empty());
    }

    #[test]
    fn a_whole_completion_without_a_finish_reason_still_finishes() {
        let mut parser = OpenAiStreamParser::default();
        let events = parser.push_completion(&json!({
            "choices": [{ "message": { "content": "hi" } }]
        }));

        assert_eq!(events, vec![text("hi"), finish(FinishReason::Stop)]);
    }
}
