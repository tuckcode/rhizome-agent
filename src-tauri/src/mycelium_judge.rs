//! Mindwalk Evaluate helpers used by the Mycelium skin proxy.
//!
//! Mindwalk's Evaluation panel is the judge surface. Rhizome does not fork
//! that engine. The skin proxy rewrites two things at the HTTP boundary:
//! the failure sentence the panel prints, and the judge list it offers.

use serde_json::{json, Value};

/// Judges Mindwalk will run today. Prime is not one of them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MindwalkJudgeId {
    Claude,
    Codex,
}

impl MindwalkJudgeId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Claude => "Claude",
            Self::Codex => "Codex",
        }
    }
}

pub const MINDWALK_JUDGE_IDS: [MindwalkJudgeId; 2] =
    [MindwalkJudgeId::Claude, MindwalkJudgeId::Codex];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MindwalkJudge {
    pub id: MindwalkJudgeId,
    pub available: bool,
}

/// Live PATH check. Missing Codex is unavailable, not a crash.
pub fn detect_mindwalk_judges() -> Vec<MindwalkJudge> {
    MINDWALK_JUDGE_IDS
        .iter()
        .copied()
        .map(|id| MindwalkJudge {
            id,
            available: cli_on_path(id.as_str()),
        })
        .collect()
}

fn cli_on_path(name: &str) -> bool {
    crate::hidden_command(path_lookup_command())
        .arg(name)
        .output()
        .ok()
        .map(|output| {
            output.status.success() && !String::from_utf8_lossy(&output.stdout).trim().is_empty()
        })
        .unwrap_or(false)
}

fn path_lookup_command() -> &'static str {
    if cfg!(windows) {
        "where"
    } else {
        "which"
    }
}

/// Available judges first, then the rest. Never Prime.
pub fn publish_judge_clis(judges: &[MindwalkJudge]) -> Vec<String> {
    let mut available = Vec::new();
    let mut missing = Vec::new();
    for judge in judges {
        if judge.available {
            available.push(judge.id.as_str().to_string());
        } else {
            missing.push(judge.id.as_str().to_string());
        }
    }
    for id in MINDWALK_JUDGE_IDS {
        let name = id.as_str();
        if !available.iter().any(|item| item == name) && !missing.iter().any(|item| item == name) {
            missing.push(name.to_string());
        }
    }
    available.extend(missing);
    available
}

/// Turn a Mindwalk judge failure into the sentence a person can use.
pub fn humanize_judge_failure(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return "Evaluation failed.".to_string();
    }
    if let Some(result) = extract_result_sentence(trimmed) {
        return result;
    }
    if let Some(missing) = humanize_missing_cli(trimmed) {
        return missing;
    }
    if looks_like_truncated_claude_envelope(trimmed) {
        return "Not logged in. Run claude login.".to_string();
    }
    if let Some(prefix) = failure_prefix_without_json(trimmed) {
        return prefix;
    }
    if trimmed.starts_with('{') {
        return "Evaluation failed.".to_string();
    }
    trimmed.to_string()
}

fn extract_result_sentence(raw: &str) -> Option<String> {
    let json = embedded_json(raw)?;
    let value: Value = serde_json::from_str(json).ok()?;
    let result = value.get("result")?.as_str()?.trim();
    if result.is_empty() || result.starts_with('{') {
        return None;
    }
    Some(result.to_string())
}

fn embedded_json(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end <= start {
        return None;
    }
    Some(&raw[start..=end])
}

fn looks_like_truncated_claude_envelope(raw: &str) -> bool {
    let lower = raw.to_ascii_lowercase();
    raw.contains('{') && (lower.contains("claude failed") || raw.contains("\"duration_api_ms\""))
}

fn humanize_missing_cli(raw: &str) -> Option<String> {
    let lower = raw.to_ascii_lowercase();
    if lower.contains("no judge cli found") {
        return Some("Evaluation needs Claude or Codex on PATH.".to_string());
    }
    let name = quoted_cli_name(raw)?;
    if name == "prime" || name == "prime-agent" {
        return Some("That judge is not available.".to_string());
    }
    if !(lower.contains("not available") || lower.contains("unsupported")) {
        return None;
    }
    let label = match name.as_str() {
        "codex" => "Codex",
        "claude" => "Claude",
        other => other,
    };
    Some(format!("{label} is not installed."))
}

fn quoted_cli_name(raw: &str) -> Option<String> {
    let start = raw.find('"')?;
    let rest = &raw[start + 1..];
    let end = rest.find('"')?;
    let name = rest[..end].trim();
    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
    }
}

fn failure_prefix_without_json(raw: &str) -> Option<String> {
    let start = raw.find('{')?;
    let prefix = raw[..start].trim().trim_end_matches(':').trim();
    if prefix.is_empty() {
        None
    } else {
        Some(prefix.to_string())
    }
}

/// Rewrite Evaluate `/report` or `/analyze` bodies. JSON or a plain sentence.
pub fn rewrite_evaluate_payload(bytes: &[u8], judges: &[MindwalkJudge]) -> Vec<u8> {
    let Ok(text) = std::str::from_utf8(bytes) else {
        return bytes.to_vec();
    };
    if text.trim_start().starts_with('{') {
        rewrite_mindwalk_json(bytes, judges)
    } else {
        humanize_judge_failure(text).into_bytes()
    }
}

/// Rewrite a Mindwalk report or analyze JSON body at the proxy boundary.
pub fn rewrite_mindwalk_json(bytes: &[u8], judges: &[MindwalkJudge]) -> Vec<u8> {
    let Ok(mut value) = serde_json::from_slice::<Value>(bytes) else {
        return bytes.to_vec();
    };
    let Some(obj) = value.as_object_mut() else {
        return bytes.to_vec();
    };
    let has_error = obj.get("error").and_then(Value::as_str).is_some();
    let has_judges = obj.contains_key("judgeClis") || obj.contains_key("judgeCli");
    if !has_error && !has_judges {
        return bytes.to_vec();
    }
    if let Some(error) = obj.get("error").and_then(Value::as_str) {
        obj.insert(
            "error".to_string(),
            Value::String(humanize_judge_failure(error)),
        );
    }
    if has_judges && judges.iter().any(|judge| judge.available) {
        let clis = publish_judge_clis(judges);
        obj.insert(
            "judgeClis".to_string(),
            Value::Array(clis.into_iter().map(Value::String).collect()),
        );
    }
    serde_json::to_vec(&value).unwrap_or_else(|_| bytes.to_vec())
}

/// Script that labels the iframe picker and disables a missing CLI.
pub fn evaluate_chrome_script(judges: &[MindwalkJudge]) -> String {
    let rows: Vec<Value> = judges
        .iter()
        .map(|judge| {
            let label = if judge.available {
                judge.id.label().to_string()
            } else {
                format!("{} (not installed)", judge.id.label())
            };
            json!({
                "id": judge.id.as_str(),
                "available": judge.available,
                "label": label,
            })
        })
        .collect();
    let payload = serde_json::to_string(&rows).unwrap_or_else(|_| "[]".to_string());
    format!(
        "(function(){{var judges={payload};function apply(){{var sel=document.querySelector('select[aria-label=\"Judge agent\"]');if(!sel)return;judges.forEach(function(j){{var opt=Array.prototype.find.call(sel.options,function(o){{return o.value===j.id;}});if(!opt){{opt=document.createElement('option');opt.value=j.id;sel.appendChild(opt);}}opt.textContent=j.label;opt.disabled=!j.available;}});}}new MutationObserver(apply).observe(document.documentElement,{{childList:true,subtree:true}});apply();}})();"
    )
}

pub fn inject_evaluate_chrome(html: &str, judges: &[MindwalkJudge]) -> String {
    let script = evaluate_chrome_script(judges);
    let block = format!("<script data-rhizome-evaluate=\"1\">{script}</script>");
    match html.find("</head>") {
        Some(idx) => {
            let mut out = String::with_capacity(html.len() + block.len());
            out.push_str(&html[..idx]);
            out.push_str(&block);
            out.push_str(&html[idx..]);
            out
        }
        None => format!("{html}{block}"),
    }
}

pub fn is_evaluate_json_path(target: &str) -> bool {
    let path = target.split('?').next().unwrap_or(target);
    path.ends_with("/report") || path.ends_with("/analyze")
}

#[cfg(test)]
mod tests {
    use super::*;

    const LIVE_CLAUDE_JSON: &str = r#"{"duration_api_ms":0,"stop_reason":"stop_sequence","session_id":"cdaef182-8389-4ada-a37a-d480cfa2c620","total_cost_usd":0,"usage":{"output_tokens":0},"is_error":true,"result":"Not logged in · Please run /login","type":"result"}"#;

    const TRUNCATED_CLAUDE_DUMP: &str = r#"claude failed: exit status 1: {"duration_api_ms":0,"stop_reason":"stop_sequence","session_id":"1108bccf-e9e7-47e9-80e1-f5b5054245dd","total_cost_usd":0,"usage":{"output_tokens_details":{"thinking_tokens":0},"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard"},""#;

    fn claude_only() -> Vec<MindwalkJudge> {
        vec![
            MindwalkJudge {
                id: MindwalkJudgeId::Claude,
                available: true,
            },
            MindwalkJudge {
                id: MindwalkJudgeId::Codex,
                available: false,
            },
        ]
    }

    #[test]
    fn extracts_result_from_a_full_claude_envelope() {
        assert_eq!(
            humanize_judge_failure(LIVE_CLAUDE_JSON),
            "Not logged in · Please run /login"
        );
    }

    #[test]
    fn extracts_result_from_the_prefixed_mindwalk_wrap() {
        let raw = format!("claude failed: exit status 1: {LIVE_CLAUDE_JSON}");
        assert_eq!(
            humanize_judge_failure(&raw),
            "Not logged in · Please run /login"
        );
    }

    #[test]
    fn extracts_an_oauth_result() {
        let raw = r#"claude failed: exit status 1: {"result":"Failed to authenticate: OAuth session expired and could not be refreshed"}"#;
        assert_eq!(
            humanize_judge_failure(raw),
            "Failed to authenticate: OAuth session expired and could not be refreshed"
        );
    }

    #[test]
    fn a_truncated_json_dump_does_not_reach_the_user() {
        let out = humanize_judge_failure(TRUNCATED_CLAUDE_DUMP);
        assert!(
            !out.contains("duration_api_ms"),
            "raw JSON must not be shown: {out}"
        );
        assert!(!out.contains('{'), "raw JSON must not be shown: {out}");
        assert!(
            out.to_ascii_lowercase().contains("not logged in")
                || out.to_ascii_lowercase().contains("login"),
            "expected a login sentence, got {out}"
        );
    }

    #[test]
    fn a_plain_sentence_stays() {
        assert_eq!(
            humanize_judge_failure("Evaluation already running."),
            "Evaluation already running."
        );
    }

    #[test]
    fn a_missing_codex_cli_is_unavailable_not_a_crash() {
        let out =
            humanize_judge_failure(r#"judge CLI "codex" is not available (installed: [claude])"#);
        assert!(!out.contains("panic"));
        assert!(!out.contains('{'));
        assert!(
            out.to_ascii_lowercase().contains("codex"),
            "expected Codex to be named, got {out}"
        );
        assert!(
            out.to_ascii_lowercase().contains("not installed")
                || out.to_ascii_lowercase().contains("not available"),
            "expected an unavailable sentence, got {out}"
        );
    }

    #[test]
    fn published_clis_are_claude_then_codex_and_never_prime() {
        let clis = publish_judge_clis(&claude_only());
        assert_eq!(clis, vec!["claude".to_string(), "codex".to_string()]);
        assert!(!clis.iter().any(|id| id == "prime" || id.contains("prime")));
    }

    #[test]
    fn published_clis_put_the_available_judge_first() {
        let judges = vec![
            MindwalkJudge {
                id: MindwalkJudgeId::Claude,
                available: false,
            },
            MindwalkJudge {
                id: MindwalkJudgeId::Codex,
                available: true,
            },
        ];
        assert_eq!(
            publish_judge_clis(&judges),
            vec!["codex".to_string(), "claude".to_string()]
        );
    }

    #[test]
    fn rewrite_replaces_the_error_and_offers_both_judges() {
        let raw = serde_json::to_vec(&json!({
            "state": "failed",
            "stale": false,
            "judgeAvailable": true,
            "judgeCli": "claude",
            "judgeClis": ["claude"],
            "error": format!("claude failed: exit status 1: {LIVE_CLAUDE_JSON}"),
        }))
        .expect("fixture");
        let out = rewrite_mindwalk_json(&raw, &claude_only());
        let value: Value = serde_json::from_slice(&out).expect("json");
        assert_eq!(
            value["error"].as_str(),
            Some("Not logged in · Please run /login")
        );
        assert_eq!(value["judgeClis"], json!(["claude", "codex"]));
        let dumped = String::from_utf8_lossy(&out);
        assert!(!dumped.contains("duration_api_ms"));
        assert!(!dumped.contains("prime"));
    }

    #[test]
    fn a_plain_analyze_error_names_the_missing_cli() {
        let out = rewrite_evaluate_payload(
            br#"judge CLI "codex" is not available (installed: [claude])"#,
            &claude_only(),
        );
        assert_eq!(out, b"Codex is not installed.");
    }

    #[test]
    fn rewrite_leaves_unrelated_json_alone() {
        let raw = br#"{"key":"pi-1","title":"Inbox"}"#;
        let out = rewrite_mindwalk_json(raw, &claude_only());
        assert_eq!(out, raw);
    }

    #[test]
    fn evaluate_paths_are_report_and_analyze_only() {
        assert!(is_evaluate_json_path("/api/sessions/pi-1/report"));
        assert!(is_evaluate_json_path("/api/sessions/pi-1/analyze"));
        assert!(!is_evaluate_json_path("/api/sessions"));
        assert!(!is_evaluate_json_path("/api/sessions/pi-1/snapshot"));
    }

    #[test]
    fn picker_script_lists_both_judges_and_disables_codex() {
        let script = evaluate_chrome_script(&claude_only());
        assert!(script.contains("claude"));
        assert!(script.contains("codex"));
        assert!(!script.contains("prime"));
        assert!(script.contains("not installed") || script.contains("disabled"));
    }

    #[test]
    fn evaluate_chrome_lands_in_the_document() {
        let html =
            inject_evaluate_chrome("<html><head></head><body></body></html>", &claude_only());
        assert!(html.contains("data-rhizome-evaluate"));
        assert!(html.contains("Judge agent"));
    }
}
