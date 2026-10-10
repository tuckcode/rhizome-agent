//! Tool allow / deny for the Rhizome loop.
//!
//! Limited tools (`Safe`) may run `echo` and `create_note`. `echo`
//! auto-runs. `create_note` asks every call (Allow once and Deny).
//! Power User `echo` still auto-runs once from the shared table.
//! Power User `create_note` runs with no prompt. Power User `bash`
//! asks a human for each call unless a session grant already matches.
//! A name outside `offered_tools` is denied by the driver before this
//! function runs. No waiter, or a cancelled wait, denies.

use crate::ai_agents::AiAgentPermissionMode;
use crate::ai_model_tools::CREATE_NOTE_TOOL_NAME;
use crate::permission_decision::{decide, PolicyDecision, PolicyOption};

/// One choice on an approval prompt. Limited-tools `create_note` offers
/// Allow once and Deny only — never Allow for session.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ApprovalOption {
    pub id: String,
    pub label: String,
}

pub enum Ruling {
    /// Run the tool. When `spend_grant` is set, the same name and args
    /// are denied the next time.
    Run {
        spend_grant: bool,
    },
    Deny {
        reason: String,
    },
    Ask,
}

pub fn rule_tool(mode: AiAgentPermissionMode, name: &str, grant_spent: bool) -> Ruling {
    if name == "bash" && mode == AiAgentPermissionMode::Safe {
        return match decide(mode, &[deny_option()]) {
            PolicyDecision::Selected(_) | PolicyDecision::Cancelled => Ruling::Deny {
                reason: "not offered".into(),
            },
        };
    }

    if name == "echo" && mode == AiAgentPermissionMode::Safe {
        return Ruling::Run { spend_grant: false };
    }

    if name == CREATE_NOTE_TOOL_NAME {
        return match mode {
            AiAgentPermissionMode::Safe => Ruling::Ask,
            AiAgentPermissionMode::PowerUser => Ruling::Run { spend_grant: false },
        };
    }

    if name == "bash" {
        return Ruling::Ask;
    }

    if name == "echo" {
        if grant_spent {
            return Ruling::Deny {
                reason: "grant spent".into(),
            };
        }
        return match decide(mode, &[allow_once_option(), deny_option()]) {
            PolicyDecision::Selected(id) if id == "allow_once" => Ruling::Run { spend_grant: true },
            PolicyDecision::Selected(_) | PolicyDecision::Cancelled => Ruling::Deny {
                reason: "denied".into(),
            },
        };
    }

    // Empty options cancel. The driver then asks the waiter and denies
    // when that wait is cancelled or missing.
    match decide(mode, &[]) {
        PolicyDecision::Cancelled | PolicyDecision::Selected(_) => Ruling::Ask,
    }
}

pub fn offered_tools(mode: AiAgentPermissionMode) -> Vec<String> {
    match mode {
        AiAgentPermissionMode::Safe => vec!["echo".into(), CREATE_NOTE_TOOL_NAME.into()],
        AiAgentPermissionMode::PowerUser => {
            vec!["echo".into(), "bash".into(), CREATE_NOTE_TOOL_NAME.into()]
        }
    }
}

/// A session grant covers later calls of the same tool.
/// Bash matches the exact command only so a session cannot
/// become "run any shell". `create_note` never matches: Limited
/// tools ask every call (Allow once and Deny only).
pub fn session_matches(name: &str, granted_args: &str, call_args: &str) -> bool {
    if name == CREATE_NOTE_TOOL_NAME {
        false
    } else if name == "bash" {
        granted_args == call_args
    } else {
        true
    }
}

/// Choices the engine passes to Chat for this tool. `create_note` in
/// Limited tools is Allow once and Deny. Other asks also offer
/// Allow for session.
pub fn approval_options(mode: AiAgentPermissionMode, name: &str) -> Vec<ApprovalOption> {
    if name == CREATE_NOTE_TOOL_NAME {
        return vec![allow_once_choice(), deny_choice()];
    }
    let _ = mode;
    vec![allow_once_choice(), allow_session_choice(), deny_choice()]
}

fn allow_once_choice() -> ApprovalOption {
    ApprovalOption {
        id: "allow_once".into(),
        label: "Allow once".into(),
    }
}

fn allow_session_choice() -> ApprovalOption {
    ApprovalOption {
        id: "allow_session".into(),
        label: "Allow for session".into(),
    }
}

fn deny_choice() -> ApprovalOption {
    ApprovalOption {
        id: "deny".into(),
        label: "Deny".into(),
    }
}

fn allow_once_option() -> PolicyOption {
    PolicyOption {
        id: "allow_once".into(),
        kind: Some("allow_once".into()),
    }
}

fn deny_option() -> PolicyOption {
    PolicyOption {
        id: "deny".into(),
        kind: Some("reject_once".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::session_matches;

    #[test]
    fn session_grant_echo_matches_any_args() {
        assert!(session_matches("echo", "hi", "bye"));
        assert!(session_matches("edit", "a", "b"));
        assert!(!session_matches("create_note", "{}", "{}"));
    }

    #[test]
    fn session_grant_bash_matches_exact_command_only() {
        assert!(session_matches("bash", "ls", "ls"));
        assert!(!session_matches("bash", "ls", "pwd"));
    }

    #[test]
    fn create_note_options_are_allow_once_and_deny() {
        use super::approval_options;
        use crate::ai_agents::AiAgentPermissionMode;

        let options = approval_options(AiAgentPermissionMode::Safe, "create_note");
        let ids: Vec<&str> = options.iter().map(|option| option.id.as_str()).collect();
        assert_eq!(ids, vec!["allow_once", "deny"]);
        assert!(!ids.contains(&"allow_session"));
    }
}
