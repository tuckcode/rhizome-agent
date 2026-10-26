//! Command-line overrides for git config that can execute code.
//!
//! A vault folder copied or synced in can carry a hostile `.git/config`.
//! `git_command_in` applies these overrides on every invocation so that file
//! cannot win over the user's system and global config.
//!
//! Git 2.26 or newer is required. `git config --show-scope` arrived in 2.26,
//! and `--end-of-options` (used for commit revisions) arrived in 2.24.

use std::cell::RefCell;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

const TRUSTED_SCOPES: [&str; 2] = ["system", "global"];
const REPO_SCOPES: [&str; 2] = ["local", "worktree"];
const MIN_GIT_VERSION: (u32, u32) = (2, 26);
const CACHE_TTL: Duration = Duration::from_secs(2);

const GPG_PROGRAM: &str = "gpg.program";
const GPG_SSH_PROGRAM: &str = "gpg.ssh.program";
const GPG_X509_PROGRAM: &str = "gpg.x509.program";

#[derive(Clone, PartialEq, Eq)]
struct CacheKey {
    repo: Option<PathBuf>,
    global_config: Option<OsString>,
    system_config: Option<OsString>,
    global_fingerprint: Option<u64>,
    system_fingerprint: Option<u64>,
    repo_fingerprint: Option<u64>,
    git_ssh: Option<OsString>,
    git_ssh_command_set: bool,
}

#[derive(Clone)]
struct RepoOverrides {
    /// System and global `credential.*helper` entries, in git's order.
    credential_helpers: Vec<(String, String)>,
    /// Repo-local filter and merge commands to set empty.
    blanked_keys: Vec<String>,
    gpg_program: String,
    gpg_ssh_program: String,
    gpg_x509_program: String,
    /// When set, assigned to `GIT_SSH_COMMAND` so it outranks repo config.
    git_ssh_command: Option<String>,
}

struct CacheSlot {
    key: CacheKey,
    at: Instant,
    overrides: RepoOverrides,
}

thread_local! {
    static OVERRIDE_CACHE: RefCell<Option<CacheSlot>> = const { RefCell::new(None) };
}

pub(super) fn apply_untrusted_repo_overrides(
    command: &mut Command,
    base: impl Fn() -> Command,
    repo: Option<&Path>,
) -> Result<(), String> {
    ensure_git_version(&base)?;
    let overrides = cached_overrides(command, &base, repo)?;
    push_overrides(command, &overrides)?;
    Ok(())
}

fn cached_overrides(
    command: &Command,
    base: &impl Fn() -> Command,
    repo: Option<&Path>,
) -> Result<RepoOverrides, String> {
    let key = cache_key(command, repo);
    let cached = OVERRIDE_CACHE.with(|slot| {
        slot.borrow().as_ref().and_then(|cached| {
            (cached.key == key && cached.at.elapsed() < CACHE_TTL).then(|| cached.overrides.clone())
        })
    });
    if let Some(overrides) = cached {
        return Ok(overrides);
    }

    let overrides = discover_overrides(base, repo)?;
    OVERRIDE_CACHE.with(|slot| {
        *slot.borrow_mut() = Some(CacheSlot {
            key,
            at: Instant::now(),
            overrides: overrides.clone(),
        });
    });
    Ok(overrides)
}

fn cache_key(command: &Command, repo: Option<&Path>) -> CacheKey {
    let global_config = command_env(command, "GIT_CONFIG_GLOBAL");
    let system_config = command_env(command, "GIT_CONFIG_SYSTEM");
    CacheKey {
        repo: repo.map(Path::to_path_buf),
        global_fingerprint: global_config.as_deref().and_then(file_fingerprint),
        system_fingerprint: system_config.as_deref().and_then(file_fingerprint),
        repo_fingerprint: repo.and_then(repo_config_fingerprint),
        global_config,
        system_config,
        git_ssh: std::env::var_os("GIT_SSH"),
        git_ssh_command_set: std::env::var_os("GIT_SSH_COMMAND").is_some(),
    }
}

fn discover_overrides(
    base: &impl Fn() -> Command,
    repo: Option<&Path>,
) -> Result<RepoOverrides, String> {
    let entries = query_scoped_entries(
        base,
        repo,
        r"^(credential\..*helper|core\.sshcommand|filter\..*\.(clean|smudge|process)|merge\..*\.driver|gpg\.(program|ssh\.program|x509\.program))$",
    )?;

    let credential_helpers = entries
        .iter()
        .filter(|entry| is_trusted(entry) && is_credential_helper(&entry.key))
        .map(|entry| (entry.key.clone(), entry.value.clone()))
        .collect();

    let mut blanked_keys = Vec::new();
    for entry in &entries {
        if is_repo_scope(entry)
            && is_blanked_repo_command(&entry.key)
            && !blanked_keys.iter().any(|key| key == &entry.key)
        {
            blanked_keys.push(entry.key.clone());
        }
    }

    Ok(RepoOverrides {
        credential_helpers,
        blanked_keys,
        gpg_program: trusted_or_default(&entries, GPG_PROGRAM, "gpg"),
        gpg_ssh_program: trusted_or_default(&entries, GPG_SSH_PROGRAM, "ssh-keygen"),
        gpg_x509_program: trusted_or_default(&entries, GPG_X509_PROGRAM, "gpgsm"),
        git_ssh_command: git_ssh_command_override(&entries),
    })
}

fn query_scoped_entries(
    base: &impl Fn() -> Command,
    repo: Option<&Path>,
    pattern: &str,
) -> Result<Vec<ScopedEntry>, String> {
    let mut command = base();
    prepare_discovery_command(&mut command, repo)?;
    command.args(["config", "--show-scope", "--get-regexp", pattern]);

    let output = command
        .output()
        .map_err(|error| format!("Failed to read git config: {error}"))?;
    entries_from_config_output(output.status.code(), &output.stdout, &output.stderr)
}

fn entries_from_config_output(
    code: Option<i32>,
    stdout: &[u8],
    stderr: &[u8],
) -> Result<Vec<ScopedEntry>, String> {
    match code {
        Some(0) => Ok(parse_show_scope(&String::from_utf8_lossy(stdout))),
        // `git config --get-regexp` exits 1 when nothing matches.
        Some(1) => Ok(Vec::new()),
        Some(code) => Err(format!(
            "git config failed (exit {code}): {}",
            String::from_utf8_lossy(stderr).trim()
        )),
        None => Err("git config failed: terminated by a signal.".to_string()),
    }
}

fn prepare_discovery_command(command: &mut Command, repo: Option<&Path>) -> Result<(), String> {
    let hooks = hooks_dir()?;
    command
        .args(["-c", "core.fsmonitor=false"])
        .args(["-c", "protocol.ext.allow=never"])
        .arg("-c")
        .arg(format!("core.hooksPath={}", git_config_path(hooks)))
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE");
    // `includeIf gitdir:` is matched against the repo we are about to use.
    // A non-repo directory is only for commands that are not inside a vault.
    let cwd = repo.unwrap_or(hooks);
    command.current_dir(cwd);
    Ok(())
}

fn push_overrides(command: &mut Command, overrides: &RepoOverrides) -> Result<(), String> {
    let hooks = git_config_path(hooks_dir()?);
    command
        .args(["-c", "core.fsmonitor=false"])
        .args(["-c", "protocol.ext.allow=never"])
        .arg("-c")
        .arg(format!("core.hooksPath={hooks}"));

    // An empty generic helper resets every helper, including URL-scoped ones
    // such as `credential.https://github.com.helper`. Replay the trusted
    // entries after that reset, each under its own key.
    command.args(["-c", "credential.helper="]);
    for (key, value) in &overrides.credential_helpers {
        command.arg("-c").arg(format!("{key}={value}"));
    }

    for key in &overrides.blanked_keys {
        command.arg("-c").arg(format!("{key}="));
    }

    command
        .arg("-c")
        .arg(format!("{GPG_PROGRAM}={}", overrides.gpg_program))
        .arg("-c")
        .arg(format!("{GPG_SSH_PROGRAM}={}", overrides.gpg_ssh_program))
        .arg("-c")
        .arg(format!("{GPG_X509_PROGRAM}={}", overrides.gpg_x509_program));

    if let Some(ssh_command) = &overrides.git_ssh_command {
        command.env("GIT_SSH_COMMAND", ssh_command);
    }
    Ok(())
}

fn git_ssh_command_override(entries: &[ScopedEntry]) -> Option<String> {
    // An existing GIT_SSH_COMMAND already outranks repo `core.sshCommand`.
    if std::env::var_os("GIT_SSH_COMMAND").is_some() {
        return None;
    }

    if let Some(value) = trusted_value(entries, "core.sshcommand") {
        if !value.is_empty() {
            return Some(value);
        }
    }

    if let Some(git_ssh) = std::env::var_os("GIT_SSH") {
        let value = git_ssh.to_string_lossy();
        if !value.trim().is_empty() {
            // `GIT_SSH` is a program path. `GIT_SSH_COMMAND` is a shell string,
            // so a path such as `C:\Program Files\PuTTY\plink.exe` must be quoted.
            return Some(shell_quote(value.trim()));
        }
    }

    Some("ssh".to_string())
}

fn trusted_or_default(entries: &[ScopedEntry], key: &str, default: &str) -> String {
    trusted_value(entries, key)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default.to_string())
}

fn trusted_value(entries: &[ScopedEntry], key: &str) -> Option<String> {
    entries.iter().rev().find_map(|entry| {
        (is_trusted(entry) && entry.key.eq_ignore_ascii_case(key) && !entry.value.is_empty())
            .then(|| entry.value.clone())
    })
}

fn is_trusted(entry: &ScopedEntry) -> bool {
    TRUSTED_SCOPES
        .iter()
        .any(|scope| entry.scope.eq_ignore_ascii_case(scope))
}

fn is_repo_scope(entry: &ScopedEntry) -> bool {
    REPO_SCOPES
        .iter()
        .any(|scope| entry.scope.eq_ignore_ascii_case(scope))
}

fn is_credential_helper(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    key == "credential.helper" || (key.starts_with("credential.") && key.ends_with(".helper"))
}

fn is_blanked_repo_command(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    let filter = key.strip_prefix("filter.").is_some_and(|rest| {
        rest.ends_with(".clean") || rest.ends_with(".smudge") || rest.ends_with(".process")
    });
    let merge = key
        .strip_prefix("merge.")
        .is_some_and(|rest| rest.ends_with(".driver") && rest != "driver");
    filter || merge
}

#[derive(Debug)]
struct ScopedEntry {
    scope: String,
    key: String,
    value: String,
}

fn parse_show_scope(stdout: &str) -> Vec<ScopedEntry> {
    stdout
        .lines()
        .filter_map(|line| {
            let (scope, rest) = line.split_once('\t')?;
            let (key, value) = rest.split_once(' ').unwrap_or((rest, ""));
            if scope.is_empty() || key.is_empty() {
                return None;
            }
            Some(ScopedEntry {
                scope: scope.to_string(),
                key: key.to_string(),
                value: value.to_string(),
            })
        })
        .collect()
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

fn ensure_git_version(base: &impl Fn() -> Command) -> Result<(), String> {
    static CHECK: OnceLock<Result<(), String>> = OnceLock::new();
    match CHECK.get_or_init(|| read_git_version(base)).clone() {
        Ok(()) => Ok(()),
        Err(message) => Err(message),
    }
}

fn read_git_version(base: &impl Fn() -> Command) -> Result<(), String> {
    let output = base()
        .arg("--version")
        .output()
        .map_err(|error| format!("Failed to run git --version: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "git --version failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let Some((major, minor)) = parse_git_version(&stdout) else {
        return Err(format!("Could not read the git version from `{stdout}`."));
    };
    if major > MIN_GIT_VERSION.0 || (major == MIN_GIT_VERSION.0 && minor >= MIN_GIT_VERSION.1) {
        return Ok(());
    }
    Err(format!(
        "Git {major}.{minor} is too old. Git {}.{} or newer is required.",
        MIN_GIT_VERSION.0, MIN_GIT_VERSION.1
    ))
}

fn parse_git_version(stdout: &str) -> Option<(u32, u32)> {
    let rest = stdout.trim().strip_prefix("git version ")?;
    let mut numbers = rest.split(|character: char| !character.is_ascii_digit());
    let major = numbers.next()?.parse().ok()?;
    let minor = numbers.next()?.parse().ok()?;
    Some((major, minor))
}

fn hooks_dir() -> Result<&'static Path, String> {
    static DIR: OnceLock<tempfile::TempDir> = OnceLock::new();
    if let Some(dir) = DIR.get() {
        return Ok(dir.path());
    }
    let created = tempfile::Builder::new()
        .prefix("rhizome-git-hooks-")
        .tempdir()
        .map_err(|error| format!("Failed to create an empty git hooks directory: {error}"))?;
    Ok(DIR.get_or_init(|| created).path())
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

fn file_fingerprint(path: &OsStr) -> Option<u64> {
    fingerprint_bytes(&std::fs::read(Path::new(path)).ok()?)
}

fn repo_config_fingerprint(repo: &Path) -> Option<u64> {
    let config = std::fs::read(repo.join(".git/config")).ok()?;
    let worktree = std::fs::read(repo.join(".git/config.worktree")).unwrap_or_default();
    let mut bytes = config;
    bytes.extend(worktree);
    fingerprint_bytes(&bytes)
}

fn fingerprint_bytes(bytes: &[u8]) -> Option<u64> {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    Some(hash ^ bytes.len() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_regexp_keeps_system_and_global_url_helpers_in_order() {
        let stdout = "\
system\tcredential.helper osxkeychain
global\tcredential.helper 
global\tcredential.https://github.com.helper !gh auth git-credential
local\tcredential.https://github.com.helper !/tmp/evil
worktree\tcredential.helper !/tmp/also
";
        let entries = parse_show_scope(stdout);
        let helpers: Vec<_> = entries
            .iter()
            .filter(|entry| is_trusted(entry) && is_credential_helper(&entry.key))
            .map(|entry| (entry.key.as_str(), entry.value.as_str()))
            .collect();
        assert_eq!(
            helpers,
            vec![
                ("credential.helper", "osxkeychain"),
                ("credential.helper", ""),
                (
                    "credential.https://github.com.helper",
                    "!gh auth git-credential"
                ),
            ]
        );
    }

    #[test]
    fn blanked_keys_are_repo_filter_and_merge_commands_only() {
        let stdout = "\
local\tfilter.evil.clean /tmp/clean
local\tfilter.evil.smudge /tmp/smudge
local\tfilter.evil.process /tmp/process
worktree\tmerge.evil.driver /tmp/merge
local\tdiff.evil.command /tmp/diff
local\tdiff.evil.textconv /tmp/textconv
global\tfilter.lfs.clean git-lfs
";
        let entries = parse_show_scope(stdout);
        let blanked: Vec<_> = entries
            .iter()
            .filter(|entry| is_repo_scope(entry) && is_blanked_repo_command(&entry.key))
            .map(|entry| entry.key.as_str())
            .collect();
        assert_eq!(
            blanked,
            vec![
                "filter.evil.clean",
                "filter.evil.smudge",
                "filter.evil.process",
                "merge.evil.driver",
            ]
        );
    }

    #[test]
    fn exit_one_from_git_config_means_no_values() {
        let entries = entries_from_config_output(Some(1), b"", b"").unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn other_git_config_failures_are_errors() {
        let error = entries_from_config_output(Some(128), b"", b"fatal: bad config").unwrap_err();
        assert!(error.contains("exit 128"), "{error}");
        assert!(error.contains("bad config"), "{error}");
        assert!(entries_from_config_output(None, b"", b"").is_err());
    }

    #[test]
    fn git_version_parser_accepts_windows_suffixes() {
        assert_eq!(parse_git_version("git version 2.47.0\n"), Some((2, 47)));
        assert_eq!(
            parse_git_version("git version 2.39.2.windows.1\n"),
            Some((2, 39))
        );
        assert_eq!(parse_git_version("git version 2.25.1\n"), Some((2, 25)));
    }

    #[test]
    fn shell_quote_keeps_windows_paths_together() {
        assert_eq!(
            shell_quote(r"C:\Program Files\PuTTY\plink.exe"),
            r"'C:\Program Files\PuTTY\plink.exe'"
        );
    }

    #[test]
    fn gpg_program_prefers_the_trusted_value() {
        let entries = parse_show_scope(
            "\
system\tgpg.program /usr/bin/gpg2
local\tgpg.program /tmp/evil
",
        );
        assert_eq!(
            trusted_or_default(&entries, GPG_PROGRAM, "gpg"),
            "/usr/bin/gpg2"
        );
        assert_eq!(
            trusted_or_default(
                &parse_show_scope("local\tgpg.program /tmp/evil\n"),
                GPG_PROGRAM,
                "gpg"
            ),
            "gpg"
        );
    }
}
