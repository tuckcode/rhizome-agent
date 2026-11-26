use crate::ai_agents::AiAgentPermissionMode;
use crate::claude_cli::ChatStreamRequest;
use crate::cli_agent_runtime::AgentStreamRequest;

// `--strict-mcp-config` only lets a run call tools it's explicitly allowed;
// the bundled rhizome MCP server (wired via `--mcp-config` below) is
// otherwise configured but unreachable in every mode. See One Brain plan
// step 2 (docs/plans/2026-07-05-one-brain-architecture-decision.md).
//
// This allowlist pattern and the "rhizome" key in mcp_config() below MUST
// name the same server — mismatch here is the one failure mode that
// silently breaks every Rhizome tool call in the in-app AI chat: MCP tool
// names are mcp__<server-key>__<tool>, so an allowlist for the wrong key
// makes `claude` refuse every one of them with no obvious error. See
// ADR-0162 (tolaria -> rhizome rename).
const CLAUDE_SAFE_AGENT_TOOLS: &str = "Read,Edit,MultiEdit,Write,Glob,Grep,LS,mcp__rhizome__*";
const CLAUDE_POWER_USER_AGENT_TOOLS: &str =
    "Read,Edit,MultiEdit,Write,Glob,Grep,LS,Bash,mcp__rhizome__*";
const CLAUDE_CHAT_DISALLOWED_TOOLS_COMPAT: &str =
    "Bash,Glob,Grep,Read,Edit,Write,NotebookEdit,WebFetch,WebSearch,TodoWrite,Task,MultiEdit,LS";

// Claude Code engine profile (ADR-0191 decisions 5 and 6).
//
// `--setting-sources user` keeps a vault folder's own `.claude/settings.json`
// (hooks, permission rules) from running: without it, a `-p` run in a synced
// vault runs that folder's hooks with no trust prompt. `--strict-mcp-config`
// does the same for the folder's `.mcp.json`. Both are pinned by tests.
const CLAUDE_ENGINE_SETTING_SOURCES: &str = "user";
// Claude Code auto memory stays off so no second memory store grows beside
// the vault. Set twice on purpose: in `--settings` and in the environment.
const CLAUDE_ENGINE_SETTINGS: &str = r#"{"autoMemoryEnabled":false}"#;
pub(crate) const CLAUDE_ENGINE_DISABLE_AUTO_MEMORY_ENV: (&str, &str) =
    ("CLAUDE_CODE_DISABLE_AUTO_MEMORY", "1");
// Limited mode asks on every edit, so it never runs in `acceptEdits`.
const CLAUDE_ENGINE_LIMITED_PERMISSION_MODE: &str = "manual";
const CLAUDE_ENGINE_POWER_USER_PERMISSION_MODE: &str = "acceptEdits";
// Until the approval bridge (plan step 4) answers prompts, nothing answers
// them: every call that would ask is denied. Fail closed.
const CLAUDE_ENGINE_PERMISSION_PROMPTS: &str = "none";
const WINDOWS_COMMAND_LINE_STDIN_THRESHOLD: usize = 24 * 1024;

#[derive(Debug)]
pub(crate) struct ClaudeInvocation {
    pub(crate) args: Vec<String>,
    pub(crate) fallback_args: Vec<Vec<String>>,
    pub(crate) stdin_text: Option<String>,
    /// Extra environment set on the process. Never a credential.
    pub(crate) env: Vec<(&'static str, &'static str)>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum PromptSource {
    Argument,
    Stdin,
}

pub(crate) fn chat(req: &ChatStreamRequest) -> ClaudeInvocation {
    chat_with_windows_limit(req, cfg!(windows))
}

pub(crate) fn agent(req: &AgentStreamRequest) -> Result<ClaudeInvocation, String> {
    agent_with_windows_limit(req, cfg!(windows))
}

fn chat_with_windows_limit(
    req: &ChatStreamRequest,
    enforce_windows_limit: bool,
) -> ClaudeInvocation {
    let args = chat_args(req);
    let fallback_args = vec![chat_args_compat(req)];
    if should_pipe_prompt_for_windows(enforce_windows_limit, &args, &fallback_args) {
        return ClaudeInvocation {
            args: chat_args_with_tool_policy(req, "--tools", String::new(), PromptSource::Stdin),
            fallback_args: vec![chat_args_with_tool_policy(
                req,
                "--disallowedTools",
                CLAUDE_CHAT_DISALLOWED_TOOLS_COMPAT.into(),
                PromptSource::Stdin,
            )],
            stdin_text: Some(stdin_prompt(&req.message, req.system_prompt.as_deref())),
            env: Vec::new(),
        };
    }

    ClaudeInvocation {
        args,
        fallback_args,
        stdin_text: None,
        env: Vec::new(),
    }
}

/// The Claude Code engine profile. No weaker fallback: a `claude` too old for
/// these flags fails with an update message instead of running unconfined.
fn agent_with_windows_limit(
    req: &AgentStreamRequest,
    enforce_windows_limit: bool,
) -> Result<ClaudeInvocation, String> {
    let args = engine_args(req, PromptSource::Argument)?;
    let stdin = should_pipe_prompt_for_windows(enforce_windows_limit, &args, &[]);
    Ok(ClaudeInvocation {
        args: if stdin {
            engine_args(req, PromptSource::Stdin)?
        } else {
            args
        },
        fallback_args: Vec::new(),
        stdin_text: stdin.then(|| stdin_prompt(&req.message, req.system_prompt.as_deref())),
        env: vec![CLAUDE_ENGINE_DISABLE_AUTO_MEMORY_ENV],
    })
}

fn chat_args(req: &ChatStreamRequest) -> Vec<String> {
    chat_args_with_tool_policy(req, "--tools", String::new(), PromptSource::Argument)
}

fn chat_args_compat(req: &ChatStreamRequest) -> Vec<String> {
    chat_args_with_tool_policy(
        req,
        "--disallowedTools",
        CLAUDE_CHAT_DISALLOWED_TOOLS_COMPAT.into(),
        PromptSource::Argument,
    )
}

fn chat_args_with_tool_policy(
    req: &ChatStreamRequest,
    tool_flag: &str,
    tool_value: String,
    prompt_source: PromptSource,
) -> Vec<String> {
    let mut args: Vec<String> = vec!["-p".into()];
    if prompt_source == PromptSource::Argument {
        args.push(req.message.clone());
    }
    args.extend([
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
        "--include-partial-messages".into(),
        tool_flag.into(),
        tool_value,
    ]);

    if prompt_source == PromptSource::Argument {
        append_non_empty_arg_pair(&mut args, "--system-prompt", req.system_prompt.as_deref());
    }
    if let Some(ref session_id) = req.session_id {
        args.push("--resume".into());
        args.push(session_id.clone());
    }

    args
}

fn engine_args(
    req: &AgentStreamRequest,
    prompt_source: PromptSource,
) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = vec!["-p".into()];
    if prompt_source == PromptSource::Argument {
        args.push(req.message.clone());
    }
    args.extend([
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
        "--include-partial-messages".into(),
        "--setting-sources".into(),
        CLAUDE_ENGINE_SETTING_SOURCES.into(),
        "--settings".into(),
        CLAUDE_ENGINE_SETTINGS.into(),
        "--mcp-config".into(),
        mcp_config(&req.vault_path, &req.vault_paths)?,
        "--strict-mcp-config".into(),
        "--permission-mode".into(),
        engine_permission_mode(req.permission_mode).into(),
        "--permission-prompts".into(),
        CLAUDE_ENGINE_PERMISSION_PROMPTS.into(),
        "--tools".into(),
        agent_tools(req.permission_mode).into(),
    ]);
    for dir in engine_add_dirs(&req.vault_path, &req.vault_paths) {
        args.push("--add-dir".into());
        args.push(dir);
    }
    if prompt_source == PromptSource::Argument {
        append_non_empty_arg_pair(
            &mut args,
            "--append-system-prompt",
            req.system_prompt.as_deref(),
        );
    }

    Ok(args)
}

/// Every vault the chat may read, once each, in order.
fn engine_add_dirs(vault_path: &str, vault_paths: &[String]) -> Vec<String> {
    let mut dirs: Vec<String> = Vec::new();
    for dir in std::iter::once(vault_path).chain(vault_paths.iter().map(String::as_str)) {
        let dir = dir.trim();
        if !dir.is_empty() && !dirs.iter().any(|seen| seen == dir) {
            dirs.push(dir.to_string());
        }
    }
    dirs
}

fn engine_permission_mode(permission_mode: AiAgentPermissionMode) -> &'static str {
    match permission_mode {
        AiAgentPermissionMode::Safe => CLAUDE_ENGINE_LIMITED_PERMISSION_MODE,
        AiAgentPermissionMode::PowerUser => CLAUDE_ENGINE_POWER_USER_PERMISSION_MODE,
    }
}

fn append_non_empty_arg_pair(args: &mut Vec<String>, flag: &str, value: Option<&str>) {
    if let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) {
        args.push(flag.into());
        args.push(value.into());
    }
}

fn stdin_prompt(message: &str, system_prompt: Option<&str>) -> String {
    crate::cli_agent_runtime::build_prompt(message, system_prompt)
}

fn mcp_config(vault_path: &str, vault_paths: &[String]) -> Result<String, String> {
    let mcp_server_path = crate::cli_agent_runtime::mcp_server_path_string()?;
    let config = serde_json::json!({
        "mcpServers": {
            "rhizome": crate::cli_agent_runtime::rhizome_node_mcp_server(
                &mcp_server_path,
                vault_path,
                vault_paths,
                false,
            )
        }
    });
    serde_json::to_string(&config).map_err(|e| format!("Failed to serialise MCP config: {e}"))
}

fn should_pipe_prompt_for_windows(
    enforce_windows_limit: bool,
    args: &[String],
    fallback_args: &[Vec<String>],
) -> bool {
    enforce_windows_limit
        && std::iter::once(args)
            .chain(fallback_args.iter().map(Vec::as_slice))
            .any(args_exceed_windows_stdin_threshold)
}

fn args_exceed_windows_stdin_threshold(args: &[String]) -> bool {
    windows_command_line_utf16_units(args) >= WINDOWS_COMMAND_LINE_STDIN_THRESHOLD
}

fn windows_command_line_utf16_units(args: &[String]) -> usize {
    args.iter().map(|arg| arg.encode_utf16().count() + 3).sum()
}

fn agent_tools(permission_mode: AiAgentPermissionMode) -> &'static str {
    match permission_mode {
        AiAgentPermissionMode::Safe => CLAUDE_SAFE_AGENT_TOOLS,
        AiAgentPermissionMode::PowerUser => CLAUDE_POWER_USER_AGENT_TOOLS,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    macro_rules! assert_args_contain {
        ($args:expr, [$($value:expr),+ $(,)?] $(,)?) => {
            $(
                assert!($args.contains(&$value.to_string()), "missing {}", $value);
            )+
        };
    }

    macro_rules! assert_args_lack {
        ($args:expr, [$($value:expr),+ $(,)?] $(,)?) => {
            $(
                assert!(!$args.iter().any(|arg| arg == &$value.to_string()), "unexpected {}", $value);
            )+
        };
    }

    macro_rules! assert_no_arg_contains {
        ($args:expr, $fragment:expr $(,)?) => {
            assert!(!$args.iter().any(|arg| arg.contains($fragment)));
        };
    }

    macro_rules! chat_request {
        ($message:expr, None, None $(,)?) => {
            ChatStreamRequest {
                message: $message.into(),
                system_prompt: None,
                session_id: None,
            }
        };
        ($message:expr, Some($system_prompt:expr), None $(,)?) => {
            ChatStreamRequest {
                message: $message.into(),
                system_prompt: Some($system_prompt.to_string()),
                session_id: None,
            }
        };
        ($message:expr, None, Some($session_id:expr) $(,)?) => {
            ChatStreamRequest {
                message: $message.into(),
                system_prompt: None,
                session_id: Some($session_id.to_string()),
            }
        };
        ($message:expr, Some($system_prompt:expr), Some($session_id:expr) $(,)?) => {
            ChatStreamRequest {
                message: $message.into(),
                system_prompt: Some($system_prompt.to_string()),
                session_id: Some($session_id.to_string()),
            }
        };
    }

    fn agent_request(
        message: &str,
        system_prompt: Option<&str>,
        permission_mode: AiAgentPermissionMode,
    ) -> AgentStreamRequest {
        AgentStreamRequest {
            message: message.into(),
            system_prompt: system_prompt.map(str::to_string),
            vault_path: "/tmp/vault".into(),
            vault_paths: Vec::new(),
            permission_mode,
        }
    }

    fn arg_value_after<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
        let index = args.iter().position(|arg| arg == name)?;
        args.get(index + 1).map(String::as_str)
    }

    #[test]
    fn chat_args_basic() {
        let args = chat_args(&chat_request!("hello", None, None));

        assert_args_contain!(args, ["-p", "hello", "stream-json"]);
        assert_args_lack!(args, ["--system-prompt", "--resume"]);
    }

    #[test]
    fn chat_args_with_system_prompt() {
        let args = chat_args(&chat_request!("hi", Some("You are helpful."), None));

        assert_args_contain!(args, ["--system-prompt", "You are helpful."]);
    }

    #[test]
    fn chat_args_empty_system_prompt_is_skipped() {
        let args = chat_args(&chat_request!("hi", Some(""), None));

        assert!(!args.contains(&"--system-prompt".to_string()));
    }

    #[test]
    fn chat_args_with_session_id() {
        let args = chat_args(&chat_request!("continue", None, Some("sess-abc")));

        assert_args_contain!(args, ["--resume", "sess-abc"]);
    }

    #[test]
    fn chat_args_compat_disallows_builtin_tools_when_tools_flag_is_unavailable() {
        let args = chat_args_compat(&chat_request!("hello", None, None));

        assert_args_contain!(args, ["--disallowedTools"]);
        assert_args_lack!(args, ["--tools"]);
        assert!(arg_value_after(&args, "--disallowedTools")
            .is_some_and(|tools| tools.contains("NotebookEdit")));
    }

    #[test]
    fn oversized_windows_invocations_pipe_prompt_to_stdin() {
        let long_message = "x".repeat(WINDOWS_COMMAND_LINE_STDIN_THRESHOLD);
        let chat_req = chat_request!(&long_message, Some("Use context."), Some("sess-abc"));
        let chat_invocation = chat_with_windows_limit(&chat_req, true);

        assert_eq!(chat_invocation.args.first().map(String::as_str), Some("-p"));
        assert_args_lack!(
            chat_invocation.args,
            [long_message.as_str(), "--system-prompt", "Use context."]
        );
        assert_args_contain!(chat_invocation.args, ["--resume", "sess-abc"]);
        assert!(chat_invocation
            .fallback_args
            .iter()
            .flatten()
            .all(|arg| arg != &long_message));
        let chat_stdin = chat_invocation.stdin_text.as_deref().unwrap();
        assert!(chat_stdin.contains("System instructions:\nUse context."));
        assert!(chat_stdin.contains("User request:\n"));
        assert!(chat_stdin.contains(&long_message));

        let agent_req = agent_request(
            &long_message,
            Some("Read the active vault first."),
            AiAgentPermissionMode::Safe,
        );
        let agent_invocation = agent_with_windows_limit(&agent_req, true).unwrap();

        assert_eq!(
            agent_invocation.args.first().map(String::as_str),
            Some("-p")
        );
        assert_args_lack!(
            agent_invocation.args,
            [
                long_message.as_str(),
                "--append-system-prompt",
                "Read the active vault first."
            ]
        );
        assert_args_contain!(
            agent_invocation.args,
            ["--mcp-config", "--strict-mcp-config"]
        );
        assert!(agent_invocation
            .fallback_args
            .iter()
            .flatten()
            .all(|arg| arg != &long_message));
        let agent_stdin = agent_invocation.stdin_text.as_deref().unwrap();
        assert!(agent_stdin.contains("System instructions:\nRead the active vault first."));
        assert!(agent_stdin.contains("User request:\n"));
        assert!(agent_stdin.contains(&long_message));
    }

    fn engine(mode: AiAgentPermissionMode) -> ClaudeInvocation {
        agent_with_windows_limit(&agent_request("Rename the note", None, mode), false).unwrap()
    }

    fn arg_values_after<'a>(args: &'a [String], name: &str) -> Vec<&'a str> {
        args.windows(2)
            .filter(|pair| pair[0] == name)
            .map(|pair| pair[1].as_str())
            .collect()
    }

    const BOTH_MODES: [AiAgentPermissionMode; 2] = [
        AiAgentPermissionMode::Safe,
        AiAgentPermissionMode::PowerUser,
    ];

    #[test]
    fn agent_args_with_system_prompt() {
        let args = agent_with_windows_limit(
            &agent_request("do it", Some("Act as expert."), AiAgentPermissionMode::Safe),
            false,
        )
        .unwrap()
        .args;
        assert_eq!(
            arg_value_after(&args, "--append-system-prompt"),
            Some("Act as expert.")
        );
    }

    #[test]
    fn agent_args_empty_system_prompt_is_skipped() {
        let args = agent_with_windows_limit(
            &agent_request("x", Some(""), AiAgentPermissionMode::Safe),
            false,
        )
        .unwrap()
        .args;
        assert_args_lack!(args, ["--append-system-prompt"]);
    }

    #[test]
    fn engine_loads_user_settings_only_and_strict_mcp_in_every_mode() {
        for mode in BOTH_MODES {
            let args = engine(mode).args;
            assert_eq!(
                arg_value_after(&args, "--setting-sources"),
                Some("user"),
                "{mode:?}"
            );
            assert_args_contain!(args, ["--strict-mcp-config", "--mcp-config"]);
        }
    }

    #[test]
    fn engine_turns_claude_code_auto_memory_off() {
        for mode in BOTH_MODES {
            let invocation = engine(mode);
            let settings: serde_json::Value =
                serde_json::from_str(arg_value_after(&invocation.args, "--settings").unwrap())
                    .unwrap();
            assert_eq!(
                settings["autoMemoryEnabled"],
                serde_json::Value::Bool(false)
            );
            assert!(invocation
                .env
                .contains(&("CLAUDE_CODE_DISABLE_AUTO_MEMORY", "1")));
        }
    }

    #[test]
    fn engine_limited_mode_asks_on_every_edit_and_has_no_bash() {
        let args = engine(AiAgentPermissionMode::Safe).args;

        assert_eq!(arg_value_after(&args, "--permission-mode"), Some("manual"));
        assert_args_lack!(args, ["acceptEdits", "--allowedTools"]);
        assert_eq!(
            arg_value_after(&args, "--tools"),
            Some("Read,Edit,MultiEdit,Write,Glob,Grep,LS,mcp__rhizome__*")
        );
        assert_no_arg_contains!(args, "Bash");
    }

    #[test]
    fn engine_power_user_accepts_edits_but_never_preapproves_bash() {
        let args = engine(AiAgentPermissionMode::PowerUser).args;

        assert_eq!(
            arg_value_after(&args, "--permission-mode"),
            Some("acceptEdits")
        );
        assert_eq!(
            arg_value_after(&args, "--tools"),
            Some("Read,Edit,MultiEdit,Write,Glob,Grep,LS,Bash,mcp__rhizome__*")
        );
        assert_args_lack!(args, ["--allowedTools", "--allowed-tools"]);
    }

    #[test]
    fn engine_denies_every_prompt_until_the_approval_bridge_lands() {
        for mode in BOTH_MODES {
            let args = engine(mode).args;
            assert_eq!(arg_value_after(&args, "--permission-prompts"), Some("none"));
        }
    }

    #[test]
    fn engine_never_runs_bare_unconfined_or_without_sessions() {
        for mode in BOTH_MODES {
            let invocation = engine(mode);
            assert_args_lack!(
                invocation.args,
                [
                    "--bare",
                    "--dangerously-skip-permissions",
                    "bypassPermissions",
                    "--no-session-persistence",
                    "--disallowedTools",
                ]
            );
            assert!(invocation.fallback_args.is_empty(), "no weaker fallback");
        }
    }

    #[test]
    fn engine_passes_no_credential_to_claude() {
        for mode in BOTH_MODES {
            let invocation = engine(mode);
            let all = invocation
                .args
                .iter()
                .map(String::as_str)
                .chain(
                    invocation
                        .env
                        .iter()
                        .flat_map(|(name, value)| [*name, *value]),
                )
                .collect::<Vec<_>>()
                .join(" ")
                .to_ascii_uppercase();
            for fragment in [
                "TOKEN",
                "API_KEY",
                "CREDENTIALS",
                "SETUP-TOKEN",
                "CLAUDE.JSON",
            ] {
                assert!(!all.contains(fragment), "found {fragment}");
            }
        }
    }

    #[test]
    fn engine_adds_each_vault_once() {
        let req = AgentStreamRequest {
            vault_paths: vec![
                "/tmp/vault".into(),
                "/tmp/second".into(),
                " ".into(),
                "/tmp/second".into(),
            ],
            ..agent_request("search", None, AiAgentPermissionMode::Safe)
        };
        let args = agent_with_windows_limit(&req, false).unwrap().args;

        assert_eq!(
            arg_values_after(&args, "--add-dir"),
            vec!["/tmp/vault", "/tmp/second"]
        );
    }

    #[test]
    fn agent_args_power_user_and_safe_modes_can_reach_the_rhizome_mcp_server() {
        for mode in BOTH_MODES {
            let args = engine(mode).args;
            assert!(
                args.iter().any(|a| a.contains("mcp__rhizome__*")),
                "mode {mode:?} did not allow mcp__rhizome__* tools: {args:?}"
            );
        }
    }

    #[test]
    fn agent_invocation_keeps_short_windows_prompt_on_args() {
        let req = agent_request(
            "summarize the inbox",
            Some("Read the active vault first."),
            AiAgentPermissionMode::Safe,
        );
        let invocation = agent_with_windows_limit(&req, true).unwrap();

        assert_args_contain!(
            invocation.args,
            ["-p", "summarize the inbox", "--append-system-prompt"]
        );
        assert!(invocation.stdin_text.is_none());
    }

    #[test]
    fn mcp_config_is_valid_json() {
        let extra_vaults = vec!["/tmp/secondary-vault".to_string()];
        if let Ok(config_str) = mcp_config("/tmp/test-vault", &extra_vaults) {
            let parsed: serde_json::Value = serde_json::from_str(&config_str).unwrap();
            assert!(parsed["mcpServers"]["rhizome"]["command"].is_string());
            assert_eq!(
                parsed["mcpServers"]["rhizome"]["env"]["VAULT_PATH"],
                "/tmp/test-vault"
            );
            assert_eq!(
                parsed["mcpServers"]["rhizome"]["env"]["VAULT_PATHS"],
                "[\"/tmp/test-vault\",\"/tmp/secondary-vault\"]"
            );
        }
    }
}
