use crate::ai_agents::AiAgentStreamEvent;
use crate::model_events::{ModelError, ModelErrorKind, ModelEvent};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

mod openai_stream;
#[cfg(test)]
pub(crate) mod test_server;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiModelProviderKind {
    OpenAi,
    Anthropic,
    OpenAiCompatible,
    Ollama,
    LmStudio,
    OpenRouter,
    Gemini,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiModelApiKeyStorage {
    None,
    Env,
    LocalFile,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct AiModelCapabilities {
    pub streaming: bool,
    pub tools: bool,
    pub vision: bool,
    pub json_mode: bool,
    pub reasoning: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct AiModelDefinition {
    pub id: String,
    pub display_name: Option<String>,
    pub context_window: Option<u32>,
    pub max_output_tokens: Option<u32>,
    pub capabilities: AiModelCapabilities,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct AiModelProvider {
    pub id: String,
    pub name: String,
    pub kind: AiModelProviderKind,
    pub base_url: Option<String>,
    pub api_key_storage: Option<AiModelApiKeyStorage>,
    pub api_key_env_var: Option<String>,
    pub headers: Option<BTreeMap<String, String>>,
    pub models: Vec<AiModelDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiModelStreamRequest {
    pub provider: AiModelProvider,
    pub model_id: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub vault_path: Option<String>,
    #[serde(default)]
    pub vault_paths: Vec<String>,
    pub api_key_override: Option<String>,
    #[serde(default)]
    pub event_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiModelProviderTestRequest {
    pub provider: AiModelProvider,
    pub model_id: String,
    pub api_key_override: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct AiModelProviderCatalogEntry {
    kind: AiModelProviderKind,
    runtime_base_url: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
struct AiProviderSecrets {
    provider_api_keys: BTreeMap<String, String>,
}

static AI_MODEL_PROVIDER_CATALOG: OnceLock<Vec<AiModelProviderCatalogEntry>> = OnceLock::new();

fn provider_catalog() -> &'static [AiModelProviderCatalogEntry] {
    AI_MODEL_PROVIDER_CATALOG
        .get_or_init(|| {
            serde_json::from_str(include_str!("../../src/shared/aiModelProviderCatalog.json"))
                .expect("bundled AI model provider catalog must be valid JSON")
        })
        .as_slice()
}

fn provider_default_base_url(kind: &AiModelProviderKind) -> Option<&'static str> {
    provider_catalog()
        .iter()
        .find(|entry| entry.kind == *kind)
        .and_then(|entry| entry.runtime_base_url.as_deref())
}

pub fn normalize_ai_model_providers(
    providers: Option<Vec<AiModelProvider>>,
) -> Option<Vec<AiModelProvider>> {
    let normalized = providers?
        .into_iter()
        .filter_map(normalize_ai_model_provider)
        .collect::<Vec<_>>();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn normalize_ai_model_provider(mut provider: AiModelProvider) -> Option<AiModelProvider> {
    provider.id = provider.id.trim().to_ascii_lowercase();
    provider.name = provider.name.trim().to_string();
    provider.base_url = normalize_optional_string(provider.base_url);
    provider.api_key_env_var = normalize_optional_string(provider.api_key_env_var);
    provider.api_key_storage = normalize_api_key_storage(&provider);
    provider.models = normalized_models(provider.models);

    is_valid_provider(&provider).then_some(provider)
}

fn normalize_api_key_storage(provider: &AiModelProvider) -> Option<AiModelApiKeyStorage> {
    match provider.api_key_storage {
        Some(AiModelApiKeyStorage::LocalFile) => Some(AiModelApiKeyStorage::LocalFile),
        Some(AiModelApiKeyStorage::Env) | None if provider.api_key_env_var.is_some() => {
            Some(AiModelApiKeyStorage::Env)
        }
        _ => Some(AiModelApiKeyStorage::None),
    }
}

fn normalized_models(models: Vec<AiModelDefinition>) -> Vec<AiModelDefinition> {
    models
        .into_iter()
        .filter_map(|mut model| {
            model.id = model.id.trim().to_string();
            model.display_name = normalize_optional_string(model.display_name);
            (!model.id.is_empty()).then_some(model)
        })
        .collect()
}

fn is_valid_provider(provider: &AiModelProvider) -> bool {
    !provider.id.is_empty() && !provider.name.is_empty() && !provider.models.is_empty()
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
}

pub fn run_ai_model_stream<F>(request: AiModelStreamRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    emit(AiAgentStreamEvent::Init {
        session_id: format!("api-{}", uuid::Uuid::new_v4()),
    });

    let text = send_model_message(&request, &mut emit)?;

    emit(AiAgentStreamEvent::TextDelta { text });
    emit(AiAgentStreamEvent::Done);
    Ok(String::new())
}

pub fn test_ai_model_provider(request: AiModelProviderTestRequest) -> Result<String, String> {
    let request = AiModelStreamRequest {
        provider: request.provider,
        model_id: request.model_id,
        message: "Reply with exactly OK.".into(),
        system_prompt: Some(
            "You are testing whether this model endpoint is reachable. Reply with exactly OK."
                .into(),
        ),
        vault_path: None,
        vault_paths: Vec::new(),
        api_key_override: normalize_optional_string(request.api_key_override),
        event_name: None,
    };
    send_model_message(&request, &mut |_| {})
}

/// Trims a base URL and strips trailing slashes. The host stays as written,
/// so a LAN address (`http://<PC LAN IP>:8080/v1`) is never rewritten to
/// loopback.
pub fn normalize_base_url(raw: &str) -> Result<String, String> {
    let base = raw.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Custom API providers need a base URL.".into());
    }
    let has_web_scheme = reqwest::Url::parse(base)
        .map(|url| matches!(url.scheme(), "http" | "https"))
        .unwrap_or(false);
    if !has_web_scheme {
        return Err(format!(
            "Base URL must start with http:// or https://: {base}"
        ));
    }
    Ok(base.to_string())
}

/// Connect and total time limits for one provider HTTP call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HttpLimits {
    pub connect: std::time::Duration,
    pub total: std::time::Duration,
}

impl HttpLimits {
    /// A slow LAN model can take minutes on one reply, so the total is long.
    pub const STREAM: Self = Self {
        connect: std::time::Duration::from_secs(15),
        total: std::time::Duration::from_secs(600),
    };
    pub const DISCOVER: Self = Self {
        connect: std::time::Duration::from_secs(15),
        total: std::time::Duration::from_secs(30),
    };
}

/// Streams one model request as `ModelEvent`s (harness plan Phase 4), with
/// `HttpLimits::STREAM`.
///
/// Runs no tools: a tool call is only data for the Rhizome loop. Every
/// failure arrives as one `ModelEvent::Error`. `emit` returns false to stop
/// reading. Then no terminal event follows, because cancel belongs to the
/// loop. Only OpenAI-compatible providers stream events so far.
pub fn stream_model_events(
    request: &AiModelStreamRequest,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) {
    stream_model_events_with(request, HttpLimits::STREAM, emit);
}

/// `stream_model_events` with caller-set time limits.
pub fn stream_model_events_with(
    request: &AiModelStreamRequest,
    limits: HttpLimits,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) {
    let payload = crate::ai_model_tools::openai_chat_payload(request);
    stream_payload(request, payload, limits, emit);
}

fn stream_payload(
    request: &AiModelStreamRequest,
    mut payload: serde_json::Value,
    limits: HttpLimits,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) {
    payload["stream"] = serde_json::Value::Bool(true);
    let response = match open_model_event_stream(request, &payload, limits) {
        Ok(response) => response,
        Err(error) => {
            emit(ModelEvent::Error(error));
            return;
        }
    };
    let mut parser = openai_stream::OpenAiStreamParser::default();
    if is_json_response(&response) {
        let events = match response.json::<serde_json::Value>() {
            Ok(json) => parser.push_completion(&json),
            Err(error) => vec![ModelEvent::Error(model_error(
                ModelErrorKind::Protocol,
                format!("Failed to parse AI provider response: {error}"),
            ))],
        };
        emit_all(events, emit);
        return;
    }
    read_event_stream(std::io::BufReader::new(response), &mut parser, emit);
}

/// Lists model ids from `GET {base_url}/models`, with
/// `HttpLimits::DISCOVER`.
///
/// Keeps no cache, so a failure is never remembered: the next call asks the
/// server again.
pub fn discover_ai_model_ids(
    provider: &AiModelProvider,
    api_key_override: Option<&str>,
) -> Result<Vec<String>, ModelError> {
    discover_ai_model_ids_with(provider, api_key_override, HttpLimits::DISCOVER)
}

/// `discover_ai_model_ids` with caller-set time limits.
pub fn discover_ai_model_ids_with(
    provider: &AiModelProvider,
    api_key_override: Option<&str>,
    limits: HttpLimits,
) -> Result<Vec<String>, ModelError> {
    let request = AiModelStreamRequest {
        provider: provider.clone(),
        model_id: String::new(),
        message: String::new(),
        system_prompt: None,
        vault_path: None,
        vault_paths: Vec::new(),
        api_key_override: api_key_override.map(str::to_string),
        event_name: None,
    };
    let endpoint = format!("{}/models", rejected_on_err(normalized_base_url(&request))?);
    let client = http_client(limits)?;
    let builder = auth_on_err(apply_auth_headers(client.get(endpoint), &request))?;
    let response = send_checked(apply_provider_headers(builder, &request))?;
    let json = response.json::<serde_json::Value>().map_err(|error| {
        model_error(
            ModelErrorKind::Protocol,
            format!("Failed to parse AI provider model list: {error}"),
        )
    })?;
    let models = json["data"].as_array().ok_or_else(|| {
        model_error(
            ModelErrorKind::Protocol,
            "AI provider model list did not include data.".into(),
        )
    })?;
    Ok(models
        .iter()
        .filter_map(|model| model["id"].as_str())
        .map(str::to_string)
        .collect())
}

/// Streams a chat that the caller built, as `ModelEvent`s. Runs no tools.
///
/// `messages` are OpenAI chat messages in order, after the system prompt.
/// The system prompt, provider, model, and API key come from `request`.
/// `request.message` is not sent. `tools` are OpenAI tool definitions.
/// Error and stop rules are the same as `stream_model_events`.
pub fn stream_chat_events_with(
    request: &AiModelStreamRequest,
    messages: Vec<serde_json::Value>,
    tools: Vec<serde_json::Value>,
    limits: HttpLimits,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) {
    let no_params = serde_json::Map::new();
    stream_chat_events_with_params(request, messages, tools, &no_params, limits, emit);
}

/// `stream_chat_events_with`, plus body fields that go out only when
/// `tools` is not empty. NVIDIA NIM, for example, needs
/// `parallel_tool_calls: false`.
pub fn stream_chat_events_with_params(
    request: &AiModelStreamRequest,
    messages: Vec<serde_json::Value>,
    tools: Vec<serde_json::Value>,
    tool_params: &serde_json::Map<String, serde_json::Value>,
    limits: HttpLimits,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) {
    let system = non_empty_option(request.system_prompt.as_deref())
        .map(|prompt| serde_json::json!({ "role": "system", "content": prompt }));
    let mut payload = serde_json::json!({
        "model": request.model_id,
        "messages": system.into_iter().chain(messages).collect::<Vec<_>>(),
    });
    if !tools.is_empty() {
        payload["tools"] = serde_json::Value::Array(tools);
        payload["tool_choice"] = serde_json::Value::String("auto".into());
        for (key, value) in tool_params {
            payload[key] = value.clone();
        }
    }
    stream_payload(request, payload, limits, emit);
}

fn open_model_event_stream(
    request: &AiModelStreamRequest,
    payload: &serde_json::Value,
    limits: HttpLimits,
) -> Result<reqwest::blocking::Response, ModelError> {
    if request.provider.kind == AiModelProviderKind::Anthropic {
        return Err(model_error(
            ModelErrorKind::Rejected,
            "This provider does not stream model events yet.".into(),
        ));
    }
    let endpoint = rejected_on_err(chat_completions_url(request))?;
    let client = http_client(limits)?;
    let builder = auth_on_err(apply_auth_headers(
        client.post(endpoint).json(payload),
        request,
    ))?;
    send_checked(apply_provider_headers(builder, request))
}

fn read_event_stream(
    reader: impl std::io::BufRead,
    parser: &mut openai_stream::OpenAiStreamParser,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
) {
    for line in reader.lines() {
        let line = match line {
            Ok(line) => line,
            Err(error) => {
                emit(ModelEvent::Error(model_error(
                    ModelErrorKind::Unavailable,
                    format!("AI provider stream failed: {error}"),
                )));
                return;
            }
        };
        let Some(data) = line.strip_prefix("data:") else {
            continue;
        };
        if !emit_all(parser.push_data(data), emit) || parser.is_finished() {
            return;
        }
    }
    emit_all(parser.end_of_stream(), emit);
}

/// Returns false when `emit` asked to stop.
fn emit_all(events: Vec<ModelEvent>, emit: &mut dyn FnMut(ModelEvent) -> bool) -> bool {
    events.into_iter().all(emit)
}

fn is_json_response(response: &reqwest::blocking::Response) -> bool {
    response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.contains("application/json"))
}

fn http_client(limits: HttpLimits) -> Result<reqwest::blocking::Client, ModelError> {
    reqwest::blocking::Client::builder()
        .connect_timeout(limits.connect)
        .timeout(limits.total)
        .build()
        .map_err(|error| {
            model_error(
                ModelErrorKind::Unavailable,
                format!("Failed to create HTTP client: {error}"),
            )
        })
}

fn send_checked(
    builder: reqwest::blocking::RequestBuilder,
) -> Result<reqwest::blocking::Response, ModelError> {
    let response = builder.send().map_err(|error| {
        model_error(
            ModelErrorKind::Unavailable,
            format!("AI provider request failed: {error}"),
        )
    })?;
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let body = response.text().unwrap_or_default();
    Err(classify_http_failure(
        status.as_u16(),
        retry_after.as_deref(),
        &body,
    ))
}

fn chat_completions_url(request: &AiModelStreamRequest) -> Result<String, String> {
    Ok(format!(
        "{}/chat/completions",
        normalized_base_url(request)?
    ))
}

/// One routing class per failure (harness plan Phase 4b decides on these).
fn classify_http_failure(status: u16, retry_after: Option<&str>, body: &str) -> ModelError {
    let kind = match status {
        429 if body.contains("insufficient_quota") => ModelErrorKind::QuotaExhausted,
        429 => ModelErrorKind::RateLimited {
            retry_after_secs: retry_after.and_then(|value| value.trim().parse().ok()),
        },
        402 => ModelErrorKind::QuotaExhausted,
        401 | 403 => ModelErrorKind::Auth,
        408 | 500..=599 => ModelErrorKind::Unavailable,
        _ => ModelErrorKind::Rejected,
    };
    ModelError {
        kind,
        status: Some(status),
        message: format!("AI provider returned {status}: {}", truncate_error(body)),
    }
}

fn model_error(kind: ModelErrorKind, message: String) -> ModelError {
    ModelError {
        kind,
        status: None,
        message,
    }
}

fn rejected_on_err<T>(result: Result<T, String>) -> Result<T, ModelError> {
    result.map_err(|message| model_error(ModelErrorKind::Rejected, message))
}

/// A missing or unreadable API key.
fn auth_on_err<T>(result: Result<T, String>) -> Result<T, ModelError> {
    result.map_err(|message| model_error(ModelErrorKind::Auth, message))
}

fn send_model_message<F>(request: &AiModelStreamRequest, emit: &mut F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    match request.provider.kind {
        AiModelProviderKind::Anthropic => send_anthropic_message(request),
        _ => send_openai_compatible_message(request, emit),
    }
}

fn send_openai_compatible_message<F>(
    request: &AiModelStreamRequest,
    emit: &mut F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let endpoint = chat_completions_url(request)?;
    let payload = crate::ai_model_tools::openai_chat_payload(request);
    let json = send_json_request(request, endpoint, payload)?;
    if let Some(tool_summary) =
        crate::ai_model_tools::execute_openai_tool_calls(request, &json, emit)?
    {
        return Ok(tool_summary);
    }
    extract_openai_text(&json)
}

fn send_anthropic_message(request: &AiModelStreamRequest) -> Result<String, String> {
    let endpoint = format!("{}/messages", normalized_base_url(request)?);
    let mut payload = serde_json::json!({
        "model": request.model_id,
        "max_tokens": selected_max_tokens(request),
        "messages": [{ "role": "user", "content": request.message }]
    });

    if let Some(system_prompt) = non_empty_option(request.system_prompt.as_deref()) {
        payload["system"] = serde_json::Value::String(system_prompt.to_string());
    }

    let json = send_json_request(request, endpoint, payload)?;
    extract_anthropic_text(&json)
}

fn selected_max_tokens(request: &AiModelStreamRequest) -> u32 {
    request
        .provider
        .models
        .iter()
        .find(|model| model.id == request.model_id)
        .and_then(|model| model.max_output_tokens)
        .unwrap_or(4096)
}

fn normalized_base_url(request: &AiModelStreamRequest) -> Result<String, String> {
    let fallback = provider_default_base_url(&request.provider.kind).unwrap_or("");
    let base = request
        .provider
        .base_url
        .as_deref()
        .and_then(non_empty_str)
        .unwrap_or(fallback);
    normalize_base_url(base)
}

fn send_json_request(
    request: &AiModelStreamRequest,
    endpoint: String,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))?;
    let builder = client.post(endpoint).json(&payload);
    let builder = apply_auth_headers(builder, request)?;
    let builder = apply_provider_headers(builder, request);
    let response = send_provider_request(builder)?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|error| format!("Failed to read AI provider response: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "AI provider returned {status}: {}",
            truncate_error(&text)
        ));
    }
    serde_json::from_str(&text)
        .map_err(|error| format!("Failed to parse AI provider response: {error}"))
}

fn apply_auth_headers(
    builder: reqwest::blocking::RequestBuilder,
    request: &AiModelStreamRequest,
) -> Result<reqwest::blocking::RequestBuilder, String> {
    let Some(api_key) = api_key_from_provider(request)? else {
        return Ok(builder);
    };

    Ok(match request.provider.kind {
        AiModelProviderKind::Anthropic => builder.header("x-api-key", api_key),
        _ => builder.bearer_auth(api_key),
    })
}

fn apply_provider_headers(
    mut builder: reqwest::blocking::RequestBuilder,
    request: &AiModelStreamRequest,
) -> reqwest::blocking::RequestBuilder {
    if matches!(request.provider.kind, AiModelProviderKind::Anthropic) {
        builder = builder.header("anthropic-version", "2023-06-01");
    }
    for (key, value) in safe_custom_headers(request) {
        builder = builder.header(key, value);
    }
    builder
}

fn safe_custom_headers(request: &AiModelStreamRequest) -> Vec<(&String, &String)> {
    request
        .provider
        .headers
        .as_ref()
        .into_iter()
        .flat_map(|headers| headers.iter())
        .filter(|(key, value)| {
            !key.eq_ignore_ascii_case("authorization") && non_empty_option(Some(value)).is_some()
        })
        .collect()
}

fn send_provider_request(
    builder: reqwest::blocking::RequestBuilder,
) -> Result<reqwest::blocking::Response, String> {
    builder
        .send()
        .map_err(|error| format!("AI provider request failed: {error}"))
}

pub fn save_provider_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    let provider_id = normalize_secret_provider_id(&provider_id)?;
    let api_key = api_key.trim().to_string();
    if api_key.is_empty() {
        return Err("API key cannot be empty.".into());
    }
    let path = secrets_path()?;
    let mut secrets = read_secrets_at(&path)?;
    secrets.provider_api_keys.insert(provider_id, api_key);
    write_secrets_at(&path, &secrets)
}

pub fn delete_provider_api_key(provider_id: String) -> Result<(), String> {
    let provider_id = normalize_secret_provider_id(&provider_id)?;
    let path = secrets_path()?;
    let mut secrets = read_secrets_at(&path)?;
    secrets.provider_api_keys.remove(&provider_id);
    write_secrets_at(&path, &secrets)
}

fn normalize_secret_provider_id(provider_id: &str) -> Result<String, String> {
    let provider_id = provider_id.trim().to_ascii_lowercase();
    if provider_id.is_empty() {
        Err("Provider ID cannot be empty.".into())
    } else {
        Ok(provider_id)
    }
}

fn secrets_path() -> Result<std::path::PathBuf, String> {
    crate::settings::preferred_app_config_path("ai-provider-secrets.json")
}

fn read_secrets_at(path: &Path) -> Result<AiProviderSecrets, String> {
    if !path.exists() {
        return Ok(AiProviderSecrets::default());
    }
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read AI provider secrets: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse AI provider secrets: {error}"))
}

fn write_secrets_at(path: &Path, secrets: &AiProviderSecrets) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create AI provider secrets directory: {error}"))?;
    }
    let json = serde_json::to_string_pretty(secrets)
        .map_err(|error| format!("Failed to serialize AI provider secrets: {error}"))?;
    write_secret_file(path, json)
}

fn write_secret_file(path: &Path, content: String) -> Result<(), String> {
    crate::secure_fs::write_owner_only_atomic(path, &content)
        .map_err(|error| format!("Failed to write AI provider secrets: {error}"))
}

fn api_key_from_local_file(request: &AiModelStreamRequest) -> Result<Option<String>, String> {
    let secrets = read_secrets_at(&secrets_path()?)?;
    let api_key = secrets
        .provider_api_keys
        .get(&request.provider.id)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if api_key.is_none() {
        return Err(format!(
            "No local API key is saved for {}.",
            request.provider.name
        ));
    }
    Ok(api_key)
}

fn api_key_from_env(request: &AiModelStreamRequest) -> Result<Option<String>, String> {
    api_key_from_env_with_lookup(
        request,
        crate::cli_agent_runtime::env_value_from_process_or_user_shell,
    )
}

fn api_key_from_env_with_lookup(
    request: &AiModelStreamRequest,
    lookup: impl Fn(crate::cli_agent_runtime::EnvName<'_>) -> Option<String>,
) -> Result<Option<String>, String> {
    let Some(name) = request
        .provider
        .api_key_env_var
        .as_deref()
        .and_then(non_empty_str)
        .and_then(crate::cli_agent_runtime::EnvName::new)
    else {
        return Ok(None);
    };

    lookup(name).map(Some).ok_or_else(|| {
        format!(
            "Environment variable {} is not set for this AI provider.",
            name.as_str()
        )
    })
}

fn api_key_from_provider(request: &AiModelStreamRequest) -> Result<Option<String>, String> {
    if let Some(api_key) = request
        .api_key_override
        .as_deref()
        .and_then(non_empty_str)
        .map(str::to_string)
    {
        return Ok(Some(api_key));
    }

    match request.provider.api_key_storage {
        Some(AiModelApiKeyStorage::LocalFile) => api_key_from_local_file(request),
        Some(AiModelApiKeyStorage::Env) => api_key_from_env(request),
        _ => Ok(None),
    }
}

fn extract_openai_text(json: &serde_json::Value) -> Result<String, String> {
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(str::to_string)
        .filter(|text| !text.trim().is_empty())
        .ok_or_else(|| "AI provider response did not include assistant text.".to_string())
}

fn extract_anthropic_text(json: &serde_json::Value) -> Result<String, String> {
    let text = json["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|block| block["text"].as_str())
        .collect::<Vec<_>>()
        .join("");
    if text.trim().is_empty() {
        Err("Anthropic response did not include assistant text.".into())
    } else {
        Ok(text)
    }
}

fn non_empty_option(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn non_empty_str(value: &str) -> Option<&str> {
    non_empty_option(Some(value))
}

fn truncate_error(value: &str) -> String {
    const MAX_ERROR_LENGTH: usize = 600;
    if value.len() <= MAX_ERROR_LENGTH {
        return value.to_string();
    }
    format!("{}...", &value[..MAX_ERROR_LENGTH])
}

#[cfg(test)]
mod tests {
    use super::test_server::{http_response, serve, serve_silent, sse, TEST_LIMITS};
    use super::*;
    use serde_json::json;

    fn capabilities() -> AiModelCapabilities {
        AiModelCapabilities {
            streaming: true,
            tools: false,
            vision: false,
            json_mode: true,
            reasoning: false,
        }
    }

    fn model(id: &str) -> AiModelDefinition {
        AiModelDefinition {
            id: id.into(),
            display_name: Some(" Demo Model ".into()),
            context_window: Some(128_000),
            max_output_tokens: Some(8192),
            capabilities: capabilities(),
        }
    }

    fn provider(kind: AiModelProviderKind) -> AiModelProvider {
        AiModelProvider {
            id: " Demo ".into(),
            name: " Demo Provider ".into(),
            kind,
            base_url: Some(" https://example.com/v1/ ".into()),
            api_key_storage: None,
            api_key_env_var: Some(" DEMO_API_KEY ".into()),
            headers: None,
            models: vec![model(" demo-model "), model("  ")],
        }
    }

    fn request(provider: AiModelProvider) -> AiModelStreamRequest {
        AiModelStreamRequest {
            provider,
            model_id: "demo-model".into(),
            message: "Hello".into(),
            system_prompt: Some("  Be concise.  ".into()),
            vault_path: None,
            vault_paths: Vec::new(),
            api_key_override: None,
            event_name: None,
        }
    }

    #[test]
    fn normalize_providers_trims_values_and_filters_invalid_entries() {
        let invalid = AiModelProvider {
            id: " ".into(),
            name: "Missing".into(),
            kind: AiModelProviderKind::OpenAiCompatible,
            base_url: None,
            api_key_storage: None,
            api_key_env_var: None,
            headers: None,
            models: vec![model("ignored")],
        };

        let providers = normalize_ai_model_providers(Some(vec![
            invalid,
            provider(AiModelProviderKind::OpenAiCompatible),
        ]))
        .expect("valid provider should remain");

        assert_eq!(providers.len(), 1);
        let normalized = &providers[0];
        assert_eq!(normalized.id, "demo");
        assert_eq!(normalized.name, "Demo Provider");
        assert_eq!(
            normalized.base_url.as_deref(),
            Some("https://example.com/v1/")
        );
        assert_eq!(normalized.api_key_env_var.as_deref(), Some("DEMO_API_KEY"));
        assert_eq!(normalized.api_key_storage, Some(AiModelApiKeyStorage::Env));
        assert_eq!(normalized.models.len(), 1);
        assert_eq!(normalized.models[0].id, "demo-model");
        assert_eq!(
            normalized.models[0].display_name.as_deref(),
            Some("Demo Model")
        );
    }

    #[test]
    fn normalize_providers_returns_none_for_missing_or_empty_sets() {
        assert_eq!(normalize_ai_model_providers(None), None);
        assert_eq!(normalize_ai_model_providers(Some(Vec::new())), None);
    }

    #[test]
    fn model_request_helpers_resolve_defaults_and_safe_headers() {
        let mut provider = provider(AiModelProviderKind::Anthropic);
        provider.base_url = None;
        provider.headers = Some(BTreeMap::from([
            ("Authorization".into(), "ignored".into()),
            ("X-Demo".into(), "demo".into()),
            ("X-Blank".into(), "   ".into()),
        ]));
        provider.models = vec![model("demo-model")];
        let request = request(provider);
        let headers = safe_custom_headers(&request)
            .into_iter()
            .map(|(key, value)| (key.as_str(), value.as_str()))
            .collect::<Vec<_>>();

        assert_eq!(
            normalized_base_url(&request).unwrap(),
            "https://api.anthropic.com/v1"
        );
        assert_eq!(selected_max_tokens(&request), 8192);
        assert_eq!(headers, vec![("X-Demo", "demo")]);
    }

    #[test]
    fn request_builders_apply_auth_and_provider_headers() {
        let client = reqwest::blocking::Client::new();
        let mut anthropic_provider = provider(AiModelProviderKind::Anthropic);
        anthropic_provider.api_key_env_var = None;
        anthropic_provider.headers = Some(BTreeMap::from([
            ("Authorization".into(), "ignored".into()),
            ("X-Demo".into(), "demo".into()),
        ]));
        let mut anthropic_request = request(anthropic_provider);
        anthropic_request.api_key_override = Some(" secret ".into());

        let built = apply_provider_headers(
            apply_auth_headers(client.post("https://example.test"), &anthropic_request).unwrap(),
            &anthropic_request,
        )
        .build()
        .unwrap();

        let headers = built.headers();
        assert_eq!(
            (
                headers["x-api-key"].to_str().unwrap(),
                headers["anthropic-version"].to_str().unwrap(),
                headers["X-Demo"].to_str().unwrap(),
                headers.get("authorization").is_none(),
            ),
            ("secret", "2023-06-01", "demo", true),
        );

        let mut openai_provider = provider(AiModelProviderKind::OpenAi);
        openai_provider.api_key_env_var = None;
        let mut openai_request = request(openai_provider);
        openai_request.api_key_override = Some(" openai-secret ".into());
        let built = apply_auth_headers(client.post("https://example.test"), &openai_request)
            .unwrap()
            .build()
            .unwrap();

        assert_eq!(
            built.headers()["authorization"].to_str().unwrap(),
            "Bearer openai-secret"
        );
    }

    #[test]
    fn shared_provider_catalog_supplies_runtime_base_urls() {
        assert_eq!(
            provider_default_base_url(&AiModelProviderKind::OpenAi),
            Some("https://api.openai.com/v1")
        );
        assert_eq!(
            provider_default_base_url(&AiModelProviderKind::Ollama),
            Some("http://localhost:11434/v1")
        );
        assert_eq!(
            provider_default_base_url(&AiModelProviderKind::OpenAiCompatible),
            None
        );
    }

    #[test]
    fn custom_provider_requires_base_url() {
        let mut provider = provider(AiModelProviderKind::OpenAiCompatible);
        provider.base_url = Some(" ".into());

        assert_eq!(
            normalized_base_url(&request(provider)).unwrap_err(),
            "Custom API providers need a base URL.",
        );
    }

    #[test]
    fn env_api_key_uses_shell_lookup_when_process_env_is_missing() {
        let mut provider = provider(AiModelProviderKind::Anthropic);
        provider.api_key_storage = Some(AiModelApiKeyStorage::Env);
        provider.api_key_env_var = Some("ANTHROPIC_API_KEY".into());
        let request = request(provider);

        let api_key =
            api_key_from_env_with_lookup(&request, |_| Some("shell-secret".to_string())).unwrap();

        assert_eq!(api_key.as_deref(), Some("shell-secret"));
    }

    #[test]
    fn extracts_provider_text_payloads_and_reports_empty_responses() {
        let openai = json!({
            "choices": [{ "message": { "content": "Hello from OpenAI" } }]
        });
        let anthropic = json!({
            "content": [
                { "text": "Hello " },
                { "text": "from Anthropic" }
            ]
        });

        assert_eq!(extract_openai_text(&openai).unwrap(), "Hello from OpenAI");
        assert_eq!(
            extract_anthropic_text(&anthropic).unwrap(),
            "Hello from Anthropic"
        );
        assert_eq!(
            extract_openai_text(&json!({ "choices": [] })).unwrap_err(),
            "AI provider response did not include assistant text.",
        );
        assert_eq!(
            extract_anthropic_text(&json!({ "content": [{ "type": "thinking" }] })).unwrap_err(),
            "Anthropic response did not include assistant text.",
        );
    }

    #[test]
    fn saves_reads_and_validates_local_provider_secrets() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/secrets.json");
        let secrets = AiProviderSecrets {
            provider_api_keys: BTreeMap::from([("demo".into(), "secret".into())]),
        };

        write_secrets_at(&path, &secrets).unwrap();

        assert_eq!(read_secrets_at(&path).unwrap(), secrets);
        assert_eq!(
            read_secrets_at(&dir.path().join("missing.json")).unwrap(),
            AiProviderSecrets::default()
        );
        assert_eq!(normalize_secret_provider_id(" Demo ").unwrap(), "demo");
        assert_eq!(
            normalize_secret_provider_id(" ").unwrap_err(),
            "Provider ID cannot be empty.",
        );

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
    }

    #[cfg(unix)]
    #[test]
    fn secret_write_does_not_follow_a_symlink() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let outside = dir.path().join("outside-secrets.json");
        let path = dir.path().join("secrets.json");
        fs::write(&outside, "{\"marker\":\"RHIZOME_R3_OUTSIDE\"}\n").unwrap();
        symlink(&outside, &path).unwrap();

        let secrets = AiProviderSecrets {
            provider_api_keys: BTreeMap::from([("demo".into(), "fixture-only".into())]),
        };
        write_secrets_at(&path, &secrets).unwrap();

        assert_eq!(
            fs::read_to_string(&outside).unwrap(),
            "{\"marker\":\"RHIZOME_R3_OUTSIDE\"}\n"
        );
        assert!(!path.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(read_secrets_at(&path).unwrap(), secrets);
    }

    #[cfg(unix)]
    #[test]
    fn secret_write_tightens_a_permissive_file_and_keeps_complete_json() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("secrets.json");
        fs::write(&path, "{}").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();

        let secrets = AiProviderSecrets {
            provider_api_keys: BTreeMap::from([("demo".into(), "fixture-only".into())]),
        };
        write_secrets_at(&path, &secrets).unwrap();

        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        let raw = fs::read_to_string(&path).unwrap();
        assert!(raw.contains("fixture-only"));
        assert!(serde_json::from_str::<AiProviderSecrets>(&raw).is_ok());
        assert_eq!(read_secrets_at(&path).unwrap(), secrets);
    }

    fn compatible_request(base_url: &str) -> AiModelStreamRequest {
        let mut provider = provider(AiModelProviderKind::LmStudio);
        provider.base_url = Some(base_url.into());
        provider.api_key_env_var = None;
        provider.models = vec![model("demo-model")];
        provider.models[0].capabilities.tools = true;
        let mut request = request(provider);
        request.provider.id = "demo".into();
        request
    }

    fn user_message(request: &AiModelStreamRequest) -> Vec<serde_json::Value> {
        vec![json!({ "role": "user", "content": request.message })]
    }

    fn collect_events(request: &AiModelStreamRequest) -> Vec<ModelEvent> {
        collect_events_with_tools(request, Vec::new())
    }

    fn collect_events_with_tools(
        request: &AiModelStreamRequest,
        tools: Vec<serde_json::Value>,
    ) -> Vec<ModelEvent> {
        let mut events = Vec::new();
        stream_chat_events_with(
            request,
            user_message(request),
            tools,
            TEST_LIMITS,
            &mut |event| {
                events.push(event);
                true
            },
        );
        events
    }

    #[test]
    fn stream_chat_events_sends_the_caller_messages_and_tools() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}"#,
        ])]);
        let request = compatible_request(&server.base_url);
        let messages = vec![
            json!({ "role": "user", "content": "first" }),
            json!({ "role": "assistant", "content": "reply" }),
            json!({ "role": "user", "content": "second" }),
        ];
        let tools = vec![json!({ "type": "function", "function": { "name": "echo" } })];
        let mut events = Vec::new();

        stream_chat_events_with(&request, messages, tools, TEST_LIMITS, &mut |event| {
            events.push(event);
            true
        });

        assert_eq!(
            events,
            vec![
                ModelEvent::TextDelta { text: "ok".into() },
                ModelEvent::Finish {
                    reason: crate::model_events::FinishReason::Stop
                },
            ]
        );
        let requests = server.requests.lock().unwrap();
        let body: serde_json::Value = serde_json::from_str(&requests[0].1).unwrap();
        assert_eq!(body["model"], "demo-model");
        assert_eq!(body["stream"], true);
        assert_eq!(
            body["messages"],
            json!([
                { "role": "system", "content": "Be concise." },
                { "role": "user", "content": "first" },
                { "role": "assistant", "content": "reply" },
                { "role": "user", "content": "second" },
            ])
        );
        assert_eq!(body["tools"][0]["function"]["name"], "echo");
        assert_eq!(body["tool_choice"], "auto");
    }

    #[test]
    fn stream_chat_events_without_tools_sends_no_tool_fields() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{},"finish_reason":"stop"}]}"#,
        ])]);
        let mut request = compatible_request(&server.base_url);
        request.system_prompt = None;

        stream_chat_events_with(
            &request,
            vec![json!({ "role": "user", "content": "hi" })],
            Vec::new(),
            TEST_LIMITS,
            &mut |_| true,
        );

        let requests = server.requests.lock().unwrap();
        let body: serde_json::Value = serde_json::from_str(&requests[0].1).unwrap();
        assert_eq!(
            body["messages"],
            json!([{ "role": "user", "content": "hi" }])
        );
        assert!(body.get("tools").is_none());
        assert!(body.get("tool_choice").is_none());
    }

    #[test]
    fn production_http_limits_stay_long_enough_for_slow_models() {
        assert_eq!(HttpLimits::STREAM.connect.as_secs(), 15);
        assert_eq!(HttpLimits::STREAM.total.as_secs(), 600);
        assert_eq!(HttpLimits::DISCOVER.connect.as_secs(), 15);
        assert_eq!(HttpLimits::DISCOVER.total.as_secs(), 30);
    }

    fn only_error(events: &[ModelEvent]) -> &ModelError {
        match events {
            [ModelEvent::Error(error)] => error,
            other => panic!("expected one Error event, got {other:?}"),
        }
    }

    #[test]
    fn custom_base_url_is_used_verbatim() {
        assert_eq!(
            normalize_base_url(" http://192.168.1.50:8080/v1// ").unwrap(),
            "http://192.168.1.50:8080/v1"
        );
        let request = compatible_request("http://192.168.1.50:8080/v1/");

        assert_eq!(
            chat_completions_url(&request).unwrap(),
            "http://192.168.1.50:8080/v1/chat/completions"
        );
    }

    #[test]
    fn normalize_base_url_rejects_empty_and_schemeless_urls() {
        assert_eq!(
            normalize_base_url("  ").unwrap_err(),
            "Custom API providers need a base URL."
        );
        assert!(normalize_base_url("192.168.1.50:8080/v1")
            .unwrap_err()
            .contains("http:// or https://"));
        assert!(normalize_base_url("ftp://example.com/v1")
            .unwrap_err()
            .contains("http:// or https://"));
    }

    #[test]
    fn stream_chat_events_parses_tool_calls_and_runs_no_tools() {
        let vault = tempfile::tempdir().unwrap();
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"On it."}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"create_note","arguments":"{\"path\":\"a.md\"}"}}]},"finish_reason":"tool_calls"}]}"#,
            "[DONE]",
        ])]);
        let mut request = compatible_request(&server.base_url);
        request.vault_path = Some(vault.path().to_string_lossy().into_owned());

        let tools = vec![crate::ai_model_tools::openai_create_note_tool()];
        let events = collect_events_with_tools(&request, tools);

        assert_eq!(
            events,
            vec![
                ModelEvent::TextDelta {
                    text: "On it.".into()
                },
                ModelEvent::ToolCallStart {
                    id: "call_a".into(),
                    name: "create_note".into()
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_a".into(),
                    delta: "{\"path\":\"a.md\"}".into()
                },
                ModelEvent::ToolCallEnd {
                    id: "call_a".into()
                },
                ModelEvent::Finish {
                    reason: crate::model_events::FinishReason::ToolCalls
                },
            ]
        );
        assert!(!vault.path().join("a.md").exists(), "the tool must not run");
        let requests = server.requests.lock().unwrap();
        assert_eq!(requests[0].0, "POST /v1/chat/completions");
        let body: serde_json::Value = serde_json::from_str(&requests[0].1).unwrap();
        assert_eq!(body["stream"], true);
        assert_eq!(body["tools"][0]["function"]["name"], "create_note");
    }

    #[test]
    fn stream_chat_events_accepts_a_whole_json_completion() {
        let server = serve(vec![http_response(
            "200 OK",
            &["Content-Type: application/json"],
            r#"{"choices":[{"message":{"content":"hi"},"finish_reason":"stop"}]}"#,
        )]);

        let events = collect_events(&compatible_request(&server.base_url));

        assert_eq!(
            events,
            vec![
                ModelEvent::TextDelta { text: "hi".into() },
                ModelEvent::Finish {
                    reason: crate::model_events::FinishReason::Stop
                },
            ]
        );
    }

    #[test]
    fn stream_chat_events_stops_reading_when_emit_returns_false() {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"one"}}]}"#,
            r#"{"choices":[{"delta":{"content":"two"}}]}"#,
            "[DONE]",
        ])]);
        let mut events = Vec::new();

        let request = compatible_request(&server.base_url);
        stream_chat_events_with(
            &request,
            user_message(&request),
            Vec::new(),
            TEST_LIMITS,
            &mut |event| {
                events.push(event);
                false
            },
        );

        assert_eq!(events, vec![ModelEvent::TextDelta { text: "one".into() }]);
    }

    #[test]
    fn stream_chat_events_reports_an_http_failure_as_one_error() {
        let server = serve(vec![http_response(
            "429 Too Many Requests",
            &["Retry-After: 3", "Content-Type: application/json"],
            r#"{"error":{"message":"slow down"}}"#,
        )]);

        let events = collect_events(&compatible_request(&server.base_url));
        let error = only_error(&events);

        assert_eq!(
            error.kind,
            ModelErrorKind::RateLimited {
                retry_after_secs: Some(3)
            }
        );
        assert_eq!(error.status, Some(429));
        assert!(error.message.contains("slow down"));
    }

    #[test]
    fn stream_chat_events_reports_a_connect_failure_as_unavailable() {
        let closed = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}/v1", closed.local_addr().unwrap());
        drop(closed);
        let request = compatible_request(&base_url);

        // A refused connect returns at once, so the production limits are
        // safe to use here.
        let mut events = Vec::new();
        stream_chat_events_with(
            &request,
            user_message(&request),
            Vec::new(),
            HttpLimits::STREAM,
            &mut |event| {
                events.push(event);
                true
            },
        );
        let discover = discover_ai_model_ids(&request.provider, None).unwrap_err();

        assert_eq!(only_error(&events).kind, ModelErrorKind::Unavailable);
        assert_eq!(discover.kind, ModelErrorKind::Unavailable);
    }

    #[test]
    fn a_server_that_never_answers_fails_fast_in_tests() {
        let started = std::time::Instant::now();

        let events = collect_events(&compatible_request(&serve_silent()));

        assert_eq!(only_error(&events).kind, ModelErrorKind::Unavailable);
        assert!(
            started.elapsed() < std::time::Duration::from_secs(10),
            "took {:?}",
            started.elapsed()
        );
    }

    #[test]
    fn stream_chat_events_rejects_a_bad_base_url_and_anthropic() {
        let bad_url = collect_events(&compatible_request("localhost:1234"));
        assert_eq!(only_error(&bad_url).kind, ModelErrorKind::Rejected);

        let mut anthropic = provider(AiModelProviderKind::Anthropic);
        anthropic.models = vec![model("demo-model")];
        let anthropic = collect_events(&request(anthropic));
        assert_eq!(only_error(&anthropic).kind, ModelErrorKind::Rejected);
    }

    #[test]
    fn http_failures_map_to_routing_classes() {
        let kind =
            |status, retry_after, body| classify_http_failure(status, retry_after, body).kind;

        assert_eq!(
            kind(429, Some("7"), ""),
            ModelErrorKind::RateLimited {
                retry_after_secs: Some(7)
            }
        );
        assert_eq!(
            kind(429, Some("Wed, 21 Oct 2026 07:28:00 GMT"), ""),
            ModelErrorKind::RateLimited {
                retry_after_secs: None
            }
        );
        assert_eq!(
            kind(429, None, r#"{"error":{"code":"insufficient_quota"}}"#),
            ModelErrorKind::QuotaExhausted
        );
        assert_eq!(kind(402, None, ""), ModelErrorKind::QuotaExhausted);
        assert_eq!(kind(401, None, ""), ModelErrorKind::Auth);
        assert_eq!(kind(403, None, ""), ModelErrorKind::Auth);
        assert_eq!(kind(408, None, ""), ModelErrorKind::Unavailable);
        assert_eq!(kind(503, None, ""), ModelErrorKind::Unavailable);
        assert_eq!(kind(400, None, ""), ModelErrorKind::Rejected);
        assert_eq!(classify_http_failure(400, None, "bad").status, Some(400));
    }

    #[test]
    fn failed_discover_is_not_cached() {
        let server = serve(vec![
            http_response("500 Internal Server Error", &[], "down"),
            http_response(
                "200 OK",
                &["Content-Type: application/json"],
                r#"{"object":"list","data":[{"id":"qwen3-32b"},{"id":"llama3.2"}]}"#,
            ),
        ]);
        let provider = compatible_request(&server.base_url).provider;

        let first = discover_ai_model_ids_with(&provider, None, TEST_LIMITS).unwrap_err();
        let second = discover_ai_model_ids_with(&provider, None, TEST_LIMITS).unwrap();

        assert_eq!(first.kind, ModelErrorKind::Unavailable);
        assert_eq!(second, vec!["qwen3-32b", "llama3.2"]);
        let requests = server.requests.lock().unwrap();
        assert_eq!(requests.len(), 2);
        assert!(requests
            .iter()
            .all(|(target, _)| target == "GET /v1/models"));
    }

    #[test]
    fn discover_reports_a_body_without_model_ids_as_protocol() {
        let server = serve(vec![http_response(
            "200 OK",
            &["Content-Type: application/json"],
            r#"{"unexpected":true}"#,
        )]);
        let provider = compatible_request(&server.base_url).provider;

        let error = discover_ai_model_ids_with(&provider, None, TEST_LIMITS).unwrap_err();

        assert_eq!(error.kind, ModelErrorKind::Protocol);
    }

    #[test]
    fn truncates_long_provider_errors_without_touching_short_errors() {
        let short = "provider unavailable";
        let long = "x".repeat(605);

        assert_eq!(truncate_error(short), short);
        assert_eq!(truncate_error(&long).len(), 603);
        assert!(truncate_error(&long).ends_with("..."));
    }
}
