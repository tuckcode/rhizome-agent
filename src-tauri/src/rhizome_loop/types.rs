/// Durable facts for one agent. Live coordination stays out of this list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DurableEvent {
    User { text: String },
    Assistant { text: String },
    TurnEnd,
    Cancelled { cause: String },
}

/// What one model call is allowed to see. Inbox items are not included.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelView {
    pub admitted: String,
    /// User texts from turns that already logged `TurnEnd`.
    pub prior_users: Vec<String>,
}
