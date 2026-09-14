use crate::settings;
use chrono::NaiveDate;
use regex::Regex;
use std::borrow::Cow;
use std::sync::Mutex;

/// Global Sentry guard — must live for the duration of the app.
static SENTRY_GUARD: Mutex<Option<sentry::ClientInitGuard>> = Mutex::new(None);

/// Scrub absolute file paths from a string to prevent vault content leakage.
fn scrub_paths(input: &str) -> String {
    let re = Regex::new(r"(?:/[\w.-]+){2,}|[A-Z]:\\[\w\\.-]+").unwrap();
    re.replace_all(input, "<redacted-path>").to_string()
}

fn scrub_secrets(input: &str) -> String {
    let without_paths = scrub_paths(input);
    let token_re = Regex::new(
        r"(?:sk-|ghp_|gho_|ghs_|ghu_|github_pat_|glpat-|xai-|gsk_|hf_|npm_|xox[abprse]-)[A-Za-z0-9_-]{20,}",
    )
    .unwrap();
    token_re
        .replace_all(&without_paths, "<redacted-token>")
        .to_string()
}

fn scrub_sentry_value(value: sentry::protocol::Value) -> sentry::protocol::Value {
    use sentry::protocol::Value;

    match value {
        Value::String(text) => Value::String(scrub_secrets(&text)),
        Value::Array(items) => Value::Array(items.into_iter().map(scrub_sentry_value).collect()),
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, nested)| (key, scrub_sentry_value(nested)))
                .collect(),
        ),
        other => other,
    }
}

fn scrub_sentry_event(
    mut event: sentry::protocol::Event<'static>,
) -> sentry::protocol::Event<'static> {
    if let Some(ref mut message) = event.message {
        *message = scrub_secrets(message);
    }
    for exception in event.exception.values.iter_mut() {
        if let Some(ref mut value) = exception.value {
            *value = scrub_secrets(value);
        }
    }
    for breadcrumb in event.breadcrumbs.values.iter_mut() {
        if let Some(ref mut message) = breadcrumb.message {
            *message = scrub_secrets(message);
        }
        breadcrumb.data = breadcrumb
            .data
            .iter()
            .map(|(key, value)| (key.clone(), scrub_sentry_value(value.clone())))
            .collect();
    }
    event.extra = event
        .extra
        .into_iter()
        .map(|(key, value)| (key, scrub_sentry_value(value)))
        .collect();
    event
}

fn normalize_embedded_env(raw: Option<&str>) -> Option<String> {
    let value = raw?.trim();
    if value.is_empty() {
        return None;
    }

    let unwrapped = match (value.chars().next(), value.chars().last()) {
        (Some('"'), Some('"')) | (Some('\''), Some('\'')) if value.len() >= 2 => {
            value[1..value.len() - 1].trim()
        }
        _ => value,
    };

    if unwrapped.is_empty() {
        None
    } else {
        Some(unwrapped.to_string())
    }
}

fn normalize_http_like_value(value: &str) -> String {
    if value.contains("://") {
        value.to_string()
    } else {
        format!("https://{value}")
    }
}

fn parse_embedded_sentry_dsn(raw: Option<&str>) -> Option<sentry::types::Dsn> {
    let normalized = normalize_embedded_env(raw)?;
    normalize_http_like_value(&normalized).parse().ok()
}

fn is_stable_calendar_release(version: &str) -> bool {
    let mut parts = version.split('.');
    let (Some(year), Some(month), Some(day)) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };

    if parts.next().is_some() {
        return false;
    }

    let (Ok(year), Ok(month), Ok(day)) = (
        year.parse::<i32>(),
        month.parse::<u32>(),
        day.parse::<u32>(),
    ) else {
        return false;
    };

    NaiveDate::from_ymd_opt(year, month, day).is_some()
}

fn sentry_release_for_version(version: &'static str) -> Option<Cow<'static, str>> {
    is_stable_calendar_release(version).then(|| version.into())
}

fn sentry_release_kind(version: &str) -> &'static str {
    if is_stable_calendar_release(version) {
        "stable"
    } else if version.contains('-') {
        "prerelease"
    } else {
        "internal"
    }
}

/// Initialize Sentry if the user has opted in to crash reporting.
/// Returns `true` if Sentry was initialized, `false` if skipped.
pub fn init_sentry_from_settings() -> bool {
    let settings = match settings::get_settings() {
        Ok(s) => s,
        Err(_) => return false,
    };

    if settings.crash_reporting_enabled != Some(true) {
        return false;
    }

    let Some(dsn) = parse_embedded_sentry_dsn(option_env!("SENTRY_DSN")) else {
        return false;
    };

    let anonymous_id = settings.anonymous_id.unwrap_or_default();
    let build_version = env!("CARGO_PKG_VERSION");
    let guard = sentry::init(sentry::ClientOptions {
        dsn: Some(dsn),
        release: sentry_release_for_version(build_version),
        send_default_pii: false,
        before_send: Some(std::sync::Arc::new(|event| Some(scrub_sentry_event(event)))),
        ..Default::default()
    });

    sentry::configure_scope(|scope| {
        scope.set_user(Some(sentry::User {
            id: Some(anonymous_id),
            ..Default::default()
        }));
        scope.set_tag("rhizome.build_version", build_version);
        scope.set_tag("rhizome.release_kind", sentry_release_kind(build_version));
    });

    *SENTRY_GUARD.lock().unwrap() = Some(guard);
    true
}

/// Tear down and reinitialize Sentry (called when user changes settings).
pub fn reinit_sentry() {
    // Drop old guard first
    *SENTRY_GUARD.lock().unwrap() = None;
    // Re-read settings and optionally re-init
    init_sentry_from_settings();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scrub_paths_unix() {
        assert_eq!(
            scrub_paths("Error at /Users/luca/Laputa/note.md"),
            "Error at <redacted-path>"
        );
    }

    #[test]
    fn test_scrub_paths_windows() {
        assert_eq!(
            scrub_paths("Error at C:\\Users\\test\\doc.md"),
            "Error at <redacted-path>"
        );
    }

    #[test]
    fn test_scrub_paths_no_paths() {
        assert_eq!(scrub_paths("Normal error message"), "Normal error message");
    }

    #[test]
    fn test_normalize_embedded_env_trims_wrapping_quotes() {
        assert_eq!(
            normalize_embedded_env(Some("  \"value\"  ")).as_deref(),
            Some("value")
        );
        assert_eq!(
            normalize_embedded_env(Some("  'value'  ")).as_deref(),
            Some("value")
        );
    }

    #[test]
    fn test_normalize_embedded_env_drops_blank_values() {
        assert_eq!(normalize_embedded_env(Some("   ")), None);
        assert_eq!(normalize_embedded_env(None), None);
    }

    #[test]
    fn test_parse_embedded_sentry_dsn_accepts_valid_trimmed_value() {
        let parsed =
            parse_embedded_sentry_dsn(Some("  \"https://public@example.ingest.sentry.io/1\"  "));
        assert!(parsed.is_some());
    }

    #[test]
    fn test_parse_embedded_sentry_dsn_accepts_scheme_less_value() {
        let parsed = parse_embedded_sentry_dsn(Some("public@example.ingest.sentry.io/1"));
        assert!(parsed.is_some());
    }

    #[test]
    fn test_parse_embedded_sentry_dsn_rejects_invalid_value() {
        let parsed = parse_embedded_sentry_dsn(Some("not a dsn"));
        assert!(parsed.is_none());
    }

    #[test]
    fn test_init_sentry_returns_false_without_dsn() {
        // Without SENTRY_DSN env var set at compile time, init should return false
        assert!(!init_sentry_from_settings());
    }

    #[test]
    fn test_sentry_release_for_stable_calendar_version() {
        assert!(sentry_release_for_version("2026.4.28").is_some());
    }

    #[test]
    fn test_sentry_release_for_alpha_version_is_none() {
        assert!(sentry_release_for_version("2026.4.28-alpha.7").is_none());
    }

    #[test]
    fn test_sentry_release_for_local_dev_version_is_none() {
        assert!(sentry_release_for_version("0.1.0").is_none());
    }

    #[test]
    fn test_sentry_release_kind_classifies_versions() {
        assert_eq!(sentry_release_kind("2026.4.28"), "stable");
        assert_eq!(sentry_release_kind("2026.4.28-alpha.7"), "prerelease");
        assert_eq!(sentry_release_kind("0.1.0"), "internal");
    }

    #[test]
    fn scrub_event_redacts_exception_extra_and_token_text() {
        use sentry::protocol::{Breadcrumb, Event, Exception, Value};

        let token = format!("sk-{}", "A".repeat(30));
        let mut event = Event {
            message: Some(format!("boom /Users/fixture/vault/note.md {token}")),
            ..Event::default()
        };
        event.exception.values = vec![Exception {
            value: Some("/Users/fixture/vault/secret.md".into()),
            ..Exception::default()
        }];
        event.extra.insert(
            "detail".into(),
            Value::String(format!("path /tmp/fixture/note.md token {token}")),
        );
        event.breadcrumbs.values = vec![Breadcrumb {
            message: Some(format!("retry {token}")),
            ..Breadcrumb::default()
        }];

        let scrubbed = scrub_sentry_event(event);
        let message = scrubbed.message.unwrap();
        assert!(!message.contains("/Users/fixture/vault/note.md"));
        assert!(!message.contains(&token));
        assert!(!scrubbed.exception.values[0]
            .value
            .as_ref()
            .unwrap()
            .contains("/Users/fixture/vault/secret.md"));
        assert!(!format!("{:?}", scrubbed.extra).contains(&token));
        assert!(!scrubbed.breadcrumbs.values[0]
            .message
            .as_ref()
            .unwrap()
            .contains(&token));
    }

    #[test]
    fn scrub_secrets_redacts_groq_and_github_pat_prefixes() {
        let groq = format!("gsk_{}", "H".repeat(28));
        let pat = format!("github_pat_{}", "J".repeat(28));
        let scrubbed = scrub_secrets(&format!("keys {groq} {pat}"));
        assert!(!scrubbed.contains(&groq));
        assert!(!scrubbed.contains(&pat));
        assert_eq!(scrubbed, "keys <redacted-token> <redacted-token>");
    }

    #[test]
    fn scrub_secrets_redacts_remaining_listed_prefixes() {
        let tokens = [
            format!("gho_{}", "K".repeat(28)),
            format!("ghs_{}", "L".repeat(28)),
            format!("ghu_{}", "P".repeat(28)),
            format!("xoxp-123456789012-{}", "N".repeat(24)),
        ];
        let scrubbed = scrub_secrets(&format!("keys {}", tokens.join(" ")));
        for token in &tokens {
            assert!(!scrubbed.contains(token));
        }
        assert_eq!(
            scrubbed,
            "keys <redacted-token> <redacted-token> <redacted-token> <redacted-token>"
        );
    }

    #[test]
    fn scrub_secrets_redacts_remaining_slack_prefixes() {
        let tokens = [
            format!("xoxa-123456789012-{}", "T".repeat(24)),
            format!("xoxr-123456789012-{}", "U".repeat(24)),
            format!("xoxs-123456789012-{}", "V".repeat(24)),
            format!("xoxe-123456789012-{}", "W".repeat(24)),
        ];
        let scrubbed = scrub_secrets(&format!("keys {}", tokens.join(" ")));
        for token in &tokens {
            assert!(!scrubbed.contains(token));
        }
        assert_eq!(
            scrubbed,
            "keys <redacted-token> <redacted-token> <redacted-token> <redacted-token>"
        );
    }

    #[test]
    fn scrub_secrets_redacts_listed_hf_npm_and_gitlab_prefixes() {
        let tokens = [
            format!("hf_{}", "D".repeat(32)),
            format!("npm_{}", "F".repeat(36)),
            format!("glpat-{}", "E".repeat(24)),
        ];
        let scrubbed = scrub_secrets(&format!("keys {}", tokens.join(" ")));
        for token in &tokens {
            assert!(!scrubbed.contains(token));
        }
        assert_eq!(
            scrubbed,
            "keys <redacted-token> <redacted-token> <redacted-token>"
        );
    }

    /// Parked this window: JS already redacts these. Do not widen the rust
    /// regex until Atticus says so.
    #[test]
    fn scrub_secrets_does_not_yet_cover_ghr_or_stripe_underscore_keys() {
        let ghr = format!("ghr_{}", "Q".repeat(28));
        let live = format!("sk_live_{}", "M".repeat(24));
        let test = format!("sk_test_{}", "S".repeat(24));
        let scrubbed = scrub_secrets(&format!("keys {ghr} {live} {test}"));
        assert!(
            scrubbed.contains(&ghr) && scrubbed.contains(&live) && scrubbed.contains(&test),
            "native Sentry still leaves ghr_ / sk_live_ / sk_test_ for a later widen"
        );
    }
}
