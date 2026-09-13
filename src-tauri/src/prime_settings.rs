//! What a Prime session *would* start as, read from Prime's own settings.
//!
//! Rhizome no longer creates a session just because a vault was attached
//! (#28), which leaves a window that is connected but session-less — and the
//! model, provider and reasoning level the strip shows are all properties of a
//! session. Without this the chip would read "Model unknown" on every launch
//! until the user typed, which is a worse answer than the true one: Prime's
//! configured defaults are exactly what the next session will be created with.
//!
//! Read fresh on each call rather than cached. The user can change these in
//! Prime itself while Rhizome is open, and a stale label is the failure this
//! module exists to avoid.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// The defaults a new Prime session inherits.
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeDefaults {
    pub default_provider: Option<String>,
    pub default_model: Option<String>,
    pub default_thinking_level: Option<String>,
}

fn settings_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".prime").join("agent").join("settings.json"))
}

/// A package listed in Prime's settings (`packages` array).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InstalledPrimePackage {
    pub source: String,
}

#[derive(Deserialize)]
struct PrimeSettingsPackages {
    #[serde(default)]
    packages: Vec<PrimePackageEntry>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum PrimePackageEntry {
    Source(String),
    Object { source: String },
}

/// Packages Prime will load, or empty when we cannot say.
pub fn list_packages() -> Vec<InstalledPrimePackage> {
    let Some(path) = settings_path() else {
        return Vec::new();
    };
    list_packages_from(&path)
}

fn list_packages_from(path: &std::path::Path) -> Vec<InstalledPrimePackage> {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(parsed) = serde_json::from_str::<PrimeSettingsPackages>(&raw) else {
        return Vec::new();
    };
    let mut seen = std::collections::BTreeSet::new();
    let mut listed = Vec::new();
    for entry in parsed.packages {
        let source = match entry {
            PrimePackageEntry::Source(value) => value,
            PrimePackageEntry::Object { source } => source,
        };
        let source = source.trim().to_string();
        if source.is_empty() || !seen.insert(source.clone()) {
            continue;
        }
        listed.push(InstalledPrimePackage { source });
    }
    listed
}

/// Prime's configured defaults, or nothing.
///
/// Every failure is the same answer — no file, unreadable, not JSON, or a
/// shape this version does not recognise all mean "we cannot say", never an
/// error. A settings file Rhizome cannot parse is not a reason to refuse to
/// draw the window.
pub fn read_defaults() -> PrimeDefaults {
    let Some(path) = settings_path() else {
        return PrimeDefaults::default();
    };
    read_defaults_from(&path)
}

fn read_defaults_from(path: &std::path::Path) -> PrimeDefaults {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return PrimeDefaults::default();
    };
    // `serde(default)` on Option fields plus an ignored rest: Prime's settings
    // carry MCP servers, telemetry flags and onboarding state we have no
    // interest in, and a new key there must not blank the model label.
    serde_json::from_str::<PrimeDefaults>(&raw).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn written(body: &str) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(body.as_bytes()).unwrap();
        (dir, path)
    }

    /// The keys Prime actually writes, pinned from a live 0.7.4 settings file.
    /// Guessing at this shape would show the user a model they are not using.
    #[test]
    fn the_configured_default_model_is_what_a_new_session_would_use() {
        let (_dir, path) = written(
            r#"{
                "defaultModel": "claude-opus-5",
                "defaultProvider": "anthropic",
                "defaultThinkingLevel": "medium",
                "onboardingShown": true
            }"#,
        );

        let defaults = read_defaults_from(&path);

        assert_eq!(defaults.default_model.as_deref(), Some("claude-opus-5"));
        assert_eq!(defaults.default_provider.as_deref(), Some("anthropic"));
        assert_eq!(defaults.default_thinking_level.as_deref(), Some("medium"));
    }

    /// Keys we do not model must not blank the ones we do — Prime's settings
    /// file grows on its own schedule, and MCP server config lives there too.
    #[test]
    fn unrecognised_settings_are_ignored_rather_than_fatal() {
        let (_dir, path) = written(
            r#"{
                "defaultModel": "grok-4.6",
                "defaultProvider": "xai",
                "mcpServers": { "rhizome": { "command": "node" } },
                "somethingAddedNextRelease": [1, 2, 3]
            }"#,
        );

        let defaults = read_defaults_from(&path);

        assert_eq!(defaults.default_model.as_deref(), Some("grok-4.6"));
        assert!(defaults.default_thinking_level.is_none());
    }

    /// A fresh install has no settings file. That is "we cannot say", not an
    /// error, and certainly not a reason to fail drawing the window.
    #[test]
    fn a_missing_settings_file_reports_nothing_rather_than_failing() {
        let dir = tempfile::tempdir().unwrap();

        let defaults = read_defaults_from(&dir.path().join("settings.json"));

        assert_eq!(defaults, PrimeDefaults::default());
    }

    #[test]
    fn packages_read_string_and_object_entries() {
        let (_dir, path) = written(
            r#"{
                "packages": [
                    "pi-skills",
                    { "source": "npm:@org/ext", "extensions": [] },
                    "  ",
                    { "source": "pi-skills" }
                ]
            }"#,
        );
        assert_eq!(
            list_packages_from(&path),
            vec![
                InstalledPrimePackage {
                    source: "pi-skills".into()
                },
                InstalledPrimePackage {
                    source: "npm:@org/ext".into()
                },
            ]
        );
    }

    #[test]
    fn missing_packages_array_is_empty() {
        let (_dir, path) = written(r#"{ "defaultModel": "grok-4.6" }"#);
        assert!(list_packages_from(&path).is_empty());
    }

    /// Same for a file that is not JSON at all — a half-written settings file
    /// must degrade to "unknown", the state the UI already knows how to draw.
    #[test]
    fn unparseable_settings_report_nothing() {
        let (_dir, path) = written("{ this is not json");

        assert_eq!(read_defaults_from(&path), PrimeDefaults::default());
    }
}
