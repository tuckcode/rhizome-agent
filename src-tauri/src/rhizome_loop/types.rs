/// Durable facts for one agent. Live coordination stays out of this list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DurableEvent {
    User {
        text: String,
    },
    Assistant {
        text: String,
    },
    /// The model started this call. `id` is the provider tool-call id.
    ToolCall {
        id: String,
        name: String,
        args: String,
    },
    ToolResult {
        id: String,
        name: String,
        output: String,
    },
    ToolDenied {
        id: String,
        name: String,
        reason: String,
    },
    ModelFailed {
        message: String,
    },
    TurnEnd,
    Cancelled {
        cause: String,
    },
}

/// One model-visible tool call the assistant started.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: String,
}

/// One model-visible fact from earlier in the session.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HistoryItem {
    User {
        text: String,
    },
    Assistant {
        text: String,
        tool_calls: Vec<ToolCall>,
    },
    ToolResult {
        id: String,
        name: String,
        output: String,
    },
    ToolDenied {
        id: String,
        name: String,
        reason: String,
    },
}

/// What one model call is allowed to see. Inbox items are not included.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelView {
    pub admitted: String,
    /// Ordered user, assistant, and tool facts already logged.
    /// The current admitted message is not repeated here.
    pub history: Vec<HistoryItem>,
    /// Index in `history` where this turn's items begin. The admitted
    /// user line is inserted at this index only when the turn ends.
    pub turn_start: usize,
    /// Names only. Schemas stay with the provider adapter (#105).
    pub offered_tools: Vec<String>,
}
