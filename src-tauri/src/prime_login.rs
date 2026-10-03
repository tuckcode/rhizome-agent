//! Sign Prime in to a model provider from Settings, without a terminal.
//!
//! Runs `mcp-server/prime-login.mjs`, which drives Prime's own `AuthStorage`
//! (ADR-0176):
//!
//! ```text
//! Settings ─invoke─▶ prime_login.rs ─spawn─▶ node prime-login.mjs ─▶ Prime AuthStorage
//!                         ▲   │                     │                    │
//!                         │   └── open_url ◀────────┘ (JSON line)        └─▶ ~/.prime/agent/auth.json
//!                         └────── done / error ◀────┘
//! ```

use serde::Deserialize;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const HELPER_SCRIPT: &str = "prime-login.mjs";
const PRIME_PACKAGE_NAME: &str = "prime-agent";
const KEY_FROM_STDIN: &str = "--key-from-stdin";
const PACKAGE_DIR_ENV: &str = "PRIME_AGENT_PACKAGE_DIR";

/// Long enough to sign in with 2FA; short enough that an abandoned tab frees
/// the callback port (53692) instead of holding it until Rhizome quits.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

/// How the credential arrives.
pub(crate) enum KeySource<'a> {
    /// OAuth: Prime's flow opens the browser and catches the redirect.
    Browser,
    /// An API key the user pasted in Settings.
    Pasted(&'a str),
}

/// One line of the helper's stdout.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub(crate) enum LoginEvent {
    OpenUrl { url: String },
    Progress { message: String },
    Done,
    Error { message: String },
}

/// The helper in flight, if any. A second Sign in click replaces it, so the
/// abandoned one cannot keep the callback port.
static IN_FLIGHT: Mutex<Option<Arc<Mutex<Child>>>> = Mutex::new(None);

/// Sign Prime in to `provider`. Blocks until the helper finishes.
///
/// `open_url` receives the provider's sign-in page; the caller opens it in
/// the system browser.
pub(crate) fn sign_in(
    provider: &str,
    source: KeySource,
    open_url: impl Fn(&str),
) -> Result<(), String> {
    if !is_provider_slug(provider) {
        return Err(format!("Not a Prime provider id: {provider}"));
    }

    let child = spawn_helper(provider, &source)?;
    let child = Arc::new(Mutex::new(child));
    replace_in_flight(Arc::clone(&child));

    // Hand over the key, then close stdin so the helper's read ends.
    let stdin = lock(&child).stdin.take();
    if let (KeySource::Pasted(key), Some(mut stdin)) = (&source, stdin) {
        stdin
            .write_all(key.as_bytes())
            .map_err(|error| format!("Could not pass the key to Prime: {error}"))?;
    }

    let stdout = lock(&child)
        .stdout
        .take()
        .ok_or("Prime sign-in helper has no output")?;
    let finished = start_watchdog(Arc::clone(&child));

    let outcome = read_outcome(stdout, &open_url);

    let _ = finished.send(());
    let _ = lock(&child).wait();
    outcome
}

fn spawn_helper(provider: &str, source: &KeySource) -> Result<Child, String> {
    let script = crate::mcp::mcp_server_dir()?.join(HELPER_SCRIPT);
    if !script.is_file() {
        return Err(format!("Missing {}", script.display()));
    }

    let mut command = crate::hidden_command(crate::mcp::find_node()?);
    command
        .arg(&script)
        .arg(provider)
        .env(PACKAGE_DIR_ENV, prime_package_dir()?)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if matches!(source, KeySource::Pasted(_)) {
        command.arg(KEY_FROM_STDIN);
    }

    command
        .spawn()
        .map_err(|error| format!("Could not start Prime sign-in: {error}"))
}

/// Follow the helper's events until it reports an outcome or exits.
fn read_outcome(stdout: impl std::io::Read, open_url: &impl Fn(&str)) -> Result<(), String> {
    for line in BufReader::new(stdout).lines() {
        let Ok(line) = line else {
            break;
        };
        match parse_login_event(&line) {
            Some(LoginEvent::OpenUrl { url }) => open_url(&url),
            Some(LoginEvent::Done) => return Ok(()),
            Some(LoginEvent::Error { message }) => return Err(message),
            Some(LoginEvent::Progress { message }) => log::info!("Prime sign-in: {message}"),
            None => {}
        }
    }
    Err("Sign-in stopped before it finished.".into())
}

/// Kill the helper if it outlives `LOGIN_TIMEOUT`. Send on the returned
/// channel once the helper is done to stand the watchdog down.
fn start_watchdog(child: Arc<Mutex<Child>>) -> mpsc::Sender<()> {
    let (finished_tx, finished_rx) = mpsc::channel::<()>();
    thread::spawn(move || {
        if finished_rx.recv_timeout(LOGIN_TIMEOUT).is_err() {
            let _ = lock(&child).kill();
        }
    });
    finished_tx
}

fn replace_in_flight(child: Arc<Mutex<Child>>) {
    let mut slot = IN_FLIGHT
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(previous) = slot.replace(child) {
        let _ = lock(&previous).kill();
    }
}

fn lock(child: &Mutex<Child>) -> std::sync::MutexGuard<'_, Child> {
    child
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Prime's ids are lowercase slugs (`anthropic`, `xai`, `prime-inference`).
/// Anything else never reaches the helper's argv.
fn is_provider_slug(provider: &str) -> bool {
    !provider.is_empty()
        && provider
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Where the installed `prime-agent` package lives.
///
/// The binary is a symlink on macOS/Linux (`bin/prime-agent` →
/// `…/prime-agent/dist/cli.js`) and a `.cmd` shim on Windows; both lead to a
/// script inside the package.
fn prime_package_dir() -> Result<PathBuf, String> {
    let binary = crate::prime_discovery::find_binary()?;
    let target = crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(&binary)?;
    let script = target.first_arg.unwrap_or(target.program);
    let script = std::fs::canonicalize(&script).unwrap_or(script);
    package_root_from(&script).ok_or_else(|| {
        format!(
            "Could not find the prime-agent package from {}",
            script.display()
        )
    })
}

pub(crate) fn parse_login_event(line: &str) -> Option<LoginEvent> {
    serde_json::from_str(line.trim()).ok()
}

/// The `prime-agent` package root: the nearest ancestor of `script` whose
/// `package.json` names `prime-agent`.
pub(crate) fn package_root_from(script: &Path) -> Option<PathBuf> {
    script.ancestors().skip(1).find_map(|dir| {
        let manifest = std::fs::read_to_string(dir.join("package.json")).ok()?;
        let parsed: serde_json::Value = serde_json::from_str(&manifest).ok()?;
        (parsed["name"].as_str() == Some(PRIME_PACKAGE_NAME)).then(|| dir.to_path_buf())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_each_helper_event() {
        assert_eq!(
            parse_login_event(
                r#"{"event":"open_url","url":"https://claude.ai/oauth/authorize?x=1"}"#
            ),
            Some(LoginEvent::OpenUrl {
                url: "https://claude.ai/oauth/authorize?x=1".into()
            })
        );
        assert_eq!(
            parse_login_event(r#"{"event":"done"}"#),
            Some(LoginEvent::Done)
        );
        assert_eq!(
            parse_login_event(r#"{"event":"error","message":"No API key was entered."}"#),
            Some(LoginEvent::Error {
                message: "No API key was entered.".into()
            })
        );
    }

    #[test]
    fn ignores_lines_that_are_not_events() {
        assert_eq!(parse_login_event("(node:123) ExperimentalWarning"), None);
        assert_eq!(parse_login_event(r#"{"event":"unknown"}"#), None);
    }

    #[test]
    fn finds_the_prime_package_above_its_cli_script() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("node_modules").join("prime-agent");
        let script = root.join("dist").join("bundle").join("cli.js");
        std::fs::create_dir_all(script.parent().unwrap()).unwrap();
        std::fs::write(&script, "").unwrap();
        std::fs::write(root.join("package.json"), r#"{"name":"prime-agent"}"#).unwrap();
        // A nested package.json that is not Prime's must be skipped.
        std::fs::write(
            root.join("dist").join("package.json"),
            r#"{"type":"module"}"#,
        )
        .unwrap();

        assert_eq!(package_root_from(&script), Some(root));
    }

    #[test]
    fn only_provider_slugs_reach_the_helper() {
        assert!(is_provider_slug("anthropic"));
        assert!(is_provider_slug("prime-inference"));
        assert!(!is_provider_slug(""));
        assert!(!is_provider_slug("xai --key-from-stdin"));
        assert!(!is_provider_slug("../etc"));
    }

    #[test]
    fn opens_the_url_then_reports_done() {
        let opened = std::cell::RefCell::new(Vec::new());
        let output = "{\"event\":\"open_url\",\"url\":\"https://a.test\"}\n{\"event\":\"done\"}\n";

        let outcome = read_outcome(output.as_bytes(), &|url: &str| {
            opened.borrow_mut().push(url.to_string())
        });

        assert_eq!(outcome, Ok(()));
        assert_eq!(opened.into_inner(), vec!["https://a.test".to_string()]);
    }

    #[test]
    fn a_helper_that_exits_silently_is_a_failure() {
        let outcome = read_outcome("".as_bytes(), &|_: &str| {});
        assert!(outcome.is_err());
    }

    #[test]
    fn finds_nothing_outside_a_prime_package() {
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("cli.js");
        std::fs::write(&script, "").unwrap();

        assert_eq!(package_root_from(&script), None);
    }
}
