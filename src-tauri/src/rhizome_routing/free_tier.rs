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

use super::UserEndpoint;
use super::{has_usable_target, Catalog, KeyStore, RoutingOptions};
use crate::ai_models::{provider_base_url, AiModelProvider, AiModelProviderKind};

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
    /// The saved provider (Settings → AI) tried last, after the catalog.
    /// `None` means no own endpoint.
    pub own_endpoint: Option<String>,
}

/// A saved provider that can be the own endpoint.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointChoice {
    pub id: String,
    pub name: String,
}

/// Saved providers that speak the OpenAI API with a model set: custom
/// OpenAI-compatible, LM Studio, and Ollama. Hosted vendors stay out.
pub fn endpoint_choices(providers: &[AiModelProvider]) -> Vec<EndpointChoice> {
    providers
        .iter()
        .filter_map(own_endpoint_for)
        .map(|(provider, _)| EndpointChoice {
            id: provider.id.clone(),
            name: provider.name.clone(),
        })
        .collect()
}

/// The provider and its endpoint, when it can be the own endpoint.
fn own_endpoint_for(provider: &AiModelProvider) -> Option<(&AiModelProvider, UserEndpoint)> {
    let compatible = matches!(
        provider.kind,
        AiModelProviderKind::OpenAiCompatible
            | AiModelProviderKind::LmStudio
            | AiModelProviderKind::Ollama
    );
    if !compatible {
        return None;
    }
    let model = provider.models.first()?.id.clone();
    let base_url = provider_base_url(provider).ok()?;
    Some((
        provider,
        UserEndpoint {
            base_url,
            model,
            name: provider.name.clone(),
            key_id: Some(provider.id.clone()),
        },
    ))
}

/// `catalog` with the chosen own endpoint added last. An id that no longer
/// matches a usable saved provider is ignored.
pub fn with_own_endpoint(
    catalog: Catalog,
    settings: &FreeTierSettings,
    providers: &[AiModelProvider],
) -> Catalog {
    let chosen = settings.own_endpoint.as_deref().and_then(|id| {
        providers
            .iter()
            .filter(|provider| provider.id == id)
            .find_map(own_endpoint_for)
    });
    match chosen {
        Some((_, endpoint)) => catalog.with_user_endpoint(endpoint),
        None => catalog,
    }
}

impl FreeTierSettings {
    pub fn to_options(&self) -> RoutingOptions {
        RoutingOptions {
            opt_in: self.opt_in.clone(),
            strict: self.strict,
            disabled: self.disabled.clone(),
        }
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
    pub own_endpoint: Option<String>,
    pub endpoint_choices: Vec<EndpointChoice>,
}

pub fn overview(
    catalog: &Catalog,
    settings: &FreeTierSettings,
    providers_saved: &[AiModelProvider],
    keys: &impl KeyStore,
) -> FreeTierOverview {
    let catalog = &with_own_endpoint(catalog.clone(), settings, providers_saved);
    let options = settings.to_options();
    let providers = catalog
        .providers
        .iter()
        .filter(|provider| !provider.user_supplied)
        .map(|provider| {
            let credential = keys.credential(&provider.id);
            FreeTierProviderRow {
                id: provider.id.clone(),
                name: provider.name.clone(),
                default_on: provider.default_on,
                enabled: (provider.default_on || settings.opt_in.contains(&provider.id))
                    && !settings.disabled.contains(&provider.id),
                has_key: credential.is_some(),
                needs_account_id: provider.base_url.contains("{account_id}"),
                has_account_id: credential
                    .is_some_and(|credential| credential.account_id.is_some()),
                billing_warning: provider.billing_warning.clone(),
                hard_stop: provider.models.iter().any(|model| model.hard_stop),
            }
        })
        .collect();
    let mut route_order: Vec<String> = Vec::new();
    for target in catalog.targets(&options) {
        let id = &catalog.providers[target.provider].id;
        if route_order.last() != Some(id) {
            route_order.push(id.clone());
        }
    }
    FreeTierOverview {
        providers,
        strict: settings.strict,
        route_order,
        usable: has_usable_target(catalog, &options, keys),
        own_endpoint: settings.own_endpoint.clone(),
        endpoint_choices: endpoint_choices(providers_saved),
    }
}

/// Defaults when the file does not exist.
pub fn load_at(path: &Path) -> Result<FreeTierSettings, String> {
    if !path.exists() {
        return Ok(FreeTierSettings::default());
    }
    let raw = std::fs::read_to_string(path)
        .map_err(|error| format!("Failed to read free-tier settings: {error}"))?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("Failed to parse free-tier settings: {error}"))
}

pub fn save_at(path: &Path, settings: &FreeTierSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create the settings folder: {error}"))?;
    }
    let json = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Failed to serialize free-tier settings: {error}"))?;
    crate::secure_fs::write_owner_only_atomic(path, &json)
        .map_err(|error| format!("Failed to write free-tier settings: {error}"))
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
            own_endpoint: Some("lm_studio-abc".into()),
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
            own_endpoint: None,
        };

        let options = settings.to_options();

        assert!(options.strict);
        assert!(options.disabled.contains("groq"));
        assert!(options.opt_in.contains("cloudflare-ai"));
    }

    #[test]
    fn the_overview_lists_every_provider_in_the_fixed_order() {
        let view = overview(
            &Catalog::pinned(),
            &FreeTierSettings::default(),
            &[],
            &keys(&[]),
        );

        let ids: Vec<&str> = view.providers.iter().map(|row| row.id.as_str()).collect();
        assert_eq!(
            ids,
            [
                "groq",
                "mistral",
                "llm7",
                "openrouter",
                "nvidia",
                "cloudflare-ai"
            ]
        );
        assert!(row(&view, "groq").enabled);
        assert!(row(&view, "groq").hard_stop);
        assert!(!row(&view, "mistral").hard_stop);
    }

    #[test]
    fn cloudflare_is_off_until_opted_in_and_carries_its_warning() {
        let off = overview(
            &Catalog::pinned(),
            &FreeTierSettings::default(),
            &[],
            &keys(&[]),
        );
        let on = overview(
            &Catalog::pinned(),
            &FreeTierSettings {
                opt_in: ["cloudflare-ai".to_string()].into(),
                ..Default::default()
            },
            &[],
            &keys(&[]),
        );

        let cloudflare = row(&off, "cloudflare-ai");
        assert!(!cloudflare.default_on);
        assert!(!cloudflare.enabled);
        assert!(cloudflare.needs_account_id);
        assert!(cloudflare
            .billing_warning
            .as_deref()
            .is_some_and(|text| text.contains("billed")));
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
            &[],
            &keys(&[]),
        );

        assert!(!row(&view, "cloudflare-ai").enabled);
    }

    #[test]
    fn key_state_comes_from_the_store_and_never_the_key() {
        let view = overview(
            &Catalog::pinned(),
            &FreeTierSettings::default(),
            &[],
            &keys(&[("groq", None), ("cloudflare-ai", Some("acct"))]),
        );

        assert!(row(&view, "groq").has_key);
        assert!(!row(&view, "mistral").has_key);
        assert!(row(&view, "cloudflare-ai").has_account_id);
        let json = serde_json::to_string(&view).unwrap();
        assert!(
            !json.contains("test-groq"),
            "a key leaked into the overview: {json}"
        );
    }

    #[test]
    fn usable_and_route_order_follow_keys_switches_and_strict_mode() {
        let catalog = Catalog::pinned();
        let none = overview(&catalog, &FreeTierSettings::default(), &[], &keys(&[]));
        let both = keys(&[("groq", None), ("mistral", None)]);
        let normal = overview(&catalog, &FreeTierSettings::default(), &[], &both);
        let strict = overview(
            &catalog,
            &FreeTierSettings {
                strict: true,
                ..Default::default()
            },
            &[],
            &both,
        );
        let groq_off = overview(
            &catalog,
            &FreeTierSettings {
                disabled: ["groq".to_string()].into(),
                ..Default::default()
            },
            &[],
            &both,
        );

        assert!(!none.usable);
        assert!(normal.usable);
        assert_eq!(
            normal.route_order,
            ["groq", "mistral", "llm7", "openrouter", "nvidia"]
        );
        assert_eq!(strict.route_order, ["groq"]);
        assert!(groq_off.usable);
        assert_eq!(
            groq_off.route_order.first().map(String::as_str),
            Some("mistral")
        );
    }

    fn saved(id: &str, kind: &str, base_url: Option<&str>, model: Option<&str>) -> AiModelProvider {
        serde_json::from_value(serde_json::json!({
            "id": id,
            "name": format!("Saved {id}"),
            "kind": kind,
            "base_url": base_url,
            "api_key_storage": "none",
            "models": model.map(|model| vec![serde_json::json!({
                "id": model,
                "capabilities": {"streaming": true, "tools": true, "vision": false, "json_mode": false, "reasoning": false}
            })]).unwrap_or_default(),
        }))
        .unwrap()
    }

    fn saved_providers() -> Vec<AiModelProvider> {
        vec![
            saved(
                "lm_studio-pc",
                "lm_studio",
                Some("http://192.168.1.50:8080/v1"),
                Some("qwen"),
            ),
            saved("ollama-home", "ollama", None, Some("llama3.2")),
            saved(
                "open_ai_compatible-x",
                "open_ai_compatible",
                Some("https://hosted.test/v1"),
                Some("m"),
            ),
            saved("open_ai-main", "open_ai", None, Some("gpt-5-nano")),
            saved(
                "lm_studio-empty",
                "lm_studio",
                Some("http://127.0.0.1:1234/v1"),
                None,
            ),
        ]
    }

    #[test]
    fn own_endpoint_choices_are_compatible_providers_with_a_model() {
        let choices = endpoint_choices(&saved_providers());

        let ids: Vec<&str> = choices.iter().map(|choice| choice.id.as_str()).collect();
        assert_eq!(ids, ["lm_studio-pc", "ollama-home", "open_ai_compatible-x"]);
        assert_eq!(choices[0].name, "Saved lm_studio-pc");
    }

    #[test]
    fn the_chosen_endpoint_routes_last_under_its_own_name_and_key_id() {
        let settings = FreeTierSettings {
            own_endpoint: Some("lm_studio-pc".into()),
            ..Default::default()
        };

        let catalog = with_own_endpoint(Catalog::pinned(), &settings, &saved_providers());

        let last = catalog.providers.last().unwrap();
        assert!(last.user_supplied);
        assert_eq!(last.name, "Saved lm_studio-pc");
        assert_eq!(last.base_url, "http://192.168.1.50:8080/v1");
        assert_eq!(last.key_id.as_deref(), Some("lm_studio-pc"));
        assert_eq!(last.models[0].id, "qwen");
    }

    #[test]
    fn an_ollama_endpoint_without_a_url_uses_the_ollama_default() {
        let settings = FreeTierSettings {
            own_endpoint: Some("ollama-home".into()),
            ..Default::default()
        };

        let catalog = with_own_endpoint(Catalog::pinned(), &settings, &saved_providers());

        assert!(catalog.providers.last().unwrap().base_url.contains("11434"));
    }

    #[test]
    fn an_unknown_or_unusable_endpoint_is_ignored() {
        let plain = Catalog::pinned().providers.len();
        for id in ["gone", "open_ai-main", "lm_studio-empty"] {
            let settings = FreeTierSettings {
                own_endpoint: Some(id.into()),
                ..Default::default()
            };
            let catalog = with_own_endpoint(Catalog::pinned(), &settings, &saved_providers());
            assert_eq!(catalog.providers.len(), plain, "{id} must not route");
        }
    }

    #[test]
    fn a_keyless_own_endpoint_alone_makes_free_tier_usable() {
        let settings = FreeTierSettings {
            own_endpoint: Some("lm_studio-pc".into()),
            ..Default::default()
        };

        let view = overview(
            &Catalog::pinned(),
            &settings,
            &saved_providers(),
            &keys(&[]),
        );

        assert!(view.usable);
        assert_eq!(
            view.route_order.last().map(String::as_str),
            Some(crate::rhizome_routing::USER_ENDPOINT_ID)
        );
        assert_eq!(view.own_endpoint.as_deref(), Some("lm_studio-pc"));
        assert_eq!(view.endpoint_choices.len(), 3);
        assert!(
            view.providers
                .iter()
                .all(|row| row.id != crate::rhizome_routing::USER_ENDPOINT_ID),
            "the own endpoint is a dropdown, not a provider row"
        );
    }
}
