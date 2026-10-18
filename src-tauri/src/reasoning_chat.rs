//! Proves background callers never send reasoning params.
//! The user chat turn is the only path that merges `reasoning_levels_for_target`.

#[cfg(test)]
mod tests {
    use crate::ai_models::test_server::{serve, sse};
    use crate::ai_models::{AiModelProvider, AiModelStreamRequest};
    use crate::ai_run_target::{run_prompt_via_target_with_model_runner, AiRunTarget};
    use serde_json::Value;

    fn provider(base_url: &str) -> AiModelProvider {
        serde_json::from_value(serde_json::json!({
            "id": "xai",
            "name": "xAI",
            "kind": "open_ai_compatible",
            "base_url": base_url,
            "api_key_storage": "none",
            "models": [{
                "id": "grok-4.7",
                "capabilities": {
                    "streaming": true,
                    "tools": false,
                    "vision": false,
                    "json_mode": false,
                    "reasoning": {"state": "unknown"}
                }
            }]
        }))
        .expect("provider")
    }

    fn assert_no_reasoning(body: &Value) {
        for key in [
            "reasoning_effort",
            "reasoning",
            "thinking",
            "chat_template_kwargs",
            "max_tokens",
        ] {
            assert!(body.get(key).is_none(), "{key} was sent: {body}");
        }
    }

    fn complete_against(mut request: AiModelStreamRequest) -> Value {
        let server = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"Title"},"finish_reason":"stop"}]}"#,
            "[DONE]",
        ])]);
        request.provider.base_url = Some(server.base_url.clone());
        request.reasoning_level = Some("high".into());
        request.model_id = "grok-4.7".into();
        request.provider.id = "xai".into();
        crate::ai_models::complete_text(&request).expect("completion");
        let body = server.requests.lock().unwrap()[0].1.clone();
        serde_json::from_str(&body).unwrap()
    }

    #[test]
    fn background_callers_send_no_reasoning_params() {
        let dir = tempfile::tempdir().unwrap();
        let target = AiRunTarget::ApiModel {
            provider: provider("https://api.x.ai/v1"),
            model_id: "grok-4.7".into(),
        };

        let mut distill_request = None;
        crate::rhizome_distill::run_distill_via_target_with_model_runner(
            dir.path(),
            "Idempotency means an operation can be applied more than once.",
            None,
            Some("concept"),
            "manual",
            target.clone(),
            &mut |_| {},
            |request, _| {
                assert!(request.reasoning_level.is_none());
                distill_request = Some(request);
                Ok("TITLE: Idempotency\nCONTEXT: Apply it again.\n---\nA short card.\n".into())
            },
        )
        .expect("distill");
        assert_no_reasoning(&complete_against(distill_request.unwrap()));

        let source = dir.path().join("paper.txt");
        std::fs::write(&source, "A paper about queues.").unwrap();
        let mut import_request = None;
        crate::rhizome_import::run_import_via_target_with_model_runner(
            dir.path(),
            source.to_str().unwrap(),
            None,
            "manual",
            target.clone(),
            &mut |_| {},
            |request, _| {
                assert!(request.reasoning_level.is_none());
                import_request = Some(request);
                Ok("TITLE: Queues\nCONTEXT: Waiting lines.\n---\nA short note.\n".into())
            },
        )
        .expect("import");
        assert_no_reasoning(&complete_against(import_request.unwrap()));

        let mut title = distill_request_placeholder(&target);
        title.message = "Name this chat".into();
        title.system_prompt = Some("Return only the title.".into());
        assert!(title.reasoning_level.is_none());
        assert_no_reasoning(&complete_against(title));

        let mut tools = title_request(&target);
        tools.reasoning_level = Some("high".into());
        tools.vault_path = Some(dir.path().to_string_lossy().into_owned());
        let payload = crate::ai_model_tools::openai_chat_payload(&tools);
        assert_no_reasoning(&payload);
    }

    fn distill_request_placeholder(target: &AiRunTarget) -> AiModelStreamRequest {
        capture_prompt(target)
    }

    fn title_request(target: &AiRunTarget) -> AiModelStreamRequest {
        capture_prompt(target)
    }

    fn capture_prompt(target: &AiRunTarget) -> AiModelStreamRequest {
        let dir = tempfile::tempdir().unwrap();
        let mut captured = None;
        run_prompt_via_target_with_model_runner(
            dir.path(),
            target,
            "title prompt".into(),
            &mut |_| {},
            |request, _| {
                captured = Some(request);
                Ok("ok".into())
            },
        )
        .unwrap();
        captured.unwrap()
    }
}
