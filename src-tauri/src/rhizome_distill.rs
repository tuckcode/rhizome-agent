//! One Brain step 4a: rebuild `rhizome_distill` on the agent layer + write
//! resolver instead of shelling the Python `rhizome-distill` CLI. See
//! `docs/plans/2026-07-09-one-brain-step4-scope.md`.
//!
//! The agent is asked for a strict, easy-to-parse response shape
//! (`TITLE:`/`CONTEXT:`/`---`/body) precisely so this module never needs a
//! fragile stdout-reparse regex — that reparse step is what dropped every
//! dash-containing path in the Python CLI this replaces.

use std::path::{Path, PathBuf};

use crate::rhizome_write_location::{default_frontmatter, ArtifactKind};

/// Card kind hint from the UI's distill dropdown. All six values collapse to
/// `ArtifactKind::Concept` per `docs/VAULT_CONTRACT.md` (none name a literal
/// person/org/tool/product) and are preserved as a `kind:` frontmatter field.
pub fn build_distill_prompt(text: &str, kind: Option<&str>) -> String {
    let kind_hint = kind
        .map(|k| format!("The user suggests this is a \"{k}\" card.\n"))
        .unwrap_or_default();
    format!(
        "Distill the following text into a single, well-formed wiki card capturing \
one durable idea. {kind_hint}\n\
Respond with exactly this shape and nothing else:\n\
TITLE: <short human title, no markdown>\n\
CONTEXT: <one sentence situating this card for retrieval>\n\
---\n\
<body in markdown: the distilled idea, self-contained>\n\n\
Text to distill:\n{text}"
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedCard {
    pub title: String,
    pub context: String,
    pub body: String,
}

/// Parse the agent's `TITLE:`/`CONTEXT:`/`---`/body response. Forgiving of
/// missing fields — a partial response still produces a usable card rather
/// than failing the whole distill, since the point of this rebuild is to
/// stop silently losing agent output.
pub fn parse_agent_response(response: &str) -> ParsedCard {
    let mut title = String::new();
    let mut context = String::new();
    let mut body_start = 0;

    for (i, line) in response.lines().enumerate() {
        if let Some(rest) = line.strip_prefix("TITLE:") {
            title = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("CONTEXT:") {
            context = rest.trim().to_string();
        } else if line.trim() == "---" {
            body_start = response
                .lines()
                .take(i + 1)
                .map(|l| l.len() + 1)
                .sum::<usize>()
                .min(response.len());
            break;
        }
    }

    let body = if body_start > 0 {
        response[body_start..].trim().to_string()
    } else {
        response.trim().to_string()
    };

    if title.is_empty() {
        title = body
            .lines()
            .find(|l| !l.trim().is_empty())
            .map(|l| l.trim_start_matches('#').trim().to_string())
            .filter(|l| !l.is_empty())
            .unwrap_or_else(|| "Untitled".to_string());
    }

    ParsedCard {
        title,
        context,
        body,
    }
}

/// Lowercase, hyphenated slug for a title. No existing slugify helper in the
/// codebase; this one is intentionally minimal (ASCII alnum + hyphen only).
pub fn slugify(title: &str) -> String {
    let mut slug = String::with_capacity(title.len());
    let mut last_was_dash = false;
    for ch in title.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash && !slug.is_empty() {
            slug.push('-');
            last_was_dash = true;
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() {
        "untitled".to_string()
    } else {
        slug
    }
}

/// Frontmatter for a distilled concept card: the shared skeleton plus
/// `kind:`/`project:` metadata fields when provided by the caller.
pub fn distill_frontmatter(
    title: &str,
    context: &str,
    last_updated: &str,
    kind: Option<&str>,
    project: Option<&str>,
) -> String {
    let mut fm = default_frontmatter(ArtifactKind::Concept, title, last_updated);
    fm = fm.replacen("context: \n", &format!("context: {context}\n"), 1);
    if let Some(kind) = kind.filter(|k| !k.is_empty()) {
        crate::rhizome_write_location::push_frontmatter_field(&mut fm, "kind", kind);
    }
    if let Some(project) = project.filter(|p| !p.is_empty()) {
        crate::rhizome_write_location::push_frontmatter_field(&mut fm, "project", project);
    }
    fm
}

/// Reject error/tooling strings that must never become wiki concepts.
pub(crate) fn is_junk_distill_title(title: &str) -> bool {
    let t = title.trim();
    if t.is_empty() {
        return true;
    }
    let lower = t.to_ascii_lowercase();
    lower.contains("failed to authenticate")
        || lower.contains("oauth session expired")
        || lower.contains("could not be refreshed")
        || lower.contains("invalid args request")
        || lower.contains("missing field vaultpath")
        || lower.starts_with("not logged in")
        || lower.contains("please run /login")
        || lower.starts_with("error:")
}

pub fn write_distilled_card(
    vault_path: &Path,
    card: &ParsedCard,
    kind: Option<&str>,
    project: Option<&str>,
    last_updated: &str,
) -> Result<(String, PathBuf), String> {
    if is_junk_distill_title(&card.title) {
        return Err(format!(
            "refusing to distill tooling/auth failure as a note: {}",
            card.title
        ));
    }

    let slug = slugify(&card.title);
    let (slug, path) =
        crate::rhizome_write_location::unique_slug_path(vault_path, ArtifactKind::Concept, &slug);
    let frontmatter = distill_frontmatter(&card.title, &card.context, last_updated, kind, project);
    let contents = format!("{frontmatter}\n{}\n", card.body);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {e}"))?;
    }
    std::fs::write(&path, contents).map_err(|e| format!("Failed to write card: {e}"))?;
    Ok((slug, path))
}

/// Which `AiAgentId` powers research/distill/import prompt-wrappers: the
/// user's configured default agent (same setting driving the in-app AI
/// chat), falling back to Claude Code — matches the existing fallback at
/// `commands/ai.rs`.
pub fn resolve_default_agent_id() -> crate::ai_agents::AiAgentId {
    use crate::ai_agents::AiAgentId;
    let settings = crate::settings::get_settings().unwrap_or_default();
    match crate::settings::normalize_default_ai_agent(settings.default_ai_agent.as_deref())
        .as_deref()
    {
        Some("codex") => AiAgentId::Codex,
        Some("opencode") => AiAgentId::Opencode,
        Some("pi") => AiAgentId::Pi,
        Some("antigravity") => AiAgentId::Antigravity,
        Some("kiro") => AiAgentId::Kiro,
        Some("hermes") => AiAgentId::Hermes,
        _ => AiAgentId::ClaudeCode,
    }
}

/// End to end against an [`AiRunTarget`] (CLI agent or direct-API model).
/// Builds the prompt, runs it through the shared target runner, then parses,
/// writes, and logs exactly as before — so the ApiModel path reuses the
/// whole existing distill pipeline. `on_line` receives progress text the
/// caller forwards as `rhizome-progress` Tauri events (unchanged shape).
#[allow(clippy::too_many_arguments)]
pub fn run_distill_via_target(
    vault_path: &Path,
    text: &str,
    project: Option<&str>,
    kind: Option<&str>,
    trigger: &str,
    target: crate::ai_run_target::AiRunTarget,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    run_distill_via_target_with_model_runner(
        vault_path,
        text,
        project,
        kind,
        trigger,
        target,
        on_line,
        |req, emit| crate::ai_models::run_ai_model_stream(req, emit),
    )
}

/// Same as [`run_distill_via_target`] with the direct-API model runner
/// injected, so the end-to-end write can be exercised with a fake completion
/// instead of a real network endpoint.
#[allow(clippy::too_many_arguments)]
pub(crate) fn run_distill_via_target_with_model_runner<R>(
    vault_path: &Path,
    text: &str,
    project: Option<&str>,
    kind: Option<&str>,
    trigger: &str,
    target: crate::ai_run_target::AiRunTarget,
    on_line: &mut dyn FnMut(&str),
    model_runner: R,
) -> Result<String, String>
where
    R: FnOnce(
        crate::ai_models::AiModelStreamRequest,
        &mut dyn FnMut(crate::ai_agents::AiAgentStreamEvent),
    ) -> Result<String, String>,
{
    let prompt = build_distill_prompt(text, kind);
    let response = crate::ai_run_target::run_prompt_via_target_with_model_runner(
        vault_path,
        &target,
        prompt,
        on_line,
        model_runner,
    )?;

    let card = parse_agent_response(&response);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let (slug, path) = write_distilled_card(vault_path, &card, kind, project, &today)?;
    let artifact_path = crate::rhizome_write_location::relative_to_vault(vault_path, &path);
    append_distill_event(vault_path, project, trigger, &artifact_path)?;
    Ok(format!(
        "Distilled \"{}\" and saved as {slug}.md",
        card.title
    ))
}

#[allow(clippy::too_many_arguments)]
pub fn run_distill_via_agent(
    vault_path: &Path,
    text: &str,
    project: Option<&str>,
    kind: Option<&str>,
    trigger: &str,
    agent: crate::ai_agents::AiAgentId,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    run_distill_via_target(
        vault_path,
        text,
        project,
        kind,
        trigger,
        crate::ai_run_target::AiRunTarget::Agent(agent),
        on_line,
    )
}

/// Append a `.rhizome/events.jsonl` line for the capture/distill/edit family.
///
/// Thin wrapper over [`crate::vault_events`], which is the single writer.
/// The old hardcoded `"from": "inline"` is gone — it was a constant on every
/// record and read by nobody (audit finding 6).
pub fn append_vault_event(
    vault_path: &Path,
    event_type: &str,
    project: Option<&str>,
    trigger: &str,
    artifact_path: &str,
) -> Result<(), String> {
    crate::vault_events::append(
        vault_path,
        &crate::vault_events::VaultEvent::new(event_type, trigger)
            .project(project)
            .artifact_path(artifact_path),
    )
}

/// Append a vault event, logging on failure instead of propagating.
///
/// For save paths that have *already* written their artifact: a failed event
/// append must never turn a successful save into an error the user sees. But
/// it must not vanish either — a read-only-tier or full-disk vault silently
/// under-reports activity, and the warning is the only signal that happened.
/// Prefer this over a bare `let _ =`, which states the same intent without
/// recording it (finding 7, `docs/plans/2026-07-31-save-path-audit-session-status.md`).
///
/// Callers whose whole job *is* the event should use [`append_vault_event`]
/// and propagate.
pub fn append_vault_event_best_effort(
    vault_path: &Path,
    event_type: &str,
    project: Option<&str>,
    trigger: &str,
    artifact_path: &str,
) {
    if let Err(e) = append_vault_event(vault_path, event_type, project, trigger, artifact_path) {
        log::warn!(
            "Vault event not recorded (save itself succeeded): type={event_type} \
             trigger={trigger} artifact={artifact_path}: {e}"
        );
    }
}

/// Append a distill event (type `"distill"`). `trigger` is `"manual"` for
/// in-app Distill, `"inbox"` for inbox automation, `"menu_bar"` for the
/// companion popover, etc.
pub fn append_distill_event(
    vault_path: &Path,
    project: Option<&str>,
    trigger: &str,
    artifact_path: &str,
) -> Result<(), String> {
    append_vault_event(vault_path, "distill", project, trigger, artifact_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_title_context_and_body() {
        let response = "TITLE: Event Sourcing\nCONTEXT: A pattern for storing state as events.\n---\nEvent sourcing stores every change as an immutable event.\n";
        let card = parse_agent_response(response);
        assert_eq!(card.title, "Event Sourcing");
        assert_eq!(card.context, "A pattern for storing state as events.");
        assert_eq!(
            card.body,
            "Event sourcing stores every change as an immutable event."
        );
    }

    #[test]
    fn falls_back_to_first_body_line_when_title_missing() {
        let response = "# Recursion\n\nA function calling itself.";
        let card = parse_agent_response(response);
        assert_eq!(card.title, "Recursion");
    }

    #[test]
    fn junk_distill_title_detects_oauth_failures() {
        assert!(is_junk_distill_title(
            "Failed to authenticate: OAuth session expired and could not be refreshed",
        ));
        assert!(!is_junk_distill_title("Event Sourcing"));
    }

    #[test]
    fn junk_distill_title_detects_logged_out_agent() {
        // Native audit 2026-09-25: a logged-out distill agent replied with
        // this line and it was saved as a concept note.
        assert!(is_junk_distill_title("Not logged in · Please run /login"));
        assert!(is_junk_distill_title("Please run /login"));
        assert!(!is_junk_distill_title("Login flows in OAuth 2.1"));
    }

    #[test]
    fn falls_back_to_untitled_when_response_is_empty() {
        let card = parse_agent_response("   \n  \n");
        assert_eq!(card.title, "Untitled");
    }

    #[test]
    fn slugify_handles_dashes_and_punctuation() {
        // The exact case that broke the old Python regex — dashes in the
        // title must survive into the slug, not get treated as separators
        // that split the match.
        assert_eq!(
            slugify("Event-Sourcing: A Pattern"),
            "event-sourcing-a-pattern"
        );
    }

    #[test]
    fn slugify_collapses_repeated_separators() {
        assert_eq!(slugify("  Multiple   Spaces  "), "multiple-spaces");
    }

    #[test]
    fn slugify_empty_title_falls_back() {
        assert_eq!(slugify("---"), "untitled");
    }

    #[test]
    fn distill_frontmatter_includes_context_kind_and_project() {
        let fm = distill_frontmatter(
            "Event Sourcing",
            "A pattern for storing state as events.",
            "2026-07-09",
            Some("architecture-pattern"),
            Some("tolaria"),
        );
        assert!(fm.contains("title: Event Sourcing"));
        assert!(fm.contains("type: concept"));
        assert!(fm.contains("context: A pattern for storing state as events."));
        assert!(fm.contains("kind: architecture-pattern"));
        assert!(fm.contains("project: tolaria"));
    }

    #[test]
    fn distill_frontmatter_keeps_kind_and_project_inside_the_block() {
        // Regression: these were appended after the closing `---`, so every
        // distilled card carried them as body text, invisible to the project
        // tree and every other frontmatter reader. `.contains()` cannot tell
        // the difference — parse instead.
        let fm = distill_frontmatter(
            "Event Sourcing",
            "A pattern.",
            "2026-07-09",
            Some("architecture-pattern"),
            Some("rhizome"),
        );
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        let parsed = matter.parse(&fm);
        let gray_matter::Pod::Hash(map) = parsed.data.expect("frontmatter should parse") else {
            panic!("expected a frontmatter hash");
        };
        assert_eq!(
            map.get("kind").unwrap().as_string().unwrap(),
            "architecture-pattern"
        );
        assert_eq!(map.get("project").unwrap().as_string().unwrap(), "rhizome");
        assert_eq!(parsed.content.trim(), "", "nothing should spill into body");
    }

    #[test]
    fn distill_frontmatter_omits_absent_optional_fields() {
        let fm = distill_frontmatter(
            "Recursion",
            "A self-referential function.",
            "2026-07-09",
            None,
            None,
        );
        assert!(!fm.contains("kind:"));
        assert!(!fm.contains("project:"));
    }

    #[test]
    fn write_distilled_card_lands_under_concepts_dir() {
        let dir = tempfile::tempdir().unwrap();
        let card = ParsedCard {
            title: "Event Sourcing".to_string(),
            context: "A pattern.".to_string(),
            body: "Body text.".to_string(),
        };
        let (slug, path) =
            write_distilled_card(dir.path(), &card, None, None, "2026-07-09").unwrap();
        assert_eq!(slug, "event-sourcing");
        assert_eq!(path, dir.path().join("wiki/concepts/event-sourcing.md"));
        let contents = std::fs::read_to_string(&path).unwrap();
        assert!(contents.contains("title: Event Sourcing"));
        assert!(contents.contains("Body text."));
    }

    #[test]
    fn write_distilled_card_dedupes_on_collision() {
        let dir = tempfile::tempdir().unwrap();
        let card = ParsedCard {
            title: "Recursion".to_string(),
            context: String::new(),
            body: "First.".to_string(),
        };
        write_distilled_card(dir.path(), &card, None, None, "2026-07-09").unwrap();
        let (slug, path) =
            write_distilled_card(dir.path(), &card, None, None, "2026-07-09").unwrap();
        assert_eq!(slug, "recursion-2");
        assert!(path.ends_with("recursion-2.md"));
    }

    #[test]
    fn append_distill_event_writes_jsonl_line_with_type_and_project() {
        let dir = tempfile::tempdir().unwrap();
        append_distill_event(
            dir.path(),
            Some("tolaria"),
            "manual",
            "wiki/concepts/recursion.md",
        )
        .unwrap();
        let events_path = dir.path().join(".rhizome/events.jsonl");
        let content = std::fs::read_to_string(&events_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(content.trim()).unwrap();
        assert_eq!(parsed["type"], "distill");
        assert_eq!(parsed["project"], "tolaria");
        assert_eq!(parsed["trigger"], "manual");
        assert_eq!(parsed["artifact_path"], "wiki/concepts/recursion.md");
        assert!(parsed["timestamp"].is_string());
    }

    #[test]
    fn append_vault_event_writes_capture_type_for_menu_bar() {
        let dir = tempfile::tempdir().unwrap();
        append_vault_event(
            dir.path(),
            "capture",
            None,
            "menu_bar",
            "raw/inbox/2026-07-25-thought.md",
        )
        .unwrap();
        let content = std::fs::read_to_string(dir.path().join(".rhizome/events.jsonl")).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(content.trim()).unwrap();
        assert_eq!(parsed["type"], "capture");
        assert_eq!(parsed["trigger"], "menu_bar");
        assert_eq!(parsed["artifact_path"], "raw/inbox/2026-07-25-thought.md");
    }

    #[test]
    fn best_effort_append_writes_the_event_on_success() {
        let dir = tempfile::tempdir().unwrap();
        append_vault_event_best_effort(
            dir.path(),
            "capture",
            None,
            "menu_bar",
            "raw/inbox/2026-08-02-note.md",
        );
        let content = std::fs::read_to_string(dir.path().join(".rhizome/events.jsonl")).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(content.trim()).unwrap();
        assert_eq!(parsed["type"], "capture");
        assert_eq!(parsed["trigger"], "menu_bar");
    }

    /// Finding 7 of the 2026-07-31 save-path audit: a failed event append must
    /// not propagate, because the artifact it describes is already on disk.
    /// `.rhizome` occupied by a *file* makes `create_dir_all` fail, standing in
    /// for the real cases (read-only tier, full disk).
    #[test]
    fn best_effort_append_does_not_propagate_when_the_log_cannot_be_written() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".rhizome"), "not a directory").unwrap();

        // Precondition: this genuinely is a failing append, so the test below
        // exercises the error arm rather than passing vacuously.
        assert!(
            append_vault_event(dir.path(), "edit", None, "manual_edit", "note.md").is_err(),
            "expected the append to fail with .rhizome occupied by a file"
        );

        // The point of the test: same call, best-effort, returns unit.
        append_vault_event_best_effort(dir.path(), "edit", None, "manual_edit", "note.md");
    }

    fn stub_api_model_target() -> crate::ai_run_target::AiRunTarget {
        use crate::ai_models::{
            AiModelCapabilities, AiModelDefinition, AiModelProvider, AiModelProviderKind,
        };
        crate::ai_run_target::AiRunTarget::ApiModel {
            provider: AiModelProvider {
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
                    capabilities: AiModelCapabilities {
                        streaming: true,
                        tools: false,
                        vision: false,
                        json_mode: true,
                        reasoning: false,
                    },
                }],
            },
            model_id: "gpt-4o".into(),
        }
    }

    #[test]
    fn distill_via_injected_api_model_writes_card_and_logs_event() {
        let dir = tempfile::tempdir().unwrap();
        let mut lines = Vec::new();
        let message = run_distill_via_target_with_model_runner(
            dir.path(),
            "Idempotency means an operation can be applied multiple times.",
            Some("tolaria"),
            Some("concept"),
            "manual",
            stub_api_model_target(),
            &mut |line| lines.push(line.to_string()),
            |_req, emit| {
                emit(crate::ai_agents::AiAgentStreamEvent::TextDelta {
                    text: "TITLE: Idempotency\nCONTEXT: A durable property.\n---\n\
                           An operation applied many times has the same effect as once."
                        .into(),
                });
                Ok(String::new())
            },
        )
        .unwrap();

        assert!(
            message.contains("saved as idempotency.md"),
            "got: {message}"
        );
        let card_path = dir.path().join("wiki/concepts/idempotency.md");
        let contents = std::fs::read_to_string(&card_path).unwrap();
        assert!(contents.contains("title: Idempotency"));
        assert!(contents.contains("kind: concept"));
        assert!(contents.contains("project: tolaria"));
        assert!(contents.contains("same effect as once."));

        let events = std::fs::read_to_string(dir.path().join(".rhizome/events.jsonl")).unwrap();
        assert!(events.contains("\"type\":\"distill\""));
        assert!(!lines.is_empty());
    }

    #[test]
    fn build_distill_prompt_includes_text_and_kind_hint() {
        let prompt = build_distill_prompt("some raw notes", Some("workflow"));
        assert!(prompt.contains("some raw notes"));
        assert!(prompt.contains("\"workflow\""));
        assert!(prompt.contains("TITLE:"));
    }

    /// Exercises the real live path end to end: a real Claude Code CLI
    /// subprocess, real MCP wiring, a real file written to disk. Costs
    /// tokens and needs `claude` on PATH, so it's `#[ignore]`d — run
    /// manually with `cargo test --manifest-path src-tauri/Cargo.toml
    /// rhizome_distill::tests::live_distill_via_claude_code_writes_a_real_card
    /// -- --ignored --nocapture` when changing the agent-invocation wiring.
    #[test]
    #[ignore]
    fn live_distill_via_claude_code_writes_a_real_card() {
        let dir = tempfile::tempdir().unwrap();
        let mut lines = Vec::new();
        let result = run_distill_via_agent(
            dir.path(),
            "Idempotency means an operation can be applied multiple times \
without changing the result beyond the first application. HTTP PUT is \
idempotent; HTTP POST is not.",
            None,
            Some("concept"),
            "manual",
            crate::ai_agents::AiAgentId::ClaudeCode,
            &mut |line| lines.push(line.to_string()),
        );

        let message = result.expect("live distill should succeed");
        assert!(
            message.contains("saved as"),
            "unexpected message: {message}"
        );
        assert!(
            !lines.is_empty(),
            "expected progress lines from the agent stream"
        );

        let concepts_dir = dir.path().join("wiki/concepts");
        let written: Vec<_> = std::fs::read_dir(&concepts_dir)
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        assert_eq!(written.len(), 1, "expected exactly one card written");
        let contents = std::fs::read_to_string(&written[0]).unwrap();
        assert!(contents.contains("type: concept"));
        assert!(contents.contains("kind: concept"));

        let events = std::fs::read_to_string(dir.path().join(".rhizome/events.jsonl")).unwrap();
        assert!(events.contains("\"type\":\"distill\""));
    }
}
