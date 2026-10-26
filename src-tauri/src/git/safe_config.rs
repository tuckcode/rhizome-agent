//! Command-line overrides for git config that can execute code.
//!
//! A vault folder copied or synced in can carry a hostile `.git/config`.
//! `git_command` applies these `-c` overrides on every invocation so that
//! file cannot win over the user's system and global config.

use std::cell::RefCell;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

const TRUSTED_SCOPES: [&str; 2] = ["system", "global"];

/// Subcommands this process invokes. An empty alias forces the built-in
/// so a repo-local `alias.status = !…` cannot replace it.
const HARDENED_ALIASES: &[&str] = &[
    "add",
    "branch",
    "checkout",
    "clone",
    "commit",
    "config",
    "credential",
    "diff",
    "fetch",
    "init",
    "log",
    "ls-files",
    "merge",
    "mv",
    "pull",
    "push",
    "rebase",
    "remote",
    "reset",
    "rev-list",
    "rev-parse",
    "show",
    "status",
    "var",
];

#[derive(Clone, PartialEq, Eq)]
struct CacheKey {
    global: Option<OsString>,
    system: Option<OsString>,
    git_ssh: Option<OsString>,
}

#[derive(Clone)]
struct RepoOverrides {
    credential_helpers: Vec<String>,
    ssh_command: String,
}

thread_local! {
    static OVERRIDE_CACHE: RefCell<Option<(CacheKey, RepoOverrides)>> = const { RefCell::new(None) };
}

pub(super) fn apply_untrusted_repo_overrides(command: &mut Command, base: impl Fn() -> Command) {
    let overrides = cached_overrides(command, base);
    push_overrides(command, &overrides);
}

fn cached_overrides(command: &Command, base: impl Fn() -> Command) -> RepoOverrides {
    let key = CacheKey {
        global: command_env(command, "GIT_CONFIG_GLOBAL"),
        system: command_env(command, "GIT_CONFIG_SYSTEM"),
        git_ssh: std::env::var_os("GIT_SSH"),
    };

    let cached = OVERRIDE_CACHE.with(|slot| {
        slot.borrow()
            .as_ref()
            .filter(|(cached_key, _)| cached_key == &key)
            .map(|(_, overrides)| overrides.clone())
    });
    if let Some(overrides) = cached {
        return overrides;
    }

    let overrides = discover_overrides(&base);
    OVERRIDE_CACHE.with(|slot| {
        *slot.borrow_mut() = Some((key, overrides.clone()));
    });
    overrides
}

fn discover_overrides(base: &impl Fn() -> Command) -> RepoOverrides {
    let credential_helpers = query_trusted_values(base, "credential.helper").unwrap_or_default();
    let ssh_values = query_trusted_values(base, "core.sshCommand").unwrap_or_default();
    RepoOverrides {
        credential_helpers,
        ssh_command: ssh_command_from_trusted(&ssh_values, std::env::var_os("GIT_SSH").as_deref()),
    }
}

fn query_trusted_values(base: &impl Fn() -> Command, key: &str) -> Option<Vec<String>> {
    let mut command = base();
    prepare_discovery_command(&mut command);
    command.args(["config", "--show-scope", "--get-all", key]);

    let output = command.output().ok()?;
    if !output.status.success() && !output.stdout.is_empty() {
        return None;
    }

    Some(trusted_values(&String::from_utf8_lossy(&output.stdout)))
}

fn prepare_discovery_command(command: &mut Command) {
    let hooks = git_config_path(inert_hooks_dir());
    let dir = inert_hooks_dir();
    command
        .args(["-c", "core.fsmonitor=false"])
        .args(["-c", "protocol.ext.allow=never"])
        .arg("-c")
        .arg(format!("core.hooksPath={hooks}"))
        .args(["-c", "alias.config="])
        .env("GIT_DIR", dir)
        .current_dir(dir);
}

fn push_overrides(command: &mut Command, overrides: &RepoOverrides) {
    let hooks = git_config_path(inert_hooks_dir());
    command
        .args(["-c", "core.fsmonitor=false"])
        .args(["-c", "protocol.ext.allow=never"])
        .arg("-c")
        .arg(format!("core.hooksPath={hooks}"));

    for name in HARDENED_ALIASES {
        command.arg("-c").arg(format!("alias.{name}="));
    }

    // Empty `core.sshCommand` does not fall back to OpenSSH; git tries to
    // execute a zero-length program. Replay the trusted command instead.
    command
        .arg("-c")
        .arg(format!("core.sshCommand={}", overrides.ssh_command));

    // An empty helper resets the list, which drops a repo-local helper.
    // System and global helpers are appended again so push and pull still
    // use the user's own credential helper.
    command.args(["-c", "credential.helper="]);
    for helper in &overrides.credential_helpers {
        command.arg("-c").arg(format!("credential.helper={helper}"));
    }
}

fn trusted_values(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| {
            let (scope, value) = line.split_once('\t')?;
            TRUSTED_SCOPES.contains(&scope).then(|| value.to_string())
        })
        .collect()
}

fn ssh_command_from_trusted(values: &[String], git_ssh: Option<&OsStr>) -> String {
    if let Some(value) = values.iter().rev().find(|value| !value.is_empty()) {
        return value.clone();
    }

    if let Some(git_ssh) = git_ssh {
        let value = git_ssh.to_string_lossy();
        if !value.trim().is_empty() {
            return value.into_owned();
        }
    }

    "ssh".to_string()
}

fn inert_hooks_dir() -> &'static Path {
    static DIR: OnceLock<PathBuf> = OnceLock::new();
    DIR.get_or_init(|| {
        tempfile::Builder::new()
            .prefix("rhizome-git-hooks-")
            .tempdir()
            .map(tempfile::TempDir::keep)
            .unwrap_or_else(|_| fallback_hooks_dir())
    })
}

fn fallback_hooks_dir() -> PathBuf {
    let path = std::env::temp_dir().join("rhizome-git-hooks");
    let _ = std::fs::create_dir_all(&path);
    path
}

fn git_config_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn command_env(command: &Command, name: &str) -> Option<OsString> {
    for (key, value) in command.get_envs() {
        if key == name {
            return value.map(OsStr::to_os_string);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_helpers_keep_system_and_global_only() {
        let stdout = "\
system\tosxkeychain
global\t
global\tmanager
local\t!/tmp/evil
worktree\t!/tmp/also-evil
command\t
";
        assert_eq!(
            trusted_values(stdout),
            vec![
                "osxkeychain".to_string(),
                String::new(),
                "manager".to_string()
            ]
        );
    }

    #[test]
    fn ssh_command_uses_last_non_empty_trusted_value() {
        let values = trusted_values(
            "\
system\tsystem-ssh
global\tssh -o BatchMode=yes
local\ttouch /tmp/x
",
        );
        assert_eq!(
            ssh_command_from_trusted(&values, Some(OsStr::new("/usr/bin/custom-ssh"))),
            "ssh -o BatchMode=yes"
        );
    }

    #[test]
    fn ssh_command_prefers_git_ssh_over_a_repo_local_value() {
        let values = trusted_values("local\ttouch /tmp/x\n");
        assert_eq!(
            ssh_command_from_trusted(&values, Some(OsStr::new("/usr/bin/custom-ssh"))),
            "/usr/bin/custom-ssh"
        );
        assert_eq!(ssh_command_from_trusted(&values, None), "ssh");
    }
}
