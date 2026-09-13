//! Install Prime packages the same way the CLI does.
//!
//! Prime's daemon has no package-install command. Settings → Packages runs
//! `prime-agent package install <source>` in the background, then reloads the
//! attached session so the new resources load. Chat is only the fallback
//! when that binary is missing.

use serde::Serialize;
use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const INSTALL_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPrimePackageResult {
    pub source: String,
    pub reloaded: bool,
}

pub fn install(source: &str) -> Result<InstallPrimePackageResult, String> {
    let spec = normalize_package_source(source)?;
    run_package_install(&spec)?;
    let reloaded = crate::prime_session_host::reload_attached_session();
    Ok(InstallPrimePackageResult {
        source: spec,
        reloaded,
    })
}

pub fn package_install_args(spec: &str) -> [&str; 3] {
    ["package", "install", spec]
}

pub fn normalize_package_source(source: &str) -> Result<String, String> {
    let trimmed = source.trim();
    if trimmed.is_empty() {
        return Err("Choose a package to install.".into());
    }
    if trimmed.starts_with('-') {
        return Err("That is not a package source.".into());
    }
    if trimmed.contains(char::is_whitespace) || trimmed.chars().any(|c| c.is_control()) {
        return Err("That is not a package source.".into());
    }
    if looks_like_explicit_source(trimmed) {
        return Ok(trimmed.to_string());
    }
    Ok(format!("npm:{trimmed}"))
}

fn looks_like_explicit_source(source: &str) -> bool {
    source.starts_with("npm:")
        || source.starts_with("git:")
        || source.starts_with("http://")
        || source.starts_with("https://")
        || source.starts_with("ssh://")
        || source.starts_with("git://")
        || source.starts_with('/')
        || source.starts_with('.')
}

fn run_package_install(spec: &str) -> Result<(), String> {
    let binary = crate::prime_discovery::find_binary().map_err(|_| {
        "Prime is not installed. Install it with `npm i -g prime-agent`.".to_string()
    })?;
    let target = crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(&binary)?;
    let mut command = crate::hidden_command(&target.program);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, &binary);
    if let Some(first_arg) = target.first_arg {
        command.arg(first_arg);
    }
    command.args(package_install_args(spec));
    command.env("GIT_TERMINAL_PROMPT", "0");
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    let output = wait_for_command(command, INSTALL_TIMEOUT)?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("exit {}", output.status)
    };
    Err(format!("Could not install {spec}. {detail}"))
}

struct CommandOutput {
    status: std::process::ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn wait_for_command(mut command: Command, timeout: Duration) -> Result<CommandOutput, String> {
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start Prime to install the package: {error}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stdout {
            let _ = pipe.read_to_end(&mut buf);
        }
        buf
    });
    let stderr_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stderr {
            let _ = pipe.read_to_end(&mut buf);
        }
        buf
    });
    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(
                        "Install timed out after 3 minutes. Try again, or install from Terminal."
                            .into(),
                    );
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => return Err(format!("Could not wait for Prime package install: {error}")),
        }
    };
    let stdout = stdout_handle.join().unwrap_or_default();
    let stderr = stderr_handle.join().unwrap_or_default();
    Ok(CommandOutput {
        status,
        stdout,
        stderr,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_bare_catalog_names_with_npm() {
        assert_eq!(
            normalize_package_source("pi-mcp-adapter").unwrap(),
            "npm:pi-mcp-adapter"
        );
    }

    #[test]
    fn keeps_explicit_sources() {
        assert_eq!(
            normalize_package_source("npm:@foo/bar@1.0.0").unwrap(),
            "npm:@foo/bar@1.0.0"
        );
        assert_eq!(
            normalize_package_source("git:github.com/user/repo@v1").unwrap(),
            "git:github.com/user/repo@v1"
        );
        assert_eq!(
            normalize_package_source("https://github.com/user/repo").unwrap(),
            "https://github.com/user/repo"
        );
        assert_eq!(
            normalize_package_source("/absolute/path").unwrap(),
            "/absolute/path"
        );
    }

    #[test]
    fn rejects_flags_and_spaces() {
        assert!(normalize_package_source("").is_err());
        assert!(normalize_package_source("--help").is_err());
        assert!(normalize_package_source("npm:foo bar").is_err());
    }

    #[test]
    fn install_argv_is_package_install_then_spec() {
        assert_eq!(
            package_install_args("npm:pi-mcp-adapter"),
            ["package", "install", "npm:pi-mcp-adapter"]
        );
    }
}
