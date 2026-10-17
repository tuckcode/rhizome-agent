//! Allowed tool bodies. A denied call never reaches this function.
//! Each registered tool has a name, a run function, a policy, and a
//! schema. An unknown name returns an error; it does not echo its args.
//! `bash` is not a process. Limited tools never call it.
//! `create_note` writes through `ai_model_tools::run_create_note_tool`.
//! Read-only file tools stay inside canonical vault and workspace roots
//! and auto-run in both permission modes. Secret-path blocking is a
//! safety net, not a wall: `bash` can still read those files.

mod args;
mod glob;
mod grep;
mod list_dir;
mod read_file;
mod sandbox;
mod scan;
mod walk;

use crate::ai_agents::AiAgentPermissionMode;
use crate::ai_model_tools::{run_create_note_tool, CREATE_NOTE_TOOL_JSON, CREATE_NOTE_TOOL_NAME};

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
    /// Offered in both modes. Auto-runs. No approval card.
    ReadOnly,
}

type ToolRun = fn(&str, Option<&str>, &[String]) -> Result<String, String>;

pub struct Tool {
    pub name: &'static str,
    pub policy: ToolPolicy,
    pub run: ToolRun,
    pub schema: &'static str,
}

impl Tool {
    pub fn offered_in(&self, mode: AiAgentPermissionMode) -> bool {
        match self.policy {
            ToolPolicy::Bash => mode == AiAgentPermissionMode::PowerUser,
            ToolPolicy::Echo | ToolPolicy::CreateNote | ToolPolicy::ReadOnly => true,
        }
    }
}

const ECHO_SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "echo",
    "description": "Return the provided arguments unchanged.",
    "parameters": { "type": "object" }
  }
}"#;

const BASH_SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "bash",
    "description": "Reserved shell tool. Not a process in this build; arguments are returned unchanged. Offered in Power User only.",
    "parameters": { "type": "object" }
  }
}"#;

const TOOLS: &[Tool] = &[
    Tool {
        name: "echo",
        policy: ToolPolicy::Echo,
        run: echo_args,
        schema: ECHO_SCHEMA,
    },
    Tool {
        name: "read_file",
        policy: ToolPolicy::ReadOnly,
        run: read_file::run,
        schema: read_file::SCHEMA,
    },
    Tool {
        name: "list_dir",
        policy: ToolPolicy::ReadOnly,
        run: list_dir::run,
        schema: list_dir::SCHEMA,
    },
    Tool {
        name: "grep",
        policy: ToolPolicy::ReadOnly,
        run: grep::run,
        schema: grep::SCHEMA,
    },
    Tool {
        name: "glob",
        policy: ToolPolicy::ReadOnly,
        run: glob::run,
        schema: glob::SCHEMA,
    },
    Tool {
        name: "bash",
        policy: ToolPolicy::Bash,
        run: echo_args,
        schema: BASH_SCHEMA,
    },
    Tool {
        name: CREATE_NOTE_TOOL_NAME,
        policy: ToolPolicy::CreateNote,
        run: run_create_note_tool,
        schema: CREATE_NOTE_TOOL_JSON,
    },
];

/// Registered tools in offer order: echo, read-only file tools, bash,
/// create_note.
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

/// OpenAI function definition for a registered name.
pub fn openai_tool_definition(name: &str) -> Option<serde_json::Value> {
    lookup(name).map(|tool| {
        serde_json::from_str(tool.schema).expect("registered tool schema must be valid JSON")
    })
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
    use super::{execute_allowed, lookup, registered, ToolPolicy};

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

    #[test]
    fn registry_exposes_the_four_read_only_file_tools() {
        let names: Vec<&str> = registered().iter().map(|tool| tool.name).collect();
        for name in ["read_file", "list_dir", "grep", "glob"] {
            assert!(names.contains(&name), "{names:?} should include {name}");
            assert_eq!(lookup(name).unwrap().policy, ToolPolicy::ReadOnly);
        }
    }
}
