//! Tool allow / deny for the Rhizome loop.
//!
//! Limited tools (`Safe`) may run `echo`, the read-only file tools,
//! `edit_file`, `write_file`, and `create_note`. `echo` and read-only
//! tools auto-run. `create_note` asks every call (Allow once and Deny).
//! `edit_file` and `write_file` ask in both modes (Allow once, Allow
//! for session, Deny) unless a session grant already covers that tool
//! and path. Power User `echo` still auto-runs once from the shared
//! table. Power User `create_note` and read-only tools run with no
//! prompt. Power User `bash` asks a human for every call. There is
//! no session grant. A name outside `offered_tools` is
//! denied by the driver before this function runs. No waiter, or a
//! cancelled wait, denies. An unknown name always asks and never
//! matches a session grant.

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
        Some(ToolPolicy::Mutate) => Ruling::Ask,
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
/// Bash never matches: every call asks. `create_note` never
/// matches: Limited tools ask every call (Allow once and Deny
/// only). An unknown name never matches.
#[cfg(test)]
pub fn session_matches(name: &str, granted_args: &str, call_args: &str) -> bool {
    session_matches_in(name, granted_args, call_args, None, &[])
}

pub fn session_matches_in(
    name: &str,
    granted_args: &str,
    call_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> bool {
    match tools::lookup(name).map(|tool| tool.policy) {
        Some(ToolPolicy::CreateNote) | Some(ToolPolicy::Bash) => false,
        Some(ToolPolicy::Mutate) => {
            tools::mutate_session_matches(granted_args, call_args, vault_path, vault_paths)
        }
        Some(ToolPolicy::Echo) | Some(ToolPolicy::ReadOnly) => true,
        None => false,
    }
}

/// Choices the engine passes to Chat for this tool. `create_note` in
/// Limited tools is Allow once and Deny. Other asks also offer
/// Allow for session.
pub fn approval_options(mode: AiAgentPermissionMode, name: &str) -> Vec<ApprovalOption> {
    let bash = matches!(
        tools::lookup(name).map(|tool| tool.policy),
        Some(ToolPolicy::Bash)
    );
    if name == CREATE_NOTE_TOOL_NAME || bash {
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
    fn session_grant_does_not_apply_to_bash() {
        assert!(!session_matches("bash", "ls", "ls"));
        assert!(!session_matches(
            "bash",
            r#"{"command":"echo hi"}"#,
            r#"{"command":"echo hi"}"#
        ));
    }

    #[test]
    fn bash_options_are_allow_once_and_deny() {
        use super::approval_options;
        use crate::ai_agents::AiAgentPermissionMode;

        let options = approval_options(AiAgentPermissionMode::PowerUser, "bash");
        let ids: Vec<&str> = options.iter().map(|option| option.id.as_str()).collect();
        assert_eq!(ids, vec!["allow_once", "deny"]);
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
                "edit_file".to_string(),
                "write_file".to_string(),
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
                "edit_file".to_string(),
                "write_file".to_string(),
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

    #[test]
    fn mutate_tools_ask_in_both_modes() {
        use super::{rule_tool, Ruling};
        use crate::ai_agents::AiAgentPermissionMode;

        for name in ["edit_file", "write_file"] {
            assert!(
                matches!(
                    rule_tool(AiAgentPermissionMode::Safe, name, false),
                    Ruling::Ask
                ),
                "{name} must ask in Limited tools"
            );
            assert!(
                matches!(
                    rule_tool(AiAgentPermissionMode::PowerUser, name, false),
                    Ruling::Ask
                ),
                "{name} must ask in Power User"
            );
        }
    }

    #[test]
    fn session_grant_mutate_matches_the_same_path_only() {
        let same = r#"{"path":"notes/a.md","content":"one"}"#;
        let later = r#"{"path":"notes/a.md","content":"two"}"#;
        let other = r#"{"path":"notes/b.md","content":"two"}"#;
        assert!(session_matches("write_file", same, later));
        assert!(!session_matches("write_file", same, other));
        assert!(session_matches(
            "edit_file",
            r#"{"path":"a.md","old_string":"x","new_string":"y"}"#,
            r#"{"path":"a.md","old_string":"a","new_string":"b"}"#
        ));
        assert!(!session_matches(
            "edit_file",
            r#"{"path":"a.md","old_string":"x","new_string":"y"}"#,
            r#"{"path":"b.md","old_string":"x","new_string":"y"}"#
        ));
    }

    #[test]
    fn mutate_tools_offer_allow_once_session_and_deny() {
        use super::approval_options;
        use crate::ai_agents::AiAgentPermissionMode;

        for name in ["edit_file", "write_file"] {
            let options = approval_options(AiAgentPermissionMode::Safe, name);
            let ids: Vec<&str> = options.iter().map(|option| option.id.as_str()).collect();
            assert_eq!(ids, vec!["allow_once", "allow_session", "deny"], "{name}");
        }
    }
}
