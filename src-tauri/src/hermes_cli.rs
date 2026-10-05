use crate::acp_client::{run_acp_prompt, AcpLaunch, AcpSessionRequest};
use crate::ai_agents::{AiAgentAvailability, AiAgentStreamEvent};
use crate::cli_agent_runtime::{AgentStreamRequest, LineStreamProcess};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};

/// How Rhizome talks to Hermes for this turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum HermesTransport {
    Acp,
    ChatFallback,
}

pub fn check_cli() -> AiAgentAvailability {
    crate::hermes_discovery::check_cli()
}

pub fn run_agent_stream<F>(request: AgentStreamRequest, emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let binary = crate::hermes_discovery::find_binary()?;
    run_agent_stream_with_binary(&binary, request, emit)
}

fn run_agent_stream_with_binary<F>(
    binary: &Path,
    request: AgentStreamRequest,
    emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let launch = hermes_launch_from_binary(binary)?;
    match select_hermes_transport(&launch) {
        HermesTransport::Acp => run_acp_stream(launch, request, emit),
        HermesTransport::ChatFallback => run_chat_fallback_stream(launch, request, emit),
    }
}

fn hermes_launch_from_binary(binary: &Path) -> Result<HermesLaunch, String> {
    let target = crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(binary)?;
    let mut prefix_args = Vec::new();
    if let Some(first_arg) = target.first_arg {
        prefix_args.push(first_arg);
    }
    Ok(HermesLaunch {
        program: target.program,
        prefix_args,
    })
}

#[derive(Debug, Clone)]
struct HermesLaunch {
    program: PathBuf,
    prefix_args: Vec<PathBuf>,
}

fn select_hermes_transport(launch: &HermesLaunch) -> HermesTransport {
    if hermes_acp_available(launch) {
        HermesTransport::Acp
    } else {
        HermesTransport::ChatFallback
    }
}

fn hermes_acp_available(launch: &HermesLaunch) -> bool {
    let mut command = crate::hidden_command(&launch.program);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, &launch.program);
    for arg in &launch.prefix_args {
        command.arg(arg);
    }
    command
        .arg("acp")
        .arg("--check")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match command.output() {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

fn run_acp_stream<F>(
    launch: HermesLaunch,
    request: AgentStreamRequest,
    mut emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let prompt =
        crate::cli_agent_runtime::build_prompt(&request.message, request.system_prompt.as_deref());
    let resume_session_id = resume_session_id_for(&request.vault_path, &prompt);
    let prompt = if resume_session_id.is_some() {
        crate::cli_agent_runtime::spoken_user_request(&prompt)
    } else {
        prompt
    };

    let mut args: Vec<String> = launch
        .prefix_args
        .iter()
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect();
    args.push("acp".into());

    let acp_launch = AcpLaunch {
        program: launch.program,
        args,
        extra_env: vec![("HERMES_ACP_SKIP_CONFIGURED_MCP".into(), "1".into())],
    };
    let session_request = AcpSessionRequest {
        cwd: absolute_vault_cwd(&request.vault_path),
        prompt,
        resume_session_id,
        mcp_servers: rhizome_mcp_servers(&request),
        permission_mode: request.permission_mode,
    };

    match run_acp_prompt(acp_launch, session_request, &mut emit) {
        Ok(session_id) => {
            remember_session(&request.vault_path, &session_id);
            Ok(session_id)
        }
        Err(message) => {
            emit(AiAgentStreamEvent::Error {
                message: format_hermes_error(&message, "acp"),
            });
            emit(AiAgentStreamEvent::Done);
            Ok(format!("hermes-acp-error-{}", std::process::id()))
        }
    }
}

fn run_chat_fallback_stream<F>(
    launch: HermesLaunch,
    request: AgentStreamRequest,
    emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let prompt =
        crate::cli_agent_runtime::build_prompt(&request.message, request.system_prompt.as_deref());
    let command = build_hermes_chat_command(&launch, prompt, &request.vault_path)?;
    crate::cli_agent_runtime::run_ai_agent_line_stream(
        LineStreamProcess::new(command, "hermes", "hermes"),
        emit,
        format_hermes_error,
    )
}

fn build_hermes_chat_command(
    launch: &HermesLaunch,
    prompt: String,
    vault_path: &str,
) -> Result<Command, String> {
    let mut command = crate::hidden_command(&launch.program);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, &launch.program);
    for arg in &launch.prefix_args {
        command.arg(arg);
    }
    command
        .arg("chat")
        .arg("--quiet")
        // "tool" is not a placeholder — it's the literal value Hermes's own
        // `--source` flag recognizes as "third-party integration, hide from
        // the user's session list" (see `hermes chat --help`). Every other
        // string, including a product name, is just a visible tag and does
        // NOT hide the entry. Do not "fix" this to "rhizome".
        //
        // This path is the fallback when `hermes acp` is missing or too old.
        // ACP sessions are visible in Hermes's own list; this one-shot is not.
        .arg("--source")
        .arg("tool")
        .arg("-q")
        .arg(prompt)
        .current_dir(vault_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    Ok(command)
}

fn rhizome_mcp_servers(request: &AgentStreamRequest) -> Vec<serde_json::Value> {
    let Ok(mcp_path) = crate::cli_agent_runtime::mcp_server_path_string() else {
        return Vec::new();
    };
    let config = crate::cli_agent_runtime::rhizome_node_mcp_server(
        &mcp_path,
        &request.vault_path,
        &request.vault_paths,
        false,
    );
    let Some(command) = config.get("command").and_then(|value| value.as_str()) else {
        return Vec::new();
    };
    let args = config
        .get("args")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let env = config
        .get("env")
        .and_then(|value| value.as_object())
        .map(|object| {
            object
                .iter()
                .filter_map(|(name, value)| {
                    value.as_str().map(|text| {
                        serde_json::json!({
                            "name": name,
                            "value": text
                        })
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    vec![serde_json::json!({
        "name": "rhizome",
        "command": command,
        "args": args,
        "env": env
    })]
}

fn absolute_vault_cwd(vault_path: &str) -> String {
    let path = Path::new(vault_path);
    if path.is_absolute() {
        return vault_path.to_string();
    }
    std::env::current_dir()
        .ok()
        .map(|cwd| cwd.join(path))
        .and_then(|joined| joined.canonicalize().ok().or(Some(joined)))
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| vault_path.to_string())
}

fn resume_session_id_for(vault_path: &str, prompt: &str) -> Option<String> {
    if !prompt.contains(concat!("<", "conversation_history", ">")) {
        forget_session(vault_path);
        return None;
    }
    remembered_session(vault_path)
}

fn session_memory() -> &'static Mutex<HashMap<String, String>> {
    static MEMORY: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    MEMORY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn remember_session(vault_path: &str, session_id: &str) {
    if let Ok(mut memory) = session_memory().lock() {
        memory.insert(vault_path.to_string(), session_id.to_string());
    }
}

fn remembered_session(vault_path: &str) -> Option<String> {
    session_memory()
        .lock()
        .ok()
        .and_then(|memory| memory.get(vault_path).cloned())
}

fn forget_session(vault_path: &str) {
    if let Ok(mut memory) = session_memory().lock() {
        memory.remove(vault_path);
    }
}

fn format_hermes_error(stderr_output: &str, status: &str) -> String {
    if is_auth_or_setup_error(stderr_output) {
        return "Hermes Agent is not ready. Run `hermes setup`, choose a model with `hermes model`, then run `hermes doctor` in your terminal before retrying in Rhizome.".into();
    }

    let stderr = stderr_output.trim();
    if stderr.is_empty() {
        format!("hermes exited with status {status}")
    } else {
        stderr.lines().take(3).collect::<Vec<_>>().join("\n")
    }
}

fn is_auth_or_setup_error(stderr_output: &str) -> bool {
    let lower = stderr_output.to_ascii_lowercase();
    [
        "auth",
        "api key",
        "login",
        "model",
        "provider",
        "setup",
        "token",
        "unauthorized",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_agents::AiAgentPermissionMode;
    use std::path::PathBuf;
    use std::time::{Duration, Instant};

    fn fixture() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/acp_fake_agent.cjs")
    }

    fn node_launch() -> HermesLaunch {
        HermesLaunch {
            program: PathBuf::from("node"),
            prefix_args: vec![fixture()],
        }
    }

    fn request(vault_path: String) -> AgentStreamRequest {
        AgentStreamRequest {
            message: "Summarize".into(),
            system_prompt: Some("Use Rhizome conventions".into()),
            vault_path,
            vault_paths: Vec::new(),
            permission_mode: AiAgentPermissionMode::Safe,
        }
    }

    #[cfg(unix)]
    fn executable_script(dir: &Path, body: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let script = dir.join("hermes");
        std::fs::write(&script, format!("#!/bin/sh\n{body}")).unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
        script
    }

    fn chat_request_command(vault_path: &str) -> Command {
        let launch = HermesLaunch {
            program: PathBuf::from("/tmp/hermes"),
            prefix_args: Vec::new(),
        };
        build_hermes_chat_command(&launch, "Prompt".into(), vault_path).unwrap()
    }

    #[test]
    fn build_hermes_command_uses_quiet_chat_query() {
        let command = chat_request_command("/tmp/vault");
        let args = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        assert_eq!(
            args,
            ["chat", "--quiet", "--source", "tool", "-q", "Prompt"]
        );
        assert_eq!(command.get_current_dir(), Some(Path::new("/tmp/vault")));
    }

    #[test]
    fn fixture_advertises_acp() {
        assert_eq!(
            select_hermes_transport(&node_launch()),
            HermesTransport::Acp
        );
    }

    #[test]
    fn missing_acp_subcommand_falls_back_to_chat() {
        let launch = HermesLaunch {
            program: PathBuf::from("node"),
            prefix_args: vec![PathBuf::from("-e"), PathBuf::from("process.exit(2)")],
        };
        assert_eq!(
            select_hermes_transport(&launch),
            HermesTransport::ChatFallback
        );
    }

    #[test]
    fn acp_check_probe_finishes_quickly() {
        let started = Instant::now();
        assert!(hermes_acp_available(&node_launch()));
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn run_agent_stream_uses_acp_when_available() {
        let vault = tempfile::tempdir().unwrap();
        forget_session(&vault.path().to_string_lossy());

        let mut events = Vec::new();
        let session_id = run_acp_stream(
            node_launch(),
            request(vault.path().to_string_lossy().into_owned()),
            |event| events.push(event),
        )
        .unwrap();

        assert_eq!(session_id, "sess_fake_1");
        assert!(events.iter().any(|event| matches!(
            event,
            AiAgentStreamEvent::TextDelta { text } if text == "Hello from ACP"
        )));
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
    }

    #[test]
    fn run_agent_stream_maps_hermes_stdout() {
        let vault = tempfile::tempdir().unwrap();
        // Force the chat path by pointing prefix at a script that rejects `acp`.
        let fallback = HermesLaunch {
            program: PathBuf::from("node"),
            prefix_args: vec![
                PathBuf::from("-e"),
                PathBuf::from(
                    "if (process.argv.includes('acp')) process.exit(2); process.stdout.write('Hello from Hermes\\nSecond line\\n')",
                ),
            ],
        };

        assert_eq!(
            select_hermes_transport(&fallback),
            HermesTransport::ChatFallback
        );

        let mut events = Vec::new();
        let session_id = run_chat_fallback_stream(
            fallback,
            request(vault.path().to_string_lossy().into_owned()),
            |event| events.push(event),
        )
        .unwrap();

        assert!(session_id.starts_with("hermes-"));
        assert!(matches!(
            &events[0],
            AiAgentStreamEvent::Init { session_id } if session_id.starts_with("hermes-")
        ));
        assert!(events.iter().any(|event| matches!(
            event,
            AiAgentStreamEvent::TextDelta { text } if text == "Hello from Hermes\n"
        )));
        assert!(events.iter().any(|event| matches!(
            event,
            AiAgentStreamEvent::TextDelta { text } if text == "Second line\n"
        )));
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
    }

    #[test]
    fn run_agent_stream_reports_hermes_setup_errors() {
        let vault = tempfile::tempdir().unwrap();
        let fallback = HermesLaunch {
            program: PathBuf::from("node"),
            prefix_args: vec![
                PathBuf::from("-e"),
                PathBuf::from(
                    "process.stderr.write('provider api key missing\\n'); process.exit(2)",
                ),
            ],
        };

        let mut events = Vec::new();
        run_chat_fallback_stream(
            fallback,
            request(vault.path().to_string_lossy().into_owned()),
            |event| events.push(event),
        )
        .unwrap();

        assert!(events.iter().any(|event| matches!(
            event,
            AiAgentStreamEvent::Error { message } if message.contains("hermes setup")
        )));
        assert!(matches!(events.last(), Some(AiAgentStreamEvent::Done)));
    }

    #[test]
    fn later_turns_resume_the_remembered_acp_session() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        forget_session(&vault_path);
        remember_session(&vault_path, "sess_remembered");

        let prompt = format!(
            "System instructions:\nrules\n\nUser request:\n<{}>\n[user]: hi\n</{}>\n",
            "conversation_history", "conversation_history"
        );
        assert_eq!(
            resume_session_id_for(&vault_path, &prompt).as_deref(),
            Some("sess_remembered")
        );

        forget_session(&vault_path);
        assert_eq!(resume_session_id_for(&vault_path, "plain ask"), None);
    }

    #[test]
    fn format_hermes_error_returns_status_for_empty_stderr() {
        let result = format_hermes_error("", "1");

        assert!(result.contains("status 1"));
    }

    #[test]
    fn strip_ansi_codes_removes_terminal_colors() {
        assert_eq!(
            crate::cli_agent_runtime::strip_ansi_codes("\x1b[32mHermes\x1b[0m"),
            "Hermes"
        );
    }

    #[cfg(unix)]
    #[test]
    fn unix_script_without_acp_keeps_chat_fallback() {
        let dir = tempfile::tempdir().unwrap();
        let vault = tempfile::tempdir().unwrap();
        let binary = executable_script(
            dir.path(),
            r#"if [ "$1" = acp ]; then exit 2; fi
printf '%s\n' 'Hello from Hermes'
"#,
        );

        let mut events = Vec::new();
        let session_id = run_agent_stream_with_binary(
            &binary,
            request(vault.path().to_string_lossy().into_owned()),
            |event| events.push(event),
        )
        .unwrap();

        assert!(session_id.starts_with("hermes-"));
        assert!(events.iter().any(|event| matches!(
            event,
            AiAgentStreamEvent::TextDelta { text } if text == "Hello from Hermes\n"
        )));
    }
}
