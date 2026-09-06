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
    // An empty set means we could not read the engine's credentials, not that
    // nothing is connected. Staying silent is the only safe reading: a false
    // "not connected" on a working setup trains the user to ignore the banner,
    // which costs more than the check ever earns.
    if connected.is_empty() {
        return CheckResult::Ok;
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

/// How a provider is connected, and whether that connection is still good.
///
/// Metadata only. The access token, refresh token and API key are never read
/// out of the credential file and have no field here — this type exists to
/// answer "am I connected?", which needs none of them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub name: String,
    /// `oauth`, `api_key`, or whatever else the engine records.
    pub auth_kind: String,
    /// Unix milliseconds, OAuth only.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
    /// True only when an expiry is known and has passed. An API key has no
    /// expiry and is never reported as expired.
    pub expired: bool,
}

/// Parse provider status out of the engine's credential JSON.
///
/// Split from the file read so the shape can be tested without a home
/// directory: the interesting logic is expiry, and that deserves a test more
/// than the `read_to_string` does.
pub fn provider_status_from_auth(auth: &serde_json::Value, now_ms: i64) -> Vec<ProviderStatus> {
    let Some(entries) = auth.as_object() else {
        return Vec::new();
    };
    let mut statuses: Vec<ProviderStatus> = entries
        .iter()
        .map(|(name, entry)| {
            let expires_at = entry["expires"].as_i64();
            ProviderStatus {
                name: name.clone(),
                auth_kind: entry["type"].as_str().unwrap_or("unknown").to_string(),
                expires_at,
                expired: expires_at.is_some_and(|expiry| expiry <= now_ms),
            }
        })
        .collect();
    statuses.sort_by(|a, b| a.name.cmp(&b.name));
    statuses
}

/// Provider status for the settings surface, read from the engine's store.
pub fn provider_statuses() -> Vec<ProviderStatus> {
    let from_auth = dirs::home_dir()
        .map(|home| home.join(".prime/agent/auth.json"))
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .map(|parsed| {
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|elapsed| elapsed.as_millis() as i64)
                .unwrap_or(0);
            provider_status_from_auth(&parsed, now_ms)
        })
        .unwrap_or_default();
    merge_statuses(from_auth, providers_from_environment())
}

/// Add providers that are connected by environment variable to the cards.
///
/// A provider already in `auth.json` keeps that entry: it carries the auth
/// kind and the expiry, which an environment variable cannot. This only adds
/// the ones that would otherwise be invisible in Settings while Prime was
/// using them.
fn merge_statuses(
    mut from_auth: Vec<ProviderStatus>,
    from_env: Vec<String>,
) -> Vec<ProviderStatus> {
    for provider in from_env {
        if from_auth.iter().any(|status| status.name == provider) {
            continue;
        }
        from_auth.push(ProviderStatus {
            name: provider,
            auth_kind: "env".to_string(),
            expires_at: None,
            // An environment variable does not expire. It can be wrong, but
            // nothing here can tell, and claiming otherwise would be a guess.
            expired: false,
        });
    }
    from_auth.sort_by(|a, b| a.name.cmp(&b.name));
    from_auth
}

/// Provider names the engine holds credentials for.
///
/// Read-only, and a deliberate fallback: Prime's daemon exposes no auth or
/// login command (verified against all 102 commands in
/// `docs/prime-adapter-surface.json` — only `get_available_models`,
/// `get_model_catalog`, `set_model`, `set_scoped_models` and `cycle_model`
/// touch this area), so the credential file is the only source. Rhizome
/// **reads** it and never writes it; writing into Prime's own state is what
/// #46 was about.
///
/// Returns an empty set on any failure, which `check_provider_connected`
/// treats as "unknown" and stays quiet about. Replace this with a daemon call
/// the moment Prime grows one.
/// Provider ids Prime will resolve from an environment variable, with the
/// variable that supplies each.
///
/// From the installed 0.8.0's `docs/providers.md`. Prime resolves credentials
/// from four places in order — CLI flag, `auth.json`, **environment
/// variable**, then `models.json` — and Rhizome read only the second. A
/// provider connected the ordinary way (`export ANTHROPIC_API_KEY=…`) was
/// therefore reported as not connected: its models greyed out in the picker
/// and its card missing from Settings, while Prime used it happily.
///
/// Not exhaustive by design. `models.json` custom providers are the fourth
/// path and have no fixed variable name, so an unknown provider still resolves
/// to "unknown", which `check_provider_connected` stays quiet about.
const PROVIDER_ENV_VARS: &[(&str, &str)] = &[
    ("anthropic", "ANTHROPIC_API_KEY"),
    ("openai", "OPENAI_API_KEY"),
    ("xai", "XAI_API_KEY"),
    ("openrouter", "OPENROUTER_API_KEY"),
    ("google", "GEMINI_API_KEY"),
    ("groq", "GROQ_API_KEY"),
    ("deepseek", "DEEPSEEK_API_KEY"),
    ("nous-portal", "NOUS_API_KEY"),
    ("mistral", "MISTRAL_API_KEY"),
    ("cerebras", "CEREBRAS_API_KEY"),
    ("prime-inference", "PRIME_API_KEY"),
    ("opencode", "OPENCODE_API_KEY"),
    ("zai", "ZAI_API_KEY"),
    ("huggingface", "HF_TOKEN"),
    ("fireworks", "FIREWORKS_API_KEY"),
    ("minimax", "MINIMAX_API_KEY"),
    ("kimi-coding", "KIMI_API_KEY"),
    ("vercel-ai-gateway", "AI_GATEWAY_API_KEY"),
    ("azure-openai-responses", "AZURE_OPENAI_API_KEY"),
];

/// Providers whose key is present in the environment.
///
/// Reads through the user's shell, not just this process: a bundled `.app`
/// launched from Finder inherits almost no environment, so checking
/// `std::env` alone would report nothing for exactly the users this exists to
/// serve. Same lookup the AI-model providers already use for `api_key_env_var`.
pub fn providers_from_environment() -> Vec<String> {
    providers_from_environment_with_lookup(
        crate::cli_agent_runtime::env_value_from_process_or_user_shell,
    )
}

fn providers_from_environment_with_lookup(
    lookup: impl Fn(crate::cli_agent_runtime::EnvName<'_>) -> Option<String>,
) -> Vec<String> {
    PROVIDER_ENV_VARS
        .iter()
        .filter(|(_, var)| {
            crate::cli_agent_runtime::EnvName::new(var)
                .and_then(&lookup)
                .is_some_and(|value| !value.trim().is_empty())
        })
        .map(|(provider, _)| (*provider).to_string())
        .collect()
}

fn merge_providers(mut from_auth: Vec<String>, from_env: Vec<String>) -> Vec<String> {
    for provider in from_env {
        if !from_auth.iter().any(|existing| existing == &provider) {
            from_auth.push(provider);
        }
    }
    from_auth.sort();
    from_auth
}

pub fn connected_providers() -> Vec<String> {
    merge_providers(providers_from_auth_file(), providers_from_environment())
}

fn providers_from_auth_file() -> Vec<String> {
    let Some(path) = dirs::home_dir().map(|home| home.join(".prime/agent/auth.json")) else {
        return Vec::new();
    };
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return Vec::new();
    };
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0);
    // Expired OAuth used to count as "connected", so Chat preflight stayed green
    // while every turn failed. Settings already showed Expired; Chat must too.
    provider_status_from_auth(&parsed, now_ms)
        .into_iter()
        .filter(|status| !status.expired)
        .map(|status| status.name)
        .collect()
}

pub fn run(vault_path: &Path, provider: &str, connected: &[String]) -> Preflight {
    Preflight {
        vault: check_vault_access(vault_path),
        provider: check_provider_connected(provider, connected),
    }
}

#[cfg(test)]
mod tests {
    /// A provider connected only by environment variable had no card at all,
    /// so Settings showed nothing while Prime used it.
    #[test]
    fn an_environment_provider_gets_its_own_card() {
        let merged = merge_statuses(Vec::new(), vec!["groq".to_string()]);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].name, "groq");
        assert_eq!(merged[0].auth_kind, "env");
        assert!(!merged[0].expired);
    }

    /// `auth.json` wins where both exist: it knows the auth kind and the
    /// expiry, and an expired OAuth token must keep saying so.
    #[test]
    fn the_auth_file_entry_survives_an_environment_variable() {
        let merged = merge_statuses(
            vec![ProviderStatus {
                name: "anthropic".to_string(),
                auth_kind: "oauth".to_string(),
                expires_at: Some(1),
                expired: true,
            }],
            vec!["anthropic".to_string()],
        );
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].auth_kind, "oauth");
        assert!(merged[0].expired);
    }

    /// Prime resolves credentials from four places; Rhizome read one. A
    /// provider connected the ordinary way — `export ANTHROPIC_API_KEY=…` —
    /// was reported as not connected, greying its models out of the picker.
    #[test]
    fn a_key_in_the_environment_counts_as_connected() {
        let found = providers_from_environment_with_lookup(|name| {
            (name.as_str() == "ANTHROPIC_API_KEY").then(|| "sk-ant-live".to_string())
        });
        assert_eq!(found, vec!["anthropic".to_string()]);
    }

    /// A variable that exists but is empty is not a credential.
    #[test]
    fn a_blank_variable_is_not_a_connection() {
        let found = providers_from_environment_with_lookup(|name| {
            (name.as_str() == "OPENAI_API_KEY").then(|| "   ".to_string())
        });
        assert!(found.is_empty());
    }

    /// The two sources overlap constantly — `/login` writes `auth.json` for a
    /// provider whose variable is also exported. One card, not two.
    #[test]
    fn the_two_credential_sources_merge_without_duplicating() {
        let merged = merge_providers(
            vec!["anthropic".to_string(), "xai".to_string()],
            vec!["anthropic".to_string(), "groq".to_string()],
        );
        assert_eq!(
            merged,
            vec![
                "anthropic".to_string(),
                "groq".to_string(),
                "xai".to_string()
            ]
        );
    }

    /// Nothing anywhere stays "unknown", which `check_provider_connected`
    /// treats as a reason to stay quiet rather than to warn.
    #[test]
    fn no_credentials_anywhere_is_still_empty() {
        assert!(providers_from_environment_with_lookup(|_| None).is_empty());
        assert!(merge_providers(Vec::new(), Vec::new()).is_empty());
    }

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

    // The banner is only worth having if it is trusted. Reporting "not
    // connected" because we failed to read credentials would be a false alarm
    // on a working setup, and one of those teaches the user to ignore it.
    #[test]
    fn an_unknown_credential_set_stays_silent_rather_than_crying_wolf() {
        assert_eq!(check_provider_connected("opencode", &[]), CheckResult::Ok);
        assert_eq!(check_provider_connected("anything", &[]), CheckResult::Ok);
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

    fn auth_fixture() -> serde_json::Value {
        serde_json::json!({
            "opencode":  { "type": "api_key", "key": "sk-secret" },
            "anthropic": { "type": "oauth", "access": "tok", "refresh": "r", "expires": 2_000 },
            "xai":       { "type": "oauth", "access": "tok", "refresh": "r", "expires": 500 },
        })
    }

    #[test]
    fn reports_how_each_provider_is_connected() {
        let statuses = provider_status_from_auth(&auth_fixture(), 1_000);
        let kinds: Vec<_> = statuses
            .iter()
            .map(|s| (s.name.as_str(), s.auth_kind.as_str()))
            .collect();
        assert_eq!(
            kinds,
            vec![
                ("anthropic", "oauth"),
                ("opencode", "api_key"),
                ("xai", "oauth"),
            ],
            "sorted by name so the settings list is stable between reads"
        );
    }

    #[test]
    fn an_expired_oauth_token_is_flagged() {
        let statuses = provider_status_from_auth(&auth_fixture(), 1_000);
        let xai = statuses.iter().find(|s| s.name == "xai").unwrap();
        let anthropic = statuses.iter().find(|s| s.name == "anthropic").unwrap();
        assert!(xai.expired, "expiry 500 is in the past at now=1000");
        assert!(!anthropic.expired, "expiry 2000 is still in the future");
    }

    /// Chat preflight only saw provider *names*, so Expired OAuth still looked
    /// connected and every turn failed with no banner.
    #[test]
    fn expired_oauth_is_dropped_from_the_connected_name_list() {
        let live: Vec<String> = provider_status_from_auth(&auth_fixture(), 1_000)
            .into_iter()
            .filter(|status| !status.expired)
            .map(|status| status.name)
            .collect();
        assert!(live.contains(&"opencode".to_string()));
        assert!(live.contains(&"anthropic".to_string()));
        assert!(
            !live.contains(&"xai".to_string()),
            "expired xai must not pass Chat preflight as connected"
        );
        assert_eq!(
            check_provider_connected("xai", &live),
            CheckResult::failed(
                "Not connected to xai",
                "Rhizome has no credentials for xai. Connect it, or pick a model from a \
                 provider you have already signed in to."
            )
        );
    }

    #[test]
    fn nous_portal_key_in_the_environment_counts_as_connected() {
        let found = providers_from_environment_with_lookup(|name| {
            (name.as_str() == "NOUS_API_KEY").then(|| "nous-live".to_string())
        });
        assert_eq!(found, vec!["nous-portal".to_string()]);
    }

    #[test]
    fn an_api_key_never_expires() {
        let statuses = provider_status_from_auth(&auth_fixture(), i64::MAX);
        let opencode = statuses.iter().find(|s| s.name == "opencode").unwrap();
        assert!(!opencode.expired);
        assert_eq!(opencode.expires_at, None);
    }

    // The settings surface answers "am I connected?", which needs no secret.
    // Serializing one would leak it to the webview and into any log that
    // captured the payload.
    #[test]
    fn no_secret_material_is_ever_serialized() {
        let statuses = provider_status_from_auth(&auth_fixture(), 1_000);
        let json = serde_json::to_string(&statuses).unwrap();
        for secret in ["sk-secret", "\"key\"", "access", "refresh", "tok"] {
            assert!(!json.contains(secret), "leaked {secret} into {json}");
        }
    }

    #[test]
    fn malformed_credential_data_yields_no_providers() {
        assert!(provider_status_from_auth(&serde_json::json!([]), 0).is_empty());
        assert!(provider_status_from_auth(&serde_json::json!("nope"), 0).is_empty());
    }

    #[test]
    fn a_healthy_setup_reports_ready_with_no_blockers() {
        let dir = tempfile::tempdir().unwrap();
        let preflight = run(dir.path(), "opencode", &connected());
        assert!(preflight.is_ready());
        assert!(preflight.blockers().is_empty());
    }
}
