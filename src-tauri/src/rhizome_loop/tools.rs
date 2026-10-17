//! Allowed tool bodies. A denied call never reaches this function.
//! Each registered tool has a name, a run function, and a policy.
//! An unknown name returns an error; it does not echo its args.
//! `bash` is not a process. Limited tools never call it.
//! `create_note` writes through `ai_model_tools::run_create_note_tool`.

use crate::ai_agents::AiAgentPermissionMode;
use crate::ai_model_tools::{run_create_note_tool, CREATE_NOTE_TOOL_NAME};

/// How the loop policy treats a registered tool.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolPolicy {
    /// Safe auto-runs. Power User auto-runs once from the shared table.
    Echo,
    /// Safe asks every call. Power User auto-runs.
    CreateNote,
    /// Safe does not offer it. Power User asks unless a session grant
    /// matches the exact command.
    Bash,
}

type ToolRun = fn(&str, Option<&str>, &[String]) -> Result<String, String>;

pub struct Tool {
    pub name: &'static str,
    pub policy: ToolPolicy,
    pub run: ToolRun,
}

impl Tool {
    pub fn offered_in(&self, mode: AiAgentPermissionMode) -> bool {
        match self.policy {
            ToolPolicy::Bash => mode == AiAgentPermissionMode::PowerUser,
            ToolPolicy::Echo | ToolPolicy::CreateNote => true,
        }
    }
}

const TOOLS: &[Tool] = &[
    Tool {
        name: "echo",
        policy: ToolPolicy::Echo,
        run: echo_args,
    },
    Tool {
        name: "bash",
        policy: ToolPolicy::Bash,
        run: echo_args,
    },
    Tool {
        name: CREATE_NOTE_TOOL_NAME,
        policy: ToolPolicy::CreateNote,
        run: run_create_note_tool,
    },
];

/// Registered tools in offer order: echo, bash, create_note.
pub fn registered() -> &'static [Tool] {
    TOOLS
}

pub fn lookup(name: &str) -> Option<&'static Tool> {
    TOOLS.iter().find(|tool| tool.name == name)
}

pub fn execute_allowed(
    name: &str,
    args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    match lookup(name) {
        Some(tool) => (tool.run)(args, vault_path, vault_paths),
        None => Err(format!("unknown tool: {name}")),
    }
}

fn echo_args(
    args: &str,
    _vault_path: Option<&str>,
    _vault_paths: &[String],
) -> Result<String, String> {
    Ok(args.to_string())
}

#[cfg(test)]
mod tests {
    use super::execute_allowed;

    #[test]
    fn echo_and_bash_return_their_args() {
        assert_eq!(execute_allowed("echo", "ping", None, &[]).unwrap(), "ping");
        assert_eq!(execute_allowed("bash", "ls", None, &[]).unwrap(), "ls");
    }

    #[test]
    fn unknown_tool_returns_an_error_not_its_args() {
        let error = execute_allowed("mystery", "secret-args", None, &[]).unwrap_err();
        assert_ne!(error, "secret-args");
        assert!(
            error.contains("mystery"),
            "unknown-tool error should name the tool: {error}"
        );
    }

    #[test]
    fn create_note_still_requires_a_vault() {
        let error = execute_allowed("create_note", r#"{"path":"a.md"}"#, None, &[]).unwrap_err();
        assert_eq!(error, "No active vault is available for create_note.");
    }
}
