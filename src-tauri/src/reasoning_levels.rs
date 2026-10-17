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

use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

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

#[derive(Clone)]
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

impl std::fmt::Debug for ResolveQuery<'_> {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("ResolveQuery")
            .field("provider", &self.provider)
            .field("preset", &self.preset)
            .field("base_url", &self.base_url)
            .field("model_id", &self.model_id)
            .field("account", &self.account)
            .field("api_key", &self.api_key.as_ref().map(|_| "<redacted>"))
            .field("requested_level", &self.requested_level)
            .field("user_override", &self.user_override)
            .finish()
    }
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
    key_fingerprints: HashMap<(String, String), u64>,
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
            let fingerprint = key_fingerprint(api_key);
            if self
                .key_fingerprints
                .get(&scope)
                .is_some_and(|previous| previous != &fingerprint)
            {
                self.drop_scope(&scope);
            }
            self.key_fingerprints.insert(scope.clone(), fingerprint);
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
        self.key_fingerprints.remove(scope);
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
/// Lookups share one process cache. The chat turn calls
/// [`reasoning_levels_for_target`], which uses this same cache.
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
        dir: reasoning_cache_dir(),
    };
    let mut cache = shared_lookup_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    resolve(&query, &sources, &mut cache).support
}

fn shared_lookup_cache() -> &'static Mutex<ReasoningLookupCache> {
    static CACHE: std::sync::OnceLock<Mutex<ReasoningLookupCache>> = std::sync::OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(ReasoningLookupCache::default()))
}

thread_local! {
    static CACHE_DIR_OVERRIDE: std::cell::RefCell<Option<PathBuf>> =
        const { std::cell::RefCell::new(None) };
}

/// Tests on this thread read catalogs from `dir` instead of the user data folder.
#[cfg(test)]
pub fn reset_reasoning_state_for_test(dir: Option<PathBuf>) {
    CACHE_DIR_OVERRIDE.with(|slot| *slot.borrow_mut() = dir);
}

fn reasoning_cache_dir() -> PathBuf {
    CACHE_DIR_OVERRIDE.with(|slot| {
        slot.borrow()
            .clone()
            .unwrap_or_else(default_reasoning_cache_dir)
    })
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

const CATALOG_TTL: Duration = Duration::from_secs(24 * 60 * 60);

struct ParsedCatalog {
    dir: PathBuf,
    openrouter_mtime: Option<SystemTime>,
    models_dev_mtime: Option<SystemTime>,
    loaded_at: SystemTime,
    openrouter: HashMap<String, Value>,
    models_dev: HashMap<String, HashMap<String, Value>>,
}

fn parsed_catalogs() -> &'static Mutex<Option<std::sync::Arc<ParsedCatalog>>> {
    static PARSED: std::sync::OnceLock<Mutex<Option<std::sync::Arc<ParsedCatalog>>>> =
        std::sync::OnceLock::new();
    PARSED.get_or_init(|| Mutex::new(None))
}

fn parsed_catalog(dir: &Path) -> Option<std::sync::Arc<ParsedCatalog>> {
    let mut slot = parsed_catalogs()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let fresh = slot
        .as_ref()
        .is_some_and(|parsed| catalog_is_fresh(parsed, dir));
    if !fresh {
        *slot = Some(std::sync::Arc::new(load_catalog(dir)));
    }
    slot.clone()
}

fn catalog_is_fresh(parsed: &ParsedCatalog, dir: &Path) -> bool {
    if parsed.dir != dir {
        return false;
    }
    let Some(age) = SystemTime::now().duration_since(parsed.loaded_at).ok() else {
        return false;
    };
    if age > CATALOG_TTL {
        return false;
    }
    file_mtime(&dir.join(OPENROUTER_CACHE_FILE)) == parsed.openrouter_mtime
        && file_mtime(&dir.join(MODELS_DEV_CACHE_FILE)) == parsed.models_dev_mtime
}

fn load_catalog(dir: &Path) -> ParsedCatalog {
    let openrouter_path = dir.join(OPENROUTER_CACHE_FILE);
    let models_dev_path = dir.join(MODELS_DEV_CACHE_FILE);
    let mut openrouter = HashMap::new();
    if let Some(body) = read_json::<Value>(&openrouter_path) {
        if let Some(items) = body.get("data").and_then(Value::as_array) {
            for item in items {
                if let Some(id) = item.get("id").and_then(Value::as_str) {
                    openrouter.insert(id.to_string(), item.clone());
                }
            }
        }
    }
    let mut models_dev = HashMap::new();
    if let Some(body) = read_json::<Value>(&models_dev_path) {
        if let Some(providers) = body.as_object() {
            for (provider, entry) in providers {
                let Some(models) = entry.get("models").and_then(Value::as_object) else {
                    continue;
                };
                let mut indexed = HashMap::new();
                for (model_id, model) in models {
                    indexed.insert(model_id.clone(), model.clone());
                }
                models_dev.insert(provider.clone(), indexed);
            }
        }
    }
    ParsedCatalog {
        dir: dir.to_path_buf(),
        openrouter_mtime: file_mtime(&openrouter_path),
        models_dev_mtime: file_mtime(&models_dev_path),
        loaded_at: SystemTime::now(),
        openrouter,
        models_dev,
    }
}

fn file_mtime(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).and_then(|meta| meta.modified()).ok()
}

/// Process-local cache discriminator. Not a password hash: the value never
/// leaves this process, and it only tells a new key from the previous one.
fn key_fingerprint(api_key: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    api_key.hash(&mut hasher);
    hasher.finish()
}

impl ReasoningSources for DiskSources {
    fn openrouter_model(&self, model_id: &str) -> Option<Value> {
        let parsed = parsed_catalog(&self.dir)?;
        parsed.openrouter.get(model_id).cloned()
    }

    fn models_dev_model(&self, provider: &str, model_id: &str) -> Option<Value> {
        let parsed = parsed_catalog(&self.dir)?;
        parsed
            .models_dev
            .get(provider)
            .and_then(|models| models.get(model_id))
            .cloned()
    }

    fn local_probe(&self, _provider: &str, _base_url: &str, _model_id: &str) -> Option<LocalProbe> {
        None
    }
}

/// Write the two fetched catalogs. Nothing in the app calls this yet, so the
/// OpenRouter and models.dev layers stay inactive until a later PR wires a
/// fetch with a timeout, a 24h TTL, and a path off the chat turn. Tests pass
/// a fake HTTP client.
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
    for family in models_dev_families(query) {
        if let Some(item) = sources.models_dev_model(&family, query.model_id.trim()) {
            if let Some(support) = from_models_dev(&family, &item) {
                return support;
            }
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

fn from_models_dev(family: &str, item: &Value) -> Option<ReasoningSupport> {
    let source = "https://models.dev/api.json";
    let Some(options) = item.get("reasoning_options") else {
        return match item.get("reasoning") {
            Some(Value::Bool(false)) => Some(ReasoningSupport::No),
            _ => None,
        };
    };
    // Live api.json stores an array of {type, values|min|max}. An object is
    // not that document, so it does not answer.
    let Some(options) = options.as_array() else {
        return Some(ReasoningSupport::Unknown);
    };
    if options.is_empty() {
        return match item.get("reasoning") {
            Some(Value::Bool(false)) => Some(ReasoningSupport::No),
            Some(_) => Some(ReasoningSupport::Unknown),
            None => None,
        };
    }
    // Prefer effort when both are present. Live rows put toggle first
    // (deepseek-v4-flash-vision-exp, nvidia moonshotai/kimi-k3, Cloudflare
    // Nemotron), and stopping at toggle hid the effort list.
    let mut effort: Option<&serde_json::Map<String, Value>> = None;
    let mut toggle = false;
    let mut saw_option = false;
    for option in options {
        let Some(option) = option.as_object() else {
            continue;
        };
        saw_option = true;
        match option.get("type").and_then(Value::as_str) {
            Some("effort") if effort.is_none() && !string_list(option.get("values")).is_empty() => {
                effort = Some(option);
            }
            Some("toggle") => toggle = true,
            _ => {}
        }
    }
    if let Some(option) = effort {
        let ids = string_list(option.get("values"));
        let Some((name, send)) = effort_wire(family) else {
            return Some(ReasoningSupport::Unknown);
        };
        let stated = option
            .get("default")
            .and_then(Value::as_str)
            .filter(|id| ids.iter().any(|level| level == id));
        return Some(effort_levels(
            &ids.iter().map(String::as_str).collect::<Vec<_>>(),
            stated,
            name,
            send,
            source,
            false,
        ));
    }
    if toggle {
        let Some((name, send)) = toggle_wire(family) else {
            return Some(ReasoningSupport::Unknown);
        };
        return Some(toggle_levels(name, send, source, false));
    }
    if saw_option {
        Some(ReasoningSupport::Unknown)
    } else {
        None
    }
}

fn effort_wire(family: &str) -> Option<(&'static str, WireSend)> {
    match family {
        "anthropic" => Some(("output_config.effort", WireSend::NestedString)),
        "openrouter" => Some(("reasoning.effort", WireSend::NestedString)),
        "openai" | "xai" | "groq" | "deepseek" | "mistral" | "google" | "nvidia" => {
            Some(("reasoning_effort", WireSend::StringField))
        }
        _ => None,
    }
}

fn toggle_wire(family: &str) -> Option<(&'static str, WireSend)> {
    // models.dev has no `ollama` provider (live api.json). This `think`
    // mapping is only reached when another layer names the ollama family.
    match family {
        "ollama" => Some(("think", WireSend::Boolean)),
        _ => None,
    }
}

fn models_dev_families(query: &ResolveQuery<'_>) -> Vec<String> {
    let mut families = Vec::new();
    let mut push = |token: &str| {
        if let Some(family) = models_dev_family(token) {
            if !families.iter().any(|seen| seen == family) {
                families.push(family.to_string());
            }
        }
    };
    if let Some(preset) = query.preset {
        push(preset);
    }
    push(&host_of(query.base_url));
    push(query.provider);
    families
}

fn models_dev_family(token: &str) -> Option<&'static str> {
    match token.trim().to_lowercase().as_str() {
        "openai" | "open_ai" | "api.openai.com" => Some("openai"),
        "anthropic" | "api.anthropic.com" => Some("anthropic"),
        "xai" | "api.x.ai" => Some("xai"),
        "gemini" | "google" | "generativelanguage.googleapis.com" => Some("google"),
        "openrouter" | "open_router" | "openrouter.ai" => Some("openrouter"),
        "groq" | "api.groq.com" => Some("groq"),
        "mistral" | "api.mistral.ai" => Some("mistral"),
        "deepseek" | "api.deepseek.com" => Some("deepseek"),
        "nvidia" | "nvidia-nim" | "integrate.api.nvidia.com" => Some("nvidia"),
        "ollama" => Some("ollama"),
        "cloudflare-ai" | "cloudflare-workers-ai" | "api.cloudflare.com" => {
            Some("cloudflare-workers-ai")
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

fn map_known_level(
    requested: &str,
    levels: &ReasoningLevels,
) -> Option<(Option<String>, Option<String>)> {
    let ids: Vec<&str> = levels
        .levels
        .iter()
        .map(|level| level.id.as_str())
        .collect();
    let has = |id: &str| ids.contains(&id);
    if has("off") && has("on") && !has("low") {
        let selected = if matches!(requested, "off" | "none" | "disabled") {
            "off"
        } else {
            "on"
        };
        let notice = (selected != requested).then(|| requested.to_string());
        return Some((Some(selected.to_string()), notice));
    }
    if matches!(levels.wire.send, WireSend::NimChatTemplate)
        && has("off")
        && has("low")
        && has("on")
    {
        let selected = match requested {
            "off" | "none" | "disabled" => "off",
            "low" => "low",
            "high" | "max" | "xhigh" | "ultra" | "on" => "on",
            _ => return None,
        };
        let notice = (selected != requested).then(|| requested.to_string());
        return Some((Some(selected.to_string()), notice));
    }
    if matches!(levels.wire.send, WireSend::DeepSeekThinking) {
        let mapped = match requested {
            "minimal" => "low",
            "medium" => "high",
            "xhigh" => "high",
            "ultra" => "max",
            "none" | "disabled" => "off",
            _ => return None,
        };
        if !has(mapped) {
            return None;
        }
        let weaker = match (
            EFFORT_LADDER.iter().position(|level| *level == requested),
            EFFORT_LADDER.iter().position(|level| *level == mapped),
        ) {
            (Some(requested_idx), Some(mapped_idx)) => mapped_idx < requested_idx,
            _ => false,
        };
        let notice = weaker.then(|| requested.to_string());
        return Some((Some(mapped.to_string()), notice));
    }
    None
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
    if let Some(mapped) = map_known_level(&requested, levels) {
        return mapped;
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
    const GEMINI: &str = "https://ai.google.dev/gemini-api/docs/openai";
    const XAI_43: &str = "https://docs.x.ai/docs/models/grok-4.3";
    const DEEPSEEK_PRICING: &str = "https://api-docs.deepseek.com/quick_start/pricing";
    const XAI: &str = "https://docs.x.ai/docs/guides/reasoning";
    const DEEPSEEK: &str = "https://api-docs.deepseek.com/guides/thinking_mode";
    const NIM: &str = "https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-super-120b-a12b";
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
    for model in [
        "claude-sonnet-4-6",
        "claude-opus-4-6",
        "claude-mythos-preview",
    ] {
        rows.push(OverrideRow {
            providers: &["anthropic"],
            presets: &["anthropic"],
            hosts: &["api.anthropic.com"],
            exact_model: Some(model),
            support: effort_levels(
                &["low", "medium", "high", "max"],
                Some("high"),
                "output_config.effort",
                WireSend::NestedString,
                ANTHROPIC,
                false,
            ),
        });
    }
    for model in ["claude-opus-4-5", "claude-opus-4-5-20251101"] {
        rows.push(OverrideRow {
            providers: &["anthropic"],
            presets: &["anthropic"],
            hosts: &["api.anthropic.com"],
            exact_model: Some(model),
            support: effort_levels(
                &["low", "medium", "high"],
                Some("high"),
                "output_config.effort",
                WireSend::NestedString,
                ANTHROPIC,
                false,
            ),
        });
    }

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
            "reasoning_effort",
            WireSend::StringField,
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
    // OpenAI-compat endpoint: `none` disables thinking on 2.5 models except 2.5 Pro.
    // Compat doc maps `reasoning_effort: minimal` to a 2.5 thinking budget of
    // 1,024. `none` stays off 2.5 Pro.
    rows.push(gemini(
        "gemini-2.5-pro",
        &["minimal", "low", "medium", "high"],
        None,
    ));
    rows.push(gemini(
        "gemini-2.5-flash",
        &["none", "minimal", "low", "medium", "high"],
        None,
    ));
    rows.push(gemini(
        "gemini-2.5-flash-lite",
        &["none", "minimal", "low", "medium", "high"],
        None,
    ));

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
        exact_model: Some("grok-4.3"),
        support: effort_levels(
            &["none", "low", "medium", "high", "xhigh"],
            Some("low"),
            "reasoning_effort",
            WireSend::StringField,
            XAI_43,
            false,
        ),
    });
    // Effort on the multi-agent model sets the agent count, not reasoning depth.
    for model in ["grok-4.20-multi-agent", "grok-4.20-multi-agent-0309"] {
        rows.push(OverrideRow {
            providers: &["xai"],
            presets: &["xai"],
            hosts: &["api.x.ai"],
            exact_model: Some(model),
            support: ReasoningSupport::No,
        });
    }

    for model in ["deepseek-flash", "deepseek-v4-pro", "deepseek-v4-flash"] {
        let source = if model == "deepseek-v4-flash" {
            DEEPSEEK_PRICING
        } else {
            DEEPSEEK
        };
        rows.push(OverrideRow {
            providers: &["deepseek"],
            presets: &["deepseek"],
            hosts: &["api.deepseek.com"],
            exact_model: Some(model),
            support: effort_levels(
                &["off", "low", "high", "max"],
                Some("high"),
                "reasoning_effort",
                WireSend::DeepSeekThinking,
                source,
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
    // The model card describes a `<|think|>` system token. That was not
    // checked with a live call on the hosted NIM API, so the row stays unknown.
    rows.push(OverrideRow {
        providers: &["nvidia"],
        presets: &["nvidia", "nvidia-nim"],
        hosts: &["integrate.api.nvidia.com"],
        exact_model: Some("google/gemma-4-31b-it"),
        support: ReasoningSupport::Unknown,
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

/// Output-token floor when a thinking level is sent.
///
/// Reasoning tokens count toward the completion limit. A cap that is used up
/// by reasoning comes back as an empty message:
/// <https://platform.openai.com/docs/guides/reasoning>
///
/// Anthropic counts `budget_tokens` (minimum 1024) inside `max_tokens`, so
/// the cap has to be larger than the thinking budget:
/// <https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking>
pub const REASONING_OUTPUT_FLOOR: u32 = 16_384;

/// Provider body fields for one user chat turn.
///
/// `body` is empty when the model is unknown, has no reasoning, or the
/// caller did not ask for a level. The chat turn merges `body` and does not
/// read catalog rows itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReasoningTargetRequest {
    pub body: serde_json::Map<String, Value>,
    /// Prepended to the system prompt when a row uses [`WireSend::SystemThinkToken`].
    /// No checked row does. Gemma on NIM is unknown.
    pub system_prefix: Option<String>,
    pub selected_level: Option<String>,
    pub downgraded_from: Option<String>,
    /// Set when the sent level spends completion tokens on reasoning.
    /// `none` and `off` stay unset.
    pub min_max_tokens: Option<u32>,
}

/// Model plus level, as the provider request fields for one user chat turn.
///
/// This is the only function the chat turn calls. It uses [`resolve`] and
/// the public wire shape on the winning row. Unknown support sends nothing.
pub fn reasoning_levels_for_target(
    provider: &str,
    base_url: &str,
    model_id: &str,
    requested_level: Option<&str>,
) -> ReasoningTargetRequest {
    let query = ResolveQuery {
        provider,
        preset: None,
        base_url,
        model_id,
        account: None,
        api_key: None,
        requested_level,
        user_override: None,
    };
    let sources = DiskSources {
        dir: reasoning_cache_dir(),
    };
    let mut cache = shared_lookup_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let resolution = resolve(&query, &sources, &mut cache);
    fields_for_resolution(&resolution)
}

fn fields_for_resolution(resolution: &ReasoningResolution) -> ReasoningTargetRequest {
    let ReasoningSupport::Levels(levels) = &resolution.support else {
        return empty_target();
    };
    let Some(selected) = resolution.selected_level.as_deref() else {
        return empty_target();
    };
    let mut body = serde_json::Map::new();
    let mut system_prefix = None;
    match levels.wire.send {
        WireSend::StringField => {
            body.insert(levels.wire.name.clone(), json!(selected));
        }
        WireSend::NestedString => {
            set_dotted(&mut body, &levels.wire.name, json!(selected));
        }
        WireSend::Boolean => {
            let enabled = !matches!(selected, "off" | "none" | "false" | "disabled");
            body.insert(levels.wire.name.clone(), json!(enabled));
        }
        WireSend::NimChatTemplate => {
            let enabled = !matches!(selected, "off" | "none" | "false" | "disabled");
            let mut kwargs = serde_json::Map::new();
            kwargs.insert("enable_thinking".into(), json!(enabled));
            if selected == "low" {
                kwargs.insert("low_effort".into(), json!(true));
            }
            body.insert(levels.wire.name.clone(), Value::Object(kwargs));
        }
        WireSend::DeepSeekThinking => {
            let enabled = !matches!(selected, "off" | "none" | "false" | "disabled");
            body.insert(
                "thinking".into(),
                json!({ "type": if enabled { "enabled" } else { "disabled" } }),
            );
            if enabled {
                body.insert("reasoning_effort".into(), json!(selected));
            }
        }
        // No checked row uses this variant. Gemma on NIM stays unknown until
        // a live NIM call confirms the `<|think|>` token.
        WireSend::SystemThinkToken => {
            if !matches!(selected, "off" | "none" | "false" | "disabled") {
                system_prefix = Some("<|think|>".to_string());
            }
        }
    }
    let thinking = !matches!(selected, "off" | "none" | "false" | "disabled");
    let min_max_tokens = thinking.then_some(REASONING_OUTPUT_FLOOR);
    ReasoningTargetRequest {
        body,
        system_prefix,
        selected_level: Some(selected.to_string()),
        downgraded_from: resolution.downgraded_from.clone(),
        min_max_tokens,
    }
}

fn empty_target() -> ReasoningTargetRequest {
    ReasoningTargetRequest {
        body: serde_json::Map::new(),
        system_prefix: None,
        selected_level: None,
        downgraded_from: None,
        min_max_tokens: None,
    }
}

fn set_dotted(body: &mut serde_json::Map<String, Value>, path: &str, value: Value) {
    let mut parts = path.split('.').filter(|part| !part.is_empty()).peekable();
    let Some(first) = parts.next() else {
        return;
    };
    if parts.peek().is_none() {
        body.insert(first.to_string(), value);
        return;
    }
    let entry = body
        .entry(first)
        .or_insert_with(|| Value::Object(serde_json::Map::new()));
    if !entry.is_object() {
        *entry = Value::Object(serde_json::Map::new());
    }
    let mut cursor = entry.as_object_mut().expect("object");
    while let Some(part) = parts.next() {
        if parts.peek().is_none() {
            cursor.insert(part.to_string(), value);
            return;
        }
        let next = cursor
            .entry(part)
            .or_insert_with(|| Value::Object(serde_json::Map::new()));
        if !next.is_object() {
            *next = Value::Object(serde_json::Map::new());
        }
        cursor = next.as_object_mut().expect("object");
    }
}

/// Notice the chat channel carries when a saved level cannot be sent as-is.
/// The `code` is for the UI. This struct holds no display copy.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReasoningLevelNotice {
    pub code: String,
    pub from: Option<String>,
    pub to: Option<String>,
}

/// Live level for one chat. `native_chat_send` updates it; the user turn reads it.
pub type ReasoningLevelSlot = std::sync::Arc<std::sync::Mutex<Option<String>>>;

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
            vec![
                "off".to_string(),
                "low".to_string(),
                "high".to_string(),
                "max".to_string()
            ]
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
                json!({"reasoning_options": [{"type": "effort", "values": ["z-custom", "a-custom"]}]}),
            ),
            probe: Some(LocalProbe::Ollama {
                capabilities: vec!["thinking".into()],
            }),
            calls: RefCell::new(Vec::new()),
        };
        let query = query("groq", None, "https://api.groq.com/openai/v1", "llama");
        let resolved = resolve(&query, &sources, &mut ReasoningLookupCache::default());
        assert_eq!(
            ids(&resolved.support),
            vec!["z-custom".to_string(), "a-custom".to_string()]
        );
        match &resolved.support {
            ReasoningSupport::Levels(levels) => assert_eq!(levels.wire.name, "reasoning_effort"),
            other => panic!("expected levels, got {other:?}"),
        }
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
                "nvidia/nemotron-3-super-120b-a12b",
            ),
            &EmptySources,
            &mut ReasoningLookupCache::default(),
        );
        match exact.support {
            ReasoningSupport::Levels(levels) => {
                assert_eq!(levels.wire.send, WireSend::NimChatTemplate)
            }
            other => panic!("expected nemotron levels, got {other:?}"),
        }
        let gemma = resolve(
            &query(
                "nvidia",
                Some("nvidia"),
                "https://integrate.api.nvidia.com/v1",
                "google/gemma-4-31b-it",
            ),
            &EmptySources,
            &mut ReasoningLookupCache::default(),
        );
        assert_eq!(gemma.support, ReasoningSupport::Unknown);
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
        let pro = resolve(
            &query(
                "gemini",
                Some("gemini"),
                "https://generativelanguage.googleapis.com/v1beta/openai",
                "gemini-2.5-pro",
            ),
            &EmptySources,
            &mut ReasoningLookupCache::default(),
        );
        assert_eq!(pro.default_label, "Default");
        match pro.support {
            ReasoningSupport::Levels(levels) => {
                assert_eq!(levels.wire.name, "reasoning_effort");
                assert!(!levels.levels.iter().any(|level| level.id == "none"));
            }
            other => panic!("expected gemini levels, got {other:?}"),
        }
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
        let support = from_models_dev(
            "groq",
            &json!({"reasoning_options": [{"type": "effort", "values": ["z-last", "m-mid", "a-first"]}]}),
        )
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
            models_dev: Some(json!({"reasoning_options": [{"type": "effort", "values": ["low"]}]})),
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
        assert!(cache
            .key_fingerprints
            .values()
            .all(|fingerprint| fingerprint.to_string() != "key-1"));
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
                        json!({"groq": {"models": {"fixture": {"reasoning_options": [{"type": "effort", "values": ["low", "high"]}]}}}}),
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
            vec!["low".to_string(), "high".to_string()]
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
            from_models_dev("groq", &json!({"reasoning": false})),
            Some(ReasoningSupport::No)
        );
        assert!(from_models_dev("groq", &json!({"id": "x"})).is_none());
        let budget = from_models_dev(
            "anthropic",
            &json!({"reasoning_options": [{"type": "budget_tokens", "min": 1024}]}),
        )
        .unwrap();
        assert_eq!(budget, ReasoningSupport::Unknown);
        let anthropic = from_models_dev(
            "anthropic",
            &json!({"reasoning_options": [{"type": "effort", "values": ["low", "high"]}]}),
        )
        .unwrap();
        match anthropic {
            ReasoningSupport::Levels(levels) => {
                assert_eq!(levels.wire.name, "output_config.effort");
            }
            other => panic!("expected anthropic effort, got {other:?}"),
        }
        let toggle = from_models_dev(
            "groq",
            &json!({"reasoning": true, "reasoning_options": [{"type": "toggle"}]}),
        )
        .unwrap();
        assert_eq!(toggle, ReasoningSupport::Unknown);
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

    #[test]
    fn models_dev_matches_a_host_not_a_rhizome_provider_id() {
        struct Recording {
            seen: RefCell<Vec<String>>,
        }
        impl ReasoningSources for Recording {
            fn openrouter_model(&self, _model_id: &str) -> Option<Value> {
                None
            }
            fn models_dev_model(&self, provider: &str, model_id: &str) -> Option<Value> {
                self.seen.borrow_mut().push(provider.to_string());
                (provider == "openai" && model_id == "gpt-5.4").then(|| {
                    json!({"reasoning_options": [{"type": "effort", "values": ["low", "high"]}]})
                })
            }
            fn local_probe(
                &self,
                _provider: &str,
                _base_url: &str,
                _model_id: &str,
            ) -> Option<LocalProbe> {
                None
            }
        }
        let sources = Recording {
            seen: RefCell::new(Vec::new()),
        };
        let resolved = resolve(
            &query("work-openai", None, "https://api.openai.com/v1", "gpt-5.4"),
            &sources,
            &mut ReasoningLookupCache::default(),
        );
        assert_eq!(sources.seen.borrow().as_slice(), ["openai"]);
        assert_eq!(
            ids(&resolved.support),
            vec!["low".to_string(), "high".to_string()]
        );
        match resolved.support {
            ReasoningSupport::Levels(levels) => assert_eq!(levels.wire.name, "reasoning_effort"),
            other => panic!("expected levels, got {other:?}"),
        }
    }

    #[test]
    fn on_off_and_nemotron_map_effort_without_turning_thinking_off() {
        let toggle = effort_levels(
            &["off", "on"],
            None,
            "think",
            WireSend::Boolean,
            "fixture",
            false,
        );
        let ReasoningSupport::Levels(toggle) = toggle else {
            panic!("levels");
        };
        let (selected, from) = select_level(Some("max"), &toggle);
        assert_eq!(selected.as_deref(), Some("on"));
        assert_eq!(from.as_deref(), Some("max"));

        let mut query = query(
            "nvidia",
            Some("nvidia"),
            "https://integrate.api.nvidia.com/v1",
            "nvidia/nemotron-3-super-120b-a12b",
        );
        query.requested_level = Some("high");
        let high = resolve(&query, &EmptySources, &mut ReasoningLookupCache::default());
        assert_eq!(high.selected_level.as_deref(), Some("on"));
        assert_eq!(high.downgraded_from.as_deref(), Some("high"));
        query.requested_level = Some("low");
        let low = resolve(&query, &EmptySources, &mut ReasoningLookupCache::default());
        assert_eq!(low.selected_level.as_deref(), Some("low"));
        assert!(low.downgraded_from.is_none());
        query.requested_level = Some("medium");
        let medium = resolve(&query, &EmptySources, &mut ReasoningLookupCache::default());
        assert_eq!(medium.selected_level.as_deref(), Some("low"));
        assert_eq!(medium.downgraded_from.as_deref(), Some("medium"));
        query.requested_level = Some("minimal");
        let minimal = resolve(&query, &EmptySources, &mut ReasoningLookupCache::default());
        assert_eq!(minimal.selected_level.as_deref(), Some("off"));
        assert_eq!(minimal.downgraded_from.as_deref(), Some("minimal"));
    }

    #[test]
    fn deepseek_medium_maps_up_to_high_without_a_downgrade_notice() {
        let mut query = query(
            "deepseek",
            Some("deepseek"),
            "https://api.deepseek.com",
            "deepseek-flash",
        );
        query.requested_level = Some("medium");
        let resolved = resolve(&query, &EmptySources, &mut ReasoningLookupCache::default());
        assert_eq!(resolved.selected_level.as_deref(), Some("high"));
        assert!(resolved.downgraded_from.is_none());
        match resolved.support {
            ReasoningSupport::Levels(levels) => {
                assert_eq!(levels.wire.send, WireSend::DeepSeekThinking);
                assert!(levels.levels.iter().any(|level| level.id == "off"));
            }
            other => panic!("expected deepseek levels, got {other:?}"),
        }
    }

    #[test]
    fn checked_rows_use_the_provider_request_field() {
        let gemini = rhizome_override(&query(
            "gemini",
            Some("gemini"),
            "https://generativelanguage.googleapis.com/v1beta/openai",
            "gemini-3.8-flash",
        ))
        .unwrap();
        match gemini {
            ReasoningSupport::Levels(levels) => {
                assert_eq!(levels.wire.name, "reasoning_effort");
                assert!(levels.source.contains("docs/openai"));
            }
            other => panic!("{other:?}"),
        }
        let flash = rhizome_override(&query(
            "gemini",
            Some("gemini"),
            "https://generativelanguage.googleapis.com/v1beta/openai",
            "gemini-2.5-flash",
        ))
        .unwrap();
        assert!(ids(&flash).contains(&"none".to_string()));
        assert!(ids(&flash).contains(&"minimal".to_string()));
        let pro = rhizome_override(&query(
            "gemini",
            Some("gemini"),
            "https://generativelanguage.googleapis.com/v1beta/openai",
            "gemini-2.5-pro",
        ))
        .unwrap();
        assert!(ids(&pro).contains(&"minimal".to_string()));
        assert!(!ids(&pro).contains(&"none".to_string()));
        let opus = rhizome_override(&query(
            "anthropic",
            Some("anthropic"),
            "https://api.anthropic.com/v1",
            "claude-opus-4-6",
        ))
        .unwrap();
        assert_eq!(
            ids(&opus),
            vec![
                "low".to_string(),
                "medium".to_string(),
                "high".to_string(),
                "max".to_string()
            ]
        );
        let grok = rhizome_override(&query(
            "xai",
            Some("xai"),
            "https://api.x.ai/v1",
            "grok-4.3",
        ))
        .unwrap();
        assert!(ids(&grok).contains(&"xhigh".to_string()));
        assert_eq!(default_label_for(&grok), "Low");
        assert_eq!(
            rhizome_override(&query(
                "xai",
                Some("xai"),
                "https://api.x.ai/v1",
                "grok-4.20-multi-agent",
            )),
            Some(ReasoningSupport::No)
        );
    }

    #[test]
    fn free_tier_lookup_reuses_the_shared_cache() {
        let dir = tempfile::tempdir().unwrap();
        reset_reasoning_state_for_test(Some(dir.path().to_path_buf()));
        let first = support_for_free_tier(
            "nvidia",
            "https://integrate.api.nvidia.com/v1",
            "not-a-real-model",
        );
        let second = support_for_free_tier(
            "nvidia",
            "https://integrate.api.nvidia.com/v1",
            "not-a-real-model",
        );
        assert_eq!(first, ReasoningSupport::Unknown);
        assert_eq!(second, first);
        reset_reasoning_state_for_test(None);
    }

    #[test]
    fn models_dev_prefers_effort_when_toggle_is_listed_first() {
        let support = from_models_dev(
            "deepseek",
            &json!({
                "reasoning_options": [
                    {"type": "toggle"},
                    {"type": "effort", "values": ["low", "high", "max"]}
                ]
            }),
        )
        .expect("effort");
        assert_eq!(
            ids(&support),
            vec!["low".to_string(), "high".to_string(), "max".to_string()]
        );
        match support {
            ReasoningSupport::Levels(levels) => assert_eq!(levels.wire.name, "reasoning_effort"),
            other => panic!("expected effort levels, got {other:?}"),
        }
    }

    #[test]
    fn debug_redacts_the_api_key() {
        let mut query = query("openai", None, "https://api.openai.com/v1", "gpt-5.4");
        query.api_key = Some("sk-test-secret-value");
        let rendered = format!("{query:?}");
        assert!(rendered.contains("<redacted>"));
        assert!(!rendered.contains("sk-test-secret-value"));
    }

    #[test]
    fn target_fields_follow_the_resolved_wire_shape() {
        reset_reasoning_state_for_test(None);
        let grok =
            reasoning_levels_for_target("xai", "https://api.x.ai/v1", "grok-4.7", Some("high"));
        assert_eq!(
            grok.body.get("reasoning_effort").and_then(Value::as_str),
            Some("high")
        );
        assert_eq!(grok.min_max_tokens, Some(REASONING_OUTPUT_FLOOR));
        assert!(grok.downgraded_from.is_none());

        let gemini = reasoning_levels_for_target(
            "gemini",
            "https://generativelanguage.googleapis.com/v1beta/openai",
            "gemini-3.8-flash",
            Some("medium"),
        );
        assert_eq!(gemini.body.get("reasoning_effort"), Some(&json!("medium")));
        assert!(gemini.body.get("generation_config").is_none());

        let deepseek = reasoning_levels_for_target(
            "deepseek",
            "https://api.deepseek.com",
            "deepseek-flash",
            Some("low"),
        );
        assert_eq!(deepseek.body["thinking"]["type"], json!("enabled"));
        assert_eq!(deepseek.body["reasoning_effort"], json!("low"));
        let deepseek_medium = reasoning_levels_for_target(
            "deepseek",
            "https://api.deepseek.com",
            "deepseek-flash",
            Some("medium"),
        );
        assert_eq!(deepseek_medium.selected_level.as_deref(), Some("high"));
        assert!(deepseek_medium.downgraded_from.is_none());
        assert_eq!(deepseek_medium.body["reasoning_effort"], json!("high"));

        let nemotron = reasoning_levels_for_target(
            "nvidia",
            "https://integrate.api.nvidia.com/v1",
            "nvidia/nemotron-3-super-120b-a12b",
            Some("low"),
        );
        assert_eq!(
            nemotron.body["chat_template_kwargs"]["enable_thinking"],
            json!(true)
        );
        assert_eq!(
            nemotron.body["chat_template_kwargs"]["low_effort"],
            json!(true)
        );
        let nemotron_high = reasoning_levels_for_target(
            "nvidia",
            "https://integrate.api.nvidia.com/v1",
            "nvidia/nemotron-3-super-120b-a12b",
            Some("high"),
        );
        assert_eq!(nemotron_high.selected_level.as_deref(), Some("on"));
        assert_eq!(nemotron_high.downgraded_from.as_deref(), Some("high"));
        assert_eq!(
            nemotron_high.body["chat_template_kwargs"]["enable_thinking"],
            json!(true)
        );

        let multi = reasoning_levels_for_target(
            "xai",
            "https://api.x.ai/v1",
            "grok-4.20-multi-agent",
            Some("high"),
        );
        assert!(multi.body.is_empty());
        let gemma = reasoning_levels_for_target(
            "nvidia",
            "https://integrate.api.nvidia.com/v1",
            "google/gemma-4-31b-it",
            Some("on"),
        );
        assert!(gemma.body.is_empty());
        assert!(gemma.system_prefix.is_none());
    }

    #[test]
    fn an_unknown_model_sends_no_request_fields() {
        reset_reasoning_state_for_test(None);
        let unknown = reasoning_levels_for_target(
            "llm7",
            "https://api.llm7.io/v1",
            "some-model",
            Some("high"),
        );
        assert!(unknown.body.is_empty());
        assert!(unknown.system_prefix.is_none());
        assert!(unknown.selected_level.is_none());
        assert!(unknown.min_max_tokens.is_none());
        assert!(unknown.downgraded_from.is_none());
    }

    #[test]
    fn a_stronger_level_steps_down_and_names_the_old_one() {
        reset_reasoning_state_for_test(None);
        let stepped =
            reasoning_levels_for_target("xai", "https://api.x.ai/v1", "grok-4.7", Some("max"));
        assert_eq!(stepped.selected_level.as_deref(), Some("xhigh"));
        assert_eq!(stepped.downgraded_from.as_deref(), Some("max"));
        assert_eq!(stepped.body["reasoning_effort"], json!("xhigh"));
    }
}
