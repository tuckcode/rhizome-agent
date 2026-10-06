use crate::ai_agents::AiAgentPermissionMode;

use super::protocol::PermissionOption;

/// Decision Rhizome's vault-layer policy makes for an ACP permission request.
///
/// The harness still owns the tool runner. Rhizome only chooses among the
/// options the agent offered (ADR-0177, ADR-0103).
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PermissionDecision {
    Selected(String),
    Cancelled,
}

pub(crate) fn decide_permission(
    mode: AiAgentPermissionMode,
    options: &[PermissionOption],
) -> PermissionDecision {
    if options.is_empty() {
        return PermissionDecision::Cancelled;
    }

    let wanted = match mode {
        AiAgentPermissionMode::Safe => OptionClass::Reject,
        AiAgentPermissionMode::PowerUser => OptionClass::AllowOnce,
    };

    if let Some(option) = options.iter().find(|option| wanted.matches(option)) {
        return PermissionDecision::Selected(option.option_id.clone());
    }

    PermissionDecision::Cancelled
}

#[derive(Clone, Copy)]
enum OptionClass {
    AllowOnce,
    Reject,
}

impl OptionClass {
    fn matches(self, option: &PermissionOption) -> bool {
        let kind = option.kind.as_deref().unwrap_or("");
        let id = option.option_id.as_str();
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

/// Power User maps Hermes edit-approval session modes to auto-allow workspace
/// edits. Limited tools (Safe) leaves the agent's default "ask" mode.
pub(crate) fn edit_approval_mode(mode: AiAgentPermissionMode) -> Option<&'static str> {
    match mode {
        AiAgentPermissionMode::Safe => None,
        AiAgentPermissionMode::PowerUser => Some("accept_edits"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn option(option_id: &str, kind: &str) -> PermissionOption {
        PermissionOption {
            option_id: option_id.into(),
            name: Some(option_id.into()),
            kind: Some(kind.into()),
        }
    }

    fn hermes_options() -> Vec<PermissionOption> {
        vec![
            option("allow_once", "allow_once"),
            option("allow_session", "allow_always"),
            option("allow_always", "allow_always"),
            option("deny", "reject_once"),
        ]
    }

    fn spec_options() -> Vec<PermissionOption> {
        vec![
            option("allow-once", "allow_once"),
            option("reject-once", "reject_once"),
        ]
    }

    #[test]
    fn safe_mode_denies_hermes_permission_requests() {
        let decision = decide_permission(AiAgentPermissionMode::Safe, &hermes_options());
        assert_eq!(decision, PermissionDecision::Selected("deny".into()));
    }

    #[test]
    fn power_user_allows_once_on_hermes_options() {
        let decision = decide_permission(AiAgentPermissionMode::PowerUser, &hermes_options());
        assert_eq!(decision, PermissionDecision::Selected("allow_once".into()));
    }

    #[test]
    fn policy_accepts_spec_option_ids() {
        assert_eq!(
            decide_permission(AiAgentPermissionMode::Safe, &spec_options()),
            PermissionDecision::Selected("reject-once".into())
        );
        assert_eq!(
            decide_permission(AiAgentPermissionMode::PowerUser, &spec_options()),
            PermissionDecision::Selected("allow-once".into())
        );
    }

    #[test]
    fn empty_options_cancel() {
        assert_eq!(
            decide_permission(AiAgentPermissionMode::PowerUser, &[]),
            PermissionDecision::Cancelled
        );
    }

    #[test]
    fn power_user_sets_hermes_accept_edits_mode() {
        assert_eq!(
            edit_approval_mode(AiAgentPermissionMode::PowerUser),
            Some("accept_edits")
        );
        assert_eq!(edit_approval_mode(AiAgentPermissionMode::Safe), None);
    }
}
