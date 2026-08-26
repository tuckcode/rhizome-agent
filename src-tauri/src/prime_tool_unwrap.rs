//! Recovering the real vault operation from a shelled-out tool call.
//!
//! The `rhizome-vault` skill does not call our tools directly. It runs them
//! through a shell inside `ipython`:
//!
//! ```text
//! VAULT_PATH='…' node '…/mcp-server/cli-call.mjs' get_note '{"path":"wiki/foo.md"}'
//! ```
//!
//! So every vault operation reaches the UI named `ipython`, with the actual
//! intent buried in a `code` string. Native dogfood on 2026-08-15 saw exactly
//! that: two tool cards both reading **ipython**, no note path, and therefore
//! no **Open** button — the chat → tool → promote → open loop working
//! underneath but invisible.
//!
//! This unwraps the wrapper so the card can say `get_note wiki/foo.md`. It is
//! deliberately conservative: anything that is not recognisably a `cli-call.mjs`
//! invocation is left exactly as it arrived, because a wrong name is worse than
//! an honest `ipython`.

use serde::Serialize;

/// The vault CLI every skill invocation goes through.
const CLI_ENTRY: &str = "cli-call.mjs";

/// Wrappers whose payload is a shell/python snippet worth looking inside.
const WRAPPER_TOOLS: &[&str] = &["ipython", "bash", "shell", "sh", "python"];

/// Argument keys that carry the wrapped source, by wrapper.
const CODE_KEYS: &[&str] = &["code", "command", "script", "input"];

/// Keys a vault tool uses for the note it acts on.
const PATH_KEYS: &[&str] = &["path", "file_path", "notePath", "note_path"];

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnwrappedTool {
    /// What to show on the card — the inner tool when we found one.
    pub tool: String,
    /// Note the call acts on, when the arguments name one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// First meaningful command or Python line, when the wrapper hid it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// True when this was recovered from a wrapper rather than reported directly.
    pub unwrapped: bool,
}

/// Best-effort recovery of the tool a call actually performs.
///
/// Returns the reported name unchanged when there is nothing to unwrap.
pub fn unwrap_tool(name: &str, arguments: &serde_json::Value) -> UnwrappedTool {
    let reported = name.trim();

    if let Some(direct) = path_from_arguments(arguments) {
        // Already a first-class tool call — it just needed its path surfaced.
        if !is_wrapper(reported) {
            return UnwrappedTool {
                tool: reported.to_string(),
                path: Some(direct),
                detail: None,
                unwrapped: false,
            };
        }
    }

    if !is_wrapper(reported) {
        return UnwrappedTool {
            tool: reported.to_string(),
            path: None,
            detail: None,
            unwrapped: false,
        };
    }

    let Some(code) = code_from_arguments(arguments) else {
        return UnwrappedTool {
            tool: reported.to_string(),
            path: None,
            detail: None,
            unwrapped: false,
        };
    };

    if let Some((tool, path)) = parse_cli_invocation(&code) {
        return UnwrappedTool {
            tool,
            path,
            detail: None,
            unwrapped: true,
        };
    }

    // Same %%bash cell Mindwalk already rewrites. Vault CLI is handled above;
    // this is research/shell that used to stay a bare "ipython".
    if let Some(bash) = crate::mycelium::extract_bash_from_ipython(&code) {
        return UnwrappedTool {
            tool: "bash".to_string(),
            path: None,
            detail: compact_preview(&bash),
            unwrapped: true,
        };
    }

    UnwrappedTool {
        tool: reported.to_string(),
        path: None,
        detail: first_meaningful_python_line(&code),
        unwrapped: false,
    }
}

fn is_wrapper(name: &str) -> bool {
    WRAPPER_TOOLS
        .iter()
        .any(|wrapper| name.eq_ignore_ascii_case(wrapper))
}

fn code_from_arguments(arguments: &serde_json::Value) -> Option<String> {
    if let Some(text) = arguments.as_str() {
        return Some(text.to_string());
    }
    CODE_KEYS
        .iter()
        .find_map(|key| arguments.get(*key).and_then(|value| value.as_str()))
        .map(str::to_string)
}

fn path_from_arguments(arguments: &serde_json::Value) -> Option<String> {
    PATH_KEYS
        .iter()
        .find_map(|key| arguments.get(*key).and_then(|value| value.as_str()))
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(str::to_string)
}

/// Pull `<tool>` and its `path` out of a `cli-call.mjs` invocation.
///
/// The snippet is python or shell we did not write, so this scans for the CLI
/// entry point and reads the next bare word rather than trying to tokenise a
/// whole script.
fn parse_cli_invocation(code: &str) -> Option<(String, Option<String>)> {
    let after_entry = code.split(CLI_ENTRY).nth(1)?;

    // The tool name is the first bare word after the entry point, once any
    // closing quote from the script path is out of the way.
    let tool = after_entry
        .split_whitespace()
        .map(|token| token.trim_matches(|c| c == '\'' || c == '"' || c == '\\'))
        .find(|token| is_tool_name(token))?
        .to_string();

    // Undo one layer of quoting first: the JSON blob is embedded in a shell
    // string inside a python literal, so the keys can arrive as \\"path\\".
    Some((tool, path_from_json_argument(&unescape_quotes(after_entry))))
}

fn unescape_quotes(text: &str) -> String {
    text.replace("\\\"", "\"")
}

/// A tool name is a bare identifier — not a flag, path, or JSON blob.
fn is_tool_name(token: &str) -> bool {
    !token.is_empty()
        && !token.starts_with('-')
        && !token.contains('/')
        && !token.contains('{')
        && token
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// Read the note path out of the JSON argument blob trailing the tool name.
///
/// Scans for the key rather than parsing: by the time this reaches us the blob
/// has been through shell and python quoting, and a card showing the tool
/// without its path is still a large improvement over `ipython`.
fn path_from_json_argument(argument: &str) -> Option<String> {
    for key in PATH_KEYS {
        // A malformed match on one key must not abandon the others.
        if let Some(found) = path_for_key(argument, key) {
            return Some(found);
        }
    }
    None
}

const PREVIEW_MAX: usize = 80;

fn compact_preview(text: &str) -> Option<String> {
    let line = text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#'))?;
    let collapsed = line.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        return None;
    }
    if collapsed.chars().count() > PREVIEW_MAX {
        let truncated: String = collapsed.chars().take(PREVIEW_MAX).collect();
        Some(format!("{truncated}…"))
    } else {
        Some(collapsed)
    }
}

fn first_meaningful_python_line(code: &str) -> Option<String> {
    let line = code.lines().map(str::trim).find(|line| {
        !line.is_empty()
            && !line.starts_with('#')
            && !line.starts_with("%%")
            && !line.starts_with("import ")
            && !line.starts_with("from ")
    })?;
    compact_preview(line)
}

fn path_for_key(argument: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\"");
    let start = argument.find(&needle)?;
    let rest = argument[start + needle.len()..].trim_start();
    let rest = rest.strip_prefix(':')?.trim_start();
    let rest = rest.strip_prefix('"')?;
    let end = rest.find('"')?;
    let value = rest[..end].trim();
    if value.is_empty() {
        return None;
    }
    Some(value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Copied from a real session log: the skill's own invocation shape.
    const REAL_GET_NOTE: &str = "VAULT_PATH='/Users/dtc/Documents/Rhizome Vault' node '/Users/dtc/code/projects/rhizome-agent/mcp-server/cli-call.mjs' get_note '{\"path\":\"wiki/foo.md\"}'";

    #[test]
    fn a_shelled_out_vault_call_reports_the_inner_tool_and_path() {
        let unwrapped = unwrap_tool(
            "ipython",
            &serde_json::json!({ "code": format!("import os\n{REAL_GET_NOTE}") }),
        );

        assert_eq!(unwrapped.tool, "get_note");
        assert_eq!(unwrapped.path.as_deref(), Some("wiki/foo.md"));
        assert!(unwrapped.unwrapped);
    }

    /// Captured verbatim from a live `tool_execution_start` on 2026-08-15,
    /// running the real vault skill against the real vault. Two things here
    /// were not in the hand-written fixtures: the `%%bash` cell magic, and a
    /// space inside the vault path.
    #[test]
    fn the_live_skill_invocation_unwraps() {
        let code = "%%bash\nVAULT_PATH='/Users/dtc/Documents/Rhizome Vault' node '/Users/dtc/code/projects/rhizome-agent/mcp-server/cli-call.mjs' get_note '{\"path\":\"inbox/20260814-promote-loop.md\"}'";

        let unwrapped = unwrap_tool("ipython", &serde_json::json!({ "code": code }));

        assert_eq!(unwrapped.tool, "get_note");
        assert_eq!(
            unwrapped.path.as_deref(),
            Some("inbox/20260814-promote-loop.md")
        );
        assert!(unwrapped.unwrapped);
    }

    /// The same turn's other call: reading the skill file itself. Not a vault
    /// operation, so it must stay `ipython` and offer no Open.
    #[test]
    fn the_live_skill_read_is_not_mistaken_for_a_vault_call() {
        let code = "from pathlib import Path\nprint(Path('/Users/dtc/Documents/Rhizome Vault/.prime/agent/skills/rhizome-vault/SKILL.md').read_text())";

        let unwrapped = unwrap_tool("ipython", &serde_json::json!({ "code": code }));

        assert_eq!(unwrapped.tool, "ipython");
        assert_eq!(unwrapped.path, None);
    }

    #[test]
    fn create_note_survives_a_multiline_python_wrapper() {
        let code = "import subprocess\nsubprocess.run(\"\"\"VAULT_PATH='/v' node '/r/mcp-server/cli-call.mjs' create_note '{\"path\":\"inbox/idea.md\",\"content\":\"# Idea\"}'\"\"\", shell=True)";

        let unwrapped = unwrap_tool("ipython", &serde_json::json!({ "code": code }));

        assert_eq!(unwrapped.tool, "create_note");
        assert_eq!(unwrapped.path.as_deref(), Some("inbox/idea.md"));
    }

    /// A wrapper doing something unrelated must keep its own name. A wrong
    /// label is worse than an honest `ipython`.
    #[test]
    fn a_wrapper_that_is_not_a_vault_call_keeps_its_name() {
        let unwrapped = unwrap_tool(
            "ipython",
            &serde_json::json!({ "code": "print(sum(range(10)))" }),
        );

        assert_eq!(unwrapped.tool, "ipython");
        assert_eq!(unwrapped.path, None);
        assert!(!unwrapped.unwrapped);
    }

    #[test]
    fn a_first_class_tool_call_is_left_alone_but_gains_its_path() {
        let unwrapped = unwrap_tool("get_note", &serde_json::json!({ "path": "wiki/a.md" }));

        assert_eq!(unwrapped.tool, "get_note");
        assert_eq!(unwrapped.path.as_deref(), Some("wiki/a.md"));
        assert!(!unwrapped.unwrapped, "nothing was unwrapped");
    }

    #[test]
    fn bash_wrappers_unwrap_too_and_read_command_as_well_as_code() {
        let unwrapped = unwrap_tool("bash", &serde_json::json!({ "command": REAL_GET_NOTE }));

        assert_eq!(unwrapped.tool, "get_note");
        assert_eq!(unwrapped.path.as_deref(), Some("wiki/foo.md"));
    }

    #[test]
    fn a_vault_call_with_no_path_still_names_the_tool() {
        let code = "node '/r/mcp-server/cli-call.mjs' search_notes '{\"query\":\"hermes\"}'";

        let unwrapped = unwrap_tool("ipython", &serde_json::json!({ "code": code }));

        assert_eq!(unwrapped.tool, "search_notes");
        assert_eq!(unwrapped.path, None);
        assert!(unwrapped.unwrapped);
    }

    #[test]
    fn escaped_json_inside_a_python_string_still_yields_the_path() {
        // What the argument looks like after python escaping survives the log.
        let code = "run('node /r/mcp-server/cli-call.mjs open_note \\'{\\\"path\\\":\\\"inbox/x.md\\\"}\\'')";

        let unwrapped = unwrap_tool("ipython", &serde_json::json!({ "code": code }));

        assert_eq!(unwrapped.tool, "open_note");
        assert_eq!(unwrapped.path.as_deref(), Some("inbox/x.md"));
    }

    #[test]
    fn arguments_that_are_a_bare_string_are_still_searched() {
        let unwrapped = unwrap_tool("bash", &serde_json::json!(REAL_GET_NOTE));

        assert_eq!(unwrapped.tool, "get_note");
    }

    #[test]
    fn a_wrapper_with_no_readable_arguments_keeps_its_name() {
        assert_eq!(
            unwrap_tool("ipython", &serde_json::json!({})).tool,
            "ipython"
        );
        assert_eq!(
            unwrap_tool("ipython", &serde_json::Value::Null).tool,
            "ipython"
        );
    }

    #[test]
    fn a_bash_cell_reports_the_command_not_ipython() {
        let unwrapped = unwrap_tool(
            "ipython",
            &serde_json::json!({ "code": "%%bash\nrg foo wiki/\n" }),
        );

        assert_eq!(unwrapped.tool, "bash");
        assert_eq!(unwrapped.detail.as_deref(), Some("rg foo wiki/"));
        assert!(unwrapped.unwrapped);
        assert_eq!(unwrapped.path, None);
    }

    #[test]
    fn a_plain_python_cell_keeps_ipython_and_shows_the_first_line() {
        let unwrapped = unwrap_tool(
            "ipython",
            &serde_json::json!({
                "code": "import os\nprint(sum(range(10)))\n"
            }),
        );

        assert_eq!(unwrapped.tool, "ipython");
        assert_eq!(unwrapped.detail.as_deref(), Some("print(sum(range(10)))"));
        assert!(!unwrapped.unwrapped);
    }

    #[test]
    fn an_unknown_tool_passes_through_untouched() {
        let unwrapped = unwrap_tool("some_future_tool", &serde_json::json!({"x": 1}));

        assert_eq!(unwrapped.tool, "some_future_tool");
        assert_eq!(unwrapped.path, None);
    }
}
