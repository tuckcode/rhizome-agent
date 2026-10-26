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
const GPG_OPENPGP_PROGRAM: &str = "gpg.openpgp.program";
const GPG_SSH_DEFAULT_KEY_COMMAND: &str = "gpg.ssh.defaultKeyCommand";
const ALTERNATE_REFS_COMMAND: &str = "core.alternateRefsCommand";
const ASK_PASS: &str = "core.askPass";
const GIT_PROXY: &str = "core.gitProxy";

const DISCOVERY_PATTERN: &str = r"^(credential\..*helper|core\.(sshcommand|alternaterefscommand|gitproxy|askpass)|filter\..*\.(clean|smudge|process)|merge\..*\.driver|gpg\.(program|ssh\.program|ssh\.defaultkeycommand|x509\.program|openpgp\.program))$";

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
    git_proxy_command: Option<OsString>,
    git_askpass: Option<OsString>,
}

#[derive(Clone)]
struct RepoOverrides {
    /// System and global `credential.*helper` entries, in git's order.
    credential_helpers: Vec<(String, String)>,
    /// Filter and merge commands. A trusted value is replayed. Otherwise the
    /// key is set empty so a repo-local command cannot run.
    command_overrides: Vec<(String, String)>,
    gpg_program: String,
    gpg_ssh_program: String,
    gpg_x509_program: String,
    gpg_openpgp_program: String,
    gpg_ssh_default_key_command: String,
    alternate_refs_command: String,
    /// `None` leaves an existing `GIT_ASKPASS` in place.
    ask_pass: Option<String>,
    /// `None` leaves an existing `GIT_PROXY_COMMAND` in place. Empty disables it.
    git_proxy_command: Option<String>,
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
        git_proxy_command: std::env::var_os("GIT_PROXY_COMMAND"),
        git_askpass: std::env::var_os("GIT_ASKPASS"),
    }
}

fn discover_overrides(
    base: &impl Fn() -> Command,
    repo: Option<&Path>,
) -> Result<RepoOverrides, String> {
    let entries = query_scoped_entries(base, repo, DISCOVERY_PATTERN)?;

    let credential_helpers = entries
        .iter()
        .filter(|entry| is_trusted(entry) && is_credential_helper(&entry.key))
        .map(|entry| (entry.key.clone(), entry.value.clone()))
        .collect();

    Ok(RepoOverrides {
        credential_helpers,
        command_overrides: filter_and_merge_overrides(&entries),
        gpg_program: trusted_or_default(&entries, GPG_PROGRAM, "gpg"),
        gpg_ssh_program: trusted_or_default(&entries, GPG_SSH_PROGRAM, "ssh-keygen"),
        gpg_x509_program: trusted_or_default(&entries, GPG_X509_PROGRAM, "gpgsm"),
        gpg_openpgp_program: trusted_or_default(&entries, GPG_OPENPGP_PROGRAM, "gpg"),
        gpg_ssh_default_key_command: trusted_or_default(&entries, GPG_SSH_DEFAULT_KEY_COMMAND, ""),
        alternate_refs_command: trusted_or_default(&entries, ALTERNATE_REFS_COMMAND, ""),
        ask_pass: ask_pass_override(&entries),
        git_proxy_command: git_proxy_override(&entries),
        git_ssh_command: git_ssh_command_override(&entries),
    })
}

fn filter_and_merge_overrides(entries: &[ScopedEntry]) -> Vec<(String, String)> {
    let mut keys = Vec::new();
    for entry in entries {
        if is_repo_scope(entry)
            && is_blanked_repo_command(&entry.key)
            && !keys.iter().any(|key| key == &entry.key)
        {
            keys.push(entry.key.clone());
        }
    }
    keys.into_iter()
        .map(|key| {
            let value = trusted_value(entries, &key).unwrap_or_default();
            (key, value)
        })
        .collect()
}

fn ask_pass_override(entries: &[ScopedEntry]) -> Option<String> {
    if std::env::var_os("GIT_ASKPASS").is_some_and(|value| !value.is_empty()) {
        return None;
    }
    Some(trusted_value(entries, ASK_PASS).unwrap_or_default())
}

fn git_proxy_override(entries: &[ScopedEntry]) -> Option<String> {
    if std::env::var_os("GIT_PROXY_COMMAND").is_some_and(|value| !value.is_empty()) {
        return None;
    }
    // An empty GIT_PROXY_COMMAND disables core.gitProxy. A later `-c` value
    // does not, because git keeps the first proxy it finds.
    Some(trusted_value(entries, GIT_PROXY).unwrap_or_default())
}

fn query_scoped_entries(
    base: &impl Fn() -> Command,
    repo: Option<&Path>,
    pattern: &str,
) -> Result<Vec<ScopedEntry>, String> {
    let mut command = base();
    prepare_discovery_command(&mut command, repo)?;
    command.args(["config", "-z", "--show-scope", "--get-regexp", pattern]);

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
        Some(0) => parse_show_scope_z(stdout),
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

    for (key, value) in &overrides.command_overrides {
        command.arg("-c").arg(format!("{key}={value}"));
    }

    command
        .arg("-c")
        .arg(format!("{GPG_PROGRAM}={}", overrides.gpg_program))
        .arg("-c")
        .arg(format!("{GPG_SSH_PROGRAM}={}", overrides.gpg_ssh_program))
        .arg("-c")
        .arg(format!("{GPG_X509_PROGRAM}={}", overrides.gpg_x509_program))
        .arg("-c")
        .arg(format!(
            "{GPG_OPENPGP_PROGRAM}={}",
            overrides.gpg_openpgp_program
        ))
        .arg("-c")
        .arg(format!(
            "{GPG_SSH_DEFAULT_KEY_COMMAND}={}",
            overrides.gpg_ssh_default_key_command
        ))
        .arg("-c")
        .arg(format!(
            "{ALTERNATE_REFS_COMMAND}={}",
            overrides.alternate_refs_command
        ));
    if let Some(ask_pass) = &overrides.ask_pass {
        command.arg("-c").arg(format!("{ASK_PASS}={ask_pass}"));
    }
    if let Some(proxy) = &overrides.git_proxy_command {
        command.env("GIT_PROXY_COMMAND", proxy);
    }

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

/// `git config -z --show-scope` records are `scope\0key\nvalue\0`.
/// Values may contain newlines, and keys may contain spaces.
fn parse_show_scope_z(bytes: &[u8]) -> Result<Vec<ScopedEntry>, String> {
    let mut entries = Vec::new();
    let mut rest = bytes;
    while !rest.is_empty() {
        let Some(scope_end) = rest.iter().position(|byte| *byte == 0) else {
            break;
        };
        let scope = utf8_config(&rest[..scope_end])?;
        rest = &rest[scope_end + 1..];
        if rest.is_empty() {
            break;
        }
        let Some(record_end) = rest.iter().position(|byte| *byte == 0) else {
            return Err("git config output ended inside a value.".to_string());
        };
        let record = &rest[..record_end];
        rest = &rest[record_end + 1..];
        let Some(newline) = record.iter().position(|byte| *byte == b'\n') else {
            return Err("git config output is missing the key/value separator.".to_string());
        };
        let key = utf8_config(&record[..newline])?;
        let value = utf8_config(&record[newline + 1..])?;
        if scope.is_empty() || key.is_empty() {
            continue;
        }
        entries.push(ScopedEntry { scope, key, value });
    }
    Ok(entries)
}

fn utf8_config(bytes: &[u8]) -> Result<String, String> {
    String::from_utf8(bytes.to_vec()).map_err(|_| "git config output is not UTF-8.".to_string())
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

    fn z_records(records: &[(&str, &str, &str)]) -> Vec<u8> {
        let mut bytes = Vec::new();
        for (scope, key, value) in records {
            bytes.extend(scope.as_bytes());
            bytes.push(0);
            bytes.extend(key.as_bytes());
            bytes.push(b'\n');
            bytes.extend(value.as_bytes());
            bytes.push(0);
        }
        bytes
    }

    #[test]
    fn credential_regexp_keeps_system_and_global_url_helpers_in_order() {
        let bytes = z_records(&[
            ("system", "credential.helper", "osxkeychain"),
            ("global", "credential.helper", ""),
            (
                "global",
                "credential.https://github.com/foo bar.helper",
                "!gh auth git-credential",
            ),
            (
                "local",
                "credential.https://github.com.helper",
                "!/tmp/evil",
            ),
            ("worktree", "credential.helper", "!/tmp/also"),
        ]);
        let entries = parse_show_scope_z(&bytes).unwrap();
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
                    "credential.https://github.com/foo bar.helper",
                    "!gh auth git-credential"
                ),
            ]
        );
    }

    #[test]
    fn newline_in_a_local_value_does_not_forge_a_global_helper() {
        let payload = "harmless\nglobal\tcredential.helper !/tmp/evil";
        let bytes = z_records(&[("local", "filter.x.clean", payload)]);
        let entries = parse_show_scope_z(&bytes).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].key, "filter.x.clean");
        assert_eq!(entries[0].value, payload);
        assert!(entries
            .iter()
            .all(|entry| !is_credential_helper(&entry.key)));
    }

    #[test]
    fn trusted_filter_value_is_replayed_and_local_only_filter_is_blank() {
        let bytes = z_records(&[
            ("global", "filter.lfs.clean", "git-lfs clean -- %f"),
            ("local", "filter.lfs.clean", "/tmp/evil"),
            ("local", "filter.evil.clean", "/tmp/clean"),
            ("local", "merge.ours.driver", "/tmp/merge"),
            ("global", "merge.ours.driver", "true"),
        ]);
        let entries = parse_show_scope_z(&bytes).unwrap();
        let overrides = filter_and_merge_overrides(&entries);
        assert_eq!(
            overrides,
            vec![
                (
                    "filter.lfs.clean".to_string(),
                    "git-lfs clean -- %f".to_string()
                ),
                ("filter.evil.clean".to_string(), String::new()),
                ("merge.ours.driver".to_string(), "true".to_string()),
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
    fn gpg_program_uses_the_last_trusted_value() {
        let entries = parse_show_scope_z(&z_records(&[
            ("system", "gpg.program", "/usr/bin/gpg2"),
            ("global", "gpg.program", "/opt/gpg"),
            ("local", "gpg.program", "/tmp/evil"),
        ]))
        .unwrap();
        assert_eq!(trusted_or_default(&entries, GPG_PROGRAM, "gpg"), "/opt/gpg");
        let local_only =
            parse_show_scope_z(&z_records(&[("local", "gpg.program", "/tmp/evil")])).unwrap();
        assert_eq!(trusted_or_default(&local_only, GPG_PROGRAM, "gpg"), "gpg");
        let openpgp = parse_show_scope_z(&z_records(&[(
            "global",
            "gpg.openpgp.program",
            "/opt/gpg-openpgp",
        )]))
        .unwrap();
        assert_eq!(
            trusted_or_default(&openpgp, GPG_OPENPGP_PROGRAM, "gpg"),
            "/opt/gpg-openpgp"
        );
    }
}
