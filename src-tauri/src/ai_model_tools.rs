use crate::ai_agents::AiAgentStreamEvent;
use crate::ai_models::{AiModelProviderKind, AiModelStreamRequest};
use std::path::{Path, PathBuf};

/// The tool name the loop offers and the policy rules on.
pub(crate) const CREATE_NOTE_TOOL_NAME: &str = "create_note";
pub(crate) const CREATE_NOTE_TOOL_JSON: &str = r#"{
  "type": "function",
  "function": {
    "name": "create_note",
    "description": "Create a new markdown note inside the active Rhizome vault without overwriting existing files.",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Relative path inside the vault, or an absolute path inside the active vault. Must end in .md."
        },
        "content": {
          "type": "string",
          "description": "Full markdown note content, including YAML frontmatter and H1 when needed."
        },
        "title": {
          "type": "string",
          "description": "Optional title used only when content is omitted."
        },
        "type": {
          "type": "string",
          "description": "Optional note type used only when content is omitted."
        },
        "is_a": {
          "type": "string",
          "description": "Legacy alias for type, used only when content is omitted."
        },
        "vaultPath": {
          "type": "string",
          "description": "Optional target vault root when multiple vaults are active."
        }
      },
      "required": ["path"],
      "additionalProperties": false
    }
  }
}"#;

struct OpenAiToolCall {
    id: String,
    name: String,
    arguments: serde_json::Value,
    raw_arguments: String,
}

pub(crate) struct CreatedNoteToolResult {
    /// One line for the chat transcript.
    pub(crate) summary: String,
    /// JSON with `path` and `vaultPath`, for the model as the tool result.
    pub(crate) output: String,
}

/// GPT-6 Sol, GPT-6 Luna, GPT-5.5, and GPT-5.6 default to medium reasoning.
/// Chat Completions rejects their function tools unless `reasoning_effort`
/// is `none`. Only GPT-5.4 already defaults to `none`; the field is still
/// sent when tools are present so the request does not depend on that
/// default. Match the model id, not the host. An Azure deployment name
/// often differs from the model id, so this override does not fire for
/// those names. OpenRouter is left unchanged: the OpenRouter kind, and any
/// base URL whose host is `openrouter.ai` or a subdomain of it (Taproot
/// stores that route as `open_ai_compatible`).
const CHAT_TOOLS_REASONING_NONE_PREFIXES: &[(&str, &str)] = &[
    ("gpt-6-sol", "GPT-6 Sol"),
    ("gpt-6-luna", "GPT-6 Luna"),
    ("gpt-5.4", "GPT-5.4"),
    ("gpt-5.5", "GPT-5.5"),
    ("gpt-5.6", "GPT-5.6"),
];

/// These models do not accept `reasoning_effort: "none"`. Chat Completions
/// cannot run vault tools for them yet (issue #225).
const CHAT_TOOLS_UNSUPPORTED_PREFIXES: &[(&str, &str)] = &[
    ("gpt-6-astra", "GPT-6 Astra"),
    ("gpt-6.1-sol", "GPT-6.1 Sol"),
];

/// What a tool turn should do on Chat Completions.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ChatToolsReasoning {
    /// Leave tools and `reasoning_effort` alone.
    Unchanged,
    /// Send the tools with `reasoning_effort: "none"`.
    None,
    /// The streaming loop stops with this message. The optional create-note
    /// call omits the tool and still sends the chat.
    OmitTools(String),
    /// Stop before any HTTP call. A `-pro` id does not work in Rhizome chat.
    Refuse(String),
}

/// `None` when this tool turn must send `reasoning_effort`. `OmitTools` for
/// Astra and GPT-6.1 Sol. `Refuse` for a `-pro` id in the family above.
/// `Unchanged` leaves the body alone.
pub(crate) fn chat_tools_reasoning(
    kind: &AiModelProviderKind,
    base_url: Option<&str>,
    model_id: &str,
    tools_present: bool,
) -> ChatToolsReasoning {
    if !tools_present || *kind == AiModelProviderKind::OpenRouter || is_openrouter_base(base_url) {
        return ChatToolsReasoning::Unchanged;
    }
    let bare = bare_chat_model_id(model_id);
    if let Some((name, _)) = bounded_family(&bare, CHAT_TOOLS_UNSUPPORTED_PREFIXES) {
        return ChatToolsReasoning::OmitTools(format!(
            "{name} can't use vault tools in Rhizome yet. Switch to GPT-6 Luna or Sol, or chat without a vault."
        ));
    }
    if let Some((name, rest)) = bounded_family(&bare, CHAT_TOOLS_REASONING_NONE_PREFIXES) {
        if is_pro_suffix(rest) {
            return ChatToolsReasoning::Refuse(pro_refusal(name, rest));
        }
        return ChatToolsReasoning::None;
    }
    ChatToolsReasoning::Unchanged
}

fn bare_chat_model_id(model_id: &str) -> String {
    model_id
        .trim()
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
}

/// The id matches a family entry exactly, or continues with `-` (a date or
/// other suffix). `gpt-5.40` does not match `gpt-5.4`.
fn bounded_family<'a>(
    bare: &'a str,
    families: &'static [(&'static str, &'static str)],
) -> Option<(&'static str, &'a str)> {
    let mut found: Option<(&str, &str, &str)> = None;
    for (prefix, name) in families {
        let rest = if bare == *prefix {
            Some("")
        } else {
            bare.strip_prefix(prefix)
                .and_then(|rest| rest.strip_prefix('-'))
        };
        let Some(rest) = rest else {
            continue;
        };
        let replace = match found {
            None => true,
            Some((previous, _, _)) => prefix.len() > previous.len(),
        };
        if replace {
            found = Some((*prefix, *name, rest));
        }
    }
    found.map(|(_, name, rest)| (name, rest))
}

/// `pro` as its own `-` segment, including after another suffix (`mini-pro`).
fn is_pro_suffix(rest: &str) -> bool {
    rest.split('-').any(|part| part == "pro")
}

/// "GPT-6 Luna Mini Pro doesn't work…" when the segments before `pro` are
/// known. Anything else falls back to a generic sentence.
fn pro_refusal(base_name: &str, rest: &str) -> String {
    let Some(display) = pro_display_name(base_name, rest) else {
        return "This Pro model doesn't work in Rhizome chat yet.".into();
    };
    let pick = if base_name.starts_with("GPT-5") {
        format!("Pick {base_name} instead.")
    } else {
        "Pick GPT-6 Sol or Luna instead.".into()
    };
    format!("{display} doesn't work in Rhizome chat yet. {pick}")
}

fn pro_display_name(base_name: &str, rest: &str) -> Option<String> {
    let mut qualifiers = Vec::new();
    for part in rest.split('-') {
        if part == "pro" {
            let mut name = base_name.to_string();
            for qualifier in qualifiers {
                name.push(' ');
                name.push_str(qualifier);
            }
            name.push_str(" Pro");
            return Some(name);
        }
        let qualifier = match part {
            "mini" => "Mini",
            _ => return None,
        };
        qualifiers.push(qualifier);
    }
    None
}

fn is_openrouter_base(base_url: Option<&str>) -> bool {
    base_url_host(base_url)
        .is_some_and(|host| host == "openrouter.ai" || host.ends_with(".openrouter.ai"))
}

fn base_url_host(base_url: Option<&str>) -> Option<String> {
    let base = base_url?.trim();
    let without_scheme = base.split_once("://").map(|(_, rest)| rest).unwrap_or(base);
    let host_port = without_scheme.split(['/', '?', '#']).next().unwrap_or("");
    let host = host_port
        .rsplit_once('@')
        .map(|(_, host)| host)
        .unwrap_or(host_port);
    let host = host.split(':').next().unwrap_or("").trim();
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    (!host.is_empty()).then_some(host)
}

pub(crate) fn openai_chat_payload(request: &AiModelStreamRequest) -> serde_json::Value {
    let mut payload = serde_json::json!({
        "model": request.model_id,
        "messages": openai_chat_messages(request),
        "stream": false
    });
    if should_offer_openai_tools(request) {
        let reasoning = chat_tools_reasoning(
            &request.provider.kind,
            request.provider.base_url.as_deref(),
            &request.model_id,
            true,
        );
        if !matches!(reasoning, ChatToolsReasoning::OmitTools(_)) {
            payload["tools"] = serde_json::Value::Array(vec![openai_create_note_tool()]);
            payload["tool_choice"] = serde_json::Value::String("auto".into());
        }
        if reasoning == ChatToolsReasoning::None {
            payload["reasoning_effort"] = serde_json::Value::String("none".into());
        }
    }
    payload
}

pub(crate) fn execute_openai_tool_calls<F>(
    request: &AiModelStreamRequest,
    json: &serde_json::Value,
    emit: F,
) -> Result<Option<String>, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let tool_calls = openai_tool_calls(json)?;
    if tool_calls.is_empty() {
        return Ok(None);
    }
    run_openai_tool_calls(request, &tool_calls, emit).map(Some)
}

fn openai_chat_messages(request: &AiModelStreamRequest) -> Vec<serde_json::Value> {
    let mut messages = Vec::new();
    if let Some(system_prompt) = non_empty_option(request.system_prompt.as_deref()) {
        messages.push(serde_json::json!({ "role": "system", "content": system_prompt }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": request.message }));
    messages
}

pub(crate) fn should_offer_openai_tools(request: &AiModelStreamRequest) -> bool {
    let has_active_vault = non_empty_option(request.vault_path.as_deref()).is_some();
    has_active_vault
        && (request.provider.kind == AiModelProviderKind::OpenAi
            || selected_model_supports_tools(request))
}

fn selected_model_supports_tools(request: &AiModelStreamRequest) -> bool {
    request
        .provider
        .models
        .iter()
        .find(|model| model.id == request.model_id)
        .is_some_and(|model| model.capabilities.tools)
}

pub(crate) fn openai_create_note_tool() -> serde_json::Value {
    serde_json::from_str(CREATE_NOTE_TOOL_JSON).expect("create_note tool schema must be valid JSON")
}

fn run_openai_tool_calls<F>(
    request: &AiModelStreamRequest,
    tool_calls: &[OpenAiToolCall],
    mut emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let mut summaries = Vec::new();
    for tool_call in tool_calls {
        summaries.push(execute_openai_tool_call(request, tool_call, &mut emit)?);
    }
    Ok(summaries.join("\n"))
}

fn execute_openai_tool_call<F>(
    request: &AiModelStreamRequest,
    tool_call: &OpenAiToolCall,
    emit: &mut F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    if tool_call.name != CREATE_NOTE_TOOL_NAME {
        return Err(format!(
            "AI provider requested unsupported tool: {}",
            tool_call.name
        ));
    }

    emit(AiAgentStreamEvent::ToolStart {
        tool_name: CREATE_NOTE_TOOL_NAME.into(),
        tool_id: tool_call.id.clone(),
        input: Some(tool_call.raw_arguments.clone()),
    });

    match create_note(
        &tool_call.arguments,
        request.vault_path.as_deref(),
        &request.vault_paths,
    ) {
        Ok(result) => {
            emit(AiAgentStreamEvent::ToolDone {
                tool_id: tool_call.id.clone(),
                output: Some(result.output),
            });
            Ok(result.summary)
        }
        Err(error) => {
            emit(AiAgentStreamEvent::ToolDone {
                tool_id: tool_call.id.clone(),
                output: Some(format!("Error: {error}")),
            });
            Err(error)
        }
    }
}

fn openai_tool_calls(json: &serde_json::Value) -> Result<Vec<OpenAiToolCall>, String> {
    let Some(calls) = json["choices"][0]["message"]["tool_calls"].as_array() else {
        return Ok(Vec::new());
    };

    calls
        .iter()
        .enumerate()
        .map(|(index, call)| openai_tool_call(index, call))
        .collect()
}

fn openai_tool_call(index: usize, call: &serde_json::Value) -> Result<OpenAiToolCall, String> {
    let function = &call["function"];
    let name = function["name"]
        .as_str()
        .ok_or_else(|| "AI provider tool call did not include a function name.".to_string())?
        .to_string();
    let (arguments, raw_arguments) = parse_tool_arguments(&function["arguments"])?;
    let id = call["id"]
        .as_str()
        .map(str::to_string)
        .unwrap_or_else(|| format!("tool_call_{index}"));
    Ok(OpenAiToolCall {
        id,
        name,
        arguments,
        raw_arguments,
    })
}

fn parse_tool_arguments(value: &serde_json::Value) -> Result<(serde_json::Value, String), String> {
    if let Some(raw) = value.as_str() {
        let parsed = serde_json::from_str(raw)
            .map_err(|error| format!("Failed to parse AI tool arguments: {error}"))?;
        return Ok((parsed, raw.to_string()));
    }
    if value.is_object() {
        let raw = serde_json::to_string(value)
            .map_err(|error| format!("Failed to serialize AI tool arguments: {error}"))?;
        return Ok((value.clone(), raw));
    }
    Ok((serde_json::json!({}), "{}".into()))
}

/// The `create_note` tool body, with no model request attached. The
/// Rhizome loop can call it after its policy allows the call.
///
/// `vault_path` is the default vault. `vault_paths` are the other active
/// vaults. An explicit `vaultPath` argument must be one of them. The note
/// path is checked against the vault root by `create_note_content`, so a
/// path outside the vault is refused. An existing file is never overwritten.
pub(crate) fn create_note(
    args: &serde_json::Value,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<CreatedNoteToolResult, String> {
    let note_path = required_tool_string(args, "path")?;
    let content = create_note_tool_content(args, note_path);
    let vault_path = tool_vault_path(vault_path, vault_paths, args)?;
    crate::commands::create_note_content(
        PathBuf::from(note_path),
        content,
        Some(PathBuf::from(vault_path)),
    )?;
    let output = serde_json::json!({
        "path": note_path,
        "vaultPath": vault_path,
    })
    .to_string();
    Ok(CreatedNoteToolResult {
        summary: format!("Created note: {note_path}"),
        output,
    })
}

/// The loop's `create_note` tool. `raw_args` is the JSON argument string
/// the model sent. Returns the model-visible tool output (JSON with `path`
/// and `vaultPath`), or the error text for the tool result.
pub fn run_create_note_tool(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    let args = parse_raw_tool_arguments(raw_args)?;
    create_note(&args, vault_path, vault_paths).map(|created| created.output)
}

/// An empty string means no arguments. Anything else must be a JSON object.
fn parse_raw_tool_arguments(raw_args: &str) -> Result<serde_json::Value, String> {
    if raw_args.trim().is_empty() {
        return Ok(serde_json::json!({}));
    }
    let args: serde_json::Value = serde_json::from_str(raw_args)
        .map_err(|error| format!("Failed to parse create_note arguments: {error}"))?;
    if args.is_object() {
        Ok(args)
    } else {
        Err("create_note arguments must be a JSON object.".into())
    }
}

fn tool_vault_path<'a>(
    default_vault: Option<&'a str>,
    vault_paths: &'a [String],
    args: &'a serde_json::Value,
) -> Result<&'a str, String> {
    if let Some(vault_path) = string_arg(args, "vaultPath") {
        let mut active = default_vault
            .into_iter()
            .chain(vault_paths.iter().map(String::as_str))
            .filter_map(non_empty_str);
        return if active.any(|candidate| candidate == vault_path) {
            Ok(vault_path)
        } else {
            Err(format!("Vault is not active in Rhizome: {vault_path}"))
        };
    }
    default_vault
        .and_then(non_empty_str)
        .ok_or_else(|| "No active vault is available for create_note.".to_string())
}

fn create_note_tool_content(args: &serde_json::Value, note_path: &str) -> String {
    let fallback_title = string_arg(args, "title")
        .map(str::to_string)
        .unwrap_or_else(|| fallback_note_title(note_path));
    if let Some(content) = content_arg(args, "content") {
        return crate::agent_run_note::rewrite_agent_run_note_content(
            content,
            Some(&fallback_title),
        );
    }
    let note_type = string_arg(args, "type")
        .or_else(|| string_arg(args, "is_a"))
        .unwrap_or("Note");
    let note_type_yaml = serde_json::to_string(note_type).unwrap_or_else(|_| "\"Note\"".into());
    format!("---\ntype: {note_type_yaml}\n---\n\n# {fallback_title}\n")
}

fn fallback_note_title(note_path: &str) -> String {
    let normalized = note_path.replace('\\', "/");
    Path::new(&normalized)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|title| !title.trim().is_empty())
        .unwrap_or("Untitled")
        .to_string()
}

fn required_tool_string<'a>(args: &'a serde_json::Value, key: &str) -> Result<&'a str, String> {
    string_arg(args, key).ok_or_else(|| format!("create_note requires {key}."))
}

fn string_arg<'a>(args: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    args[key].as_str().and_then(non_empty_str)
}

fn content_arg<'a>(args: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    args[key]
        .as_str()
        .filter(|content| !content.trim().is_empty())
}

fn non_empty_option(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn non_empty_str(value: &str) -> Option<&str> {
    non_empty_option(Some(value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_models::{
        AiModelApiKeyStorage, AiModelCapabilities, AiModelDefinition, AiModelProvider,
    };
    use serde_json::json;
    use std::fs;

    const CREATED_NOTE_PATH: &str = "nota-longa-teste-gerada-2.md";
    const CREATED_NOTE_CONTENT: &str = "---\ntype: Note\n---\n\n# Nota longa de teste - gerada 2\n";

    fn request(vault_path: String) -> AiModelStreamRequest {
        request_with_provider(provider(), Some(vault_path), Vec::new())
    }

    fn request_with_provider(
        provider: AiModelProvider,
        vault_path: Option<String>,
        vault_paths: Vec<String>,
    ) -> AiModelStreamRequest {
        AiModelStreamRequest {
            provider,
            model_id: "gpt-5-nano".into(),
            message: "Create the note".into(),
            system_prompt: Some("Use create_note for new notes.".into()),
            vault_path,
            vault_paths,
            api_key_override: None,
            event_name: None,
            reasoning_level: None,
            reasoning_slot: None,
            reasoning_notice_tx: None,
            reasoning_notices_seen: None,
            chat_images: Vec::new(),
            vision_state: crate::chat_images::VisionState::Unknown,
        }
    }

    fn provider() -> AiModelProvider {
        AiModelProvider {
            id: "openai".into(),
            name: "OpenAI".into(),
            kind: AiModelProviderKind::OpenAi,
            base_url: Some("https://api.openai.com/v1".into()),
            api_key_storage: Some(AiModelApiKeyStorage::LocalFile),
            api_key_env_var: None,
            headers: None,
            models: vec![AiModelDefinition {
                id: "gpt-5-nano".into(),
                display_name: None,
                context_window: None,
                max_output_tokens: None,
                capabilities: AiModelCapabilities {
                    streaming: false,
                    tools: false,
                    vision: false,
                    json_mode: false,
                    reasoning: crate::reasoning_levels::ReasoningSupport::Unknown,
                },
            }],
        }
    }

    fn create_note_response() -> serde_json::Value {
        tool_call_response(json!({
            "id": "call_create",
            "function": {
                "name": CREATE_NOTE_TOOL_NAME,
                "arguments": serde_json::to_string(&json!({
                    "path": CREATED_NOTE_PATH,
                    "content": CREATED_NOTE_CONTENT
                })).unwrap()
            }
        }))
    }

    fn tool_call_response(tool_call: serde_json::Value) -> serde_json::Value {
        json!({
            "choices": [{
                "message": {
                    "tool_calls": [tool_call]
                }
            }]
        })
    }

    fn create_note_response_with_args(arguments: serde_json::Value) -> serde_json::Value {
        tool_call_response(json!({
            "function": {
                "name": CREATE_NOTE_TOOL_NAME,
                "arguments": arguments,
            }
        }))
    }

    fn create_note_error(arguments: serde_json::Value) -> String {
        let dir = tempfile::tempdir().unwrap();
        let request = request(dir.path().to_string_lossy().into_owned());

        execute_openai_tool_calls(&request, &create_note_response_with_args(arguments), |_| {})
            .unwrap_err()
    }

    fn assert_note_created(vault_path: &Path) {
        let actual = fs::read_to_string(vault_path.join(CREATED_NOTE_PATH)).unwrap();
        assert_eq!(actual, CREATED_NOTE_CONTENT);
    }

    fn assert_summary(summary: Option<String>) {
        assert_eq!(
            summary.as_deref(),
            Some("Created note: nota-longa-teste-gerada-2.md"),
        );
    }

    fn assert_tool_events(events: &[AiAgentStreamEvent]) {
        assert!(matches!(
            &events[0],
            AiAgentStreamEvent::ToolStart { tool_name, tool_id, input: Some(input) }
                if tool_name == CREATE_NOTE_TOOL_NAME && tool_id == "call_create" && input.contains(CREATED_NOTE_PATH)
        ));
        assert!(matches!(
            &events[1],
            AiAgentStreamEvent::ToolDone { tool_id, output: Some(output) }
                if tool_id == "call_create" && output.contains(CREATED_NOTE_PATH)
        ));
    }

    #[test]
    fn openai_payload_offers_create_note_when_active_vault_is_loaded() {
        let dir = tempfile::tempdir().unwrap();
        let payload = openai_chat_payload(&request(dir.path().to_string_lossy().into_owned()));

        assert!(payload["tools"][0]["function"]["name"] == CREATE_NOTE_TOOL_NAME);
    }

    #[test]
    fn openai_payload_offers_create_note_for_tool_capable_custom_models() {
        let dir = tempfile::tempdir().unwrap();
        let mut provider = provider();
        provider.kind = AiModelProviderKind::OpenAiCompatible;
        provider.models[0].capabilities.tools = true;
        let request = request_with_provider(
            provider,
            Some(dir.path().to_string_lossy().into_owned()),
            vec![],
        );

        let payload = openai_chat_payload(&request);

        assert!(payload["tools"][0]["function"]["name"] == CREATE_NOTE_TOOL_NAME);
    }

    #[test]
    fn openai_payload_skips_create_note_when_no_active_vault_is_loaded() {
        let payload = openai_chat_payload(&request_with_provider(provider(), None, Vec::new()));

        assert!(payload.get("tools").is_none());
        assert!(payload.get("tool_choice").is_none());
    }

    fn payload_for(model_id: &str, kind: AiModelProviderKind, vault: bool) -> serde_json::Value {
        let mut provider = provider();
        provider.kind = kind;
        provider.models[0].id = model_id.into();
        provider.models[0].capabilities.tools = true;
        let mut request =
            request_with_provider(provider, vault.then(|| "vault".into()), Vec::new());
        request.model_id = model_id.into();
        openai_chat_payload(&request)
    }

    fn reasoning_for(
        model_id: &str,
        kind: AiModelProviderKind,
        base_url: Option<&str>,
        tools: bool,
    ) -> ChatToolsReasoning {
        chat_tools_reasoning(&kind, base_url, model_id, tools)
    }

    #[test]
    fn openai_payload_sends_reasoning_none_only_with_tools_on_the_gpt_family() {
        for model_id in [
            "gpt-6-sol",
            "gpt-6-luna",
            "GPT-6-LUNA",
            "gpt-5.4",
            "gpt-5.4-2026-03-01",
            "gpt-5.5-mini",
            "gpt-5.6-terra",
            "openai/gpt-6-luna",
        ] {
            let payload = payload_for(model_id, AiModelProviderKind::OpenAi, true);
            assert_eq!(payload["reasoning_effort"], "none", "{model_id}");
            assert!(payload.get("tools").is_some(), "{model_id}");
        }

        for model_id in [
            "gpt-4.1",
            "gpt-5.3",
            "gpt-5.40",
            "gpt-5.55",
            "gpt-5-nano",
            "gpt-6-lunatic",
        ] {
            let payload = payload_for(model_id, AiModelProviderKind::OpenAi, true);
            assert!(payload.get("tools").is_some(), "{model_id}");
            assert!(payload.get("reasoning_effort").is_none(), "{model_id}");
            assert_eq!(
                reasoning_for(model_id, AiModelProviderKind::OpenAi, None, true),
                ChatToolsReasoning::Unchanged,
                "{model_id}"
            );
        }

        let no_tools = payload_for("gpt-6-luna", AiModelProviderKind::OpenAi, false);
        assert!(no_tools.get("tools").is_none());
        assert!(no_tools.get("reasoning_effort").is_none());
        assert_eq!(
            reasoning_for("gpt-6-astra", AiModelProviderKind::OpenAi, None, false),
            ChatToolsReasoning::Unchanged
        );

        for model_id in ["openai/gpt-6-luna", "gpt-6-astra", "gpt-6.1-sol"] {
            let payload = payload_for(model_id, AiModelProviderKind::OpenRouter, true);
            assert!(payload.get("tools").is_some(), "{model_id}");
            assert!(payload.get("reasoning_effort").is_none(), "{model_id}");
        }

        let mut openrouter_host = provider();
        openrouter_host.kind = AiModelProviderKind::OpenAiCompatible;
        openrouter_host.base_url = Some("https://OpenRouter.ai/api/v1".into());
        openrouter_host.models[0].id = "gpt-6-luna".into();
        openrouter_host.models[0].capabilities.tools = true;
        let mut request = request_with_provider(openrouter_host, Some("vault".into()), Vec::new());
        request.model_id = "gpt-6-luna".into();
        let payload = openai_chat_payload(&request);
        assert!(payload.get("tools").is_some());
        assert!(payload.get("reasoning_effort").is_none());
        assert_eq!(
            chat_tools_reasoning(
                &AiModelProviderKind::OpenAiCompatible,
                Some("https://openrouter.ai/api/v1"),
                "gpt-6-luna",
                true,
            ),
            ChatToolsReasoning::Unchanged
        );

        for (model_id, name) in [
            ("gpt-6-astra", "GPT-6 Astra"),
            ("GPT-6-ASTRA", "GPT-6 Astra"),
            ("gpt-6-astra-900k", "GPT-6 Astra"),
            ("gpt-6.1-sol", "GPT-6.1 Sol"),
            ("openai/gpt-6.1-sol", "GPT-6.1 Sol"),
        ] {
            let payload = payload_for(model_id, AiModelProviderKind::OpenAi, true);
            assert!(payload.get("tools").is_none(), "{model_id}");
            assert!(payload.get("reasoning_effort").is_none(), "{model_id}");
            assert_eq!(
                reasoning_for(model_id, AiModelProviderKind::OpenAi, None, true),
                ChatToolsReasoning::OmitTools(format!(
                    "{name} can't use vault tools in Rhizome yet. Switch to GPT-6 Luna or Sol, or chat without a vault."
                )),
                "{model_id}"
            );
        }

        for (model_id, message) in [
            (
                "gpt-6-luna-pro",
                "GPT-6 Luna Pro doesn't work in Rhizome chat yet. Pick GPT-6 Sol or Luna instead.",
            ),
            (
                "gpt-5.4-pro",
                "GPT-5.4 Pro doesn't work in Rhizome chat yet. Pick GPT-5.4 instead.",
            ),
            (
                "gpt-5.6-pro",
                "GPT-5.6 Pro doesn't work in Rhizome chat yet. Pick GPT-5.6 instead.",
            ),
            (
                "gpt-6-luna-mini-pro",
                "GPT-6 Luna Mini Pro doesn't work in Rhizome chat yet. Pick GPT-6 Sol or Luna instead.",
            ),
            (
                "gpt-6-sol-mini-pro-2026-01-01",
                "GPT-6 Sol Mini Pro doesn't work in Rhizome chat yet. Pick GPT-6 Sol or Luna instead.",
            ),
            (
                "gpt-6-luna-custom-pro",
                "This Pro model doesn't work in Rhizome chat yet.",
            ),
        ] {
            assert_eq!(
                reasoning_for(model_id, AiModelProviderKind::OpenAi, None, true),
                ChatToolsReasoning::Refuse(message.into()),
                "{model_id}"
            );
        }

        for base_url in [
            "https://openrouter.ai.evil.com/api/v1",
            "https://evilopenrouter.ai/api/v1",
            "https://evil.com/openrouter.ai",
            "https://openrouter.ai@evil.com/api/v1",
            "openrouter.ai.evil.com",
            "evil.com/openrouter.ai",
            "openrouter.ai@evil.com",
        ] {
            assert_eq!(
                reasoning_for(
                    "gpt-6-luna",
                    AiModelProviderKind::OpenAiCompatible,
                    Some(base_url),
                    true,
                ),
                ChatToolsReasoning::None,
                "{base_url}"
            );
            let mut provider = provider();
            provider.kind = AiModelProviderKind::OpenAiCompatible;
            provider.base_url = Some(base_url.into());
            provider.models[0].id = "gpt-6-luna".into();
            provider.models[0].capabilities.tools = true;
            let mut request = request_with_provider(provider, Some("vault".into()), Vec::new());
            request.model_id = "gpt-6-luna".into();
            let payload = openai_chat_payload(&request);
            assert_eq!(payload["reasoning_effort"], "none", "{base_url}");
        }

        assert_eq!(
            reasoning_for(
                "gpt-6-luna",
                AiModelProviderKind::OpenAiCompatible,
                Some("https://api.openrouter.ai/api/v1"),
                true,
            ),
            ChatToolsReasoning::Unchanged
        );
        let mut subdomain = provider();
        subdomain.kind = AiModelProviderKind::OpenAiCompatible;
        subdomain.base_url = Some("https://api.openrouter.ai/api/v1".into());
        subdomain.models[0].id = "gpt-6-luna".into();
        subdomain.models[0].capabilities.tools = true;
        let mut request = request_with_provider(subdomain, Some("vault".into()), Vec::new());
        request.model_id = "gpt-6-luna".into();
        let payload = openai_chat_payload(&request);
        assert!(payload.get("tools").is_some());
        assert!(payload.get("reasoning_effort").is_none());
    }

    #[test]
    fn execute_openai_tool_calls_returns_none_without_tool_calls() {
        let dir = tempfile::tempdir().unwrap();
        let request = request(dir.path().to_string_lossy().into_owned());

        let summary = execute_openai_tool_calls(
            &request,
            &json!({ "choices": [{ "message": { "content": "No tools" } }] }),
            |_| {},
        )
        .unwrap();

        assert_eq!(summary, None);
    }

    #[test]
    fn executes_openai_create_note_tool_call_inside_active_vault() {
        let dir = tempfile::tempdir().unwrap();
        let request = request(dir.path().to_string_lossy().into_owned());
        let mut events = Vec::new();

        let summary = execute_openai_tool_calls(&request, &create_note_response(), |event| {
            events.push(event)
        })
        .unwrap();

        assert_note_created(dir.path());
        assert_summary(summary);
        assert_tool_events(&events);
    }

    #[test]
    fn executes_openai_create_note_with_object_arguments_and_selected_vault() {
        let primary = tempfile::tempdir().unwrap();
        let secondary = tempfile::tempdir().unwrap();
        let secondary_path = secondary.path().to_string_lossy().into_owned();
        let request = request_with_provider(
            provider(),
            Some(primary.path().to_string_lossy().into_owned()),
            vec![secondary_path.clone()],
        );
        let response = tool_call_response(json!({
            "function": {
                "name": CREATE_NOTE_TOOL_NAME,
                "arguments": {
                    "path": "Generated/fallback-note.md",
                    "is_a": "Project",
                    "vaultPath": secondary_path,
                }
            }
        }));

        let summary = execute_openai_tool_calls(&request, &response, |_| {}).unwrap();

        assert_eq!(
            fs::read_to_string(secondary.path().join("Generated/fallback-note.md")).unwrap(),
            "---\ntype: \"Project\"\n---\n\n# fallback-note\n",
        );
        assert_eq!(
            summary.as_deref(),
            Some("Created note: Generated/fallback-note.md")
        );
        assert!(!primary.path().join("Generated/fallback-note.md").exists());
    }

    #[test]
    fn execute_openai_tool_calls_rejects_unsupported_tool_before_running_it() {
        let dir = tempfile::tempdir().unwrap();
        let request = request(dir.path().to_string_lossy().into_owned());
        let response = tool_call_response(json!({
            "id": "call_delete",
            "function": {
                "name": "delete_note",
                "arguments": "{}",
            }
        }));
        let mut events = Vec::new();

        let error =
            execute_openai_tool_calls(&request, &response, |event| events.push(event)).unwrap_err();

        assert_eq!(error, "AI provider requested unsupported tool: delete_note");
        assert!(events.is_empty());
    }

    #[test]
    fn execute_openai_tool_calls_rejects_malformed_arguments() {
        let error = create_note_error(json!("{not-json"));

        assert!(error.contains("Failed to parse AI tool arguments"));
    }

    #[test]
    fn execute_openai_tool_calls_treats_non_object_arguments_as_empty() {
        let error = create_note_error(json!([]));

        assert_eq!(error, "create_note requires path.");
    }

    #[test]
    fn execute_openai_tool_calls_rejects_existing_note_without_overwriting() {
        let dir = tempfile::tempdir().unwrap();
        let request = request(dir.path().to_string_lossy().into_owned());
        fs::write(dir.path().join("existing.md"), "# Existing\n").unwrap();
        let response = tool_call_response(json!({
            "function": {
                "name": CREATE_NOTE_TOOL_NAME,
                "arguments": serde_json::to_string(&json!({
                    "path": "existing.md",
                    "content": "# Replacement\n",
                })).unwrap(),
            }
        }));

        let error = execute_openai_tool_calls(&request, &response, |_| {}).unwrap_err();

        assert!(error.contains("already exists"));
        assert_eq!(
            fs::read_to_string(dir.path().join("existing.md")).unwrap(),
            "# Existing\n",
        );
    }

    #[test]
    fn execute_openai_tool_calls_requires_path() {
        let error = create_note_error(json!("{}"));

        assert_eq!(error, "create_note requires path.");
    }

    #[test]
    fn create_note_writes_inside_the_default_vault_without_a_model_request() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();

        let created = create_note(
            &json!({ "path": CREATED_NOTE_PATH, "content": CREATED_NOTE_CONTENT }),
            Some(&vault_path),
            &[],
        )
        .unwrap();

        assert_note_created(vault.path());
        assert_eq!(
            created.summary,
            format!("Created note: {CREATED_NOTE_PATH}")
        );
        assert!(created.output.contains(CREATED_NOTE_PATH));
    }

    #[test]
    fn create_note_refuses_a_path_outside_the_vault() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let vault_path = vault.to_string_lossy().into_owned();

        let result = create_note(
            &json!({ "path": "../escape.md", "content": "# Escape\n" }),
            Some(&vault_path),
            &[],
        );

        assert!(result.is_err());
        assert!(!parent.path().join("escape.md").exists());
    }

    #[test]
    fn create_note_refuses_secret_and_git_paths() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        for requested in [
            ".env",
            ".env.local",
            "key.pem",
            "id_rsa",
            "nested/.git/config",
        ] {
            let error = create_note(
                &json!({ "path": requested, "content": "no\n" }),
                Some(&vault_path),
                &[],
            )
            .err()
            .expect("secret path");
            assert!(
                error.contains(crate::rhizome_loop::BLOCKED_SECRET),
                "{requested}: {error}"
            );
            assert!(
                !vault.path().join(requested).exists(),
                "{requested} must not be created"
            );
        }
        assert!(
            !vault.path().join("nested").exists(),
            "create_note must not create a .git parent"
        );

        create_note(
            &json!({ "path": ".env.example", "content": "EXAMPLE=1\n" }),
            Some(&vault_path),
            &[],
        )
        .expect(".env.example is not a secret");
        assert_eq!(
            fs::read_to_string(vault.path().join(".env.example")).unwrap(),
            "EXAMPLE=1\n"
        );
    }

    #[test]
    fn create_note_stays_blocked_when_the_secret_setting_is_off() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        fs::create_dir_all(vault.path().join(".git").join("hooks")).unwrap();
        fs::write(
            vault.path().join(".git").join("hooks").join("pre-commit"),
            "keep\n",
        )
        .unwrap();
        fs::write(vault.path().join(".env"), "SECRET=keep\n").unwrap();
        let _guard = crate::rhizome_loop::override_secret_block(false);
        for requested in [".git/hooks/pre-commit", ".env", "id_ed25519"] {
            let error = create_note(
                &json!({ "path": requested, "content": "no\n" }),
                Some(&vault_path),
                &[],
            )
            .err()
            .expect("secret path");
            assert!(
                error.contains(crate::rhizome_loop::BLOCKED_SECRET),
                "create_note must keep blocking {requested} with the setting off: {error}"
            );
            if requested != "id_ed25519" {
                assert_eq!(
                    fs::read_to_string(vault.path().join(requested)).unwrap(),
                    if requested == ".env" {
                        "SECRET=keep\n"
                    } else {
                        "keep\n"
                    },
                    "{requested} must stay unchanged"
                );
            } else {
                assert!(!vault.path().join(requested).exists());
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn create_note_refuses_a_symlink_into_git() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        fs::create_dir_all(vault.path().join(".git")).unwrap();
        fs::write(vault.path().join(".git").join("config"), "keep\n").unwrap();
        std::os::unix::fs::symlink(vault.path().join(".git"), vault.path().join("gitlink"))
            .unwrap();
        let error = create_note(
            &json!({ "path": "gitlink/config", "content": "no\n" }),
            Some(&vault_path),
            &[],
        )
        .err()
        .expect("symlink into .git");
        assert!(
            error.contains(crate::rhizome_loop::BLOCKED_SECRET),
            "{error}"
        );
        assert_eq!(
            fs::read_to_string(vault.path().join(".git").join("config")).unwrap(),
            "keep\n"
        );
    }

    #[test]
    fn create_note_refuses_git_and_env_aliases() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        for requested in [".GIT/x", ".ENV.LOCAL", ".git/../.git/x", ".env.production"] {
            let error = create_note(
                &json!({ "path": requested, "content": "no\n" }),
                Some(&vault_path),
                &[],
            )
            .err()
            .expect("secret path");
            assert!(
                error.contains(crate::rhizome_loop::BLOCKED_SECRET),
                "{requested}: {error}"
            );
            assert!(
                !vault.path().join(requested).exists(),
                "{requested} must not be created"
            );
        }
        assert!(!vault.path().join(".git").join("x").exists());
        assert!(!vault.path().join(".env.production").exists());
    }

    /// `CI` counts only when it is set to a real value. An empty string,
    /// `false` in any ASCII case, and `0` are the same as unset.
    fn ci_is_set() -> bool {
        std::env::var("CI").ok().is_some_and(|value| {
            let value = value.trim();
            !value.is_empty() && !value.eq_ignore_ascii_case("false") && value != "0"
        })
    }

    /// False when this platform cannot make a symlink. The test then returns.
    fn relative_symlink(target: &str, link: &std::path::Path) -> bool {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(target, link).is_ok()
        }
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_file(target, link).is_ok()
        }
        #[cfg(not(any(unix, windows)))]
        {
            let _ = (target, link);
            false
        }
    }

    #[test]
    fn create_note_refuses_a_relative_symlink_into_git() {
        let vault = tempfile::tempdir().unwrap();
        let git = vault.path().join(".git");
        fs::create_dir(&git).unwrap();
        fs::write(git.join("config"), "keep\n").unwrap();
        let link = vault.path().join("note");
        #[cfg(windows)]
        let target = ".git\\config";
        #[cfg(not(windows))]
        let target = ".git/config";
        if !relative_symlink(target, &link) {
            if ci_is_set() {
                panic!("symlink support is required when CI is set");
            }
            eprintln!(
                "skipping create_note_refuses_a_relative_symlink_into_git: this platform cannot create a symlink"
            );
            return;
        }
        let vault_path = vault.path().to_string_lossy().into_owned();
        let error = create_note(
            &json!({ "path": "note", "content": "hello\n" }),
            Some(&vault_path),
            &[],
        )
        .err()
        .expect("a symlink into git is refused");
        assert!(
            error.contains(crate::rhizome_loop::BLOCKED_SECRET),
            "secret path must be refused"
        );
        assert_eq!(fs::read_to_string(git.join("config")).unwrap(), "keep\n");
    }

    #[cfg(windows)]
    #[test]
    fn create_note_refuses_windows_git_short_names() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        for requested in [
            ".git./config",
            "GIT~1/config",
            ".git /config",
            ".git../config",
            ".git.../config",
            ".git. /config",
            ".git::$INDEX_ALLOCATION/config",
        ] {
            let error = create_note(
                &json!({ "path": requested, "content": "no\n" }),
                Some(&vault_path),
                &[],
            )
            .err()
            .expect("windows git alias");
            assert!(
                error.contains(crate::rhizome_loop::BLOCKED_SECRET),
                "{requested}: {error}"
            );
            assert!(!vault.path().join(requested).exists(), "{requested}");
        }
    }

    #[test]
    fn create_note_refuses_an_inactive_vault_and_a_missing_vault() {
        let active = tempfile::tempdir().unwrap();
        let inactive = tempfile::tempdir().unwrap();
        let active_path = active.path().to_string_lossy().into_owned();
        let args = json!({
            "path": "inactive.md",
            "vaultPath": inactive.path().to_string_lossy(),
        });

        let inactive_error = create_note(&args, Some(&active_path), &[]).err().unwrap();
        let missing_error = create_note(&json!({ "path": "a.md" }), None, &[])
            .err()
            .unwrap();

        assert!(inactive_error.starts_with("Vault is not active in Rhizome:"));
        assert!(!inactive.path().join("inactive.md").exists());
        assert_eq!(
            missing_error,
            "No active vault is available for create_note."
        );
    }

    #[test]
    fn execute_openai_tool_calls_rejects_inactive_explicit_vault() {
        let active = tempfile::tempdir().unwrap();
        let inactive = tempfile::tempdir().unwrap();
        let request = request(active.path().to_string_lossy().into_owned());
        let response = tool_call_response(json!({
            "function": {
                "name": CREATE_NOTE_TOOL_NAME,
                "arguments": serde_json::to_string(&json!({
                    "path": "inactive.md",
                    "content": "# Inactive\n",
                    "vaultPath": inactive.path().to_string_lossy(),
                })).unwrap(),
            }
        }));

        let error = execute_openai_tool_calls(&request, &response, |_| {}).unwrap_err();

        assert!(error.starts_with("Vault is not active in Rhizome:"));
        assert!(!inactive.path().join("inactive.md").exists());
    }

    #[test]
    fn run_create_note_tool_writes_a_note_from_raw_json_args() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        let raw = json!({ "path": CREATED_NOTE_PATH, "content": CREATED_NOTE_CONTENT }).to_string();

        let output = run_create_note_tool(&raw, Some(&vault_path), &[]).unwrap();

        assert_note_created(vault.path());
        let output: serde_json::Value = serde_json::from_str(&output).unwrap();
        assert_eq!(output["path"], CREATED_NOTE_PATH);
        assert_eq!(output["vaultPath"], vault_path);
    }

    #[test]
    fn run_create_note_tool_refuses_a_path_outside_the_vault() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let vault_path = vault.to_string_lossy().into_owned();
        let raw = json!({ "path": "../escape.md", "content": "# Escape\n" }).to_string();

        let result = run_create_note_tool(&raw, Some(&vault_path), &[]);

        assert!(result.is_err());
        assert!(!parent.path().join("escape.md").exists());
    }

    #[test]
    fn run_create_note_tool_does_not_overwrite() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        fs::write(vault.path().join("kept.md"), "# Kept\n").unwrap();
        let raw = json!({ "path": "kept.md", "content": "# Replaced\n" }).to_string();

        let result = run_create_note_tool(&raw, Some(&vault_path), &[]);

        assert!(result.is_err());
        assert_eq!(
            fs::read_to_string(vault.path().join("kept.md")).unwrap(),
            "# Kept\n"
        );
    }

    #[test]
    fn run_create_note_tool_rejects_malformed_and_non_object_args() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();

        let malformed = run_create_note_tool("{\"path\":", Some(&vault_path), &[]).unwrap_err();
        let not_object = run_create_note_tool("[\"a.md\"]", Some(&vault_path), &[]).unwrap_err();

        assert!(malformed.starts_with("Failed to parse create_note arguments:"));
        assert_eq!(not_object, "create_note arguments must be a JSON object.");
        assert_eq!(fs::read_dir(vault.path()).unwrap().count(), 0);
    }

    #[test]
    fn run_create_note_tool_with_empty_args_asks_for_a_path() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();

        let error = run_create_note_tool("  ", Some(&vault_path), &[]).unwrap_err();

        assert_eq!(error, "create_note requires path.");
    }

    #[test]
    fn run_create_note_tool_refuses_an_absolute_path_outside_the_vault() {
        let vault = tempfile::tempdir().unwrap();
        let vault_path = vault.path().to_string_lossy().into_owned();
        let outside_dir = tempfile::tempdir().unwrap();
        let outside = outside_dir.path().join("x.md");
        let raw = json!({
            "path": outside.to_string_lossy(),
            "content": "# Escape\n",
        })
        .to_string();

        let result = run_create_note_tool(&raw, Some(&vault_path), &[]);

        assert!(result.is_err());
        assert!(!outside.exists());
    }

    #[test]
    fn run_create_note_tool_requires_a_vault() {
        let raw = json!({ "path": "a.md", "content": "# A\n" }).to_string();

        let error = run_create_note_tool(&raw, None, &[]).unwrap_err();

        assert_eq!(error, "No active vault is available for create_note.");
    }
}
