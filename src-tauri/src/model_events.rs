//! Events that one model request streams to the Rhizome loop (harness plan
//! Phase 4).
//!
//! The provider layer (`ai_models.rs`) parses each wire format into these
//! events. The loop (`rhizome_loop`) consumes them. The provider layer runs
//! no tools. A tool call is only data here.
//!
//! Stream contract:
//! - Zero or more `TextDelta` and tool-call events, then one terminal event.
//! - The terminal event is `Finish` or `Error`. Nothing follows it.
//! - Each tool call is `ToolCallStart`, zero or more `ToolCallArgsDelta`,
//!   then `ToolCallEnd`, all with the same `id`.
//! - Tool calls can interleave. The `id` tells them apart. The parser maps
//!   wire indexes (OpenAI `index`, Anthropic content block) to the `id`.
//! - The concatenated `ToolCallArgsDelta` text is the raw JSON arguments
//!   string. The consumer parses it after `ToolCallEnd`.

/// One event from one model request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ModelEvent {
    /// Assistant text, in arrival order.
    TextDelta { text: String },
    /// The model started a tool call. `id` is the provider's tool-call id.
    /// The loop sends the same id back with the tool result.
    ToolCallStart { id: String, name: String },
    /// A fragment of the raw JSON arguments for the call `id`.
    ToolCallArgsDelta { id: String, delta: String },
    /// The arguments for the call `id` are complete.
    ToolCallEnd { id: String },
    /// The request completed normally. Terminal.
    Finish { reason: FinishReason },
    /// The request failed. Terminal. Text and tool calls that arrived
    /// before this event are partial.
    Error(ModelError),
}

impl ModelEvent {
    /// True for `Finish` and `Error`. No event follows a terminal event.
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Finish { .. } | Self::Error(_))
    }
}

/// Why the model stopped.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FinishReason {
    /// The model ended its reply.
    Stop,
    /// The model wants the tool calls in this step run.
    ToolCalls,
    /// The output hit the token limit.
    Length,
    /// The provider filtered the output.
    ContentFilter,
    /// A reason this enum does not name. The provider's string, verbatim.
    Other(String),
}

/// A failed model request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelError {
    pub kind: ModelErrorKind,
    /// HTTP status when the provider sent one.
    pub status: Option<u16>,
    /// Text for logs and the user. Never contains an API key.
    pub message: String,
}

/// Failure classes. The fallback router (Phase 4b) chooses on these, so
/// each class maps to one routing action.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelErrorKind {
    /// HTTP 429 or the provider's equivalent. `retry_after_secs` comes
    /// from a `Retry-After` header when one is present.
    RateLimited { retry_after_secs: Option<u64> },
    /// The free tier or the account quota is used up.
    QuotaExhausted,
    /// A 5xx status, a connect failure, or a timeout.
    Unavailable,
    /// HTTP 401 or 403, or no API key for a provider that needs one.
    Auth,
    /// Any other 4xx status: the provider rejected this request.
    Rejected,
    /// The response or stream did not parse.
    Protocol,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn error(kind: ModelErrorKind) -> ModelEvent {
        ModelEvent::Error(ModelError {
            kind,
            status: None,
            message: String::new(),
        })
    }

    #[test]
    fn finish_and_error_are_the_only_terminal_events() {
        let terminal = [
            ModelEvent::Finish {
                reason: FinishReason::Stop,
            },
            ModelEvent::Finish {
                reason: FinishReason::Other("eos".into()),
            },
            error(ModelErrorKind::RateLimited {
                retry_after_secs: Some(3),
            }),
            error(ModelErrorKind::Protocol),
        ];
        for event in &terminal {
            assert!(event.is_terminal(), "{event:?} must end the stream");
        }

        let open = [
            ModelEvent::TextDelta { text: "hi".into() },
            ModelEvent::ToolCallStart {
                id: "call_1".into(),
                name: "create_note".into(),
            },
            ModelEvent::ToolCallArgsDelta {
                id: "call_1".into(),
                delta: "{\"title\"".into(),
            },
            ModelEvent::ToolCallEnd {
                id: "call_1".into(),
            },
        ];
        for event in &open {
            assert!(!event.is_terminal(), "{event:?} must not end the stream");
        }
    }
}
