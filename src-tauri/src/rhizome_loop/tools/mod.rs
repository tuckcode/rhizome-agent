//! Allowed tool bodies. A denied call never reaches this function.
//! Each registered tool has a name, a run function, a policy, and a
//! schema. An unknown name returns an error; it does not echo its args.
//! `bash` is not a process. Limited tools never call it.
//! `create_note` writes through `ai_model_tools::run_create_note_tool`.
//! Read-only file tools stay inside canonical vault and workspace roots
//! and auto-run in both permission modes. `edit_file` and `write_file`
//! use the same roots and ask before they write. Secret-path blocking
//! on those tools is a safety net, not a wall: a future shell tool will
//! not be covered. Write tools must call `sandbox::resolve_for_write`,
//! which always applies the denylist.

mod args;
mod atomic;
mod edit_file;
mod glob;
mod grep;
mod list_dir;
mod preview;
mod read_file;
mod sandbox;
mod scan;
mod text;
mod walk;
mod write_file;

pub use sandbox::resolve_for_write;
pub use text::CHANGED_SINCE_APPROVAL;

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
    /// Offered in both modes. Asks every call unless a session grant
    /// already covers this tool and path.
    Mutate,
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
            ToolPolicy::Echo
            | ToolPolicy::CreateNote
            | ToolPolicy::ReadOnly
            | ToolPolicy::Mutate => true,
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
        name: "edit_file",
        policy: ToolPolicy::Mutate,
        run: edit_file::run,
        schema: edit_file::SCHEMA,
    },
    Tool {
        name: "write_file",
        policy: ToolPolicy::Mutate,
        run: write_file::run,
        schema: write_file::SCHEMA,
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

/// Registered tools in offer order: echo, read-only file tools,
/// mutate file tools, bash, create_note.
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

/// Path and unified-style diff for an approval card. `None` when the
/// tool is not a file mutation. Errors mean the call must fail
/// before an approval card is shown.
pub fn approval_preview(
    name: &str,
    args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Option<Result<ApprovalPreview, String>> {
    match name {
        "edit_file" | "write_file" => Some(mutate_prepare(name, args, vault_path, vault_paths)),
        _ => None,
    }
}

pub fn mutate_prepare(
    name: &str,
    args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<ApprovalPreview, String> {
    match name {
        "edit_file" => {
            let plan = edit_file::plan(args, vault_path, vault_paths)?;
            Ok(ApprovalPreview {
                path: plan.display_path.clone(),
                diff: preview::unified(&plan.display_path, &plan.before, &plan.after),
                created: false,
                overwrite: false,
                content_hash: plan.content_hash,
            })
        }
        "write_file" => {
            let plan = write_file::plan(args, vault_path, vault_paths)?;
            Ok(ApprovalPreview {
                path: plan.display_path.clone(),
                diff: preview::unified(&plan.display_path, &plan.before, &plan.after),
                created: plan.created,
                overwrite: !plan.created,
                content_hash: plan.content_hash,
            })
        }
        _ => Err(format!("not a mutate tool: {name}")),
    }
}

pub fn current_content_hash(
    name: &str,
    args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    let requested = args::json_path(args).ok_or_else(|| "path is required".to_string())?;
    let path = if name == "edit_file" {
        sandbox::resolve_file(&requested, vault_path, vault_paths)?
    } else {
        sandbox::resolve(&requested, vault_path, vault_paths)?
    };
    text::hash_existing(&path, text::MAX_BYTES)
}

#[derive(Debug)]
pub struct ApprovalPreview {
    pub path: String,
    pub diff: String,
    pub created: bool,
    pub overwrite: bool,
    pub content_hash: String,
}

/// Session grants for mutate tools cover later calls of the same
/// tool against the same canonical path, not every file in the vault.
pub fn mutate_session_matches(
    granted_args: &str,
    call_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> bool {
    match (args::json_path(granted_args), args::json_path(call_args)) {
        (Some(granted), Some(call)) => {
            match (
                sandbox::resolve(&granted, vault_path, vault_paths),
                sandbox::resolve(&call, vault_path, vault_paths),
            ) {
                (Ok(left), Ok(right)) => left == right,
                _ => granted == call,
            }
        }
        _ => false,
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

    #[test]
    fn registry_exposes_edit_file_and_write_file_as_mutate() {
        let names: Vec<&str> = registered().iter().map(|tool| tool.name).collect();
        for name in ["edit_file", "write_file"] {
            assert!(names.contains(&name), "{names:?} should include {name}");
            assert_eq!(lookup(name).unwrap().policy, ToolPolicy::Mutate);
        }
    }

    #[test]
    fn approval_preview_carries_the_canonical_target_path() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let preview = super::approval_preview(
            "write_file",
            &serde_json::json!({ "path": "fresh.md", "content": "hello\n" }).to_string(),
            Some(root.to_str().unwrap()),
            &[],
        )
        .expect("write_file must produce a preview")
        .unwrap();
        assert_eq!(preview.path, "fresh.md");
        assert!(preview.created);
        assert!(!preview.overwrite);
        assert_eq!(preview.content_hash, super::text::ABSENT_HASH);
    }

    #[test]
    fn approval_preview_fails_before_a_card_for_a_missing_old_string() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        std::fs::write(root.join("note.md"), "only this\n").unwrap();
        let preview = super::approval_preview(
            "edit_file",
            &serde_json::json!({
                "path": "note.md",
                "old_string": "missing",
                "new_string": "x"
            })
            .to_string(),
            Some(root.to_str().unwrap()),
            &[],
        );
        let error = preview
            .expect("edit_file must produce a preview result")
            .unwrap_err();
        assert!(error.contains("not found"), "{error}");
    }

    #[test]
    fn approval_preview_fails_before_a_card_for_a_secret_path() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        std::fs::write(root.join(".env"), "SECRET=keep\n").unwrap();
        let preview = super::approval_preview(
            "write_file",
            &serde_json::json!({ "path": ".env", "content": "SECRET=no\n" }).to_string(),
            Some(root.to_str().unwrap()),
            &[],
        );
        let error = preview
            .expect("write_file must produce a preview result")
            .unwrap_err();
        assert!(error.contains(super::sandbox::BLOCKED_SECRET), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn session_grant_matches_a_symlink_to_the_same_canonical_path() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        std::fs::write(root.join("a.md"), "one\n").unwrap();
        std::os::unix::fs::symlink(root.join("a.md"), root.join("alias.md")).unwrap();
        let granted = r#"{"path":"a.md","content":"one"}"#;
        let via_link = r#"{"path":"alias.md","content":"two"}"#;
        assert!(super::mutate_session_matches(
            granted,
            via_link,
            Some(root.to_str().unwrap()),
            &[],
        ));
    }
}
