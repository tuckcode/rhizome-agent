//! Per-model reasoning levels.
//!
//! The resolver checks five sources, in order:
//! 1. the user's override
//! 2. the small Rhizome override table in this file
//! 3. a cached OpenRouter `/api/v1/models` body, for OpenRouter routes
//! 4. a cached models.dev `api.json`
//! 5. a local probe, for Ollama and LM Studio
//!
//! If none of them answers, the result is [`ReasoningSupport::Unknown`].
//! Unknown sends no reasoning params. There is no generic effort ladder.
//!
//! Real rows are added in `rhizome_overrides` only after that provider's own
//! docs name the levels. The doc URL is the row's `source`. OpenRouter and
//! models.dev plug in through the cache files written by
//! [`refresh_cached_catalogs`]. That is the seam for fetched catalogs.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::hermes_reasoning::{
    clamp_effort, parse_openrouter_reasoning_capabilities, EFFORT_LADDER,
};

const OPENROUTER_MODELS_URL: &str = "https://openrouter.ai/api/v1/models";
const MODELS_DEV_URL: &str = "https://models.dev/api.json";
const OPENROUTER_CACHE_FILE: &str = "openrouter-models.json";
const MODELS_DEV_CACHE_FILE: &str = "models-dev.json";

/// How a level is sent on the provider request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WireSend {
    /// A top-level string field. `name` is that field, for example `reasoning_effort`.
    StringField,
    /// A dotted object path. `name` is that path, for example `output_config.effort`.
    NestedString,
    /// A top-level boolean. `name` is that field, for example Ollama `think`.
    Boolean,
    /// NVIDIA NIM `chat_template_kwargs.enable_thinking`, plus `low_effort` on the `low` level.
    NimChatTemplate,
    /// DeepSeek `thinking.type` together with `reasoning_effort`.
    DeepSeekThinking,
    /// Gemma on NIM: the `<|think|>` token at the start of the system prompt.
    SystemThinkToken,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WireParam {
    pub name: String,
    pub send: WireSend,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReasoningLevel {
    pub id: String,
    pub label: String,
}

/// One model's ordered levels. `stated_default` is set only when the source
/// names that default. An empty `levels` list is a known row with no discrete
/// levels, which is not the same as [`ReasoningSupport::Unknown`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReasoningLevels {
    pub levels: Vec<ReasoningLevel>,
    pub wire: WireParam,
    pub stated_default: Option<String>,
    pub source: String,
    pub mandatory: bool,
}

/// `capabilities.reasoning`. Unknown means do not send a reasoning param.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum ReasoningSupport {
    #[default]
    Unknown,
    No,
    Levels(ReasoningLevels),
}

impl Serialize for ReasoningSupport {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let value = match self {
            Self::Unknown => json!({"state": "unknown"}),
            Self::No => json!({"state": "no"}),
            Self::Levels(levels) => {
                let mut value = serde_json::to_value(levels).map_err(serde::ser::Error::custom)?;
                if let Some(object) = value.as_object_mut() {
                    object.insert("state".into(), json!("levels"));
                }
                value
            }
        };
        value.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for ReasoningSupport {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = Value::deserialize(deserializer)?;
        match value {
            // Stored settings used a bool. Both values meant "not a verified
            // level list", so both load as unknown and send nothing.
            Value::Bool(_) | Value::Null => Ok(Self::Unknown),
            Value::Object(object) => match object.get("state").and_then(Value::as_str) {
                Some("unknown") => Ok(Self::Unknown),
                Some("no") => Ok(Self::No),
                Some("levels") => {
                    let levels: ReasoningLevels = serde_json::from_value(Value::Object(object))
                        .map_err(serde::de::Error::custom)?;
                    Ok(Self::Levels(levels))
                }
                _ => Err(serde::de::Error::custom(
                    "reasoning state must be unknown, no, or levels",
                )),
            },
            _ => Err(serde::de::Error::custom(
                "reasoning must be a bool or an object",
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReasoningResolution {
    pub support: ReasoningSupport,
    /// Set when the requested level was moved to a weaker one. The UI shows
    /// this. A move with this field empty is not produced.
    pub downgraded_from: Option<String>,
    /// `"Default"` unless the winning row names a default.
    pub default_label: String,
    /// The level id to send, after a visible downgrade. Empty when the caller
    /// did not request one, or the model has no levels.
    pub selected_level: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ResolveQuery<'a> {
    pub provider: &'a str,
    pub preset: Option<&'a str>,
    pub base_url: &'a str,
    pub model_id: &'a str,
    pub account: Option<&'a str>,
    pub api_key: Option<&'a str>,
    pub requested_level: Option<&'a str>,
    pub user_override: Option<ReasoningSupport>,
}

/// Live lookup answers. `None` means that layer did not answer.
pub trait ReasoningSources {
    fn openrouter_model(&self, model_id: &str) -> Option<Value>;
    fn models_dev_model(&self, provider: &str, model_id: &str) -> Option<Value>;
    fn local_probe(&self, provider: &str, base_url: &str, model_id: &str) -> Option<LocalProbe>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LocalProbe {
    Ollama { capabilities: Vec<String> },
    LmStudio { reasoning_efforts: Vec<String> },
}

pub struct EmptySources;

impl ReasoningSources for EmptySources {
    fn openrouter_model(&self, _model_id: &str) -> Option<Value> {
        None
    }
    fn models_dev_model(&self, _provider: &str, _model_id: &str) -> Option<Value> {
        None
    }
    fn local_probe(&self, _provider: &str, _base_url: &str, _model_id: &str) -> Option<LocalProbe> {
        None
    }
}

pub trait HttpGet {
    fn get_json(&self, url: &str) -> Result<Value, String>;
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ReasoningCacheKey {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub account: String,
}

#[derive(Debug, Default)]
pub struct ReasoningLookupCache {
    entries: HashMap<ReasoningCacheKey, ReasoningSupport>,
    api_keys: HashMap<(String, String), String>,
    base_urls: HashMap<(String, String), String>,
}

impl ReasoningLookupCache {
    pub fn get(&self, key: &ReasoningCacheKey) -> Option<&ReasoningSupport> {
        self.entries.get(key)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Drop cached lookups for this provider and account when the API key or
    /// the base URL changed. The first observation only records the value.
    pub fn observe_credentials(
        &mut self,
        provider: &str,
        account: &str,
        api_key: Option<&str>,
        base_url: &str,
    ) {
        let scope = (provider.trim().to_lowercase(), account.trim().to_string());
        let base_url = normalize_base_url(base_url);
        if let Some(api_key) = api_key {
            if self
                .api_keys
                .get(&scope)
                .is_some_and(|previous| previous != api_key)
            {
                self.drop_scope(&scope);
            }
            self.api_keys.insert(scope.clone(), api_key.to_string());
        }
        if self
            .base_urls
            .get(&scope)
            .is_some_and(|previous| previous != &base_url)
        {
            self.drop_scope(&scope);
        }
        self.base_urls.insert(scope, base_url);
    }

    fn drop_scope(&mut self, scope: &(String, String)) {
        let provider = scope.0.clone();
        let account = scope.1.clone();
        self.entries
            .retain(|key, _| key.provider != provider || key.account != account);
        self.api_keys.remove(scope);
        self.base_urls.remove(scope);
    }

    fn insert(&mut self, key: ReasoningCacheKey, support: ReasoningSupport) {
        self.entries.insert(key, support);
    }
}

pub fn cache_key(query: &ResolveQuery<'_>) -> ReasoningCacheKey {
    ReasoningCacheKey {
        provider: query.provider.trim().to_lowercase(),
        base_url: normalize_base_url(query.base_url),
        model: query.model_id.trim().to_string(),
        account: query.account.unwrap_or("").trim().to_string(),
    }
}

pub fn resolve(
    query: &ResolveQuery<'_>,
    sources: &dyn ReasoningSources,
    cache: &mut ReasoningLookupCache,
) -> ReasoningResolution {
    if let Some(support) = query.user_override.clone() {
        return finish(support, query.requested_level);
    }
    if let Some(support) = rhizome_override(query) {
        return finish(support, query.requested_level);
    }
    cache.observe_credentials(
        query.provider,
        query.account.unwrap_or(""),
        query.api_key,
        query.base_url,
    );
    let key = cache_key(query);
    if let Some(cached) = cache.get(&key).cloned() {
        return finish(cached, query.requested_level);
    }
    let support = live_support(query, sources);
    cache.insert(key, support.clone());
    finish(support, query.requested_level)
}

/// The label the pill shows before the user picks. `"Default"` unless the
/// row's source names a default level.
pub fn default_label_for(support: &ReasoningSupport) -> String {
    let ReasoningSupport::Levels(levels) = support else {
        return "Default".to_string();
    };
    let Some(id) = levels.stated_default.as_deref() else {
        return "Default".to_string();
    };
    levels
        .levels
        .iter()
        .find(|level| level.id == id)
        .map(|level| level.label.clone())
        .unwrap_or_else(|| "Default".to_string())
}

/// Reasoning state for one Taproot route. Uses the override table and, when
/// present, the on-disk OpenRouter and models.dev caches. No network call.
pub fn support_for_free_tier(
    provider_id: &str,
    base_url: &str,
    model_id: &str,
) -> ReasoningSupport {
    let query = ResolveQuery {
        provider: provider_id,
        preset: None,
        base_url,
        model_id,
        account: None,
        api_key: None,
        requested_level: None,
        user_override: None,
    };
    let sources = DiskSources {
        dir: default_reasoning_cache_dir(),
    };
    let mut cache = ReasoningLookupCache::default();
    resolve(&query, &sources, &mut cache).support
}

pub fn default_reasoning_cache_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("rhizome-agent")
        .join("reasoning-levels")
}

pub struct DiskSources {
    pub dir: PathBuf,
}

impl ReasoningSources for DiskSources {
    fn openrouter_model(&self, model_id: &str) -> Option<Value> {
        let body: Value = read_json(&self.dir.join(OPENROUTER_CACHE_FILE))?;
        let items = body.get("data")?.as_array()?;
        items
            .iter()
            .find(|item| item.get("id").and_then(Value::as_str) == Some(model_id))
            .cloned()
    }

    fn models_dev_model(&self, provider: &str, model_id: &str) -> Option<Value> {
        let body: Value = read_json(&self.dir.join(MODELS_DEV_CACHE_FILE))?;
        body.get(provider)?.get("models")?.get(model_id).cloned()
    }

    fn local_probe(&self, _provider: &str, _base_url: &str, _model_id: &str) -> Option<LocalProbe> {
        None
    }
}

/// Write the two fetched catalogs. Callers pass an HTTP client. Tests pass a fake.
pub fn refresh_cached_catalogs(dir: &Path, http: &dyn HttpGet) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let openrouter = http.get_json(OPENROUTER_MODELS_URL)?;
    let models_dev = http.get_json(MODELS_DEV_URL)?;
    write_json(&dir.join(OPENROUTER_CACHE_FILE), &openrouter)?;
    write_json(&dir.join(MODELS_DEV_CACHE_FILE), &models_dev)?;
    Ok(())
}

fn live_support(query: &ResolveQuery<'_>, sources: &dyn ReasoningSources) -> ReasoningSupport {
    if is_openrouter(query) {
        if let Some(item) = sources.openrouter_model(query.model_id.trim()) {
            if let Some(support) = from_openrouter(&item) {
                return support;
            }
        }
    }
    if let Some(item) =
        sources.models_dev_model(&query.provider.trim().to_lowercase(), query.model_id.trim())
    {
        if let Some(support) = from_models_dev(&item) {
            return support;
        }
    }
    if is_local(query) {
        if let Some(probe) = sources.local_probe(query.provider, query.base_url, query.model_id) {
            return from_probe(probe);
        }
    }
    ReasoningSupport::Unknown
}

fn from_openrouter(item: &Value) -> Option<ReasoningSupport> {
    let caps = parse_openrouter_reasoning_capabilities(item)?;
    if !caps.supports_reasoning {
        return Some(ReasoningSupport::No);
    }
    let stated_default = item
        .pointer("/reasoning/default_effort")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(str::to_lowercase);
    let ids = caps.supported_efforts.unwrap_or_default();
    let stated_default = stated_default.filter(|id| ids.iter().any(|level| level == id));
    Some(effort_levels(
        &ids.iter().map(String::as_str).collect::<Vec<_>>(),
        stated_default.as_deref(),
        "reasoning.effort",
        WireSend::NestedString,
        "https://openrouter.ai/api/v1/models",
        caps.mandatory,
    ))
}

fn from_models_dev(item: &Value) -> Option<ReasoningSupport> {
    let options = item.get("reasoning_options");
    if options.is_none() && item.get("reasoning").is_none() {
        return None;
    }
    let Some(options) = options.and_then(Value::as_object) else {
        return match item.get("reasoning") {
            Some(Value::Bool(false)) => Some(ReasoningSupport::No),
            _ => None,
        };
    };
    let kind = options.get("type").and_then(Value::as_str).unwrap_or("");
    let source = "https://models.dev/api.json";
    match kind {
        "effort" => {
            let ids = string_list(options.get("values"));
            if ids.is_empty() {
                return None;
            }
            let stated = options
                .get("default")
                .and_then(Value::as_str)
                .filter(|id| ids.iter().any(|level| level == id));
            Some(effort_levels(
                &ids.iter().map(String::as_str).collect::<Vec<_>>(),
                stated,
                "reasoning_effort",
                WireSend::StringField,
                source,
                false,
            ))
        }
        "toggle" => Some(toggle_levels("think", WireSend::Boolean, source, false)),
        "budget_tokens" => {
            let min = options.get("min").and_then(Value::as_u64).unwrap_or(0);
            let max = options.get("max").and_then(Value::as_u64).unwrap_or(0);
            Some(ReasoningSupport::Levels(ReasoningLevels {
                levels: Vec::new(),
                wire: WireParam {
                    name: format!("thinking_budget:{min}-{max}"),
                    send: WireSend::StringField,
                },
                stated_default: None,
                source: source.to_string(),
                mandatory: false,
            }))
        }
        _ => None,
    }
}

fn from_probe(probe: LocalProbe) -> ReasoningSupport {
    match probe {
        LocalProbe::Ollama { capabilities } => {
            let thinks = capabilities
                .iter()
                .any(|cap| cap.eq_ignore_ascii_case("thinking"));
            if thinks {
                toggle_levels(
                    "think",
                    WireSend::Boolean,
                    "ollama /api/show capabilities",
                    false,
                )
            } else {
                ReasoningSupport::No
            }
        }
        LocalProbe::LmStudio { reasoning_efforts } => {
            if reasoning_efforts.is_empty() {
                ReasoningSupport::No
            } else {
                effort_levels(
                    &reasoning_efforts
                        .iter()
                        .map(String::as_str)
                        .collect::<Vec<_>>(),
                    None,
                    "reasoning_effort",
                    WireSend::StringField,
                    "lm studio local probe",
                    false,
                )
            }
        }
    }
}

fn finish(support: ReasoningSupport, requested: Option<&str>) -> ReasoningResolution {
    let default_label = default_label_for(&support);
    let (selected_level, downgraded_from) = match &support {
        ReasoningSupport::Levels(levels) => select_level(requested, levels),
        _ => (None, None),
    };
    ReasoningResolution {
        support,
        downgraded_from,
        default_label,
        selected_level,
    }
}

fn select_level(
    requested: Option<&str>,
    levels: &ReasoningLevels,
) -> (Option<String>, Option<String>) {
    let Some(raw) = requested.map(str::trim).filter(|value| !value.is_empty()) else {
        return (None, None);
    };
    let requested = raw.to_lowercase();
    if let Some(level) = levels.levels.iter().find(|level| level.id == requested) {
        return (Some(level.id.clone()), None);
    }
    if levels.levels.is_empty() {
        return (None, None);
    }
    let ids: Vec<&str> = levels
        .levels
        .iter()
        .map(|level| level.id.as_str())
        .collect();
    let all_ladder = ids.iter().all(|id| EFFORT_LADDER.contains(id));
    if all_ladder {
        if let Some(clamped) = clamp_effort(Some(&requested), &ids, &[]) {
            if ids.contains(&clamped.as_str()) && clamped != requested {
                return (Some(clamped), Some(requested));
            }
        }
    }
    let pool: Vec<&ReasoningLevel> = levels
        .levels
        .iter()
        .filter(|level| level.id != "none")
        .collect();
    let pool = if pool.is_empty() {
        levels.levels.iter().collect::<Vec<_>>()
    } else {
        pool
    };
    if let Some(requested_idx) = EFFORT_LADDER.iter().position(|level| *level == requested) {
        let below: Vec<&&ReasoningLevel> = pool
            .iter()
            .filter(|level| {
                EFFORT_LADDER
                    .iter()
                    .position(|id| *id == level.id)
                    .is_some_and(|index| index < requested_idx)
            })
            .collect();
        if let Some(nearest) = below.iter().max_by_key(|level| {
            EFFORT_LADDER
                .iter()
                .position(|id| *id == level.id)
                .unwrap_or(0)
        }) {
            return (Some(nearest.id.clone()), Some(requested));
        }
    }
    let weakest = pool
        .first()
        .expect("pool is non-empty when levels is non-empty");
    (Some(weakest.id.clone()), Some(requested))
}

fn is_openrouter(query: &ResolveQuery<'_>) -> bool {
    let provider = query.provider.trim().to_lowercase();
    let preset = query.preset.unwrap_or("").trim().to_lowercase();
    provider == "openrouter"
        || provider == "open_router"
        || preset == "openrouter"
        || host_of(query.base_url) == "openrouter.ai"
}

fn is_local(query: &ResolveQuery<'_>) -> bool {
    let provider = query.provider.trim().to_lowercase();
    let preset = query.preset.unwrap_or("").trim().to_lowercase();
    matches!(provider.as_str(), "ollama" | "lm_studio" | "lmstudio")
        || matches!(preset.as_str(), "ollama" | "lm_studio" | "lmstudio")
}

struct OverrideRow {
    providers: &'static [&'static str],
    presets: &'static [&'static str],
    hosts: &'static [&'static str],
    exact_model: Option<&'static str>,
    support: ReasoningSupport,
}

fn rhizome_override(query: &ResolveQuery<'_>) -> Option<ReasoningSupport> {
    match_override(rhizome_overrides(), query)
}

fn match_override(rows: &[OverrideRow], query: &ResolveQuery<'_>) -> Option<ReasoningSupport> {
    let model = query.model_id.trim();
    let provider = query.provider.trim().to_lowercase();
    let preset = query.preset.unwrap_or("").trim().to_lowercase();
    let host = host_of(query.base_url);
    let identity = |row: &OverrideRow| {
        (!row.providers.is_empty() && row.providers.contains(&provider.as_str()))
            || (!row.presets.is_empty() && row.presets.contains(&preset.as_str()))
            || (!row.hosts.is_empty() && row.hosts.contains(&host.as_str()))
    };
    if let Some(row) = rows
        .iter()
        .find(|row| row.exact_model == Some(model) && identity(row))
    {
        return Some(row.support.clone());
    }
    rows.iter()
        .find(|row| row.exact_model.is_none() && identity(row))
        .map(|row| row.support.clone())
}

fn rhizome_overrides() -> &'static [OverrideRow] {
    use std::sync::OnceLock;
    static ROWS: OnceLock<Vec<OverrideRow>> = OnceLock::new();
    ROWS.get_or_init(build_overrides).as_slice()
}

fn build_overrides() -> Vec<OverrideRow> {
    const ANTHROPIC: &str = "https://docs.anthropic.com/en/docs/build-with-claude/effort";
    const GEMINI: &str = "https://ai.google.dev/gemini-api/docs/thinking";
    const XAI: &str = "https://docs.x.ai/docs/guides/reasoning";
    const DEEPSEEK: &str = "https://api-docs.deepseek.com/guides/thinking_mode";
    const NIM: &str = "https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-super-120b-a12b";
    const GEMMA: &str = "https://build.nvidia.com/google/gemma-4-31b-it/modelcard";
    let five = ["low", "medium", "high", "xhigh", "max"];
    let mut rows = Vec::new();
    let anthropic = |model: &'static str, default: &'static str| OverrideRow {
        providers: &["anthropic"],
        presets: &["anthropic"],
        hosts: &["api.anthropic.com"],
        exact_model: Some(model),
        support: effort_levels(
            &five,
            Some(default),
            "output_config.effort",
            WireSend::NestedString,
            ANTHROPIC,
            false,
        ),
    };
    // Doc: "supports all five effort levels", or an explicit low/medium/high/xhigh/max list.
    for (model, default) in [
        ("claude-fable-5-1", "high"),
        ("claude-mythos-5-1", "high"),
        ("claude-fable-5", "high"),
        ("claude-mythos-5", "high"),
        ("claude-opus-5-5", "medium"),
        ("claude-opus-5", "high"),
        ("claude-opus-4-8", "high"),
        ("claude-opus-4-7", "high"),
        ("claude-sonnet-5-5", "high"),
        ("claude-sonnet-5", "high"),
        ("claude-haiku-5-5", "medium"),
    ] {
        rows.push(anthropic(model, default));
    }
    rows.push(OverrideRow {
        providers: &["anthropic"],
        presets: &["anthropic"],
        hosts: &["api.anthropic.com"],
        exact_model: Some("claude-sonnet-4-6"),
        support: effort_levels(
            &["low", "medium", "high", "max"],
            Some("high"),
            "output_config.effort",
            WireSend::NestedString,
            ANTHROPIC,
            false,
        ),
    });

    let gemini = |model: &'static str,
                  ids: &'static [&'static str],
                  default: Option<&'static str>| OverrideRow {
        providers: &["gemini"],
        presets: &["gemini"],
        hosts: &["generativelanguage.googleapis.com"],
        exact_model: Some(model),
        support: effort_levels(
            ids,
            default,
            "generation_config.thinking_level",
            WireSend::NestedString,
            GEMINI,
            false,
        ),
    };
    let low_high = &["low", "medium", "high"][..];
    let with_minimal = &["minimal", "low", "medium", "high"][..];
    for (model, default) in [
        ("gemini-4-argon", Some("medium")),
        ("gemini-3.8-flash", Some("medium")),
        ("gemini-3.1-pro-preview", Some("high")),
    ] {
        rows.push(gemini(model, low_high, default));
    }
    for (model, default) in [
        ("gemini-3.6-flash", Some("medium")),
        ("gemini-3.5-flash-lite", Some("minimal")),
        ("gemini-3-flash-preview", Some("high")),
        ("gemini-robotics-er-2-preview", Some("high")),
    ] {
        rows.push(gemini(model, with_minimal, default));
    }
    rows.push(gemini(
        "gemini-3.1-flash-lite-image",
        &["minimal", "high"],
        Some("minimal"),
    ));
    rows.push(gemini(
        "gemini-3-pro-preview",
        &["low", "high"],
        Some("high"),
    ));
    // The table says "On" or "Off" and does not name a thinking_level default.
    for model in [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ] {
        rows.push(gemini(model, low_high, None));
    }

    let xai = |model: &'static str, ids: &'static [&'static str], mandatory: bool| OverrideRow {
        providers: &["xai"],
        presets: &["xai"],
        hosts: &["api.x.ai"],
        exact_model: Some(model),
        support: effort_levels(
            ids,
            Some("high"),
            "reasoning_effort",
            WireSend::StringField,
            XAI,
            mandatory,
        ),
    };
    let grok46 = &["low", "medium", "high", "xhigh"][..];
    rows.push(xai("grok-4.7", grok46, true));
    rows.push(xai("grok-4.6", grok46, true));
    rows.push(xai("grok-4.5", &["low", "medium", "high"], true));
    rows.push(OverrideRow {
        providers: &["xai"],
        presets: &["xai"],
        hosts: &["api.x.ai"],
        exact_model: Some("grok-4.20-multi-agent"),
        support: effort_levels(
            grok46,
            None,
            "reasoning_effort",
            WireSend::StringField,
            XAI,
            false,
        ),
    });

    for model in ["deepseek-flash", "deepseek-v4-pro"] {
        rows.push(OverrideRow {
            providers: &["deepseek"],
            presets: &["deepseek"],
            hosts: &["api.deepseek.com"],
            exact_model: Some(model),
            support: effort_levels(
                &["low", "high", "max"],
                Some("high"),
                "reasoning_effort",
                WireSend::DeepSeekThinking,
                DEEPSEEK,
                false,
            ),
        });
    }

    rows.push(OverrideRow {
        providers: &["nvidia"],
        presets: &["nvidia", "nvidia-nim"],
        hosts: &["integrate.api.nvidia.com"],
        exact_model: Some("nvidia/nemotron-3-super-120b-a12b"),
        support: effort_levels(
            &["off", "low", "on"],
            Some("on"),
            "chat_template_kwargs",
            WireSend::NimChatTemplate,
            NIM,
            false,
        ),
    });
    rows.push(OverrideRow {
        providers: &["nvidia"],
        presets: &["nvidia", "nvidia-nim"],
        hosts: &["integrate.api.nvidia.com"],
        exact_model: Some("google/gemma-4-31b-it"),
        support: toggle_levels(
            "system_think_token",
            WireSend::SystemThinkToken,
            GEMMA,
            false,
        ),
    });
    // The public model list has no reasoning fields. This stops a later layer
    // from inventing levels. https://llm7.io
    rows.push(OverrideRow {
        providers: &["llm7"],
        presets: &["llm7"],
        hosts: &["api.llm7.io"],
        exact_model: None,
        support: ReasoningSupport::Unknown,
    });
    rows
}

fn effort_levels(
    ids: &[&str],
    stated_default: Option<&str>,
    name: &str,
    send: WireSend,
    source: &str,
    mandatory: bool,
) -> ReasoningSupport {
    ReasoningSupport::Levels(ReasoningLevels {
        levels: ids
            .iter()
            .map(|id| ReasoningLevel {
                id: (*id).to_string(),
                label: label_for(id),
            })
            .collect(),
        wire: WireParam {
            name: name.to_string(),
            send,
        },
        stated_default: stated_default.map(str::to_string),
        source: source.to_string(),
        mandatory,
    })
}

fn toggle_levels(name: &str, send: WireSend, source: &str, mandatory: bool) -> ReasoningSupport {
    effort_levels(&["off", "on"], None, name, send, source, mandatory)
}

fn label_for(id: &str) -> String {
    let mut chars = id.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

fn host_of(base_url: &str) -> String {
    let trimmed = base_url.trim();
    let without_scheme = trimmed.split("://").nth(1).unwrap_or(trimmed);
    let host = without_scheme
        .split('/')
        .next()
        .unwrap_or("")
        .rsplit('@')
        .next()
        .unwrap_or("");
    host.split(':').next().unwrap_or("").to_lowercase()
}

fn normalize_base_url(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

fn string_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Option<T> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let text = serde_json::to_string(value).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::cell::RefCell;

    struct Scripted {
        openrouter: Option<Value>,
        models_dev: Option<Value>,
        probe: Option<LocalProbe>,
        calls: RefCell<Vec<&'static str>>,
    }

    impl ReasoningSources for Scripted {
        fn openrouter_model(&self, _model_id: &str) -> Option<Value> {
            self.calls.borrow_mut().push("openrouter");
            self.openrouter.clone()
        }
        fn models_dev_model(&self, _provider: &str, _model_id: &str) -> Option<Value> {
            self.calls.borrow_mut().push("models_dev");
            self.models_dev.clone()
        }
        fn local_probe(
            &self,
            _provider: &str,
            _base_url: &str,
            _model_id: &str,
        ) -> Option<LocalProbe> {
            self.calls.borrow_mut().push("probe");
            self.probe.clone()
        }
    }

    fn query<'a>(
        provider: &'a str,
        preset: Option<&'a str>,
        base_url: &'a str,
        model: &'a str,
    ) -> ResolveQuery<'a> {
        ResolveQuery {
            provider,
            preset,
            base_url,
            model_id: model,
            account: None,
            api_key: None,
            requested_level: None,
            user_override: None,
        }
    }

    fn ids(support: &ReasoningSupport) -> Vec<String> {
        match support {
            ReasoningSupport::Levels(levels) => {
                levels.levels.iter().map(|level| level.id.clone()).collect()
            }
            _ => Vec::new(),
        }
    }

    #[test]
    fn user_override_beats_every_later_layer() {
        let sources = Scripted {
            openrouter: Some(
                json!({"supported_parameters": ["reasoning"], "reasoning": {"supported_efforts": ["low"]}}),
            ),
            models_dev: Some(json!({"reasoning_options": {"type": "effort", "values": ["max"]}})),
            probe: Some(LocalProbe::Ollama {
                capabilities: vec!["thinking".into()],
            }),
            calls: RefCell::new(Vec::new()),
        };
        let mut query = query(
            "openrouter",
            None,
            "https://openrouter.ai/api/v1",
            "vendor/model",
        );
        query.user_override = Some(effort_levels(
            &["xhigh"],
            None,
            "reasoning_effort",
            WireSend::StringField,
            "user",
            false,
        ));
        let resolved = resolve(&query, &sources, &mut ReasoningLookupCache::default());
        assert_eq!(ids(&resolved.support), vec!["xhigh".to_string()]);
        assert!(sources.calls.borrow().is_empty());
    }

    #[test]
    fn rhizome_override_beats_openrouter_models_dev_and_probe() {
        let sources = Scripted {
            openrouter: Some(
                json!({"supported_parameters": ["reasoning"], "reasoning": {"supported_efforts": ["max"]}}),
            ),
            models_dev: Some(
                json!({"reasoning_options": {"type": "effort", "values": ["minimal"]}}),
            ),
            probe: Some(LocalProbe::LmStudio {
                reasoning_efforts: vec!["low".into()],
            }),
            calls: RefCell::new(Vec::new()),
        };
        let query = query(
            "deepseek",
            Some("deepseek"),
            "https://api.deepseek.com",
            "deepseek-flash",
        );
        let resolved = resolve(&query, &sources, &mut ReasoningLookupCache::default());
        assert_eq!(
            ids(&resolved.support),
            vec!["low".to_string(), "high".to_string(), "max".to_string()]
        );
        assert!(sources.calls.borrow().is_empty());
    }

    #[test]
    fn openrouter_beats_models_dev_on_an_openrouter_route() {
        let sources = Scripted {
            openrouter: Some(json!({
                "supported_parameters": ["reasoning"],
                "reasoning": {"supported_efforts": ["high", "low"], "default_effort": "low"}
            })),
            models_dev: Some(json!({"reasoning_options": {"type": "effort", "values": ["max"]}})),
            probe: None,
            calls: RefCell::new(Vec::new()),
        };
        let query = query(
            "openrouter",
            None,
            "https://openrouter.ai/api/v1",
            "vendor/model",
        );
        let resolved = resolve(&query, &sources, &mut ReasoningLookupCache::default());
        assert_eq!(
            ids(&resolved.support),
            vec!["high".to_string(), "low".to_string()]
        );
        assert_eq!(resolved.default_label, "Low");
        assert_eq!(sources.calls.borrow().as_slice(), ["openrouter"]);
    }

    #[test]
    fn models_dev_beats_the_local_probe_when_it_answers() {
        let sources = Scripted {
            openrouter: Some(
                json!({"supported_parameters": ["reasoning"], "reasoning": {"supported_efforts": ["max"]}}),
            ),
            models_dev: Some(
                json!({"reasoning_options": {"type": "effort", "values": ["z-custom", "a-custom"]}}),
            ),
            probe: Some(LocalProbe::Ollama {
                capabilities: vec!["thinking".into()],
            }),
            calls: RefCell::new(Vec::new()),
        };
        let query = query("ollama", None, "http://127.0.0.1:11434", "llama");
        let resolved = resolve(&query, &sources, &mut ReasoningLookupCache::default());
        assert_eq!(
            ids(&resolved.support),
            vec!["z-custom".to_string(), "a-custom".to_string()]
        );
        assert_eq!(sources.calls.borrow().as_slice(), ["models_dev"]);
    }

    #[test]
    fn local_probe_beats_unknown() {
        let sources = Scripted {
            openrouter: None,
            models_dev: None,
            probe: Some(LocalProbe::Ollama {
                capabilities: vec!["thinking".into()],
            }),
            calls: RefCell::new(Vec::new()),
        };
        let query = query("ollama", None, "http://127.0.0.1:11434", "llama");
        let resolved = resolve(&query, &sources, &mut ReasoningLookupCache::default());
        assert_eq!(
            ids(&resolved.support),
            vec!["off".to_string(), "on".to_string()]
        );
        match &resolved.support {
            ReasoningSupport::Levels(levels) => {
                assert_eq!(levels.wire.name, "think");
                assert_eq!(levels.wire.send, WireSend::Boolean);
            }
            other => panic!("expected levels, got {other:?}"),
        }
    }

    #[test]
    fn unknown_model_has_no_levels_and_no_generic_ladder() {
        let sources = Scripted {
            openrouter: None,
            models_dev: None,
            probe: None,
            calls: RefCell::new(Vec::new()),
        };
        let query = query(
            "groq",
            Some("groq"),
            "https://api.groq.com/openai/v1",
            "some-new-model",
        );
        let resolved = resolve(&query, &sources, &mut ReasoningLookupCache::default());
        assert_eq!(resolved.support, ReasoningSupport::Unknown);
        assert!(ids(&resolved.support).is_empty());
        assert_ne!(ids(&resolved.support).len(), 7);
        assert!(resolved.selected_level.is_none());
    }

    #[test]
    fn exact_model_beats_a_family_row() {
        let exact = resolve(
            &query(
                "nvidia",
                Some("nvidia"),
                "https://integrate.api.nvidia.com/v1",
                "google/gemma-4-31b-it",
            ),
            &EmptySources,
            &mut ReasoningLookupCache::default(),
        );
        match exact.support {
            ReasoningSupport::Levels(levels) => {
                assert_eq!(levels.wire.send, WireSend::SystemThinkToken)
            }
            other => panic!("expected gemma levels, got {other:?}"),
        }
        let family_only = resolve(
            &query("llm7", None, "https://api.llm7.io/v1", "any-model"),
            &Scripted {
                openrouter: None,
                models_dev: Some(
                    json!({"reasoning_options": {"type": "effort", "values": ["high"]}}),
                ),
                probe: None,
                calls: RefCell::new(Vec::new()),
            },
            &mut ReasoningLookupCache::default(),
        );
        assert_eq!(family_only.support, ReasoningSupport::Unknown);
    }

    fn fixture_keys(name: &str) -> (&'static [&'static str], &'static [&'static str]) {
        match name {
            "openai" => (&["openai"], &["api.openai.com"]),
            "anthropic" => (&["anthropic"], &["api.anthropic.com"]),
            "xai" => (&["xai"], &["api.x.ai"]),
            "gemini" => (&["gemini"], &["generativelanguage.googleapis.com"]),
            "openrouter" => (&["openrouter"], &["openrouter.ai"]),
            "groq" => (&["groq"], &["api.groq.com"]),
            "mistral" => (&["mistral"], &["api.mistral.ai"]),
            "deepseek" => (&["deepseek"], &["api.deepseek.com"]),
            "llm7" => (&["llm7"], &["api.llm7.io"]),
            "nvidia" => (&["nvidia"], &["integrate.api.nvidia.com"]),
            "cloudflare-ai" => (&["cloudflare-ai"], &["api.cloudflare.com"]),
            _ => (&[], &[]),
        }
    }

    #[test]
    fn family_match_covers_every_provider_preset_by_preset_or_host() {
        // Fixture rows, separate from the production table. providerPresets.ts
        // plus the Taproot hosts in free_catalog.json.
        for name in [
            "openai",
            "anthropic",
            "xai",
            "gemini",
            "openrouter",
            "groq",
            "mistral",
            "deepseek",
            "llm7",
            "nvidia",
            "cloudflare-ai",
        ] {
            let (presets, hosts) = fixture_keys(name);
            let family = effort_levels(
                &["fixture-low", "fixture-high"],
                None,
                "reasoning_effort",
                WireSend::StringField,
                "fixture",
                false,
            );
            let exact = effort_levels(
                &["exact"],
                None,
                "reasoning_effort",
                WireSend::StringField,
                "fixture",
                false,
            );
            let rows = [
                OverrideRow {
                    providers: &[],
                    presets,
                    hosts,
                    exact_model: Some("exact-model"),
                    support: exact,
                },
                OverrideRow {
                    providers: &[],
                    presets,
                    hosts,
                    exact_model: None,
                    support: family,
                },
            ];
            let by_preset = match_override(
                &rows,
                &query(
                    "open_ai_compatible",
                    Some(name),
                    "https://example.invalid/v1",
                    "any-model",
                ),
            );
            let url = format!("https://{}/v1", hosts[0]);
            let by_host = match_override(
                &rows,
                &query("open_ai_compatible", None, &url, "other-model"),
            );
            assert_eq!(
                ids(&by_preset.expect(name)),
                vec!["fixture-low".to_string(), "fixture-high".to_string()],
                "{name} by preset"
            );
            assert_eq!(ids(&by_host.expect(name)).len(), 2, "{name} by host");
            let exact_hit = match_override(
                &rows,
                &query(
                    "open_ai_compatible",
                    Some(name),
                    "https://example.invalid/v1",
                    "exact-model",
                ),
            );
            assert_eq!(ids(&exact_hit.expect(name)), vec!["exact".to_string()]);
        }
    }

    #[test]
    fn default_label_is_default_unless_the_source_names_one() {
        let unnamed = effort_levels(
            &["low", "high"],
            None,
            "reasoning_effort",
            WireSend::StringField,
            "fixture",
            false,
        );
        assert_eq!(default_label_for(&unnamed), "Default");
        let named = effort_levels(
            &["low", "high"],
            Some("high"),
            "reasoning_effort",
            WireSend::StringField,
            "fixture",
            false,
        );
        assert_eq!(default_label_for(&named), "High");
        let gemma = resolve(
            &query(
                "nvidia",
                None,
                "https://integrate.api.nvidia.com/v1",
                "google/gemma-4-31b-it",
            ),
            &EmptySources,
            &mut ReasoningLookupCache::default(),
        );
        assert_eq!(gemma.default_label, "Default");
        let flash = resolve(
            &query(
                "deepseek",
                None,
                "https://api.deepseek.com",
                "deepseek-flash",
            ),
            &EmptySources,
            &mut ReasoningLookupCache::default(),
        );
        assert_eq!(flash.default_label, "High");
    }

    #[test]
    fn levels_keep_source_order() {
        let support = from_models_dev(&json!({
            "reasoning_options": {"type": "effort", "values": ["z-last", "m-mid", "a-first"]}
        }))
        .expect("levels");
        assert_eq!(
            ids(&support),
            vec![
                "z-last".to_string(),
                "m-mid".to_string(),
                "a-first".to_string()
            ]
        );
    }

    #[test]
    fn downgrade_is_visible_and_moves_to_a_weaker_level() {
        let mut query = query("xai", Some("xai"), "https://api.x.ai/v1", "grok-4.5");
        query.requested_level = Some("xhigh");
        let resolved = resolve(&query, &EmptySources, &mut ReasoningLookupCache::default());
        assert_eq!(resolved.selected_level.as_deref(), Some("high"));
        assert_eq!(resolved.downgraded_from.as_deref(), Some("xhigh"));
        query.requested_level = Some("low");
        let kept = resolve(&query, &EmptySources, &mut ReasoningLookupCache::default());
        assert_eq!(kept.selected_level.as_deref(), Some("low"));
        assert!(kept.downgraded_from.is_none());
    }

    #[test]
    fn unknown_does_not_invent_a_level_for_a_request() {
        let mut query = query(
            "mistral",
            Some("mistral"),
            "https://api.mistral.ai/v1",
            "mistral-large-latest",
        );
        query.requested_level = Some("high");
        let resolved = resolve(&query, &EmptySources, &mut ReasoningLookupCache::default());
        assert_eq!(resolved.support, ReasoningSupport::Unknown);
        assert!(resolved.selected_level.is_none());
        assert!(resolved.downgraded_from.is_none());
    }

    #[test]
    fn cache_key_includes_provider_base_url_model_and_account() {
        let mut cache = ReasoningLookupCache::default();
        let mut query = query(
            "openrouter",
            None,
            "https://openrouter.ai/api/v1",
            "vendor/one",
        );
        query.account = Some("acc-a");
        query.api_key = Some("key-1");
        let sources = Scripted {
            openrouter: Some(
                json!({"supported_parameters": ["reasoning"], "reasoning": {"supported_efforts": ["low"]}}),
            ),
            models_dev: None,
            probe: None,
            calls: RefCell::new(Vec::new()),
        };
        resolve(&query, &sources, &mut cache);
        resolve(&query, &sources, &mut cache);
        assert_eq!(sources.calls.borrow().as_slice(), ["openrouter"]);
        query.account = Some("acc-b");
        resolve(&query, &sources, &mut cache);
        assert_eq!(sources.calls.borrow().len(), 2);
        query.account = Some("acc-a");
        query.model_id = "vendor/two";
        resolve(&query, &sources, &mut cache);
        assert_eq!(sources.calls.borrow().len(), 3);
    }

    #[test]
    fn cache_clears_when_the_api_key_or_base_url_changes() {
        let mut cache = ReasoningLookupCache::default();
        let mut query = query("groq", None, "https://api.groq.com/openai/v1", "fixture");
        query.account = Some("acc");
        query.api_key = Some("key-1");
        let sources = Scripted {
            openrouter: None,
            models_dev: Some(json!({"reasoning_options": {"type": "effort", "values": ["low"]}})),
            probe: None,
            calls: RefCell::new(Vec::new()),
        };
        resolve(&query, &sources, &mut cache);
        assert_eq!(cache.len(), 1);
        query.api_key = Some("key-2");
        resolve(&query, &sources, &mut cache);
        assert_eq!(sources.calls.borrow().len(), 2);
        query.base_url = "https://api.groq.com/openai/v2";
        resolve(&query, &sources, &mut cache);
        assert_eq!(sources.calls.borrow().len(), 3);
        assert!(!cache.is_empty());
    }

    #[test]
    fn legacy_bool_reasoning_deserializes_as_unknown() {
        let unknown: ReasoningSupport = serde_json::from_value(json!(false)).unwrap();
        assert_eq!(unknown, ReasoningSupport::Unknown);
        let also: ReasoningSupport = serde_json::from_value(json!(true)).unwrap();
        assert_eq!(also, ReasoningSupport::Unknown);
        let no: ReasoningSupport = serde_json::from_value(json!({"state": "no"})).unwrap();
        assert_eq!(no, ReasoningSupport::No);
    }

    #[test]
    fn openrouter_param_without_an_object_is_levels_and_object_without_param_is_no() {
        let yes = from_openrouter(&json!({"supported_parameters": ["reasoning"]})).unwrap();
        assert!(matches!(yes, ReasoningSupport::Levels(_)));
        assert!(ids(&yes).is_empty());
        let no = from_openrouter(&json!({
            "supported_parameters": ["tools"],
            "reasoning": {"mandatory": true}
        }))
        .unwrap();
        assert_eq!(no, ReasoningSupport::No);
        assert!(from_openrouter(&json!({"reasoning": {"supported_efforts": ["high"]}})).is_none());
    }

    #[test]
    fn refresh_writes_the_catalog_caches_the_resolver_reads() {
        let dir = tempfile::tempdir().unwrap();
        struct Fake;
        impl HttpGet for Fake {
            fn get_json(&self, url: &str) -> Result<Value, String> {
                if url.contains("openrouter") {
                    Ok(
                        json!({"data": [{"id": "vendor/m", "supported_parameters": ["reasoning"], "reasoning": {"supported_efforts": ["high"]}}]}),
                    )
                } else {
                    Ok(
                        json!({"groq": {"models": {"fixture": {"reasoning_options": {"type": "toggle"}}}}}),
                    )
                }
            }
        }
        refresh_cached_catalogs(dir.path(), &Fake).unwrap();
        let sources = DiskSources {
            dir: dir.path().to_path_buf(),
        };
        let openrouter = resolve(
            &query(
                "openrouter",
                None,
                "https://openrouter.ai/api/v1",
                "vendor/m",
            ),
            &sources,
            &mut ReasoningLookupCache::default(),
        );
        assert_eq!(ids(&openrouter.support), vec!["high".to_string()]);
        let groq = resolve(
            &query("groq", None, "https://api.groq.com/openai/v1", "fixture"),
            &sources,
            &mut ReasoningLookupCache::default(),
        );
        assert_eq!(
            ids(&groq.support),
            vec!["off".to_string(), "on".to_string()]
        );
    }

    #[test]
    fn verified_rows_cite_docs_and_unverified_providers_stay_unknown() {
        let flash = rhizome_override(&query(
            "gemini",
            Some("gemini"),
            "https://example.invalid",
            "gemini-3.8-flash",
        ))
        .unwrap();
        match flash {
            ReasoningSupport::Levels(levels) => {
                assert!(levels.source.contains("ai.google.dev"));
                assert_eq!(levels.stated_default.as_deref(), Some("medium"));
            }
            other => panic!("{other:?}"),
        }
        assert!(rhizome_override(&query(
            "openai",
            Some("openai"),
            "https://api.openai.com/v1",
            "gpt-6-luna"
        ))
        .is_none());
        assert!(rhizome_override(&query(
            "mistral",
            Some("mistral"),
            "https://api.mistral.ai/v1",
            "mistral-large-latest"
        ))
        .is_none());
        assert!(rhizome_override(&query(
            "groq",
            Some("groq"),
            "https://api.groq.com/openai/v1",
            "openai/gpt-oss-120b"
        ))
        .is_none());
        let nemotron = rhizome_override(&query(
            "nvidia",
            None,
            "https://integrate.api.nvidia.com/v1",
            "nvidia/nemotron-3-super-120b-a12b",
        ))
        .unwrap();
        assert_eq!(default_label_for(&nemotron), "On");
    }

    #[test]
    fn models_dev_false_is_no_and_a_missing_field_does_not_answer() {
        assert_eq!(
            from_models_dev(&json!({"reasoning": false})),
            Some(ReasoningSupport::No)
        );
        assert!(from_models_dev(&json!({"id": "x"})).is_none());
        let budget = from_models_dev(
            &json!({"reasoning_options": {"type": "budget_tokens", "min": 128, "max": 1024}}),
        )
        .unwrap();
        assert!(ids(&budget).is_empty());
        assert!(matches!(budget, ReasoningSupport::Levels(_)));
    }

    #[test]
    fn lm_studio_probe_uses_the_returned_efforts_only() {
        let levels = from_probe(LocalProbe::LmStudio {
            reasoning_efforts: vec!["high".into(), "low".into()],
        });
        assert_eq!(ids(&levels), vec!["high".to_string(), "low".to_string()]);
        assert_eq!(
            from_probe(LocalProbe::LmStudio {
                reasoning_efforts: vec![]
            }),
            ReasoningSupport::No
        );
        assert_eq!(
            from_probe(LocalProbe::Ollama {
                capabilities: vec!["completion".into()]
            }),
            ReasoningSupport::No
        );
    }
}
