use crate::ai_agents::{AiAgentPermissionMode, AiAgentStreamEvent};
use serde::Deserialize;
use std::ffi::OsString;
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus};

mod line_stream;
mod mcp_config;
mod shell_env;
mod windows_cmd_shim;

#[cfg(test)]
pub(crate) use line_stream::strip_ansi_codes;
pub(crate) use line_stream::{run_ai_agent_line_stream, LineStreamProcess};
pub(crate) use mcp_config::rhizome_node_mcp_server;
pub(crate) use shell_env::{
    apply_user_shell_env_vars_if_missing, env_value_from_process_or_user_shell, EnvName,
};

#[derive(Debug, Clone, Deserialize)]
pub struct AgentStreamRequest {
    pub message: String,
    pub system_prompt: Option<String>,
    pub vault_path: String,
    #[serde(default)]
    pub vault_paths: Vec<String>,
    pub permission_mode: AiAgentPermissionMode,
}

pub(crate) struct JsonLineRun {
    pub session_id: String,
    pub parsed_json_lines: usize,
    pub ignored_stdout_output: String,
    pub stderr_output: String,
    pub status: ExitStatus,
}

impl JsonLineRun {
    pub(crate) fn diagnostic_output(&self) -> String {
        self.ignored_stdout_output
            .lines()
            .chain(self.stderr_output.lines())
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .take(3)
            .collect::<Vec<_>>()
            .join("\n")
    }
}

pub(crate) struct AgentCommandTarget {
    pub program: PathBuf,
    pub first_arg: Option<PathBuf>,
}

pub(crate) struct JsonLineProcess<'a> {
    command: Command,
    process_name: &'static str,
    stdin_input: Option<&'a str>,
}

impl<'a> JsonLineProcess<'a> {
    pub(crate) fn new(command: Command, process_name: &'static str) -> Self {
        Self {
            command,
            process_name,
            stdin_input: None,
        }
    }

    pub(crate) fn with_stdin(mut self, stdin_input: Option<&'a str>) -> Self {
        self.stdin_input = stdin_input;
        self
    }
}

/// The two halves of the shape `build_prompt` composes. They live beside both
/// the function that writes it and the one that reads it back, so the encoding
/// cannot drift apart into a parser that silently stops matching.
const SYSTEM_INSTRUCTIONS_PREFIX: &str = "System instructions:\n";
const USER_REQUEST_MARKER: &str = "\n\nUser request:\n";

pub(crate) fn build_prompt(message: &str, system_prompt: Option<&str>) -> String {
    match system_prompt
        .map(str::trim)
        .filter(|prompt| !prompt.is_empty())
    {
        Some(system_prompt) => {
            format!("{SYSTEM_INSTRUCTIONS_PREFIX}{system_prompt}{USER_REQUEST_MARKER}{message}")
        }
        None => message.to_string(),
    }
}

/// Recover the user's own words from a prompt `build_prompt` composed.
///
/// What reaches Prime — and therefore what the session log stores — is the
/// user's message with a system-instruction block in front of it. Replaying
/// that verbatim renders a two-character message as a screenful of
/// instructions the user never wrote (C26). The context block is rebuilt from
/// the open note on every turn, so it cannot simply be moved to session
/// creation instead; the composition is right, and only the *display* of it
/// was wrong.
///
/// Returns `None` when the prompt carries no system block, which is the
/// ordinary case for anything Rhizome did not compose.
///
/// Splits on the **first** marker. A system prompt containing the marker would
/// leak a little of itself into the message, while splitting on the last would
/// truncate a user who quoted it — and losing the user's own words is the
/// worse of the two failures.
pub(crate) fn user_request_from_prompt(prompt: &str) -> Option<&str> {
    let rest = prompt.strip_prefix(SYSTEM_INSTRUCTIONS_PREFIX)?;
    let marker = rest.find(USER_REQUEST_MARKER)?;
    Some(&rest[marker + USER_REQUEST_MARKER.len()..])
}

const CONVERSATION_HISTORY_OPEN: &str = concat!("<", "conversation_history", ">");
const CONVERSATION_HISTORY_CLOSE: &str = concat!("</", "conversation_history", ">");

/// Recover the latest user ask from a `formatMessageWithHistory` wrapper.
///
/// The first turn is a bare message. Later turns wrap the transcript in
/// `<conversation_history>`. Naming or listing from the opening tag printed
/// that tag in the session list. Incomplete wrappers still yield the last
/// `[user]:` turn when one exists.
pub(crate) fn unwrap_conversation_history(raw: &str) -> String {
    let text = raw.trim();
    let Some(start) = text.find(CONVERSATION_HISTORY_OPEN) else {
        return text.to_string();
    };
    let inner_start = start + CONVERSATION_HISTORY_OPEN.len();
    let inner = match text[inner_start..].find(CONVERSATION_HISTORY_CLOSE) {
        Some(rel) => text[inner_start..inner_start + rel].trim(),
        None => text[inner_start..].trim(),
    };
    last_user_turn(inner).unwrap_or_else(|| strip_role_prefixes(inner))
}

fn last_user_turn(inner: &str) -> Option<String> {
    let mut last = None;
    let hay = inner.as_bytes();
    let mut index = 0;
    while index < hay.len() {
        let rest = &inner[index..];
        let Some(rel) = find_ignore_ascii_case(rest, "[user]:") else {
            break;
        };
        let after = rest[rel + "[user]:".len()..].trim_start();
        let cut = find_ignore_ascii_case(after, "[assistant]:").unwrap_or(after.len());
        let turn = after[..cut].trim();
        if !turn.is_empty() {
            last = Some(turn.to_string());
        }
        index += rel + 1;
    }
    last
}

fn strip_role_prefixes(inner: &str) -> String {
    let mut out = inner.to_string();
    for marker in ["[user]:", "[assistant]:", "[User]:", "[Assistant]:"] {
        out = out.replace(marker, "");
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn find_ignore_ascii_case(haystack: &str, needle: &str) -> Option<usize> {
    let hay = haystack.as_bytes();
    let needle = needle.as_bytes();
    if needle.is_empty() || hay.len() < needle.len() {
        return None;
    }
    hay.windows(needle.len())
        .position(|window| window.eq_ignore_ascii_case(needle))
}

/// The user's own words after both composition wrappers are removed.
pub(crate) fn spoken_user_request(prompt: &str) -> String {
    let after_system = user_request_from_prompt(prompt).unwrap_or(prompt);
    unwrap_conversation_history(after_system)
}

pub(crate) fn mcp_server_path_string() -> Result<String, String> {
    crate::mcp::mcp_server_index_js_path_string()
}

pub(crate) fn active_vault_paths(primary_vault_path: &str, vault_paths: &[String]) -> Vec<String> {
    let mut paths = Vec::new();
    push_unique_vault_path(&mut paths, primary_vault_path);
    for path in vault_paths {
        push_unique_vault_path(&mut paths, path);
    }
    paths
}

pub(crate) fn active_vault_paths_json(primary_vault_path: &str, vault_paths: &[String]) -> String {
    serde_json::to_string(&active_vault_paths(primary_vault_path, vault_paths))
        .unwrap_or_else(|_| format!("[{}]", serde_json::json!(primary_vault_path)))
}

fn push_unique_vault_path(paths: &mut Vec<String>, path: &str) {
    let trimmed = path.trim();
    if trimmed.is_empty() || paths.iter().any(|existing| existing == trimmed) {
        return;
    }
    paths.push(trimmed.to_string());
}

pub(crate) fn version_for_binary(binary: &Path) -> Option<String> {
    let target = command_target_avoiding_windows_cmd_shim(binary).ok()?;
    let mut command = crate::hidden_command(&target.program);
    configure_agent_command_environment(&mut command, binary);
    if let Some(first_arg) = target.first_arg {
        command.arg(first_arg);
    }
    command
        .arg("--version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub(crate) fn command_target_avoiding_windows_cmd_shim(
    binary: &Path,
) -> Result<AgentCommandTarget, String> {
    if let Some(target) = windows_cmd_shim::command_target(binary)? {
        return Ok(target);
    }

    Ok(AgentCommandTarget {
        program: binary.to_path_buf(),
        first_arg: None,
    })
}

pub(crate) fn configure_agent_command_environment(command: &mut Command, binary: &Path) {
    if let Some(path) = expanded_agent_path(binary) {
        command.env("PATH", path);
    }
}

fn expanded_agent_path(binary: &Path) -> Option<OsString> {
    let mut paths = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .unwrap_or_default();

    for candidate in agent_path_candidates(binary) {
        push_unique_path(&mut paths, candidate);
    }

    std::env::join_paths(paths).ok()
}

fn agent_path_candidates(binary: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(parent) = binary
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        candidates.push(parent.to_path_buf());
    }

    if let Some(home) = dirs::home_dir() {
        candidates.extend([
            home.join(".local/bin"),
            home.join(".local/share/mise/shims"),
            home.join(".asdf/shims"),
            home.join(".npm-global/bin"),
            home.join(".npm/bin"),
            home.join(".bun/bin"),
            home.join(".linuxbrew/bin"),
            home.join("AppData/Roaming/npm"),
            home.join("AppData/Local/pnpm"),
            home.join("scoop/shims"),
        ]);
    }

    candidates.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin"),
    ]);

    candidates
}

fn push_unique_path(paths: &mut Vec<PathBuf>, candidate: PathBuf) {
    if candidate.as_os_str().is_empty() {
        return;
    }
    if paths.iter().any(|path| path == &candidate) {
        return;
    }
    paths.push(candidate);
}

pub(crate) fn find_executable_binary_candidate(
    candidates: Vec<PathBuf>,
    agent_label: &str,
) -> Result<Option<PathBuf>, String> {
    let mut first_unusable_candidate = None;

    for candidate in candidates {
        if !candidate.exists() {
            continue;
        }

        if is_executable_file(&candidate) {
            return Ok(Some(candidate));
        }

        if first_unusable_candidate.is_none() {
            first_unusable_candidate = Some(candidate);
        }
    }

    match first_unusable_candidate {
        Some(candidate) => Err(format!(
            "{agent_label} binary found at {} but it is not executable. Fix the file permissions or reinstall the CLI.",
            candidate.display()
        )),
        None => Ok(None),
    }
}

fn is_executable_file(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::metadata(path)
            .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }

    #[cfg(windows)]
    {
        path.is_file() && has_windows_cli_extension(path)
    }

    #[cfg(all(not(unix), not(windows)))]
    {
        path.is_file()
    }
}

pub(crate) fn has_windows_cli_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            ["bat", "cmd", "com", "exe"]
                .iter()
                .any(|expected| extension.eq_ignore_ascii_case(expected))
        })
}

#[cfg(test)]
pub(crate) fn parse_json_line(
    line: Result<String, std::io::Error>,
) -> Result<Option<serde_json::Value>, String> {
    let line = line.map_err(|error| format!("Read error: {error}"))?;
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    Ok(serde_json::from_str::<serde_json::Value>(trimmed).ok())
}

fn parse_process_stdout_line(
    line: Result<String, std::io::Error>,
    ignored_stdout_lines: &mut Vec<String>,
) -> Result<Option<serde_json::Value>, String> {
    let line = line.map_err(|error| format!("Read error: {error}"))?;
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    match serde_json::from_str::<serde_json::Value>(trimmed) {
        Ok(json) => Ok(Some(json)),
        Err(_) => {
            push_ignored_stdout_line(ignored_stdout_lines, trimmed);
            Ok(None)
        }
    }
}

fn push_ignored_stdout_line(lines: &mut Vec<String>, line: &str) {
    if lines.len() < 3 {
        lines.push(line.to_string());
    }
}

#[cfg(test)]
pub(crate) fn parse_ai_agent_json_line<F>(
    line: Result<String, std::io::Error>,
    emit: &mut F,
) -> Option<serde_json::Value>
where
    F: FnMut(AiAgentStreamEvent),
{
    match parse_json_line(line) {
        Ok(json) => json,
        Err(message) => {
            emit(AiAgentStreamEvent::Error { message });
            None
        }
    }
}

pub(crate) fn run_json_line_process<Event, F, H>(
    command: Command,
    process_name: &'static str,
    emit: &mut F,
    error_event: impl Fn(String) -> Event,
    handle_json: H,
) -> Result<JsonLineRun, String>
where
    F: FnMut(Event),
    H: FnMut(&serde_json::Value, &mut F, &mut String),
{
    run_json_line_process_with_stdin(
        JsonLineProcess::new(command, process_name),
        emit,
        error_event,
        handle_json,
    )
}

pub(crate) fn run_json_line_process_with_stdin<Event, F, H>(
    mut process: JsonLineProcess<'_>,
    emit: &mut F,
    error_event: impl Fn(String) -> Event,
    mut handle_json: H,
) -> Result<JsonLineRun, String>
where
    F: FnMut(Event),
    H: FnMut(&serde_json::Value, &mut F, &mut String),
{
    if process.stdin_input.is_some() {
        process.command.stdin(std::process::Stdio::piped());
    }

    let mut child = process
        .command
        .spawn()
        .map_err(|error| format_spawn_error(process.process_name, &error))?;
    let stdin_write_error =
        write_stdin_input(&mut child, process.process_name, process.stdin_input);
    let stdout = child.stdout.take().ok_or("No stdout handle")?;
    let stderr = child.stderr.take();
    let child = crate::ai_agent_processes::register_current_stream_child(child);
    let reader = std::io::BufReader::new(stdout);
    let mut session_id = String::new();
    let mut ignored_stdout_lines = Vec::new();
    let mut parsed_json_lines = 0;

    for line in reader.lines() {
        match parse_process_stdout_line(line, &mut ignored_stdout_lines) {
            Ok(Some(json)) => {
                parsed_json_lines += 1;
                handle_json(&json, emit, &mut session_id);
            }
            Ok(None) => {}
            Err(message) => {
                emit(error_event(message));
                break;
            }
        }
    }

    let stderr_output = stderr
        .and_then(|stderr| std::io::read_to_string(stderr).ok())
        .unwrap_or_default();
    let status = child.wait()?;
    let stderr_output = with_stdin_write_error(stderr_output, stdin_write_error);

    Ok(JsonLineRun {
        session_id,
        parsed_json_lines,
        ignored_stdout_output: ignored_stdout_lines.join("\n"),
        stderr_output,
        status,
    })
}

fn write_stdin_input(
    child: &mut std::process::Child,
    process_name: &str,
    stdin_input: Option<&str>,
) -> Option<String> {
    let input = stdin_input?;
    let Some(mut stdin) = child.stdin.take() else {
        return Some(format!(
            "Failed to write {process_name} stdin: no stdin handle"
        ));
    };

    stdin
        .write_all(input.as_bytes())
        .err()
        .map(|error| format!("Failed to write {process_name} stdin: {error}"))
}

fn with_stdin_write_error(mut stderr_output: String, stdin_write_error: Option<String>) -> String {
    let Some(error) = stdin_write_error else {
        return stderr_output;
    };

    if !stderr_output.is_empty() {
        stderr_output.push('\n');
    }
    stderr_output.push_str(&error);
    stderr_output
}

fn format_spawn_error(process_name: &str, error: &std::io::Error) -> String {
    if error.kind() == std::io::ErrorKind::NotFound {
        return format!(
            "Failed to start {process_name}: the CLI or one of its runtime dependencies was not found. If it was installed with Homebrew, make sure /opt/homebrew/bin or /usr/local/bin contains the CLI and Node.js, then restart Rhizome. Details: {error}"
        );
    }

    format!("Failed to spawn {process_name}: {error}")
}

pub(crate) fn run_ai_agent_json_stream<F>(
    command: Command,
    process_name: &'static str,
    emit: F,
    session_id: impl Fn(&serde_json::Value) -> Option<&str>,
    dispatch_event: impl Fn(&serde_json::Value, &mut F),
    format_error: impl Fn(String, String) -> String,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    run_ai_agent_json_stream_with_success_check(
        command,
        process_name,
        emit,
        session_id,
        dispatch_event,
        format_error,
        |_| None,
    )
}

pub(crate) fn run_ai_agent_json_stream_with_success_check<F>(
    command: Command,
    process_name: &'static str,
    mut emit: F,
    session_id: impl Fn(&serde_json::Value) -> Option<&str>,
    dispatch_event: impl Fn(&serde_json::Value, &mut F),
    format_error: impl Fn(String, String) -> String,
    success_check: impl Fn(&JsonLineRun) -> Option<String>,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let run = run_json_line_process(
        command,
        process_name,
        &mut emit,
        |message| AiAgentStreamEvent::Error { message },
        |json, emit, active_session_id| {
            if let Some(id) = session_id(json) {
                *active_session_id = id.to_string();
            }
            dispatch_event(json, emit);
        },
    )?;

    let session_id = run.session_id.clone();
    if !run.status.success() {
        emit(AiAgentStreamEvent::Error {
            message: format_error(run.stderr_output.clone(), run.status.to_string()),
        });
    } else if let Some(message) = success_check(&run) {
        emit(AiAgentStreamEvent::Error { message });
    }

    emit(AiAgentStreamEvent::Done);
    Ok(session_id)
}

/// Shared binary discovery: look up a CLI command by name using PATH, login shell, then candidates.
pub(crate) fn find_cli_binary(
    name: &str,
    candidates: Vec<PathBuf>,
    label: &str,
    install_hint: &str,
) -> Result<PathBuf, String> {
    if let Some(binary) = find_binary_on_path(name) {
        return Ok(binary);
    }
    if let Some(binary) = find_binary_in_user_shell(name) {
        return Ok(binary);
    }
    if let Some(binary) = find_executable_binary_candidate(candidates, label)? {
        return Ok(binary);
    }
    Err(format!("{label} not found. Install it: {install_hint}"))
}

fn find_binary_on_path(name: &str) -> Option<PathBuf> {
    let cmd = if cfg!(windows) { "where" } else { "which" };
    crate::hidden_command(cmd)
        .arg(name)
        .output()
        .ok()
        .and_then(|output| path_from_successful_output(&output))
}

fn find_binary_in_user_shell(name: &str) -> Option<PathBuf> {
    shell_candidates()
        .into_iter()
        .filter(|shell| shell.exists())
        .find_map(|shell| command_path_from_shell(&shell, name))
}

fn shell_candidates() -> Vec<PathBuf> {
    let mut shells = Vec::new();
    if let Some(shell) = std::env::var_os("SHELL") {
        if !shell.is_empty() {
            shells.push(PathBuf::from(shell));
        }
    }
    shells.push(PathBuf::from("/bin/zsh"));
    shells.push(PathBuf::from("/bin/bash"));
    shells
}

fn command_path_from_shell(shell: &Path, command: &str) -> Option<PathBuf> {
    crate::hidden_command(shell)
        .arg("-lc")
        .arg(format!("command -v {command}"))
        .output()
        .ok()
        .and_then(|output| path_from_successful_output(&output))
}

fn path_from_successful_output(output: &std::process::Output) -> Option<PathBuf> {
    if output.status.success() {
        first_existing_path(&String::from_utf8_lossy(&output.stdout))
    } else {
        None
    }
}

/// Which OS a path lookup is choosing a runnable binary for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Platform {
    Windows,
    Unix,
}

impl Platform {
    fn current() -> Self {
        if cfg!(windows) {
            Platform::Windows
        } else {
            Platform::Unix
        }
    }
}

pub(crate) fn first_existing_path(stdout: &str) -> Option<PathBuf> {
    first_existing_path_for_platform(stdout, Platform::current())
}

/// The first listed path that exists and this platform can run.
///
/// On Windows, npm installs both `prime-agent` (a shell script) and
/// `prime-agent.cmd`, and `where` lists the script first. Only a name with a
/// Windows CLI extension is runnable there.
fn first_existing_path_for_platform(stdout: &str, platform: Platform) -> Option<PathBuf> {
    let mut paths = stdout.lines().filter_map(|line| {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }
        let candidate = PathBuf::from(trimmed);
        candidate.exists().then_some(candidate)
    });

    match platform {
        Platform::Windows => paths.find(|path| has_windows_cli_extension(path)),
        Platform::Unix => paths.next(),
    }
}

/// Shared check_cli pattern for CLI agents.
pub(crate) fn check_cli_availability(
    find_binary: impl FnOnce() -> Result<PathBuf, String>,
) -> crate::ai_agents::AiAgentAvailability {
    match find_binary() {
        Ok(binary) => crate::ai_agents::AiAgentAvailability {
            installed: true,
            version: version_for_binary(&binary),
        },
        Err(_) => crate::ai_agents::AiAgentAvailability {
            installed: false,
            version: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `where prime-agent` lists npm's extensionless shell script before the
    /// `.cmd` shim. Windows cannot run the script ("not a valid Win32
    /// application"), so Rhizome never started Prime's daemon there.
    #[test]
    fn windows_path_lookup_prefers_the_cmd_shim_over_the_shell_script() {
        let dir = tempfile::tempdir().unwrap();
        let shell_script = dir.path().join("prime-agent");
        let cmd_shim = dir.path().join("prime-agent.cmd");
        std::fs::write(&shell_script, "#!/bin/sh\n").unwrap();
        std::fs::write(&cmd_shim, "@ECHO off\n").unwrap();
        let stdout = format!("{}\n{}\n", shell_script.display(), cmd_shim.display());

        assert_eq!(
            first_existing_path_for_platform(&stdout, Platform::Windows),
            Some(cmd_shim)
        );
        assert_eq!(
            first_existing_path_for_platform(&stdout, Platform::Unix),
            Some(shell_script)
        );
    }

    #[test]
    fn build_prompt_keeps_system_prompt_first() {
        let prompt = build_prompt("Rename the note", Some("Be concise"));

        assert!(prompt.starts_with("System instructions:\nBe concise"));
        assert!(prompt.contains("User request:\nRename the note"));
    }

    #[test]
    fn build_prompt_skips_blank_system_prompt() {
        assert_eq!(
            build_prompt("Rename the note", Some("  ")),
            "Rename the note"
        );
    }

    #[test]
    fn parse_json_line_reports_read_errors_and_skips_blank_or_invalid_lines() {
        assert!(parse_json_line(Ok("   ".into())).unwrap().is_none());
        assert!(parse_json_line(Ok("not json".into())).unwrap().is_none());

        let error = parse_json_line(Err(std::io::Error::other("broken pipe"))).unwrap_err();
        assert!(error.contains("broken pipe"));
    }

    #[test]
    fn agent_command_environment_keeps_homebrew_shims_available() {
        let mut command = Command::new("/opt/homebrew/bin/codex");
        configure_agent_command_environment(&mut command, Path::new("/opt/homebrew/bin/codex"));
        let path = command
            .get_envs()
            .find(|(key, _)| *key == std::ffi::OsStr::new("PATH"))
            .and_then(|(_, value)| value)
            .expect("PATH should be set");
        let paths = std::env::split_paths(path).collect::<Vec<_>>();

        assert!(paths.contains(&PathBuf::from("/opt/homebrew/bin")));
        assert!(paths.contains(&PathBuf::from("/usr/local/bin")));
    }

    #[test]
    fn unwraps_a_conversation_history_blob_to_the_latest_user_turn() {
        let open = concat!("<", "conversation_history", ">");
        let close = concat!("</", "conversation_history", ">");
        let blob = format!(
            "{open}\n[user]: hi\n\n[assistant]: Hello.\n\n[user]: hide chat on notes\n{close}\n\n\
             Continue the conversation. Respond only to the latest [user] message."
        );
        assert_eq!(unwrap_conversation_history(&blob), "hide chat on notes");
        assert_eq!(
            unwrap_conversation_history("Audit session"),
            "Audit session"
        );
        let incomplete = format!("{open}\n[user]: hide chat on notes\n");
        assert_eq!(
            unwrap_conversation_history(&incomplete),
            "hide chat on notes"
        );
    }

    #[test]
    fn spoken_user_request_strips_system_block_then_history() {
        let open = concat!("<", "conversation_history", ">");
        let close = concat!("</", "conversation_history", ">");
        let inner = format!("{open}\n[user]: hide chat on notes\n{close}");
        let composed = build_prompt(&inner, Some("Be concise"));
        assert_eq!(spoken_user_request(&composed), "hide chat on notes");
    }

    #[test]
    fn spawn_not_found_errors_explain_gui_path_runtime_dependencies() {
        let error = std::io::Error::new(std::io::ErrorKind::NotFound, "No such file or directory");
        let message = format_spawn_error("codex", &error);

        assert!(message.contains("Failed to start codex"));
        assert!(message.contains("/opt/homebrew/bin"));
        assert!(message.contains("Node.js"));
    }

    #[cfg(unix)]
    #[test]
    fn executable_binary_candidate_skips_unusable_file_when_later_candidate_works() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let unusable = dir.path().join("codex-unusable");
        let executable = dir.path().join("codex");
        std::fs::write(&unusable, "#!/bin/sh\n").unwrap();
        std::fs::write(&executable, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&unusable, std::fs::Permissions::from_mode(0o644)).unwrap();
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();

        let found =
            find_executable_binary_candidate(vec![unusable, executable.clone()], "Codex CLI")
                .unwrap();

        assert_eq!(found, Some(executable));
    }

    #[cfg(unix)]
    #[test]
    fn executable_binary_candidate_reports_unusable_file_when_no_candidate_works() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let unusable = dir.path().join("opencode");
        std::fs::write(&unusable, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&unusable, std::fs::Permissions::from_mode(0o644)).unwrap();

        let error =
            find_executable_binary_candidate(vec![unusable.clone()], "OpenCode CLI").unwrap_err();

        assert!(error.contains("OpenCode CLI binary found"));
        assert!(error.contains(&unusable.display().to_string()));
        assert!(error.contains("not executable"));
    }
}
