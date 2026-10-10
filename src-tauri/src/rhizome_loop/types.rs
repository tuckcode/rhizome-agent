/// Durable facts for one agent. Live coordination stays out of this list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DurableEvent {
    User { text: String },
    Assistant { text: String },
    ToolResult { name: String, output: String },
    ToolDenied { name: String, reason: String },
    TurnEnd,
    Cancelled { cause: String },
}

/// One model-visible fact from earlier in the session.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HistoryItem {
    User { text: String },
    Assistant { text: String },
    ToolResult { name: String, output: String },
    ToolDenied { name: String, reason: String },
}

/// What one model call is allowed to see. Inbox items are not included.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelView {
    pub admitted: String,
    /// Ordered user, assistant, and tool facts already logged.
    /// The current admitted message is not repeated here.
    pub history: Vec<HistoryItem>,
    pub offered_tools: Vec<String>,
}
