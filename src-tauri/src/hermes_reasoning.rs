// Copyright (c) 2025 Nous Research
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Ported from Hermes Agent (MIT), Nous Research. Upstream:
// https://github.com/NousResearch/hermes-agent/blob/main/hermes_cli/models_reasoning_caps.py
// https://github.com/NousResearch/hermes-agent/blob/main/agent/reasoning_effort.py
//
// This file is the three-state OpenRouter parser, the effort ladder, the
// nearest-weaker clamp, and the hand-checked effort constants. Rhizome does
// not call Hermes at runtime. Wire-shape helpers that only build a provider
// request stayed upstream; the resolver in `reasoning_levels` owns that.

use serde_json::Value;

/// One OpenRouter-schema catalog entry, after the tri-state parse.
///
/// `None` from the parser means unknown: the record is missing or
/// `supported_parameters` is not a list. `supports_reasoning: false` means the
/// catalog lists the model and it does not accept reasoning. `true` means
/// `supported_parameters` contains `"reasoning"`. The `reasoning` object only
/// adds `mandatory` and `supported_efforts`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenRouterReasoningCaps {
    pub supports_reasoning: bool,
    pub supported_efforts: Option<Vec<String>>,
    pub mandatory: bool,
}

/// Normalize one OpenRouter-schema `/v1/models` record.
pub fn parse_openrouter_reasoning_capabilities(item: &Value) -> Option<OpenRouterReasoningCaps> {
    let item = item.as_object()?;
    let params = item.get("supported_parameters")?.as_array()?;
    if !params
        .iter()
        .any(|param| param.as_str() == Some("reasoning"))
    {
        return Some(OpenRouterReasoningCaps {
            supports_reasoning: false,
            supported_efforts: None,
            mandatory: false,
        });
    }
    let reasoning = item.get("reasoning").and_then(Value::as_object);
    let supported_efforts = reasoning
        .and_then(|reasoning| reasoning.get("supported_efforts"))
        .and_then(Value::as_array)
        .map(|raw| {
            let mut efforts = Vec::new();
            for effort in raw {
                let text = match effort {
                    Value::String(text) => text.clone(),
                    other => other.to_string(),
                };
                let text = text.trim().to_lowercase();
                if !text.is_empty() && !efforts.contains(&text) {
                    efforts.push(text);
                }
            }
            efforts
        });
    let mandatory = reasoning
        .and_then(|reasoning| reasoning.get("mandatory"))
        .and_then(Value::as_bool)
        == Some(true);
    Some(OpenRouterReasoningCaps {
        supports_reasoning: true,
        supported_efforts,
        mandatory,
    })
}

/// Low to high. `ultra` is Hermes-internal; no wire accepts it.
pub const EFFORT_LADDER: &[&str] = &[
    "none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra",
];

pub const OPENAI_COMPAT_WIRE_EFFORTS: &[&str] =
    &["none", "minimal", "low", "medium", "high", "xhigh", "max"];

pub const CODEX_GPT56_EFFORTS: &[&str] = &["none", "low", "medium", "high", "xhigh", "max"];
pub const CODEX_LEGACY_EFFORTS: &[&str] = &["none", "low", "medium", "high", "xhigh"];
pub const CODEX_ASTRA_EFFORTS: &[&str] = &["low", "medium", "high", "xhigh", "max"];
pub const ASTRA_MODEL_IDS: &[&str] = &["gpt-6-astra", "gpt-6-astra-900k"];
pub const GPT6_TIER_PREFIXES: &[&str] = &["gpt-6-sol", "gpt-6-luna"];
pub const NO_DISABLE_TIER_PREFIXES: &[&str] = &["gpt-6.1-sol"];
pub const DAYBREAK_MODEL_IDS: &[&str] =
    &["gpt-daybreak-blue-latest", "gpt-daybreak-blue-latest-900k"];

pub const XAI_GROK46_EFFORTS: &[&str] = &["low", "medium", "high", "xhigh"];
pub const XAI_LEGACY_EFFORTS: &[&str] = &["low", "medium", "high"];

pub const ACTUAL_RELAY_EFFORTS: &[&str] = &["none", "low", "medium", "high", "max"];
pub const KIMI_K3_EFFORTS: &[&str] = &["low", "high", "max"];
pub const KIMI_K2_EFFORTS: &[&str] = &["low", "medium", "high"];
pub const KIMI_K3_OVERRIDES: &[(&str, &str)] = &[("medium", "high"), ("xhigh", "max")];
pub const OX_ALPHA_EFFORTS: &[&str] = &["low", "high", "max"];
pub const OX_ALPHA_OVERRIDES: &[(&str, &str)] = &[("xhigh", "max")];
pub const TOKENHUB_EFFORTS: &[&str] = &["low", "medium", "high"];
pub const NEBIUS_EFFORTS: &[&str] = &["low", "medium", "high"];
pub const SOLAR_EFFORTS: &[&str] = &["low", "medium", "high"];
pub const GLM52_EFFORTS: &[&str] = &["high", "max"];
pub const GLM52_OVERRIDES: &[(&str, &str)] = &[("xhigh", "max")];
pub const GLM53_EFFORTS: &[&str] = &["low", "medium", "high", "max"];
pub const GLM53_OVERRIDES: &[(&str, &str)] = &[("xhigh", "max")];
pub const DEEPSEEK_V4_EFFORTS: &[&str] = &["low", "medium", "high", "max"];
pub const DEEPSEEK_V4_OVERRIDES: &[(&str, &str)] = &[("xhigh", "max")];
pub const OLLAMA_CLOUD_EFFORTS: &[&str] = &["none", "low", "medium", "high", "max"];
pub const OLLAMA_CLOUD_OVERRIDES: &[(&str, &str)] = &[("xhigh", "max")];
pub const META_AI_EFFORTS: &[&str] = &["minimal", "low", "medium", "high", "xhigh"];
pub const GEMINI4_THINKING_LEVELS: &[&str] = &["low", "medium", "high"];

/// `gpt-6-astra` or its `-900k` alias, with or without a vendor prefix.
pub fn is_astra_model(model: Option<&str>) -> bool {
    let bare = bare_model(model);
    ASTRA_MODEL_IDS.contains(&bare.as_str())
}

pub fn codex_supported_efforts(model: Option<&str>) -> &'static [&'static str] {
    let bare = bare_model(model);
    if is_astra_model(model)
        || NO_DISABLE_TIER_PREFIXES
            .iter()
            .any(|prefix| bare.starts_with(prefix))
    {
        return CODEX_ASTRA_EFFORTS;
    }
    if bare.contains("gpt-5.6")
        || GPT6_TIER_PREFIXES
            .iter()
            .any(|prefix| bare.starts_with(prefix))
        || DAYBREAK_MODEL_IDS.contains(&bare.as_str())
    {
        CODEX_GPT56_EFFORTS
    } else {
        CODEX_LEGACY_EFFORTS
    }
}

pub fn kimi_supported_efforts(model: Option<&str>) -> &'static [&'static str] {
    let bare = bare_model(model);
    if kimi_k3_slug(&bare) {
        KIMI_K3_EFFORTS
    } else {
        KIMI_K2_EFFORTS
    }
}

fn bare_model(model: Option<&str>) -> String {
    model
        .unwrap_or("")
        .trim()
        .to_lowercase()
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_string()
}

fn kimi_k3_slug(model: &str) -> bool {
    // `(?:^|[^a-z0-9])k3(?:[^a-z0-9]|$)` — never `kimi-k2.6`.
    let bytes = model.as_bytes();
    let mut index = 0;
    while index + 2 <= bytes.len() {
        if bytes[index..].starts_with(b"k3") {
            let before_ok = index == 0 || !bytes[index - 1].is_ascii_alphanumeric();
            let after = index + 2;
            let after_ok = after == bytes.len() || !bytes[after].is_ascii_alphanumeric();
            if before_ok && after_ok {
                return true;
            }
        }
        index += 1;
    }
    false
}

/// Clamp onto a wire's supported levels.
///
/// Verbatim when the request is supported, the supported set is empty, or the
/// request is not on the ladder. Otherwise the nearest weaker ladder level.
/// `none` is never a degradation target. When nothing weaker exists, the
/// weakest supported level that is not `none`.
pub fn clamp_effort(
    effort: Option<&str>,
    supported: &[impl AsRef<str>],
    overrides: &[(&str, &str)],
) -> Option<String> {
    let raw = effort?;
    let requested = raw.trim().to_lowercase();
    if requested.is_empty() || supported.is_empty() {
        return Some(raw.to_string());
    }
    let supported_norm: Vec<String> = supported
        .iter()
        .map(|level| level.as_ref().trim().to_lowercase())
        .filter(|level| EFFORT_LADDER.contains(&level.as_str()))
        .collect();
    if supported_norm.is_empty() || supported_norm.iter().any(|level| level == &requested) {
        return Some(raw.to_string());
    }
    if let Some((_, mapped)) = overrides.iter().find(|(from, _)| *from == requested) {
        if supported_norm.iter().any(|level| level == mapped) {
            return Some((*mapped).to_string());
        }
    }
    if !EFFORT_LADDER.contains(&requested.as_str()) {
        return Some(raw.to_string());
    }
    let candidates: Vec<&String> = supported_norm
        .iter()
        .filter(|level| level.as_str() != "none")
        .collect();
    if candidates.is_empty() {
        return Some(raw.to_string());
    }
    let requested_idx = ladder_index(&requested).expect("requested is on the ladder");
    let below: Vec<&&String> = candidates
        .iter()
        .filter(|level| ladder_index(level).is_some_and(|index| index < requested_idx))
        .collect();
    if let Some(nearest) = below
        .iter()
        .max_by_key(|level| ladder_index(level).unwrap_or(0))
    {
        return Some((**nearest).clone());
    }
    let weakest = candidates
        .iter()
        .min_by_key(|level| ladder_index(level).unwrap_or(0))
        .expect("candidates is non-empty");
    Some((*weakest).clone())
}

fn ladder_index(level: &str) -> Option<usize> {
    EFFORT_LADDER.iter().position(|item| *item == level)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_is_tri_state() {
        assert!(parse_openrouter_reasoning_capabilities(&json!("nope")).is_none());
        assert!(parse_openrouter_reasoning_capabilities(&json!({"id": "m"})).is_none());
        assert_eq!(
            parse_openrouter_reasoning_capabilities(&json!({
                "supported_parameters": ["tools"],
                "reasoning": {"mandatory": true}
            })),
            Some(OpenRouterReasoningCaps {
                supports_reasoning: false,
                supported_efforts: None,
                mandatory: false,
            })
        );
        assert_eq!(
            parse_openrouter_reasoning_capabilities(&json!({
                "supported_parameters": ["reasoning"]
            })),
            Some(OpenRouterReasoningCaps {
                supports_reasoning: true,
                supported_efforts: None,
                mandatory: false,
            })
        );
        assert_eq!(
            parse_openrouter_reasoning_capabilities(&json!({
                "supported_parameters": ["reasoning", "tools"],
                "reasoning": {
                    "mandatory": true,
                    "supported_efforts": [" High ", "high", "low", ""]
                }
            })),
            Some(OpenRouterReasoningCaps {
                supports_reasoning: true,
                supported_efforts: Some(vec!["high".into(), "low".into()]),
                mandatory: true,
            })
        );
    }

    #[test]
    fn clamp_keeps_a_supported_level_and_steps_down() {
        let supported = ["low", "medium", "high"];
        assert_eq!(
            clamp_effort(Some("high"), &supported, &[]).as_deref(),
            Some("high")
        );
        assert_eq!(
            clamp_effort(Some("xhigh"), &supported, &[]).as_deref(),
            Some("high")
        );
        assert_eq!(
            clamp_effort(Some("minimal"), &supported, &[]).as_deref(),
            Some("low")
        );
        assert_eq!(
            clamp_effort(Some("none"), &supported, &[]).as_deref(),
            Some("low")
        );
        assert_eq!(clamp_effort(None, &supported, &[]), None);
        assert_eq!(
            clamp_effort(Some("high"), &[] as &[&str], &[]).as_deref(),
            Some("high")
        );
        assert_eq!(
            clamp_effort(Some("medium"), KIMI_K3_EFFORTS, KIMI_K3_OVERRIDES).as_deref(),
            Some("high")
        );
        assert_eq!(
            clamp_effort(Some("custom-tier"), &supported, &[]).as_deref(),
            Some("custom-tier")
        );
    }

    #[test]
    fn hand_checked_constants_match_the_hermes_sets() {
        assert_eq!(EFFORT_LADDER.len(), 8);
        assert_eq!(OPENAI_COMPAT_WIRE_EFFORTS.last().copied(), Some("max"));
        assert_eq!(CODEX_GPT56_EFFORTS.last().copied(), Some("max"));
        assert_eq!(CODEX_LEGACY_EFFORTS.last().copied(), Some("xhigh"));
        assert!(!CODEX_ASTRA_EFFORTS.contains(&"none"));
        assert_eq!(ASTRA_MODEL_IDS, &["gpt-6-astra", "gpt-6-astra-900k"]);
        assert_eq!(GPT6_TIER_PREFIXES, &["gpt-6-sol", "gpt-6-luna"]);
        assert_eq!(NO_DISABLE_TIER_PREFIXES, &["gpt-6.1-sol"]);
        assert!(DAYBREAK_MODEL_IDS[0].starts_with("gpt-daybreak"));
        assert_eq!(XAI_GROK46_EFFORTS, &["low", "medium", "high", "xhigh"]);
        assert_eq!(XAI_LEGACY_EFFORTS, &["low", "medium", "high"]);
        assert_eq!(ACTUAL_RELAY_EFFORTS.last().copied(), Some("max"));
        assert_eq!(KIMI_K3_EFFORTS, &["low", "high", "max"]);
        assert_eq!(KIMI_K2_EFFORTS, &["low", "medium", "high"]);
        assert_eq!(KIMI_K3_OVERRIDES, &[("medium", "high"), ("xhigh", "max")]);
        assert_eq!(OX_ALPHA_EFFORTS, &["low", "high", "max"]);
        assert_eq!(OX_ALPHA_OVERRIDES, &[("xhigh", "max")]);
        assert_eq!(TOKENHUB_EFFORTS, NEBIUS_EFFORTS);
        assert_eq!(NEBIUS_EFFORTS, SOLAR_EFFORTS);
        assert_eq!(GLM52_EFFORTS, &["high", "max"]);
        assert_eq!(GLM52_OVERRIDES, &[("xhigh", "max")]);
        assert_eq!(GLM53_EFFORTS, &["low", "medium", "high", "max"]);
        assert_eq!(GLM53_OVERRIDES, &[("xhigh", "max")]);
        assert_eq!(DEEPSEEK_V4_EFFORTS, &["low", "medium", "high", "max"]);
        assert_eq!(DEEPSEEK_V4_OVERRIDES, &[("xhigh", "max")]);
        assert_eq!(OLLAMA_CLOUD_EFFORTS.last().copied(), Some("max"));
        assert_eq!(OLLAMA_CLOUD_OVERRIDES, &[("xhigh", "max")]);
        assert_eq!(META_AI_EFFORTS.first().copied(), Some("minimal"));
        assert_eq!(GEMINI4_THINKING_LEVELS, &["low", "medium", "high"]);
        assert!(is_astra_model(Some("openai/gpt-6-astra")));
        assert!(!is_astra_model(Some("gpt-6-luna")));
        assert_eq!(
            codex_supported_efforts(Some("gpt-6-astra")),
            CODEX_ASTRA_EFFORTS
        );
        assert_eq!(
            codex_supported_efforts(Some("gpt-6.1-sol")),
            CODEX_ASTRA_EFFORTS
        );
        assert_eq!(
            codex_supported_efforts(Some("gpt-5.6-terra")),
            CODEX_GPT56_EFFORTS
        );
        assert_eq!(
            codex_supported_efforts(Some("gpt-6-luna")),
            CODEX_GPT56_EFFORTS
        );
        assert_eq!(
            codex_supported_efforts(Some("gpt-5.5")),
            CODEX_LEGACY_EFFORTS
        );
        assert_eq!(
            kimi_supported_efforts(Some("kimi-k3-256k")),
            KIMI_K3_EFFORTS
        );
        assert_eq!(kimi_supported_efforts(Some("kimi-k2.6")), KIMI_K2_EFFORTS);
    }
}
