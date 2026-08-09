//! Wave 3 (ADR-0156): the engine that powers a research *write* verb
//! (distill/import) — either a locally installed CLI agent, or a direct-API
//! model configured with just a key. Distill/Import build+parse+write in
//! Rust, and `ai_models::run_ai_model_stream` emits the same
//! `AiAgentStreamEvent` enum the agent-stream callback consumes, so an
//! API-only call slots in behind the agent path with no event-mapping work.
//!
//! Out of scope by design: `repo_research`/`generate_wiki` need an agentic
//! file-writing loop an API-only call can't do — those stay agent-only.

use std::path::Path;

use crate::ai_agents::AiAgentStreamEvent;
use crate::ai_models::{AiModelProvider, AiModelStreamRequest};

/// Which engine powers a research write verb (distill/import): a locally
/// installed CLI agent, or a direct-API model configured with just a key.
#[derive(Debug, Clone)]
pub enum AiRunTarget {
    Agent(crate::ai_agents::AiAgentId),
    ApiModel {
        provider: AiModelProvider,
        model_id: String,
    },
}

impl AiRunTarget {
    /// Loads `settings.ai_model_providers` when needed. Returns `None` on an
    /// unparseable string OR a `model:` target whose provider/model no longer
    /// exists — callers fall back to the default agent (do NOT panic/drop).
    pub fn from_arg(value: &str) -> Option<AiRunTarget> {
        let settings = crate::settings::get_settings().unwrap_or_default();
        Self::from_arg_with_providers(value, settings.ai_model_providers.as_deref())
    }

    /// Pure inner parser — mirrors the `api_key_from_env`/`_with_lookup`
    /// split in `ai_models.rs` so tests never load real settings.
    pub fn from_arg_with_providers(
        value: &str,
        providers: Option<&[AiModelProvider]>,
    ) -> Option<AiRunTarget> {
        let value = value.trim();
        if let Some(rest) = value.strip_prefix("model:") {
            let (provider_id, model_id) = rest.split_once('/')?;
            let provider = providers?
                .iter()
                .find(|p| p.id.eq_ignore_ascii_case(provider_id.trim()))?;
            provider.models.iter().find(|m| m.id == model_id.trim())?;
            return Some(AiRunTarget::ApiModel {
                provider: provider.clone(),
                model_id: model_id.trim().to_string(),
            });
        }
        // "agent:<id>" or bare "<id>" (legacy `agent` arg).
        let id = value.strip_prefix("agent:").unwrap_or(value);
        crate::ai_agents::parse_agent_id(id).map(AiRunTarget::Agent)
    }
}

/// Run a prepared `prompt` against `target`, accumulating the full response
/// text while forwarding progress lines. Same accumulation the CLI callback
/// used, so parse/write/event downstream stay unchanged.
pub fn run_prompt_via_target(
    vault_path: &Path,
    target: &AiRunTarget,
    prompt: String,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    run_prompt_via_target_with_model_runner(vault_path, target, prompt, on_line, |req, emit| {
        crate::ai_models::run_ai_model_stream(req, emit)
    })
}

/// Same as [`run_prompt_via_target`] with the direct-API model runner
/// injected — lets tests exercise the ApiModel arm with a fake completion
/// instead of a real network endpoint (mirrors the runner-injection pattern
/// in `ai_agents::run_shared_agent_stream`).
pub(crate) fn run_prompt_via_target_with_model_runner<R>(
    vault_path: &Path,
    target: &AiRunTarget,
    prompt: String,
    on_line: &mut dyn FnMut(&str),
    model_runner: R,
) -> Result<String, String>
where
    R: FnOnce(AiModelStreamRequest, &mut dyn FnMut(AiAgentStreamEvent)) -> Result<String, String>,
{
    let mut response = String::new();
    match target {
        AiRunTarget::Agent(agent) => {
            use crate::ai_agents::{AiAgentPermissionMode, AiAgentStreamRequest};
            let request = AiAgentStreamRequest {
                agent: *agent,
                message: prompt,
                system_prompt: None,
                vault_path: vault_path.to_string_lossy().to_string(),
                vault_paths: Vec::new(),
                permission_mode: Some(AiAgentPermissionMode::Safe),
                event_name: None,
            };
            crate::ai_agents::run_ai_agent_stream(request, |event| {
                accumulate(event, &mut response, on_line)
            })?;
        }
        AiRunTarget::ApiModel { provider, model_id } => {
            let request = AiModelStreamRequest {
                provider: provider.clone(),
                model_id: model_id.clone(),
                message: prompt,
                system_prompt: None,
                vault_path: Some(vault_path.to_string_lossy().to_string()),
                vault_paths: Vec::new(),
                api_key_override: None,
                event_name: None,
            };
            model_runner(request, &mut |event| {
                accumulate(event, &mut response, on_line)
            })?;
        }
    }
    Ok(response)
}

fn accumulate(event: AiAgentStreamEvent, response: &mut String, on_line: &mut dyn FnMut(&str)) {
    match event {
        AiAgentStreamEvent::TextDelta { text } => {
            response.push_str(&text);
            on_line(&text);
        }
        AiAgentStreamEvent::ToolStart { tool_name, .. } => on_line(&format!("[{tool_name}]")),
        AiAgentStreamEvent::Error { message } => on_line(&format!("Error: {message}")),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_models::{AiModelCapabilities, AiModelDefinition, AiModelProviderKind};

    fn capabilities() -> AiModelCapabilities {
        AiModelCapabilities {
            streaming: true,
            tools: false,
            vision: false,
            json_mode: true,
            reasoning: false,
        }
    }

    fn provider() -> AiModelProvider {
        AiModelProvider {
            id: "openai".into(),
            name: "OpenAI".into(),
            kind: AiModelProviderKind::OpenAi,
            base_url: None,
            api_key_storage: None,
            api_key_env_var: None,
            headers: None,
            models: vec![AiModelDefinition {
                id: "gpt-4o".into(),
                display_name: None,
                context_window: None,
                max_output_tokens: None,
                capabilities: capabilities(),
            }],
        }
    }

    #[test]
    fn parses_agent_prefixed_and_bare_agent_ids() {
        let providers = vec![provider()];
        assert!(matches!(
            AiRunTarget::from_arg_with_providers("agent:codex", Some(&providers)),
            Some(AiRunTarget::Agent(crate::ai_agents::AiAgentId::Codex))
        ));
        assert!(matches!(
            AiRunTarget::from_arg_with_providers("codex", Some(&providers)),
            Some(AiRunTarget::Agent(crate::ai_agents::AiAgentId::Codex))
        ));
    }

    #[test]
    fn parses_model_target_against_configured_providers() {
        let providers = vec![provider()];
        match AiRunTarget::from_arg_with_providers("model:openai/gpt-4o", Some(&providers)) {
            Some(AiRunTarget::ApiModel { provider, model_id }) => {
                assert_eq!(provider.id, "openai");
                assert_eq!(model_id, "gpt-4o");
            }
            other => panic!("expected ApiModel, got {other:?}"),
        }
    }

    #[test]
    fn model_target_matches_provider_id_case_insensitively() {
        let providers = vec![provider()];
        assert!(matches!(
            AiRunTarget::from_arg_with_providers("model:OpenAI/gpt-4o", Some(&providers)),
            Some(AiRunTarget::ApiModel { .. })
        ));
    }

    #[test]
    fn returns_none_for_model_with_missing_provider() {
        let providers = vec![provider()];
        assert!(AiRunTarget::from_arg_with_providers("model:ghost/x", Some(&providers)).is_none());
    }

    #[test]
    fn returns_none_for_model_with_missing_model_id() {
        let providers = vec![provider()];
        assert!(
            AiRunTarget::from_arg_with_providers("model:openai/nope", Some(&providers)).is_none()
        );
    }

    #[test]
    fn returns_none_for_model_target_without_any_providers() {
        assert!(AiRunTarget::from_arg_with_providers("model:openai/gpt-4o", None).is_none());
    }

    #[test]
    fn returns_none_for_malformed_model_string_without_slash() {
        let providers = vec![provider()];
        assert!(AiRunTarget::from_arg_with_providers("model:openai", Some(&providers)).is_none());
    }

    #[test]
    fn returns_none_for_junk_agent_id() {
        assert!(AiRunTarget::from_arg_with_providers("frobnicate", None).is_none());
    }

    #[test]
    fn api_model_arm_accumulates_injected_completion_and_forwards_lines() {
        let target = AiRunTarget::ApiModel {
            provider: provider(),
            model_id: "gpt-4o".into(),
        };
        let mut lines = Vec::new();
        let response = run_prompt_via_target_with_model_runner(
            Path::new("/tmp/vault"),
            &target,
            "prompt".into(),
            &mut |line| lines.push(line.to_string()),
            |req, emit| {
                assert_eq!(req.model_id, "gpt-4o");
                assert_eq!(req.provider.id, "openai");
                assert_eq!(req.api_key_override, None);
                emit(AiAgentStreamEvent::TextDelta {
                    text: "TITLE: X\n---\nbody".into(),
                });
                Ok(String::new())
            },
        )
        .unwrap();

        assert_eq!(response, "TITLE: X\n---\nbody");
        assert_eq!(lines, vec!["TITLE: X\n---\nbody".to_string()]);
    }

    #[test]
    fn api_model_arm_propagates_runner_errors() {
        let target = AiRunTarget::ApiModel {
            provider: provider(),
            model_id: "gpt-4o".into(),
        };
        let err = run_prompt_via_target_with_model_runner(
            Path::new("/tmp/vault"),
            &target,
            "prompt".into(),
            &mut |_| {},
            |_req, _emit| Err("provider unreachable".to_string()),
        )
        .unwrap_err();
        assert_eq!(err, "provider unreachable");
    }
}
