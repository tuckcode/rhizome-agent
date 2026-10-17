//! Tool allow / deny for the Rhizome loop.
//!
//! Limited tools (`Safe`) may run `echo`, the read-only file tools,
//! and `create_note`. `echo` and read-only tools auto-run.
//! `create_note` asks every call (Allow once and Deny).
//! Power User `echo` still auto-runs once from the shared table.
//! Power User `create_note` and read-only tools run with no prompt.
//! Power User `bash` asks a human for each call unless a session grant
//! already matches. A name outside `offered_tools` is denied by the
//! driver before this function runs. No waiter, or a cancelled wait,
//! denies. An unknown name always asks and never matches a session grant.

use crate::ai_agents::AiAgentPermissionMode;
use crate::ai_model_tools::CREATE_NOTE_TOOL_NAME;
use crate::permission_decision::{decide, PolicyDecision, PolicyOption};

use super::tools::{self, ToolPolicy};

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
    match tools::lookup(name).map(|tool| tool.policy) {
        Some(ToolPolicy::Bash) if mode == AiAgentPermissionMode::Safe => {
            match decide(mode, &[deny_option()]) {
                PolicyDecision::Selected(_) | PolicyDecision::Cancelled => Ruling::Deny {
                    reason: "not offered".into(),
                },
            }
        }
        Some(ToolPolicy::Echo) if mode == AiAgentPermissionMode::Safe => {
            Ruling::Run { spend_grant: false }
        }
        Some(ToolPolicy::ReadOnly) => Ruling::Run { spend_grant: false },
        Some(ToolPolicy::CreateNote) => match mode {
            AiAgentPermissionMode::Safe => Ruling::Ask,
            AiAgentPermissionMode::PowerUser => Ruling::Run { spend_grant: false },
        },
        Some(ToolPolicy::Bash) => Ruling::Ask,
        Some(ToolPolicy::Echo) => {
            if grant_spent {
                return Ruling::Deny {
                    reason: "grant spent".into(),
                };
            }
            match decide(mode, &[allow_once_option(), deny_option()]) {
                PolicyDecision::Selected(id) if id == "allow_once" => {
                    Ruling::Run { spend_grant: true }
                }
                PolicyDecision::Selected(_) | PolicyDecision::Cancelled => Ruling::Deny {
                    reason: "denied".into(),
                },
            }
        }
        None => Ruling::Ask,
    }
}

pub fn offered_tools(mode: AiAgentPermissionMode) -> Vec<String> {
    tools::registered()
        .iter()
        .filter(|tool| tool.offered_in(mode))
        .map(|tool| tool.name.to_string())
        .collect()
}

/// A session grant covers later calls of the same tool.
/// Bash matches the exact command only so a session cannot
/// become "run any shell". `create_note` never matches: Limited
/// tools ask every call (Allow once and Deny only). An unknown
/// name never matches.
pub fn session_matches(name: &str, granted_args: &str, call_args: &str) -> bool {
    match tools::lookup(name).map(|tool| tool.policy) {
        Some(ToolPolicy::CreateNote) => false,
        Some(ToolPolicy::Bash) => granted_args == call_args,
        Some(ToolPolicy::Echo) | Some(ToolPolicy::ReadOnly) => true,
        None => false,
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
        assert!(!session_matches("create_note", "{}", "{}"));
    }

    #[test]
    fn session_grant_unknown_tool_never_matches() {
        assert!(!session_matches("edit", "a", "b"));
        assert!(!session_matches("mystery", "same", "same"));
        assert!(!session_matches("not_a_tool", "{}", "{}"));
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

    #[test]
    fn unknown_tool_always_asks() {
        use super::{rule_tool, Ruling};
        use crate::ai_agents::AiAgentPermissionMode;

        assert!(matches!(
            rule_tool(AiAgentPermissionMode::Safe, "mystery", false),
            Ruling::Ask
        ));
        assert!(matches!(
            rule_tool(AiAgentPermissionMode::PowerUser, "mystery", true),
            Ruling::Ask
        ));
    }

    #[test]
    fn offered_tools_keep_echo_create_note_and_power_user_bash() {
        use super::offered_tools;
        use crate::ai_agents::AiAgentPermissionMode;

        assert_eq!(
            offered_tools(AiAgentPermissionMode::Safe),
            vec![
                "echo".to_string(),
                "read_file".to_string(),
                "list_dir".to_string(),
                "grep".to_string(),
                "glob".to_string(),
                "create_note".to_string()
            ]
        );
        assert_eq!(
            offered_tools(AiAgentPermissionMode::PowerUser),
            vec![
                "echo".to_string(),
                "read_file".to_string(),
                "list_dir".to_string(),
                "grep".to_string(),
                "glob".to_string(),
                "bash".to_string(),
                "create_note".to_string()
            ]
        );
    }

    #[test]
    fn read_only_tools_auto_run_in_both_modes() {
        use super::{rule_tool, Ruling};
        use crate::ai_agents::AiAgentPermissionMode;

        for name in ["read_file", "list_dir", "grep", "glob"] {
            assert!(
                matches!(
                    rule_tool(AiAgentPermissionMode::Safe, name, false),
                    Ruling::Run { spend_grant: false }
                ),
                "{name} must auto-run in Limited tools"
            );
            assert!(
                matches!(
                    rule_tool(AiAgentPermissionMode::PowerUser, name, false),
                    Ruling::Run { spend_grant: false }
                ),
                "{name} must auto-run in Power User"
            );
        }
    }
}
