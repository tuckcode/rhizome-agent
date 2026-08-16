//! Real-update check for Prime (`prime-agent`).
//!
//! Rhizome does not ship or manage the Prime binary — it is installed
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
//! Because Prime must never update itself unattended (a model changing
//! behaviour underneath the user needs explicit consent), this module only
//! ever *reports* an available version. Nothing here downloads, installs,
//! or restarts anything — the UI sends the user to the real release page
//! to do that themselves.

use serde::Serialize;
use std::time::Duration;

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
}
