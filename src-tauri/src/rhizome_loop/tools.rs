//! Allowed tool bodies. A denied call never reaches this function.
//! `bash` is not a process. Limited tools never call it.
//! `create_note` writes through `ai_model_tools::run_create_note_tool`.
//! Echo, bash, and test extras return their args. An unknown name
//! still returns a result; it does not panic.

use crate::ai_model_tools::{run_create_note_tool, CREATE_NOTE_TOOL_NAME};

pub fn execute_allowed(
    name: &str,
    args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    if name == CREATE_NOTE_TOOL_NAME {
        return run_create_note_tool(args, vault_path, vault_paths);
    }
    Ok(args.to_string())
}
