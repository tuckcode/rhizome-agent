//! Rewrite a raw agent-run dump at the `create_note` save step.
//!
//! CLI agents often pass the whole terminal log as note content. The reader
//! wants the answer first, then one collapsed run log. Keep ordinary notes.

use regex::Regex;
use std::collections::BTreeMap;
use std::sync::OnceLock;

pub fn rewrite_agent_run_note_content(content: &str, fallback_title: Option<&str>) -> String {
    let fallback = fallback_title.unwrap_or("Agent run");
    let Some(formatted) = format_agent_run_note(content, fallback) else {
        return content.to_string();
    };
    let (mut fields, _body, raw_frontmatter) = split_frontmatter(content);
    if let Some(agent) = &formatted.agent {
        fields.insert("agent".into(), agent.clone());
    }
    if let Some(mode) = &formatted.mode {
        fields.insert("mode".into(), mode.clone());
    }
    if !fields.contains_key("title") {
        fields.insert("title".into(), formatted.title.clone());
    }
    if !fields.contains_key("type") {
        fields.insert("type".into(), "Note".into());
    }
    format!(
        "{}\n\n{}\n",
        render_frontmatter(&fields, raw_frontmatter.as_deref()),
        render_run_note_body(&formatted)
    )
}

struct ToolRow {
    name: String,
    target: String,
    duration: String,
    status: &'static str,
}

struct FormattedNote {
    title: String,
    answer: String,
    asked: Option<String>,
    agent: Option<String>,
    mode: Option<String>,
    tools: Vec<ToolRow>,
    failed_lifecycle: Vec<String>,
    duration: Option<String>,
}

fn format_agent_run_note(text: &str, fallback_title: &str) -> Option<FormattedNote> {
    let (fields, body, _) = split_frontmatter(text);
    let source = if body.trim().is_empty() {
        text
    } else {
        body.as_str()
    };
    if !looks_like_agent_run_log(source) && !looks_like_agent_run_log(text) {
        return None;
    }

    let mut tools: BTreeMap<String, ToolRow> = BTreeMap::new();
    let mut failed_lifecycle = Vec::new();
    let mut answer_lines: Vec<String> = Vec::new();
    let mut asked = None;
    let mut agent = fields.get("agent").cloned();
    let mut mode = fields.get("mode").cloned();
    let mut duration = None;
    let mut heading = first_heading(source).or_else(|| fields.get("title").cloned());

    for raw in source.lines() {
        let line = strip_bullet(raw);
        if line.is_empty() {
            if !answer_lines.is_empty() && answer_lines.last().is_some_and(|last| !last.is_empty())
            {
                answer_lines.push(String::new());
            }
            continue;
        }

        if let Some(rest) = capture(asking_line(), &line) {
            let value = if rest.is_empty() {
                line.trim_start_matches(['→', '='])
                    .trim_start_matches('>')
                    .trim()
                    .to_string()
            } else {
                rest
            };
            if heading.is_none() {
                heading = usable_title(&title_from_asked(&value));
            }
            asked = Some(value);
            continue;
        }
        if let Some(value) = capture(agent_line(), &line) {
            agent = Some(unquote(&value));
            continue;
        }
        if let Some(value) = capture(mode_line(), &line) {
            mode = Some(unquote(&value));
            continue;
        }
        if let Some(value) = capture(duration_line(), &line) {
            duration = Some(value);
            continue;
        }
        if let Some(value) = line.strip_prefix("# ") {
            if heading.is_none() {
                heading = usable_title(value).or_else(|| Some(value.trim().to_string()));
            }
            continue;
        }
        if let Some((name, rest)) = parse_tool_line(&line) {
            let target = target_from_rest(&rest);
            let key = format!("{name}\0{target}");
            let existing = tools.get(&key);
            let status = if fail_re().is_match(&rest) {
                "failed"
            } else {
                existing.map(|row| row.status).unwrap_or("ok")
            };
            let tool_duration = clock_in(&rest)
                .or_else(|| existing.map(|row| row.duration.clone()))
                .unwrap_or_default();
            let target = if target.is_empty() {
                existing.map(|row| row.target.clone()).unwrap_or_default()
            } else {
                target
            };
            tools.insert(
                key,
                ToolRow {
                    name,
                    target,
                    duration: tool_duration,
                    status,
                },
            );
            continue;
        }
        if lifecycle_line().is_match(&line)
            || (any_event_line().is_match(&line) && !line.starts_with("[["))
        {
            if fail_re().is_match(&line) {
                failed_lifecycle.push(line);
            }
            continue;
        }
        answer_lines.push(raw.trim_end().to_string());
    }

    let answer = collapse_blank(&answer_lines);
    if duration.is_none() {
        let from_tools: Vec<&str> = tools
            .values()
            .map(|row| row.duration.as_str())
            .filter(|value| !value.is_empty())
            .collect();
        if from_tools.len() == 1 {
            duration = Some(from_tools[0].to_string());
        }
    }
    let title = heading
        .or_else(|| first_sentence_title(&answer))
        .unwrap_or_else(|| fallback_title.to_string());

    Some(FormattedNote {
        title,
        answer,
        asked,
        agent,
        mode,
        tools: tools.into_values().collect(),
        failed_lifecycle,
        duration,
    })
}

fn looks_like_agent_run_log(text: &str) -> bool {
    let mut events = 0;
    let mut tools = 0;
    let mut has_agent = false;
    let mut has_mode = false;
    for raw in text.lines() {
        let line = strip_bullet(raw);
        if tool_line().is_match(&line) || line.to_ascii_lowercase().starts_with("[tool]") {
            events += 1;
            tools += 1;
            continue;
        }
        if lifecycle_line().is_match(&line) {
            events += 1;
            continue;
        }
        if agent_line().is_match(&line) {
            has_agent = true;
        }
        if mode_line().is_match(&line) {
            has_mode = true;
        }
    }
    events >= 2 || (tools >= 1 && has_agent && has_mode)
}

fn render_run_note_body(formatted: &FormattedNote) -> String {
    let mut parts = vec![format!("# {}", formatted.title), String::new()];
    if !formatted.answer.is_empty() {
        parts.push(formatted.answer.clone());
        parts.push(String::new());
    }
    if !formatted.tools.is_empty() || !formatted.failed_lifecycle.is_empty() {
        parts.push(render_run_log(formatted));
    }
    parts.join("\n").trim_end().to_string()
}

fn render_run_log(formatted: &FormattedNote) -> String {
    let n = formatted.tools.len();
    let summary = match &formatted.duration {
        Some(duration) => format!("Run log · {n} tools · {duration}"),
        None => format!("Run log · {n} tools"),
    };
    let rows: Vec<String> = formatted
        .tools
        .iter()
        .map(|row| {
            let target = if row.target.is_empty() {
                "—"
            } else {
                &row.target
            };
            let duration = if row.duration.is_empty() {
                "—"
            } else {
                &row.duration
            };
            format!("{} · {target} · {duration} · {}", row.name, row.status)
        })
        .collect();
    let mut inner = Vec::new();
    if let Some(asked) = &formatted.asked {
        inner.push(format!("Asked: {asked}"));
    }
    if !rows.is_empty() {
        inner.push(format!("```\n{}\n```", rows.join("\n")));
    }
    if !formatted.failed_lifecycle.is_empty() {
        inner.push(formatted.failed_lifecycle.join("\n"));
    }
    format!(
        "<details>\n<summary>{summary}</summary>\n\n{}\n\n</details>",
        inner.join("\n\n")
    )
}

fn parse_tool_line(line: &str) -> Option<(String, String)> {
    let caps = tool_line().captures(line)?;
    Some((
        caps.get(1)?.as_str().to_string(),
        caps.get(2)
            .map(|m| m.as_str().to_string())
            .unwrap_or_default(),
    ))
}

fn target_from_rest(rest: &str) -> String {
    if rest.is_empty() {
        return String::new();
    }
    let without_running = running_re().replace_all(rest, "");
    let without_fail = fail_re().replace_all(&without_running, "");
    clock_re()
        .replace_all(&without_fail, "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn clock_in(text: &str) -> Option<String> {
    clock_re()
        .captures(text)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

fn title_from_asked(asked: &str) -> String {
    asked_title()
        .captures(asked)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().trim().to_string())
        .unwrap_or_else(|| asked.to_string())
}

fn first_heading(text: &str) -> Option<String> {
    for raw in text.lines() {
        if let Some(rest) = raw.trim().strip_prefix("# ") {
            return usable_title(rest).or_else(|| Some(rest.trim().to_string()));
        }
    }
    None
}

fn first_sentence_title(text: &str) -> Option<String> {
    let paragraph = text
        .split("\n\n")
        .next()
        .unwrap_or("")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if paragraph.is_empty() {
        return None;
    }
    let sentence = sentence_re()
        .captures(&paragraph)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
        .unwrap_or(paragraph);
    usable_title(&sentence)
}

fn usable_title(raw: &str) -> Option<String> {
    let cleaned = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() {
        return None;
    }
    if cleaned.chars().count() > 80 {
        let clipped: String = cleaned.chars().take(79).collect();
        return Some(format!("{}…", clipped.trim_end()));
    }
    Some(cleaned)
}

fn collapse_blank(lines: &[String]) -> String {
    let joined = lines.join("\n");
    extra_blank()
        .replace_all(&joined, "\n\n")
        .trim()
        .to_string()
}

fn strip_bullet(raw: &str) -> String {
    bullet_re().replace(raw.trim(), "").to_string()
}

fn unquote(value: &str) -> String {
    let trimmed = value.trim();
    if (trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2)
        || (trimmed.starts_with('\'') && trimmed.ends_with('\'') && trimmed.len() >= 2)
    {
        return trimmed[1..trimmed.len() - 1].replace("\\\"", "\"");
    }
    trimmed.to_string()
}

fn split_frontmatter(text: &str) -> (BTreeMap<String, String>, String, Option<String>) {
    let Some(caps) = frontmatter_re().captures(text) else {
        return (BTreeMap::new(), text.to_string(), None);
    };
    let raw = caps
        .get(1)
        .map(|m| m.as_str().to_string())
        .unwrap_or_default();
    let mut fields = BTreeMap::new();
    for line in raw.lines() {
        if let Some(caps) = field_re().captures(line) {
            let key = caps
                .get(1)
                .map(|m| m.as_str().to_string())
                .unwrap_or_default();
            let value = unquote(caps.get(2).map(|m| m.as_str()).unwrap_or(""));
            fields.insert(key, value);
        }
    }
    let body = caps
        .get(0)
        .map(|m| text[m.end()..].to_string())
        .unwrap_or_default();
    (fields, body, Some(raw))
}

fn render_frontmatter(fields: &BTreeMap<String, String>, raw_frontmatter: Option<&str>) -> String {
    let keys = match raw_frontmatter {
        Some(raw) => unique_keys(raw, fields),
        None => ["title", "type", "agent", "mode"]
            .into_iter()
            .filter(|key| fields.contains_key(*key))
            .map(str::to_string)
            .collect(),
    };
    let lines: Vec<String> = keys
        .into_iter()
        .filter_map(|key| {
            fields
                .get(&key)
                .map(|value| format!("{key}: {}", yaml_double_quoted(value)))
        })
        .collect();
    format!("---\n{}\n---", lines.join("\n"))
}

fn unique_keys(raw_frontmatter: &str, fields: &BTreeMap<String, String>) -> Vec<String> {
    let mut keys = Vec::new();
    for line in raw_frontmatter.lines() {
        if let Some(caps) = field_key_re().captures(line) {
            let key = caps.get(1).unwrap().as_str().to_string();
            if !keys.contains(&key) {
                keys.push(key);
            }
        }
    }
    for extra in ["agent", "mode", "title", "type"] {
        if fields.contains_key(extra) && !keys.iter().any(|key| key == extra) {
            keys.push(extra.to_string());
        }
    }
    keys
}

fn yaml_double_quoted(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn capture(re: &Regex, line: &str) -> Option<String> {
    re.captures(line)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().trim().to_string())
}

fn tool_line() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)^\[tool\]\s+(\S+)(?:\s+is running\.)?(?:\s+(.*?))?\s*$").unwrap()
    })
}

fn lifecycle_line() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)^\[(preparing|spawned|grok-auth|auth|lifecycle|init|shutdown)\]\s*(.*)$")
            .unwrap()
    })
}

fn any_event_line() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^\[([^\]]+)\]\s*(.*)$").unwrap())
}

fn agent_line() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)^agent:\s+(.+)$").unwrap())
}

fn mode_line() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)^mode:\s+(.+)$").unwrap())
}

fn duration_line() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)^(?:duration|elapsed):\s*(.+)$").unwrap())
}

fn asking_line() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(?:→|=>)\s+Asking\b[:\s]*(.*)$").unwrap())
}

fn clock_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)\b(\d+m(?:\s*\d+s)?|\d+s)\b").unwrap())
}

fn fail_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(fail(?:ed|ure)?|error|denied|timeout|refused|abort(?:ed)?)\b").unwrap()
    })
}

fn running_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)\bis running\.\s*").unwrap())
}

fn asked_title() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^[\w./-]+:\s+(.+)$").unwrap())
}

fn sentence_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(.+?[.!?])(?:\s|$)").unwrap())
}

fn extra_blank() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\n{3,}").unwrap())
}

fn bullet_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(?:[-*+]|\d+\.)\s+").unwrap())
}

fn frontmatter_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?s)^---\r?\n(.*?)\r?\n---\r?\n?").unwrap())
}

fn field_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^([A-Za-z][\w-]*):\s*(.*)$").unwrap())
}

fn field_key_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^([A-Za-z][\w-]*):").unwrap())
}

#[cfg(test)]
mod tests {
    use super::rewrite_agent_run_note_content;

    const RAW_RUN: &str = "\
→ Asking local/rhizome: Vault analysis

[preparing] starting tools
[tool] Grep
[tool] Grep is running.
[tool] Read README.md
[spawned] child
[grok-auth] ok

agent: Grok CLI
mode: deep

The vault has three layers.

duration: 1m 3s
";

    #[test]
    fn rewrites_a_raw_run_into_answer_and_collapsed_log() {
        let note = rewrite_agent_run_note_content(RAW_RUN, None);
        assert!(note.contains("# Vault analysis"));
        assert!(note.contains("The vault has three layers."));
        assert!(note.contains("<summary>Run log · 2 tools · 1m 3s</summary>"));
        assert!(note.contains("agent: \"Grok CLI\""));
        assert!(note.contains("mode: \"deep\""));
        assert!(!note.contains("is running."));
        assert!(!note.contains("[preparing]"));
        assert!(
            note.find("The vault has three layers.").unwrap() < note.find("<details>").unwrap()
        );
    }

    #[test]
    fn keeps_ordinary_notes() {
        let ordinary = "---\ntype: Note\n---\n\n# Nota longa de teste - gerada 2\n";
        assert_eq!(rewrite_agent_run_note_content(ordinary, None), ordinary);
    }

    #[test]
    fn keeps_failed_lifecycle_only() {
        let note = rewrite_agent_run_note_content(
            &[RAW_RUN, "[grok-auth] failed: token expired\n"].concat(),
            None,
        );
        assert!(note.contains("[grok-auth] failed: token expired"));
        assert!(!note.contains("[spawned] child"));
    }
}
