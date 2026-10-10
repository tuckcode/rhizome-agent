//! Shared allow / deny / cancel table for a permission request.
//!
//! ACP (`acp_client::permission`) and the Rhizome loop both use this.
//! Safe selects a reject option. Power User selects allow-once, not
//! allow-always. An empty option list cancels (fail-closed).

use crate::ai_agents::AiAgentPermissionMode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PolicyOption {
    pub id: String,
    pub kind: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PolicyDecision {
    Selected(String),
    Cancelled,
}

pub(crate) fn decide(mode: AiAgentPermissionMode, options: &[PolicyOption]) -> PolicyDecision {
    if options.is_empty() {
        return PolicyDecision::Cancelled;
    }

    let wanted = match mode {
        AiAgentPermissionMode::Safe => OptionClass::Reject,
        AiAgentPermissionMode::PowerUser => OptionClass::AllowOnce,
    };

    if let Some(option) = options.iter().find(|option| wanted.matches(option)) {
        return PolicyDecision::Selected(option.id.clone());
    }

    PolicyDecision::Cancelled
}

#[derive(Clone, Copy)]
enum OptionClass {
    AllowOnce,
    Reject,
}

impl OptionClass {
    fn matches(self, option: &PolicyOption) -> bool {
        let kind = option.kind.as_deref().unwrap_or("");
        let id = option.id.as_str();
        match self {
            Self::AllowOnce => {
                kind_is(kind, &["allow_once"])
                    || id_is(id, &["allow_once", "allow-once", "allow_session"])
            }
            Self::Reject => {
                kind_is(kind, &["reject_once", "reject_always"])
                    || id_is(id, &["deny", "deny_always", "reject-once", "reject_once"])
            }
        }
    }
}

fn kind_is(kind: &str, allowed: &[&str]) -> bool {
    allowed
        .iter()
        .any(|candidate| kind.eq_ignore_ascii_case(candidate))
}

fn id_is(id: &str, allowed: &[&str]) -> bool {
    allowed
        .iter()
        .any(|candidate| id.eq_ignore_ascii_case(candidate))
}
