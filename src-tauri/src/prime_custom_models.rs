//! User-asked custom providers in Prime's `models.json`.
//!
//! Prime's Chat catalog is whatever `get_available_models` returns. Built-in
//! hosts (OpenRouter, Anthropic) are already in that list. An OpenAI-compatible
//! host such as Nous Portal is not, until `~/.prime/agent/models.json` names it
//! and lists model ids. Settings → Add to Chat list is that write: merge one
//! provider, copy each record's reasoning flag and input modalities, never
//! the API key, never `auth.json`.

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

/// One Nous `/v1/models` record, reduced to the fields Prime stores.
///
/// `reasoning` on the wire is an object when the model can think, and absent
/// when it cannot. Prime stores a boolean. `input` is only `text` and `image`.
/// Nous also sends video, file, and audio. Those tokens are dropped. Prime's
/// schema rejects them, and a rejected file hides the whole provider.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NousCatalogModel {
    pub id: String,
    pub reasoning: bool,
    pub input: Vec<String>,
}

/// Catalog rows from an OpenAI-shaped `/v1/models` body.
///
/// Fields come from each record. The id is not a hint. A name that contains
/// "claude" or "glm" does not set reasoning or image input.
pub fn nous_catalog_models(value: &Value) -> Vec<NousCatalogModel> {
    let items = value
        .get("data")
        .and_then(Value::as_array)
        .or_else(|| value.get("models").and_then(Value::as_array));
    let Some(items) = items else {
        return Vec::new();
    };
    let mut models: Vec<NousCatalogModel> =
        items.iter().filter_map(catalog_model_from_record).collect();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    models.dedup_by(|left, right| left.id == right.id);
    models
}

fn catalog_model_from_record(entry: &Value) -> Option<NousCatalogModel> {
    let id = entry
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())?;
    Some(NousCatalogModel {
        id: id.to_string(),
        reasoning: record_supports_reasoning(entry),
        input: record_input_modalities(entry),
    })
}

fn record_supports_reasoning(entry: &Value) -> bool {
    match entry.get("reasoning") {
        Some(Value::Bool(value)) => *value,
        Some(Value::Object(_)) => true,
        _ => false,
    }
}

fn record_input_modalities(entry: &Value) -> Vec<String> {
    let Some(list) = entry
        .pointer("/architecture/input_modalities")
        .and_then(Value::as_array)
    else {
        return vec!["text".to_string()];
    };
    let mut input = Vec::new();
    for value in list {
        let Some(token) = value.as_str() else {
            continue;
        };
        if matches!(token, "text" | "image") && !input.iter().any(|seen| seen == token) {
            input.push(token.to_string());
        }
    }
    if input.is_empty() {
        input.push("text".to_string());
    }
    input
}

/// Merge Nous Portal into an existing `models.json` object.
///
/// Other providers stay as they were. The API key field is the environment
/// variable *name*, never a pasted secret.
pub fn merge_nous_portal(existing: &Value, models: &[NousCatalogModel]) -> Result<Value, String> {
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

fn models_file_with_nous(mut root: Value, models: &[NousCatalogModel]) -> Value {
    if !root.is_object() {
        root = json!({});
    }
    let models: Vec<Value> = models
        .iter()
        .map(|model| {
            json!({
                "id": model.id,
                "reasoning": model.reasoning,
                "input": model.input,
            })
        })
        .collect();
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

pub fn write_nous_portal_models(path: &Path, models: &[NousCatalogModel]) -> Result<usize, String> {
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

pub fn fetch_nous_catalog() -> Result<Vec<NousCatalogModel>, String> {
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
    let models = nous_catalog_models(&body);
    if models.is_empty() {
        return Err("Nous Portal returned no models.".into());
    }
    Ok(models)
}

/// Fetch Nous Portal's public model list, merge it into Prime's `models.json`,
/// then reload the attached session so Chat sees the new provider.
pub fn ensure_nous_portal() -> Result<EnsureNousPortalResult, String> {
    let models = fetch_nous_catalog()?;
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

    fn row(id: &str, reasoning: bool, input: &[&str]) -> NousCatalogModel {
        NousCatalogModel {
            id: id.to_string(),
            reasoning,
            input: input.iter().map(|token| (*token).to_string()).collect(),
        }
    }

    #[test]
    fn reads_catalog_fields_from_each_record() {
        let body = json!({
            "data": [
                { "id": "  " },
                {
                    "id": "z-ai/glm-5.3-flash",
                    "reasoning": { "mandatory": true, "supported_efforts": ["max", "high", "low"] },
                    "architecture": { "input_modalities": ["text", "image", "video"] }
                },
                {
                    "id": "~anthropic/claude-opus-latest",
                    "architecture": { "input_modalities": ["text"] }
                },
                {
                    "id": "baai/bge-m3",
                    "architecture": { "input_modalities": ["text"] }
                },
                {
                    "id": "acme/pictor-1",
                    "reasoning": { "mandatory": false },
                    "architecture": { "input_modalities": ["file", "image", "audio"] }
                },
                { "id": "acme/flag", "reasoning": false },
                { "id": "z-ai/glm-5.3-flash" }
            ]
        });
        assert_eq!(
            nous_catalog_models(&body),
            vec![
                row("acme/flag", false, &["text"]),
                row("acme/pictor-1", true, &["image"]),
                row("baai/bge-m3", false, &["text"]),
                row("z-ai/glm-5.3-flash", true, &["text", "image"]),
                row("~anthropic/claude-opus-latest", false, &["text"]),
            ]
        );
    }

    #[test]
    fn merge_writes_the_catalog_fields() {
        let merged = merge_nous_portal(
            &json!({}),
            &[row("z-ai/glm-5.3-flash", true, &["text", "image"])],
        )
        .unwrap();
        let model = &merged["providers"]["nous-portal"]["models"][0];
        assert_eq!(model["reasoning"], true);
        assert_eq!(model["input"], json!(["text", "image"]));
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
            &[
                row("nousresearch/hermes-4-405b", true, &["text"]),
                row("tencent/hy3", false, &["text"]),
            ],
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
        assert_eq!(nous["models"][0]["input"], json!(["text"]));
        assert_eq!(nous["models"][1]["input"], json!(["text"]));
        let serialized = serde_json::to_string(&merged).unwrap();
        assert!(!serialized.contains("sk-"));
        assert!(!serialized.contains("paste-your-key"));
    }

    #[test]
    fn merge_starts_a_missing_file() {
        let merged =
            merge_nous_portal(&Value::Null, &[row("tencent/hy3", false, &["text"])]).unwrap();
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
        let error =
            write_nous_portal_models(&path, &[row("tencent/hy3", false, &["text"])]).unwrap_err();
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
        let count =
            write_nous_portal_models(&path, &[row("tencent/hy3", false, &["text"])]).unwrap();
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
