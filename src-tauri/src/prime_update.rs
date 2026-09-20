//! Real-update check and consent-gated apply for the Chat engine (`prime-agent`).
//!
//! Rhizome does not ship the Chat engine binary — it is installed
//! independently (npm, Homebrew, mise, asdf, or a manual binary, per
//! `prime_discovery.rs`). There is no reliable way for Rhizome to know
//! whether an npm-published `prime-agent` exists (the docs say `npm i -g
//! prime-agent`, but the package is not actually published to the npm
//! registry as of this writing — `registry.npmjs.org/prime-agent` 404s).
//! What *is* real and queryable is the project's GitHub Releases feed
//! (`PrimeIntellect-ai/prime-agent`), which carries a real tag and real,
//! human-written release notes. This module checks that feed and compares
//! it against the version Rhizome already learned from the daemon
//! handshake (`PrimeHostStatus.version`).
//!
//! The Chat engine must never update itself unattended (a model changing
//! behaviour underneath the user needs explicit consent). `check_prime_update`
//! only reports an available version. `apply_prime_update` runs the CLI
//! update only when the UI invokes it after a click.

use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const CHAT_BUSY_ERR: &str = "Chat is still answering. Wait until the reply finishes, then update.";
const CHOOSE_UPDATE_ERR: &str = "Choose an update first.";
const NOT_INSTALLED_ERR: &str = "Chat engine is not installed.";
const STALE_OFFER_ERR: &str = "That update offer is stale. Check again.";
const NPM_UPDATE_ERR: &str =
    "Could not update the Chat engine. Try again, or run npm i -g prime-agent@latest in Terminal.";
const HOMEBREW_UPDATE_ERR: &str =
    "Could not update the Chat engine. Try again, or run brew upgrade prime-agent in Terminal.";
const RELEASE_PAGE_UPDATE_ERR: &str =
    "Could not update the Chat engine. Try again, or update it from the release page.";
const UPDATE_TIMEOUT: Duration = Duration::from_secs(180);

const PRIME_RELEASES_LATEST_URL: &str =
    "https://api.github.com/repos/PrimeIntellect-ai/prime-agent/releases/latest";
const USER_AGENT: &str = "rhizome-agent-update-check";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeReleaseInfo {
    /// The release version, without a leading `v` (e.g. `"0.7.2"`).
    pub version: String,
    /// The real release-notes body from GitHub, verbatim.
    pub notes: String,
    /// The real release page, so "Update now" can send the user there.
    pub url: String,
}

/// Strips a leading `v`/`V` from a git tag so it reads as a bare version.
fn strip_tag_prefix(tag: &str) -> &str {
    tag.strip_prefix(['v', 'V']).unwrap_or(tag)
}

/// Parses a numeric dot-separated version prefix (major.minor.patch, ...)
/// into comparable integer components, stopping at the first component
/// that isn't purely digits. That drops a `-beta.1` pre-release suffix
/// entirely rather than parsing its leading digit as a real component —
/// `0.7.2-beta.1` must not compare as newer than the `0.7.2` release it
/// precedes. Good enough to order ordinary release versions without
/// pulling in a full semver implementation for one comparison.
fn version_components(version: &str) -> Vec<u64> {
    version
        .split('.')
        .map_while(|part| part.parse::<u64>().ok())
        .collect()
}

/// True when `candidate` is a newer version than `installed`. Unparseable
/// or equal versions are not "newer" — an update prompt for a version we
/// can't confirm is newer would be worse than staying quiet.
pub fn is_newer_version(candidate: &str, installed: &str) -> bool {
    let candidate_parts = version_components(candidate);
    let installed_parts = version_components(installed);

    if candidate_parts.is_empty() || installed_parts.is_empty() {
        return false;
    }

    candidate_parts > installed_parts
}

#[derive(Debug, serde::Deserialize)]
struct GithubReleaseResponse {
    tag_name: String,
    body: Option<String>,
    html_url: String,
}

/// Parses the GitHub "latest release" API response into `PrimeReleaseInfo`.
/// Split out from the network fetch so it can be tested against a canned
/// response body without a live network call.
fn parse_release_response(body: &str) -> Result<PrimeReleaseInfo, String> {
    let release: GithubReleaseResponse = serde_json::from_str(body)
        .map_err(|error| format!("Failed to parse GitHub release: {error}"))?;

    Ok(PrimeReleaseInfo {
        version: strip_tag_prefix(&release.tag_name).to_string(),
        notes: release.body.unwrap_or_default(),
        url: release.html_url,
    })
}

/// Fetches the real latest Prime release from GitHub. Network errors and
/// non-2xx responses are reported as `Err`, never silently swallowed into
/// "no update" — a failed check is a different fact than "you're current".
fn fetch_latest_prime_release() -> Result<PrimeReleaseInfo, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))?;

    let response = client
        .get(PRIME_RELEASES_LATEST_URL)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|error| format!("Failed to reach GitHub: {error}"))?;

    let status = response.status();
    let text = response
        .text()
        .map_err(|error| format!("Failed to read GitHub response: {error}"))?;

    if !status.is_success() {
        return Err(format!("GitHub returned {status}"));
    }

    parse_release_response(&text)
}

/// Checks whether a newer Prime release is available than `installed_version`.
///
/// Returns `Ok(None)` when there is nothing to compare against (Prime not
/// yet connected so its version is unknown) or when the latest release is
/// not newer than what's installed. Returns `Err` only on an actual check
/// failure (network, parse) so the caller can tell "checked, none found"
/// apart from "couldn't check".
pub fn check_prime_update(
    installed_version: Option<&str>,
) -> Result<Option<PrimeReleaseInfo>, String> {
    let Some(installed_version) = installed_version.filter(|v| !v.trim().is_empty()) else {
        return Ok(None);
    };

    let latest = fetch_latest_prime_release()?;

    if is_newer_version(&latest.version, installed_version) {
        Ok(Some(latest))
    } else {
        Ok(None)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPrimeUpdateResult {
    pub previous_version: String,
    pub installed_version: String,
    pub method: String,
}

#[derive(Debug, Clone)]
struct UpdateCliOutput {
    stdout: String,
    stderr: String,
}

/// Detect the install method from a resolved or canonical binary path.
pub fn detect_install_method(path: &Path) -> &'static str {
    let normalized = path.to_string_lossy().replace('\\', "/");
    if normalized.contains("node_modules")
        || normalized.contains(".npm-global")
        || normalized.contains("AppData/Roaming/npm")
    {
        "npm"
    } else if normalized.contains("Cellar")
        || normalized.contains("homebrew")
        || normalized.contains("linuxbrew")
        || normalized.contains("/opt/homebrew")
    {
        "homebrew"
    } else if normalized.contains("mise") {
        "mise"
    } else if normalized.contains("asdf") {
        "asdf"
    } else {
        "unknown"
    }
}

fn surface_cli_error(error: String, method: &str) -> String {
    if error.contains("timed out")
        || error.contains("Could not start")
        || error.contains("Could not wait")
    {
        error
    } else {
        update_failure_message(method).to_string()
    }
}

fn update_failure_message(method: &str) -> &'static str {
    match method {
        "npm" => NPM_UPDATE_ERR,
        "homebrew" => HOMEBREW_UPDATE_ERR,
        _ => RELEASE_PAGE_UPDATE_ERR,
    }
}

fn versions_match(installed: &str, expected: &str) -> bool {
    strip_tag_prefix(installed.trim()) == strip_tag_prefix(expected.trim())
}

fn reports_already_latest(output: &UpdateCliOutput) -> bool {
    let combined = format!("{}\n{}", output.stdout, output.stderr).to_ascii_lowercase();
    combined.contains("already latest")
        || combined.contains("up to date")
        || combined.contains("up-to-date")
}

fn path_for_method(binary: &Path) -> PathBuf {
    std::fs::canonicalize(binary).unwrap_or_else(|_| binary.to_path_buf())
}

/// Refuse when Chat is mid-turn. The host streaming flag is the guard.
/// The client `chat_busy` flag is only an early hint.
fn refuse_busy_chat(chat_busy: bool, host_streaming: bool) -> Result<(), String> {
    if chat_busy || host_streaming {
        return Err(CHAT_BUSY_ERR.to_string());
    }
    Ok(())
}

/// Apply a Chat-engine update after the UI collects consent.
///
/// Never runs on its own. The Tauri command calls this only after a click.
/// The host streaming flag is the guard. The client `chat_busy` flag is
/// only an early hint.
pub fn apply_prime_update(
    expected_version: &str,
    chat_busy: bool,
) -> Result<ApplyPrimeUpdateResult, String> {
    refuse_busy_chat(chat_busy, crate::prime_session_host::is_streaming())?;
    apply_prime_update_with(
        expected_version,
        false,
        fetch_latest_prime_release,
        crate::prime_discovery::find_binary,
        run_prime_update_cli,
        crate::prime_discovery::installed_version_for,
        || {
            let _ = crate::prime_session_host::reload_attached_session();
        },
    )
}

fn apply_prime_update_with<Fetch, Find, Run, ReadVer, Reload>(
    expected_version: &str,
    chat_busy: bool,
    fetch_latest: Fetch,
    find_binary: Find,
    mut run_update: Run,
    mut read_version: ReadVer,
    reload: Reload,
) -> Result<ApplyPrimeUpdateResult, String>
where
    Fetch: FnOnce() -> Result<PrimeReleaseInfo, String>,
    Find: FnOnce() -> Result<PathBuf, String>,
    Run: FnMut(&Path, &[&str]) -> Result<UpdateCliOutput, String>,
    ReadVer: FnMut(&Path) -> Option<String>,
    Reload: FnOnce(),
{
    refuse_busy_chat(chat_busy, false)?;

    let expected_version = expected_version.trim();
    if expected_version.is_empty() {
        return Err(CHOOSE_UPDATE_ERR.to_string());
    }

    let binary = find_binary().map_err(|_| NOT_INSTALLED_ERR.to_string())?;
    let method = detect_install_method(&path_for_method(&binary));
    let latest = fetch_latest()?;
    if strip_tag_prefix(expected_version) != latest.version {
        return Err(STALE_OFFER_ERR.to_string());
    }

    let previous_version =
        strip_tag_prefix(read_version(&binary).as_deref().unwrap_or("").trim()).to_string();

    let first_output = match run_update(&binary, &["update"]) {
        Ok(output) => output,
        Err(error) => return Err(surface_cli_error(error, method)),
    };

    let mut installed_version =
        strip_tag_prefix(read_version(&binary).as_deref().unwrap_or("").trim()).to_string();

    if !versions_match(&installed_version, expected_version)
        && reports_already_latest(&first_output)
    {
        if let Err(error) = run_update(&binary, &["update", "--force"]) {
            return Err(surface_cli_error(error, method));
        }
        installed_version =
            strip_tag_prefix(read_version(&binary).as_deref().unwrap_or("").trim()).to_string();
    }

    if !versions_match(&installed_version, expected_version) {
        return Err(update_failure_message(method).to_string());
    }

    reload();

    Ok(ApplyPrimeUpdateResult {
        previous_version,
        installed_version,
        method: method.to_string(),
    })
}

fn run_prime_update_cli(binary: &Path, args: &[&str]) -> Result<UpdateCliOutput, String> {
    let target = crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(binary)?;
    let mut command = crate::hidden_command(&target.program);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, binary);
    if let Some(first_arg) = target.first_arg {
        command.arg(first_arg);
    }
    command.args(args);
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    let output = wait_for_update_command(command, UPDATE_TIMEOUT)?;
    Ok(UpdateCliOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

struct CommandOutput {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn wait_for_update_command(
    mut command: Command,
    timeout: Duration,
) -> Result<CommandOutput, String> {
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start the Chat engine update: {error}"))?;
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
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(
                        "Update timed out after 3 minutes. Try again, or update the Chat engine from Terminal."
                            .into(),
                    );
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                return Err(format!(
                    "Could not wait for the Chat engine update: {error}"
                ))
            }
        }
    }
    let stdout = stdout_handle.join().unwrap_or_default();
    let stderr = stderr_handle.join().unwrap_or_default();
    Ok(CommandOutput { stdout, stderr })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_a_leading_v_from_the_tag() {
        assert_eq!(strip_tag_prefix("v0.7.2"), "0.7.2");
        assert_eq!(strip_tag_prefix("V0.7.2"), "0.7.2");
        assert_eq!(strip_tag_prefix("0.7.2"), "0.7.2");
    }

    #[test]
    fn a_higher_patch_version_is_newer() {
        assert!(is_newer_version("0.7.2", "0.7.1"));
    }

    #[test]
    fn a_higher_minor_version_is_newer_even_with_a_lower_patch() {
        assert!(is_newer_version("0.8.0", "0.7.9"));
    }

    #[test]
    fn an_equal_version_is_not_newer() {
        assert!(!is_newer_version("0.7.2", "0.7.2"));
    }

    #[test]
    fn an_older_version_is_not_newer() {
        assert!(!is_newer_version("0.7.0", "0.7.2"));
    }

    #[test]
    fn an_unparseable_candidate_is_never_reported_as_newer() {
        assert!(!is_newer_version("not-a-version", "0.7.1"));
    }

    #[test]
    fn an_unparseable_installed_version_never_yields_a_prompt() {
        // We can't confirm we're newer than something we can't parse, so
        // stay quiet rather than guess.
        assert!(!is_newer_version("0.7.2", "unknown"));
    }

    #[test]
    fn a_prerelease_suffix_is_truncated_rather_than_misread_as_a_component() {
        // "0.7.2-beta.1" truncates to [0, 7] (the "2-beta" component isn't
        // purely numeric), so it compares as a *shorter* prefix of "0.7.1"
        // ([0, 7, 1]) rather than as version 2 of anything. That's a
        // conservative miss, not a wrong "newer" claim — which is the
        // property that matters: this never reports a pre-release tag as
        // newer than a release it actually precedes.
        assert!(!is_newer_version("0.7.2-beta.1", "0.7.1"));
        assert!(!is_newer_version("0.7.2-beta.1", "0.7.2"));
    }

    #[test]
    fn parses_a_real_shaped_github_release_response() {
        let body = r#"{
            "tag_name": "v0.7.2",
            "name": "v0.7.2",
            "body": "- Fixed a focus bug\n- Added a shortcut",
            "html_url": "https://github.com/PrimeIntellect-ai/prime-agent/releases/tag/v0.7.2"
        }"#;

        let release = parse_release_response(body).unwrap();

        assert_eq!(
            release,
            PrimeReleaseInfo {
                version: "0.7.2".into(),
                notes: "- Fixed a focus bug\n- Added a shortcut".into(),
                url: "https://github.com/PrimeIntellect-ai/prime-agent/releases/tag/v0.7.2".into(),
            }
        );
    }

    #[test]
    fn a_release_with_no_body_yields_empty_notes_rather_than_failing() {
        let body = r#"{
            "tag_name": "v0.7.2",
            "name": "v0.7.2",
            "body": null,
            "html_url": "https://github.com/PrimeIntellect-ai/prime-agent/releases/tag/v0.7.2"
        }"#;

        let release = parse_release_response(body).unwrap();
        assert_eq!(release.notes, "");
    }

    #[test]
    fn malformed_json_is_reported_as_an_error_not_swallowed() {
        assert!(parse_release_response("not json").is_err());
    }

    #[test]
    fn no_installed_version_means_nothing_to_check_against() {
        // We haven't yet connected to Prime, so we don't know what's
        // installed — this must not attempt a network call or guess.
        assert_eq!(check_prime_update(None), Ok(None));
        assert_eq!(check_prime_update(Some("")), Ok(None));
        assert_eq!(check_prime_update(Some("   ")), Ok(None));
    }

    /// Live smoke test against the real GitHub API — not run by default
    /// (network, non-deterministic wrt future releases). Run manually with
    /// `cargo test --lib prime_update -- --ignored --nocapture` to confirm
    /// the whole path against a real, currently-older installed version.
    #[test]
    #[ignore]
    fn a_real_older_installed_version_finds_the_real_latest_release() {
        let result = check_prime_update(Some("0.1.0")).expect("network check should succeed");
        let release = result.expect("0.1.0 should be older than whatever is currently released");
        println!("Live check found: {release:?}");
        assert!(!release.version.is_empty());
        assert!(!release.url.is_empty());
    }

    #[test]
    fn release_info_serializes_camel_case_for_the_frontend() {
        let info = PrimeReleaseInfo {
            version: "0.7.2".into(),
            notes: "Notes".into(),
            url: "https://example.com".into(),
        };

        assert_eq!(
            serde_json::to_value(&info).unwrap(),
            serde_json::json!({
                "version": "0.7.2",
                "notes": "Notes",
                "url": "https://example.com",
            })
        );
    }

    fn canned_latest(version: &str) -> PrimeReleaseInfo {
        PrimeReleaseInfo {
            version: version.into(),
            notes: "notes".into(),
            url: "https://example.com/releases".into(),
        }
    }

    fn apply_with(
        expected_version: &str,
        chat_busy: bool,
        latest: PrimeReleaseInfo,
        binary: Result<PathBuf, String>,
        run_update: impl FnMut(&Path, &[&str]) -> Result<UpdateCliOutput, String>,
        read_version: impl FnMut(&Path) -> Option<String>,
        reload: impl FnOnce(),
    ) -> Result<ApplyPrimeUpdateResult, String> {
        apply_prime_update_with(
            expected_version,
            chat_busy,
            || Ok(latest),
            || binary,
            run_update,
            read_version,
            reload,
        )
    }

    #[test]
    fn apply_refuses_when_chat_is_busy_without_looking_up_the_binary() {
        let error = apply_prime_update_with(
            "0.9.4",
            true,
            || panic!("must not fetch when chat is busy"),
            || panic!("must not look up the binary when chat is busy"),
            |_binary, _args| panic!("must not spawn the CLI when chat is busy"),
            |_binary| panic!("must not read a version when chat is busy"),
            || panic!("must not reload when chat is busy"),
        )
        .expect_err("busy chat must refuse");

        assert_eq!(error, CHAT_BUSY_ERR);
    }

    #[test]
    fn apply_refuses_when_the_host_is_streaming_even_if_the_client_says_idle() {
        let error = refuse_busy_chat(false, true).expect_err("host streaming must refuse");
        assert_eq!(error, CHAT_BUSY_ERR);
        assert!(refuse_busy_chat(false, false).is_ok());
    }

    #[test]
    fn apply_refuses_an_empty_expected_version() {
        for expected in ["", "   ", "\n"] {
            let error = apply_prime_update_with(
                expected,
                false,
                || panic!("must not fetch without an expected version"),
                || panic!("must not look up the binary without an expected version"),
                |_binary, _args| panic!("must not spawn the CLI without an expected version"),
                |_binary| panic!("must not read a version without an expected version"),
                || panic!("must not reload without an expected version"),
            )
            .expect_err("empty expected version must refuse");

            assert_eq!(error, CHOOSE_UPDATE_ERR);
        }
    }

    #[test]
    fn detects_install_method_from_resolved_path() {
        let cases = [
            (
                "/usr/local/lib/node_modules/prime-agent/bin/prime-agent",
                "npm",
            ),
            ("/Users/alex/.npm-global/bin/prime-agent", "npm"),
            (r"C:\Users\alex\AppData\Roaming\npm\prime-agent.cmd", "npm"),
            ("/opt/homebrew/bin/prime-agent", "homebrew"),
            (
                "/usr/local/Cellar/prime-agent/0.9.3/bin/prime-agent",
                "homebrew",
            ),
            ("/home/linuxbrew/.linuxbrew/bin/prime-agent", "homebrew"),
            ("/Users/alex/.local/share/mise/shims/prime-agent", "mise"),
            ("/Users/alex/.asdf/shims/prime-agent", "asdf"),
            ("/usr/local/bin/prime-agent", "unknown"),
        ];

        for (path, method) in cases {
            assert_eq!(detect_install_method(Path::new(path)), method, "{path}");
        }
    }

    #[test]
    fn apply_refuses_when_the_chat_engine_is_missing() {
        let error = apply_prime_update_with(
            "0.9.4",
            false,
            || panic!("must not fetch when the Chat engine is missing"),
            || Err("missing".into()),
            |_binary, _args| panic!("must not spawn the CLI when the Chat engine is missing"),
            |_binary| panic!("must not read a version when the Chat engine is missing"),
            || panic!("must not reload when the Chat engine is missing"),
        )
        .expect_err("missing binary must refuse");

        assert_eq!(error, NOT_INSTALLED_ERR);
    }

    #[test]
    fn apply_refuses_a_stale_expected_version() {
        let mut spawned = false;
        let error = apply_with(
            "0.8.0",
            false,
            canned_latest("0.9.4"),
            Ok(PathBuf::from(
                "/usr/local/lib/node_modules/prime-agent/bin/prime-agent",
            )),
            |_binary, _args| {
                spawned = true;
                panic!("must not spawn the CLI for a stale offer");
            },
            |_binary| Some("0.8.0".into()),
            || panic!("must not reload a stale offer"),
        )
        .expect_err("stale offer must refuse");

        assert_eq!(error, STALE_OFFER_ERR);
        assert!(!spawned);
    }

    #[test]
    fn apply_runs_update_without_force_and_returns_versions() {
        let calls = std::cell::RefCell::new(Vec::<Vec<String>>::new());
        let versions = std::cell::RefCell::new(vec!["0.9.3".to_string(), "0.9.4".to_string()]);
        let reloaded = std::cell::Cell::new(false);

        let result = apply_with(
            "v0.9.4",
            false,
            canned_latest("0.9.4"),
            Ok(PathBuf::from(
                "/usr/local/lib/node_modules/prime-agent/bin/prime-agent",
            )),
            |_binary, args| {
                calls
                    .borrow_mut()
                    .push(args.iter().map(|arg| (*arg).to_string()).collect());
                Ok(UpdateCliOutput {
                    stdout: "updated".into(),
                    stderr: String::new(),
                })
            },
            |_binary| Some(versions.borrow_mut().remove(0)),
            || reloaded.set(true),
        )
        .expect("successful apply");

        assert_eq!(
            result,
            ApplyPrimeUpdateResult {
                previous_version: "0.9.3".into(),
                installed_version: "0.9.4".into(),
                method: "npm".into(),
            }
        );
        assert_eq!(*calls.borrow(), vec![vec!["update".to_string()]]);
        assert!(reloaded.get());
    }

    #[test]
    fn apply_retries_once_with_force_when_already_latest() {
        let calls = std::cell::RefCell::new(Vec::<Vec<String>>::new());
        let versions = std::cell::RefCell::new(vec![
            "0.9.3".to_string(),
            "0.9.3".to_string(),
            "0.9.4".to_string(),
        ]);
        let reloaded = std::cell::Cell::new(false);

        let result = apply_with(
            "0.9.4",
            false,
            canned_latest("0.9.4"),
            Ok(PathBuf::from("/opt/homebrew/bin/prime-agent")),
            |_binary, args| {
                calls
                    .borrow_mut()
                    .push(args.iter().map(|arg| (*arg).to_string()).collect());
                Ok(UpdateCliOutput {
                    stdout: "Already latest".into(),
                    stderr: "up to date".into(),
                })
            },
            |_binary| Some(versions.borrow_mut().remove(0)),
            || reloaded.set(true),
        )
        .expect("force retry should succeed");

        assert_eq!(
            *calls.borrow(),
            vec![
                vec!["update".to_string()],
                vec!["update".to_string(), "--force".to_string()],
            ]
        );
        assert_eq!(result.previous_version, "0.9.3");
        assert_eq!(result.installed_version, "0.9.4");
        assert_eq!(result.method, "homebrew");
        assert!(reloaded.get());
    }

    #[test]
    fn apply_failure_copy_names_the_chat_engine() {
        assert_eq!(update_failure_message("npm"), NPM_UPDATE_ERR);
        assert_eq!(update_failure_message("homebrew"), HOMEBREW_UPDATE_ERR);
        assert_eq!(update_failure_message("mise"), RELEASE_PAGE_UPDATE_ERR);
        assert_eq!(update_failure_message("asdf"), RELEASE_PAGE_UPDATE_ERR);
        assert_eq!(update_failure_message("unknown"), RELEASE_PAGE_UPDATE_ERR);

        let error = apply_with(
            "0.9.4",
            false,
            canned_latest("0.9.4"),
            Ok(PathBuf::from("/usr/local/bin/prime-agent")),
            |_binary, _args| {
                Ok(UpdateCliOutput {
                    stdout: "failed".into(),
                    stderr: String::new(),
                })
            },
            |_binary| Some("0.9.3".into()),
            || panic!("must not reload a failed update"),
        )
        .expect_err("failed apply must refuse");

        assert_eq!(error, RELEASE_PAGE_UPDATE_ERR);
        assert!(error.contains("Chat engine"));
        assert!(!error.to_ascii_lowercase().contains("prime never updates"));
    }

    #[test]
    fn apply_keeps_a_timeout_error() {
        let error = apply_with(
            "0.9.4",
            false,
            canned_latest("0.9.4"),
            Ok(PathBuf::from(
                "/usr/local/lib/node_modules/prime-agent/bin/prime-agent",
            )),
            |_binary, _args| {
                Err(
                    "Update timed out after 3 minutes. Try again, or update the Chat engine from Terminal."
                        .into(),
                )
            },
            |_binary| Some("0.9.3".into()),
            || panic!("must not reload a timed-out update"),
        )
        .expect_err("timeout must surface");

        assert!(error.contains("timed out"));
        assert!(error.contains("Chat engine"));
        assert_ne!(error, NPM_UPDATE_ERR);
    }

    #[test]
    fn apply_result_serializes_camel_case_for_the_frontend() {
        let result = ApplyPrimeUpdateResult {
            previous_version: "0.9.3".into(),
            installed_version: "0.9.4".into(),
            method: "npm".into(),
        };

        assert_eq!(
            serde_json::to_value(&result).unwrap(),
            serde_json::json!({
                "previousVersion": "0.9.3",
                "installedVersion": "0.9.4",
                "method": "npm",
            })
        );
    }
}
