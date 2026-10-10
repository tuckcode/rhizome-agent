//! Tool allow / deny for the Rhizome loop.
//!
//! Limited tools (`Safe`) may run `echo` and must not run `bash`.
//! Power User allow-once comes from the shared permission table.
//! A name outside `offered_tools` is denied by the driver before this
//! function runs. An offered name that this function does not decide
//! asks a human. No waiter, or a cancelled wait, denies.

use crate::ai_agents::AiAgentPermissionMode;
use crate::permission_decision::{decide, PolicyDecision, PolicyOption};

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

    if name == "echo" || name == "bash" {
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
        AiAgentPermissionMode::Safe => vec!["echo".into()],
        AiAgentPermissionMode::PowerUser => vec!["echo".into(), "bash".into()],
    }
}

/// A session grant covers later calls of the same tool.
/// Bash matches the exact command only so a session cannot
/// become "run any shell".
pub fn session_matches(name: &str, granted_args: &str, call_args: &str) -> bool {
    if name == "bash" {
        granted_args == call_args
    } else {
        true
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
    }

    #[test]
    fn session_grant_bash_matches_exact_command_only() {
        assert!(session_matches("bash", "ls", "ls"));
        assert!(!session_matches("bash", "ls", "pwd"));
    }
}
