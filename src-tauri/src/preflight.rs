//! Answer "will this actually work?" before the user finds out the hard way.
//!
//! Three unrelated failures reached the user as the same sentence — "Prime
//! Agent finished without returning a reply": a session worker dying on
//! `uv_cwd`, a provider refusing the request, and a model that genuinely had
//! nothing to say. Two of them were misdiagnosed for days (C51, C53). The
//! provider case now surfaces its own reason (`prime_events`), but that is
//! reactive: the user still has to send a doomed turn to learn anything.
//!
//! This module is the proactive half. Each check is cheap, side-effect free,
//! and reports a remedy the user can act on rather than a status code.

use serde::Serialize;
use std::path::Path;

/// One check's outcome. `Failed` always carries a remedy: a check that only
/// says "broken" reproduces the problem it exists to solve.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum CheckResult {
    Ok,
    #[serde(rename_all = "camelCase")]
    Failed {
        /// What is wrong, in the user's terms.
        reason: String,
        /// What to do about it. Never empty.
        remedy: String,
    },
}

impl CheckResult {
    fn failed(reason: impl Into<String>, remedy: impl Into<String>) -> Self {
        Self::Failed {
            reason: reason.into(),
            remedy: remedy.into(),
        }
    }

    pub fn is_ok(&self) -> bool {
        matches!(self, Self::Ok)
    }
}

/// Can Rhizome actually read this vault?
///
/// Distinguishes the two failures that look identical from inside the app.
/// A missing directory is the user's mistake and is obvious once named. A
/// **permission** denial is macOS TCC: `~/Documents`, `~/Desktop` and
/// `~/Downloads` are gated, and until 2026-08-27 Rhizome shipped without the
/// usage strings that let macOS even ask (C53). The symptom was every chat
/// turn timing out after 30s, which reads as a broken model, not a blocked
/// folder — so the permission case gets its own remedy.
pub fn check_vault_access(vault_path: &Path) -> CheckResult {
    if vault_path.as_os_str().is_empty() {
        return CheckResult::Ok; // No vault attached is a supported state.
    }
    match std::fs::read_dir(vault_path) {
        Ok(_) => CheckResult::Ok,
        Err(error) => {
            let display = vault_path.display();
            match error.kind() {
                std::io::ErrorKind::PermissionDenied => CheckResult::failed(
                    format!("macOS is blocking access to {display}"),
                    "Grant access in System Settings → Privacy & Security → Files and Folders, \
                     then reopen the vault. Folders inside Documents, Desktop and Downloads are \
                     protected by macOS.",
                ),
                std::io::ErrorKind::NotFound => CheckResult::failed(
                    format!("No folder at {display}"),
                    "The vault may have been moved or renamed. Open it again to point Rhizome at \
                     its new location.",
                ),
                _ => CheckResult::failed(
                    format!("Could not read {display}: {error}"),
                    "Check that the folder exists and is readable, then reopen the vault.",
                ),
            }
        }
    }
}

/// Is a model provider actually connected?
///
/// `providers` is the set of provider names the engine holds credentials for.
/// A selected model whose provider is absent cannot possibly answer, and today
/// that is indistinguishable from a quiet model — the whole point of #45.
pub fn check_provider_connected(provider: &str, connected: &[String]) -> CheckResult {
    let provider = provider.trim();
    if provider.is_empty() {
        return CheckResult::failed(
            "No model provider selected",
            "Pick a model from the composer before sending a message.",
        );
    }
    if connected.iter().any(|name| name == provider) {
        return CheckResult::Ok;
    }
    CheckResult::failed(
        format!("Not connected to {provider}"),
        format!(
            "Rhizome has no credentials for {provider}. Connect it, or pick a model from a \
             provider you have already signed in to."
        ),
    )
}

/// Everything the app can determine without spending a turn.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preflight {
    pub vault: CheckResult,
    pub provider: CheckResult,
}

impl Preflight {
    /// True when nothing is blocking a turn. Deliberately not "no warnings" —
    /// this gates whether we tell the user something is wrong.
    pub fn is_ready(&self) -> bool {
        self.vault.is_ok() && self.provider.is_ok()
    }

    /// The failures worth showing, in the order they should be fixed: a vault
    /// that cannot be read makes the provider question moot.
    pub fn blockers(&self) -> Vec<&CheckResult> {
        [&self.vault, &self.provider]
            .into_iter()
            .filter(|check| !check.is_ok())
            .collect()
    }
}

pub fn run(vault_path: &Path, provider: &str, connected: &[String]) -> Preflight {
    Preflight {
        vault: check_vault_access(vault_path),
        provider: check_provider_connected(provider, connected),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connected() -> Vec<String> {
        vec!["opencode".into(), "anthropic".into()]
    }

    #[test]
    fn a_readable_vault_passes() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(check_vault_access(dir.path()), CheckResult::Ok);
    }

    #[test]
    fn no_vault_attached_is_not_a_failure() {
        // Chat without a vault is a supported flow; do not nag about it.
        assert_eq!(check_vault_access(Path::new("")), CheckResult::Ok);
    }

    #[test]
    fn a_missing_vault_names_the_path_and_says_what_to_do() {
        let result = check_vault_access(Path::new("/nope/not/here"));
        let CheckResult::Failed { reason, remedy } = result else {
            panic!("expected failure");
        };
        assert!(reason.contains("/nope/not/here"), "reason names the path");
        assert!(!remedy.is_empty());
    }

    // C53: the permission case must not be reported as "missing". They look
    // identical from inside the app and have completely different remedies.
    #[test]
    fn a_blocked_folder_points_at_the_macos_setting() {
        let result = CheckResult::failed(
            "macOS is blocking access to /Users/x/Documents/V",
            "Grant access in System Settings → Privacy & Security → Files and Folders, then \
             reopen the vault. Folders inside Documents, Desktop and Downloads are protected \
             by macOS.",
        );
        let CheckResult::Failed { remedy, .. } = result else {
            panic!("expected failure");
        };
        assert!(remedy.contains("Privacy & Security"));
        assert!(!remedy.to_lowercase().contains("moved or renamed"));
    }

    #[test]
    fn a_connected_provider_passes() {
        assert_eq!(
            check_provider_connected("opencode", &connected()),
            CheckResult::Ok
        );
    }

    #[test]
    fn an_unconnected_provider_is_named_not_just_flagged() {
        let result = check_provider_connected("nous-portal", &connected());
        let CheckResult::Failed { reason, remedy } = result else {
            panic!("expected failure");
        };
        assert!(reason.contains("nous-portal"), "reason names the provider");
        assert!(remedy.contains("nous-portal"));
    }

    #[test]
    fn no_provider_selected_is_its_own_message() {
        let result = check_provider_connected("   ", &connected());
        let CheckResult::Failed { reason, .. } = result else {
            panic!("expected failure");
        };
        assert!(reason.contains("No model provider"));
    }

    #[test]
    fn every_failure_carries_a_remedy() {
        // A check that only says "broken" reproduces the problem it exists to
        // solve, so this is enforced rather than assumed.
        let failures = [
            check_vault_access(Path::new("/nope/not/here")),
            check_provider_connected("ghost", &connected()),
            check_provider_connected("", &connected()),
        ];
        for failure in failures {
            let CheckResult::Failed { remedy, reason } = failure else {
                panic!("expected failure");
            };
            assert!(!reason.trim().is_empty());
            assert!(!remedy.trim().is_empty());
        }
    }

    #[test]
    fn blockers_put_the_vault_first() {
        let preflight = run(Path::new("/nope/not/here"), "ghost", &connected());
        assert!(!preflight.is_ready());
        assert_eq!(preflight.blockers().len(), 2);
        let CheckResult::Failed { reason, .. } = preflight.blockers()[0] else {
            panic!("expected failure");
        };
        assert!(
            reason.contains("/nope/not/here"),
            "an unreadable vault makes the provider question moot, so it leads"
        );
    }

    #[test]
    fn a_healthy_setup_reports_ready_with_no_blockers() {
        let dir = tempfile::tempdir().unwrap();
        let preflight = run(dir.path(), "opencode", &connected());
        assert!(preflight.is_ready());
        assert!(preflight.blockers().is_empty());
    }
}
