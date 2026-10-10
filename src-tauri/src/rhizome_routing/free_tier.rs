//! The user's free-tier choices (step 3b) and the read-only view Settings
//! shows.
//!
//! Kept in their own file, `free-tier-settings.json`, not in `Settings`: the
//! frontend saves `Settings` as one whole object, so a field it does not know
//! would be wiped by the next save.
//!
//! The provider order is fixed by ADR-0182 decision 5. Settings shows it and
//! cannot change it.

use std::collections::BTreeSet;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::{Catalog, KeyStore, RoutingOptions};

/// The settings file name in the app config folder.
pub const SETTINGS_FILE_NAME: &str = "free-tier-settings.json";

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FreeTierSettings {
    /// Providers the user turned off. Off wins over opt-in.
    pub disabled: BTreeSet<String>,
    /// Opt-in providers the user turned on (Cloudflare today).
    pub opt_in: BTreeSet<String>,
    /// Route only providers with a documented hard stop, plus the user
    /// endpoint.
    pub strict: bool,
}

impl FreeTierSettings {
    pub fn to_options(&self) -> RoutingOptions {
        let _ = self;
        RoutingOptions::default()
    }
}

/// One provider row in Settings. Never holds a key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FreeTierProviderRow {
    pub id: String,
    pub name: String,
    pub default_on: bool,
    /// On after the user's choices: default-on or opted in, and not off.
    pub enabled: bool,
    pub has_key: bool,
    /// The base URL needs an account id (Cloudflare).
    pub needs_account_id: bool,
    pub has_account_id: bool,
    /// Shown before an opt-in provider is turned on.
    pub billing_warning: Option<String>,
    /// At least one model has a documented hard stop, so strict mode keeps it.
    pub hard_stop: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FreeTierOverview {
    /// Every catalog provider, in the fixed priority order.
    pub providers: Vec<FreeTierProviderRow>,
    pub strict: bool,
    /// Ids of the providers that route now, in the order the router tries
    /// them. Read-only (ADR-0182 decision 5).
    pub route_order: Vec<String>,
    /// The router can try at least one provider (D11).
    pub usable: bool,
}

pub fn overview(
    catalog: &Catalog,
    settings: &FreeTierSettings,
    keys: &impl KeyStore,
) -> FreeTierOverview {
    let _ = (catalog, keys);
    FreeTierOverview {
        providers: Vec::new(),
        strict: settings.strict,
        route_order: Vec::new(),
        usable: false,
    }
}

/// Defaults when the file does not exist.
pub fn load_at(path: &Path) -> Result<FreeTierSettings, String> {
    let _ = path;
    Err("not built".into())
}

pub fn save_at(path: &Path, settings: &FreeTierSettings) -> Result<(), String> {
    let _ = (path, settings);
    Err("not built".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rhizome_routing::Credential;
    use std::collections::HashMap;

    struct Keys(HashMap<String, Credential>);

    impl KeyStore for Keys {
        fn credential(&self, provider_id: &str) -> Option<Credential> {
            self.0.get(provider_id).cloned()
        }
    }

    fn keys(entries: &[(&str, Option<&str>)]) -> Keys {
        Keys(
            entries
                .iter()
                .map(|(id, account)| {
                    (
                        id.to_string(),
                        Credential {
                            api_key: format!("test-{id}"),
                            account_id: account.map(str::to_string),
                        },
                    )
                })
                .collect(),
        )
    }

    fn row<'a>(view: &'a FreeTierOverview, id: &str) -> &'a FreeTierProviderRow {
        view.providers.iter().find(|row| row.id == id).unwrap()
    }

    #[test]
    fn a_missing_file_gives_the_defaults() {
        let dir = tempfile::tempdir().unwrap();

        let settings = load_at(&dir.path().join(SETTINGS_FILE_NAME)).unwrap();

        assert_eq!(settings, FreeTierSettings::default());
    }

    #[test]
    fn settings_round_trip_in_camel_case() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join(SETTINGS_FILE_NAME);
        let settings = FreeTierSettings {
            disabled: ["groq".to_string()].into(),
            opt_in: ["cloudflare-ai".to_string()].into(),
            strict: true,
        };

        save_at(&path, &settings).unwrap();

        assert_eq!(load_at(&path).unwrap(), settings);
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(raw.contains("\"optIn\""), "{raw}");
    }

    #[test]
    fn settings_map_to_routing_options() {
        let settings = FreeTierSettings {
            disabled: ["groq".to_string()].into(),
            opt_in: ["cloudflare-ai".to_string()].into(),
            strict: true,
        };

        let options = settings.to_options();

        assert!(options.strict);
        assert!(options.disabled.contains("groq"));
        assert!(options.opt_in.contains("cloudflare-ai"));
    }

    #[test]
    fn the_overview_lists_every_provider_in_the_fixed_order() {
        let view = overview(&Catalog::pinned(), &FreeTierSettings::default(), &keys(&[]));

        let ids: Vec<&str> = view.providers.iter().map(|row| row.id.as_str()).collect();
        assert_eq!(
            ids,
            ["groq", "mistral", "llm7", "openrouter", "nvidia", "cloudflare-ai"]
        );
        assert!(row(&view, "groq").enabled);
        assert!(row(&view, "groq").hard_stop);
        assert!(!row(&view, "mistral").hard_stop);
    }

    #[test]
    fn cloudflare_is_off_until_opted_in_and_carries_its_warning() {
        let off = overview(&Catalog::pinned(), &FreeTierSettings::default(), &keys(&[]));
        let on = overview(
            &Catalog::pinned(),
            &FreeTierSettings {
                opt_in: ["cloudflare-ai".to_string()].into(),
                ..Default::default()
            },
            &keys(&[]),
        );

        let cloudflare = row(&off, "cloudflare-ai");
        assert!(!cloudflare.default_on);
        assert!(!cloudflare.enabled);
        assert!(cloudflare.needs_account_id);
        assert!(cloudflare.billing_warning.as_deref().is_some_and(|text| text.contains("billed")));
        assert!(row(&on, "cloudflare-ai").enabled);
        assert_eq!(row(&off, "groq").billing_warning, None);
    }

    #[test]
    fn off_wins_over_opt_in() {
        let view = overview(
            &Catalog::pinned(),
            &FreeTierSettings {
                opt_in: ["cloudflare-ai".to_string()].into(),
                disabled: ["cloudflare-ai".to_string()].into(),
                ..Default::default()
            },
            &keys(&[]),
        );

        assert!(!row(&view, "cloudflare-ai").enabled);
    }

    #[test]
    fn key_state_comes_from_the_store_and_never_the_key() {
        let view = overview(
            &Catalog::pinned(),
            &FreeTierSettings::default(),
            &keys(&[("groq", None), ("cloudflare-ai", Some("acct"))]),
        );

        assert!(row(&view, "groq").has_key);
        assert!(!row(&view, "mistral").has_key);
        assert!(row(&view, "cloudflare-ai").has_account_id);
        let json = serde_json::to_string(&view).unwrap();
        assert!(!json.contains("test-groq"), "a key leaked into the overview: {json}");
    }

    #[test]
    fn usable_and_route_order_follow_keys_switches_and_strict_mode() {
        let catalog = Catalog::pinned();
        let none = overview(&catalog, &FreeTierSettings::default(), &keys(&[]));
        let both = keys(&[("groq", None), ("mistral", None)]);
        let normal = overview(&catalog, &FreeTierSettings::default(), &both);
        let strict = overview(
            &catalog,
            &FreeTierSettings {
                strict: true,
                ..Default::default()
            },
            &both,
        );
        let groq_off = overview(
            &catalog,
            &FreeTierSettings {
                disabled: ["groq".to_string()].into(),
                ..Default::default()
            },
            &both,
        );

        assert!(!none.usable);
        assert!(normal.usable);
        assert_eq!(normal.route_order, ["groq", "mistral", "llm7", "openrouter", "nvidia"]);
        assert_eq!(strict.route_order, ["groq"]);
        assert!(groq_off.usable);
        assert_eq!(groq_off.route_order.first().map(String::as_str), Some("mistral"));
    }
}
