//! Pinned free-tier catalog (ADR-0182).
//!
//! Source: OmniRoute (https://github.com/diegosouzapw/OmniRoute), MIT,
//! Copyright (c) 2026 diegosouzapw. Pin and paths: `free_catalog.json` and
//! `docs/vendored-sources.md`. The rows are upstream data. The gate below is
//! Rhizome's own rule.

use std::collections::{BTreeMap, BTreeSet};

use serde::Deserialize;
use serde_json::{Map, Value};

/// The provider list and its upstream pin.
#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Catalog {
    pub(crate) source: CatalogSource,
    /// In priority order. The router tries the first provider first.
    pub(crate) providers: Vec<CatalogProvider>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CatalogSource {
    pub(crate) commit: String,
    pub(crate) curated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CatalogProvider {
    pub(crate) id: String,
    pub(crate) name: String,
    /// OpenAI-compatible base URL, without `/chat/completions`. The text
    /// `{account_id}` takes the account id from the credential.
    pub(crate) base_url: String,
    /// One key serves many upstream models, each with its own quota. A 429
    /// then locks the quota family, not the key.
    #[serde(default)]
    pub(crate) per_model_quota: bool,
    /// When set, only model ids that end with this text route.
    #[serde(default)]
    pub(crate) free_suffix: Option<String>,
    #[serde(default)]
    pub(crate) headers: BTreeMap<String, String>,
    /// Body fields sent only when the request offers tools.
    #[serde(default)]
    pub(crate) tool_params: Map<String, Value>,
    /// False only for the user-supplied endpoint, which may be keyless.
    #[serde(default = "key_required_default")]
    pub(crate) key_required: bool,
    /// The user-supplied endpoint skips the free-tier gate.
    #[serde(default)]
    pub(crate) user_supplied: bool,
    /// False for an opt-in provider. It routes only when the user turns it
    /// on (ADR-0182 decision 1).
    #[serde(default = "default_on_default")]
    pub(crate) default_on: bool,
    /// Shown before the user turns on an opt-in provider.
    #[serde(default)]
    pub(crate) billing_warning: Option<String>,
    /// Replaces a stale upstream `free_type` for every row of this
    /// provider. The upstream label stays in the row as ported.
    #[serde(default)]
    pub(crate) free_type_override: Option<String>,
    #[serde(default)]
    pub(crate) evidence: String,
    pub(crate) models: Vec<CatalogModel>,
}

fn key_required_default() -> bool {
    true
}

fn default_on_default() -> bool {
    true
}

/// The user's routing choices.
#[derive(Debug, Clone, Default)]
pub(crate) struct RoutingOptions {
    /// Opt-in provider ids the user turned on.
    pub(crate) opt_in: BTreeSet<String>,
    /// Route only rows with a documented hard stop, plus the user endpoint.
    /// Upstream `freeAccessPolicy=strict`. A missing flag means "not
    /// established", so the default mode does not check it.
    pub(crate) strict: bool,
}

/// One upstream free-model row.
#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CatalogModel {
    pub(crate) id: String,
    /// Upstream `freeType`, for example `recurring-daily`.
    pub(crate) free_type: String,
    /// Upstream ToS rating: `ok`, `caution`, `ambiguous`, or `avoid`.
    pub(crate) tos: String,
    /// Upstream `poolKey`: models that share one quota. `None` means the
    /// model has its own quota.
    #[serde(default)]
    pub(crate) pool: Option<String>,
    /// Upstream `hardStopGuaranteed`. Recorded, not gated (see the PR).
    #[serde(default)]
    pub(crate) hard_stop: bool,
    #[serde(default)]
    pub(crate) trains_on_prompts: bool,
}

/// One provider and model the router can try.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Target {
    pub(crate) provider: usize,
    pub(crate) model: String,
    /// The quota family: the upstream pool, or the model id.
    pub(crate) family: String,
}

/// A user-run OpenAI-compatible endpoint, tried after the catalog.
#[derive(Debug, Clone)]
pub(crate) struct UserEndpoint {
    pub(crate) base_url: String,
    pub(crate) model: String,
}

/// The provider id the router uses for the user endpoint and its key.
pub(crate) const USER_ENDPOINT_ID: &str = "custom";

impl Catalog {
    /// The catalog compiled into the app.
    pub(crate) fn pinned() -> Self {
        serde_json::from_str(include_str!("free_catalog.json"))
            .expect("the pinned free catalog must be valid JSON")
    }

    /// Adds the user endpoint last, after every catalog provider.
    pub(crate) fn with_user_endpoint(mut self, endpoint: UserEndpoint) -> Self {
        self.providers.push(CatalogProvider {
            id: USER_ENDPOINT_ID.into(),
            name: "Custom endpoint".into(),
            base_url: endpoint.base_url,
            per_model_quota: false,
            free_suffix: None,
            headers: BTreeMap::new(),
            tool_params: Map::new(),
            key_required: false,
            user_supplied: true,
            default_on: true,
            billing_warning: None,
            free_type_override: None,
            evidence: String::new(),
            models: vec![CatalogModel {
                id: endpoint.model,
                free_type: "user".into(),
                tos: "ok".into(),
                pool: None,
                hard_stop: false,
                trains_on_prompts: false,
            }],
        });
        self
    }

    /// Opt-in providers and the warning to show before the user turns one
    /// on.
    pub(crate) fn opt_in_warnings(&self) -> Vec<(&str, &str)> {
        self.providers
            .iter()
            .filter(|provider| !provider.default_on)
            .map(|provider| {
                (
                    provider.id.as_str(),
                    provider.billing_warning.as_deref().unwrap_or_default(),
                )
            })
            .collect()
    }

    /// Every routable provider and model, in priority order.
    pub(crate) fn targets(&self, options: &RoutingOptions) -> Vec<Target> {
        self.providers
            .iter()
            .enumerate()
            .filter(|(_, provider)| provider.default_on || options.opt_in.contains(&provider.id))
            .flat_map(|(index, provider)| {
                provider
                    .models
                    .iter()
                    .filter(move |model| exclusion(provider, model).is_none())
                    .filter(move |model| {
                        !options.strict || provider.user_supplied || model.hard_stop
                    })
                    .map(move |model| Target {
                        provider: index,
                        model: model.id.clone(),
                        family: model.pool.clone().unwrap_or_else(|| model.id.clone()),
                    })
            })
            .collect()
    }
}

/// Why a row does not route, or `None` when it does (ADR-0182 decisions 2
/// and 3).
pub(crate) fn exclusion(provider: &CatalogProvider, model: &CatalogModel) -> Option<&'static str> {
    if provider.user_supplied {
        return None;
    }
    if model.trains_on_prompts {
        return Some("the provider trains on prompts");
    }
    if !matches!(model.tos.as_str(), "ok" | "caution") {
        return Some("the ToS rating is not ok or caution");
    }
    let free_type = provider
        .free_type_override
        .as_deref()
        .unwrap_or(&model.free_type);
    if !free_type.starts_with("recurring-") {
        return Some("the free tier is not recurring");
    }
    if provider.id.ends_with("-web") {
        return Some("web scraper");
    }
    if model.id.starts_with("stealth/") {
        return Some("stealth path");
    }
    if let Some(suffix) = &provider.free_suffix {
        if !model.id.ends_with(suffix.as_str()) {
            return Some("not a free model id");
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(catalog: &Catalog, options: &RoutingOptions) -> Vec<String> {
        catalog
            .targets(options)
            .iter()
            .map(|target| format!("{}/{}", catalog.providers[target.provider].id, target.model))
            .collect()
    }

    fn providers(routable: &[String]) -> Vec<&str> {
        let mut seen: Vec<&str> = Vec::new();
        for id in routable {
            let provider = id.split('/').next().unwrap();
            if seen.last() != Some(&provider) {
                seen.push(provider);
            }
        }
        seen
    }

    fn opt_in(ids: &[&str]) -> RoutingOptions {
        RoutingOptions {
            opt_in: ids.iter().map(|id| id.to_string()).collect(),
            strict: false,
        }
    }

    #[test]
    fn the_pin_and_the_adr_priority_order_are_recorded() {
        let catalog = Catalog::pinned();

        assert_eq!(
            catalog.source.commit,
            "fc5e2bccd4f70fecf5aab94dfb8136c74ab5a21b"
        );
        assert_eq!(catalog.source.curated_at, "2026-09-12");
        let order: Vec<&str> = catalog.providers.iter().map(|p| p.id.as_str()).collect();
        // ADR-0182 decision 1: default-on in its listed order, then the
        // opt-in provider. Cerebras and GitHub Models are dropped.
        assert_eq!(
            order,
            [
                "groq",
                "mistral",
                "llm7",
                "openrouter",
                "nvidia",
                "cloudflare-ai"
            ]
        );
        assert!(catalog
            .providers
            .iter()
            .all(|provider| !provider.evidence.is_empty()));
    }

    #[test]
    fn default_on_routes_five_providers_and_cloudflare_waits_for_opt_in() {
        let catalog = Catalog::pinned();

        let default = ids(&catalog, &RoutingOptions::default());
        let with_cloudflare = ids(&catalog, &opt_in(&["cloudflare-ai"]));

        assert_eq!(
            providers(&default),
            ["groq", "mistral", "llm7", "openrouter", "nvidia"]
        );
        assert_eq!(default.first().unwrap(), "groq/openai/gpt-oss-120b");
        assert_eq!(
            providers(&with_cloudflare),
            [
                "groq",
                "mistral",
                "llm7",
                "openrouter",
                "nvidia",
                "cloudflare-ai"
            ]
        );
    }

    #[test]
    fn only_opt_in_providers_carry_a_billing_warning() {
        let catalog = Catalog::pinned();

        let warnings = catalog.opt_in_warnings();

        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].0, "cloudflare-ai");
        assert!(warnings[0].1.contains("billed"));
    }

    #[test]
    fn nvidia_routes_although_upstream_rows_still_say_one_time_credit() {
        let catalog = Catalog::pinned();
        let nvidia = catalog.providers.iter().find(|p| p.id == "nvidia").unwrap();

        // The upstream label stays as ported. FREE_TIERS.md says the credit
        // pool is gone, so the provider override wins.
        assert!(nvidia
            .models
            .iter()
            .all(|model| model.free_type == "one-time-initial"));
        assert_eq!(
            nvidia.free_type_override.as_deref(),
            Some("recurring-uncapped")
        );
        let routable = ids(&catalog, &RoutingOptions::default());
        assert!(routable.contains(&"nvidia/openai/gpt-oss-120b".to_string()));
    }

    #[test]
    fn the_gate_drops_stealth_and_non_free_openrouter_ids() {
        let routable = ids(&Catalog::pinned(), &RoutingOptions::default());

        assert!(routable.contains(&"openrouter/liquid/lfm-2.5-2.6b:free".to_string()));
        for dropped in ["openrouter/auto", "openrouter/stealth/"] {
            assert!(
                !routable.iter().any(|id| id.starts_with(dropped)),
                "{dropped} must not route: {routable:?}"
            );
        }
    }

    #[test]
    fn strict_mode_keeps_only_hard_stop_rows_and_the_user_endpoint() {
        let catalog = Catalog::pinned().with_user_endpoint(UserEndpoint {
            base_url: "http://lan:1234/v1".into(),
            model: "qwen".into(),
        });
        let strict = RoutingOptions {
            strict: true,
            ..opt_in(&["cloudflare-ai"])
        };

        let routable = ids(&catalog, &strict);

        assert_eq!(providers(&routable), ["groq", USER_ENDPOINT_ID]);
        // Upstream marks only Groq as a documented hard stop.
        assert_eq!(routable.len(), 6);
    }

    #[test]
    fn a_missing_hard_stop_flag_does_not_block_default_routing() {
        let catalog = Catalog::pinned();
        let mistral = catalog
            .providers
            .iter()
            .find(|p| p.id == "mistral")
            .unwrap();

        assert!(mistral.models.iter().all(|model| !model.hard_stop));
        assert!(ids(&catalog, &RoutingOptions::default())
            .iter()
            .any(|id| id.starts_with("mistral/")));
    }

    #[test]
    fn trains_on_prompts_and_avoid_rows_never_route() {
        let provider: CatalogProvider = serde_json::from_value(serde_json::json!({
            "id": "p", "name": "P", "base_url": "http://x/v1",
            "models": [
                { "id": "a", "free_type": "recurring-daily", "tos": "caution", "trains_on_prompts": true },
                { "id": "b", "free_type": "recurring-daily", "tos": "avoid" },
                { "id": "c", "free_type": "recurring-daily", "tos": "ok" }
            ]
        }))
        .unwrap();

        let reasons: Vec<_> = provider
            .models
            .iter()
            .map(|model| exclusion(&provider, model))
            .collect();

        assert_eq!(
            reasons,
            [
                Some("the provider trains on prompts"),
                Some("the ToS rating is not ok or caution"),
                None
            ]
        );
    }

    #[test]
    fn the_user_endpoint_routes_last_and_skips_the_gate() {
        let catalog = Catalog::pinned().with_user_endpoint(UserEndpoint {
            base_url: "http://lan:1234/v1".into(),
            model: "qwen".into(),
        });

        let targets = catalog.targets(&RoutingOptions::default());
        let last = targets.last().unwrap();

        assert_eq!(catalog.providers[last.provider].id, USER_ENDPOINT_ID);
        assert_eq!(last.model, "qwen");
        assert!(!catalog.providers[last.provider].key_required);
    }

    #[test]
    fn a_shared_pool_is_one_quota_family() {
        let catalog = Catalog::pinned();
        let targets = catalog.targets(&RoutingOptions::default());
        let family = |model: &str| {
            targets
                .iter()
                .find(|target| target.model == model)
                .map(|target| target.family.clone())
        };

        assert_eq!(family("mistral-large-latest").as_deref(), Some("mistral"));
        assert_eq!(family("codestral-latest").as_deref(), Some("mistral"));
        // Groq caps each model on its own, so the family is the model.
        assert_eq!(
            family("openai/gpt-oss-20b").as_deref(),
            Some("openai/gpt-oss-20b")
        );
    }
}
