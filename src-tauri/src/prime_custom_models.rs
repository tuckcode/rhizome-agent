//! User-asked custom providers in Prime's `models.json`.
//!
//! Prime's Chat catalog is whatever `get_available_models` returns. Built-in
//! hosts (OpenRouter, Anthropic) are already in that list. An OpenAI-compatible
//! host such as Nous Portal is not, until `~/.prime/agent/models.json` names it
//! and lists model ids. Settings → Add to Chat list is that write: merge one
//! provider, never the API key, never `auth.json`.

use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const NOUS_PORTAL_PROVIDER: &str = "nous-portal";
pub const NOUS_PORTAL_API_KEY_ENV: &str = "NOUS_API_KEY";
pub const NOUS_PORTAL_BASE_URL: &str = "https://inference-api.nousresearch.com/v1";
const NOUS_PORTAL_MODELS_URL: &str = "https://inference-api.nousresearch.com/v1/models";
const FETCH_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureNousPortalResult {
    pub provider: String,
    pub model_count: usize,
    pub reloaded: bool,
}

pub fn models_json_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".prime").join("agent").join("models.json"))
}

/// Prime's thinking levels above `off`, in Prime's order.
const PRIME_EFFORT_LEVELS: [&str; 6] = ["minimal", "low", "medium", "high", "xhigh", "max"];

/// `models.json` entries from an OpenAI-shaped `/v1/models` body, by id.
pub fn openai_models(value: &Value) -> Vec<Value> {
    let items = value
        .get("data")
        .and_then(Value::as_array)
        .or_else(|| value.get("models").and_then(Value::as_array));
    let Some(items) = items else {
        return Vec::new();
    };
    let mut models: Vec<Value> = items.iter().filter_map(model_entry).collect();
    models.sort_by(|a, b| a["id"].as_str().cmp(&b["id"].as_str()));
    models.dedup_by(|a, b| a["id"] == b["id"]);
    models
}

/// One `models.json` entry, with reasoning taken from what the host
/// advertises for that model.
///
/// Guessing from the name marked Claude Opus, GPT-5 and DeepSeek V4 as
/// non-reasoning, so Prime offered only "Off" for them. Nous lists
/// `supported_parameters` and `reasoning.supported_efforts` per model
/// (OpenRouter's shape), e.g. DeepSeek V4 Flash: `["xhigh", "high"]`.
pub fn model_entry(item: &Value) -> Option<Value> {
    let id = item.get("id")?.as_str()?.trim();
    if id.is_empty() {
        return None;
    }

    let mut entry = json!({ "id": id, "reasoning": supports_reasoning(item, id) });
    if let Some(map) = thinking_level_map(item) {
        entry["thinkingLevelMap"] = map;
    }
    Some(entry)
}

fn supports_reasoning(item: &Value, id: &str) -> bool {
    let advertised = item["supported_parameters"]
        .as_array()
        .is_some_and(|params| {
            params
                .iter()
                .any(|param| matches!(param.as_str(), Some("reasoning" | "reasoning_effort")))
        });
    advertised || item["reasoning"].is_object() || looks_like_reasoning_model(id)
}

/// Prime's `thinkingLevelMap` from the host's effort list.
///
/// A listed effort maps to itself, an unlisted one to `null` (hidden). With
/// no list, Prime's defaults stand. Mandatory reasoning hides `off`.
fn thinking_level_map(item: &Value) -> Option<Value> {
    let reasoning = item.get("reasoning")?.as_object()?;
    let mut map = serde_json::Map::new();

    if reasoning.get("mandatory") == Some(&Value::Bool(true)) {
        map.insert("off".into(), Value::Null);
    }

    let efforts = reasoning
        .get("supported_efforts")
        .and_then(Value::as_array)
        .filter(|efforts| !efforts.is_empty());
    if let Some(efforts) = efforts {
        for level in PRIME_EFFORT_LEVELS {
            let listed = efforts.iter().any(|effort| effort.as_str() == Some(level));
            let value = if listed {
                Value::from(level)
            } else {
                Value::Null
            };
            map.insert(level.into(), value);
        }
    }

    (!map.is_empty()).then_some(Value::Object(map))
}

/// Fallback for hosts that publish no reasoning metadata.
pub fn looks_like_reasoning_model(id: &str) -> bool {
    let lower = id.to_ascii_lowercase();
    lower.contains("hermes") || lower.contains("reason") || lower.contains("think")
}

/// Merge Nous Portal into an existing `models.json` object.
///
/// Other providers stay as they were. The API key field is the environment
/// variable *name*, never a pasted secret.
pub fn merge_nous_portal(existing: &Value, models: &[Value]) -> Result<Value, String> {
    if models.is_empty() {
        return Err("Nous Portal returned no models.".into());
    }
    if existing.is_null() {
        return Ok(models_file_with_nous(json!({}), models));
    }
    let Value::Object(_) = existing else {
        return Err(
            "Prime's models.json is not a JSON object. Fix or rename that file, then try again."
                .into(),
        );
    };
    Ok(models_file_with_nous(existing.clone(), models))
}

fn models_file_with_nous(mut root: Value, models: &[Value]) -> Value {
    if !root.is_object() {
        root = json!({});
    }
    let nous = json!({
        "baseUrl": NOUS_PORTAL_BASE_URL,
        "api": "openai-completions",
        "apiKey": NOUS_PORTAL_API_KEY_ENV,
        "authHeader": true,
        "compat": {
            "supportsDeveloperRole": false
        },
        "models": models,
    });
    {
        let providers = root
            .as_object_mut()
            .expect("root is an object")
            .entry("providers")
            .or_insert_with(|| json!({}));
        if !providers.is_object() {
            *providers = json!({});
        }
        providers[NOUS_PORTAL_PROVIDER] = nous;
    }
    root
}

pub fn write_nous_portal_models(path: &Path, models: &[Value]) -> Result<usize, String> {
    let existing = read_models_json(path)?;
    let merged = merge_nous_portal(&existing, models)?;
    let pretty = serde_json::to_string_pretty(&merged)
        .map_err(|error| format!("Could not write models.json: {error}"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create {parent}: {error}",
                parent = parent.display()
            )
        })?;
    }
    fs::write(path, format!("{pretty}\n"))
        .map_err(|error| format!("Could not write {path}: {error}", path = path.display()))?;
    Ok(models.len())
}

fn read_models_json(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(Value::Null);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Could not read {path}: {error}", path = path.display()))?;
    if raw.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&raw).map_err(|_| {
        "Prime's models.json is not valid JSON. Fix or rename that file, then try again.".into()
    })
}

pub fn fetch_nous_models() -> Result<Vec<Value>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(FETCH_TIMEOUT)
        .user_agent("Rhizome Agent")
        .build()
        .map_err(|error| format!("Could not reach Nous Portal: {error}"))?;
    let response = client
        .get(NOUS_PORTAL_MODELS_URL)
        .send()
        .map_err(|error| format!("Could not reach Nous Portal: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Nous Portal returned HTTP {status}."));
    }
    let body: Value = response
        .json()
        .map_err(|error| format!("Nous Portal returned a body this app could not read: {error}"))?;
    let models = openai_models(&body);
    if models.is_empty() {
        return Err("Nous Portal returned no models.".into());
    }
    Ok(models)
}

/// Fetch Nous Portal's public model list, merge it into Prime's `models.json`,
/// then reload the attached session so Chat sees the new provider.
pub fn ensure_nous_portal() -> Result<EnsureNousPortalResult, String> {
    let models = fetch_nous_models()?;
    let path = models_json_path().ok_or_else(|| "Could not find the home folder.".to_string())?;
    let model_count = write_nous_portal_models(&path, &models)?;
    let reloaded = crate::prime_session_host::reload_attached_session();
    Ok(EnsureNousPortalResult {
        provider: NOUS_PORTAL_PROVIDER.to_string(),
        model_count,
        reloaded,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// Entries for bare ids, as a host with no metadata would produce.
    fn entries(ids: &[&str]) -> Vec<Value> {
        ids.iter()
            .filter_map(|id| model_entry(&json!({ "id": id })))
            .collect()
    }

    #[test]
    fn reads_openai_shaped_model_ids() {
        let body = json!({
            "data": [
                { "id": "nousresearch/hermes-4-405b" },
                { "id": "  " },
                { "id": "tencent/hy3" },
                { "id": "nousresearch/hermes-4-405b" }
            ]
        });
        let models = openai_models(&body);
        let ids: Vec<&str> = models
            .iter()
            .map(|model| model["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, ["nousresearch/hermes-4-405b", "tencent/hy3"]);
    }

    #[test]
    fn maps_advertised_efforts_onto_prime_levels() {
        // deepseek/deepseek-v4-flash as Nous lists it, 2026-10-03.
        let item = json!({
            "id": "deepseek/deepseek-v4-flash",
            "supported_parameters": ["include_reasoning", "reasoning", "reasoning_effort"],
            "reasoning": { "mandatory": false, "supported_efforts": ["xhigh", "high"], "default_effort": "high" }
        });

        assert_eq!(
            model_entry(&item).unwrap(),
            json!({
                "id": "deepseek/deepseek-v4-flash",
                "reasoning": true,
                "thinkingLevelMap": {
                    "minimal": null, "low": null, "medium": null,
                    "high": "high", "xhigh": "xhigh", "max": null
                }
            })
        );
    }

    #[test]
    fn mandatory_reasoning_cannot_be_turned_off() {
        let item = json!({
            "id": "anthropic/claude-opus-5.5",
            "supported_parameters": ["reasoning", "reasoning_effort"],
            "reasoning": { "mandatory": true, "supported_efforts": ["max", "xhigh", "high", "medium", "low"] }
        });

        let entry = model_entry(&item).unwrap();
        assert_eq!(entry["thinkingLevelMap"]["off"], Value::Null);
        assert!(entry["thinkingLevelMap"]
            .as_object()
            .unwrap()
            .contains_key("off"));
        assert_eq!(entry["thinkingLevelMap"]["max"], "max");
        assert_eq!(entry["thinkingLevelMap"]["minimal"], Value::Null);
    }

    #[test]
    fn reasoning_without_listed_efforts_keeps_prime_defaults() {
        // openai/o3: reasons, but Nous does not list effort levels.
        let item = json!({
            "id": "openai/o3",
            "supported_parameters": ["include_reasoning", "reasoning"],
            "reasoning": { "mandatory": false }
        });

        assert_eq!(
            model_entry(&item).unwrap(),
            json!({ "id": "openai/o3", "reasoning": true })
        );
    }

    #[test]
    fn a_model_without_reasoning_stays_off() {
        let item = json!({ "id": "openai/gpt-4o", "supported_parameters": ["tools"] });
        assert_eq!(
            model_entry(&item).unwrap(),
            json!({ "id": "openai/gpt-4o", "reasoning": false })
        );
    }

    #[test]
    fn hermes_ids_count_as_reasoning() {
        assert!(looks_like_reasoning_model("nousresearch/hermes-4-405b"));
        assert!(!looks_like_reasoning_model("tencent/hy3"));
    }

    #[test]
    fn merge_keeps_other_providers_and_does_not_store_a_key() {
        let existing = json!({
            "providers": {
                "ollama": {
                    "baseUrl": "http://localhost:11434/v1",
                    "apiKey": "ollama",
                    "models": [{ "id": "llama3.1:8b" }]
                }
            }
        });
        let merged = merge_nous_portal(
            &existing,
            &entries(&["nousresearch/hermes-4-405b", "tencent/hy3"]),
        )
        .unwrap();

        assert_eq!(
            merged["providers"]["ollama"]["models"][0]["id"],
            "llama3.1:8b"
        );
        let nous = &merged["providers"]["nous-portal"];
        assert_eq!(nous["baseUrl"], NOUS_PORTAL_BASE_URL);
        assert_eq!(nous["api"], "openai-completions");
        assert_eq!(nous["apiKey"], NOUS_PORTAL_API_KEY_ENV);
        assert_eq!(nous["models"][0]["id"], "nousresearch/hermes-4-405b");
        assert_eq!(nous["models"][0]["reasoning"], true);
        assert_eq!(nous["models"][1]["id"], "tencent/hy3");
        assert_eq!(nous["models"][1]["reasoning"], false);
        let serialized = serde_json::to_string(&merged).unwrap();
        assert!(!serialized.contains("sk-"));
        assert!(!serialized.contains("paste-your-key"));
    }

    #[test]
    fn merge_starts_a_missing_file() {
        let merged = merge_nous_portal(&Value::Null, &entries(&["tencent/hy3"])).unwrap();
        assert_eq!(
            merged["providers"]["nous-portal"]["models"][0]["id"],
            "tencent/hy3"
        );
    }

    #[test]
    fn merge_refuses_an_empty_catalog() {
        let error = merge_nous_portal(&json!({}), &[]).unwrap_err();
        assert!(error.contains("no models"));
    }

    #[test]
    fn write_refuses_invalid_json_instead_of_overwriting() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("models.json");
        fs::write(&path, "{ not json }\n{ also not }\n").unwrap();
        let error = write_nous_portal_models(&path, &entries(&["tencent/hy3"])).unwrap_err();
        assert!(error.contains("not valid JSON"));
        let leftover = fs::read_to_string(&path).unwrap();
        assert!(leftover.contains("not json"));
    }

    #[test]
    fn write_replaces_only_the_nous_provider() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("models.json");
        fs::write(
            &path,
            r#"{ "providers": { "ollama": { "baseUrl": "http://localhost:11434/v1" } } }"#,
        )
        .unwrap();
        let count = write_nous_portal_models(&path, &entries(&["tencent/hy3"])).unwrap();
        assert_eq!(count, 1);
        let parsed: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(
            parsed["providers"]["ollama"]["baseUrl"],
            "http://localhost:11434/v1"
        );
        assert_eq!(
            parsed["providers"]["nous-portal"]["models"][0]["id"],
            "tencent/hy3"
        );
    }
}
