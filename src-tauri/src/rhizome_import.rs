//! One Brain step 4b: rebuild `rhizome_import_source` on the agent layer +
//! write resolver, same pattern as `rhizome_distill` (step 4a). See
//! `docs/plans/2026-07-09-one-brain-step4-scope.md` and ADR-0150 for the
//! markitdown/yt-dlp subprocess decision this depends on.

use std::io::Write as _;
use std::path::{Path, PathBuf};

use crate::rhizome_write_location::{default_frontmatter, ArtifactKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SourceKind {
    LocalFile(String),
    YouTube(String),
    Url(String),
}

/// Classify a raw `source` string from the Import tab. YouTube hosts are
/// checked before the generic URL case since a YouTube link also matches
/// "starts with http(s)://".
pub fn classify_source(source: &str) -> SourceKind {
    let trimmed = source.trim();
    if let Some(host) = url_host(trimmed) {
        if host == "youtube.com" || host == "www.youtube.com" || host == "youtu.be" {
            return SourceKind::YouTube(trimmed.to_string());
        }
        return SourceKind::Url(trimmed.to_string());
    }
    SourceKind::LocalFile(trimmed.to_string())
}

/// Minimal host extraction — avoids pulling in a full URL-parsing crate for
/// a "does this look like a web URL" check.
fn url_host(source: &str) -> Option<&str> {
    let rest = source
        .strip_prefix("https://")
        .or_else(|| source.strip_prefix("http://"))?;
    let host = rest.split(['/', '?', '#']).next().unwrap_or(rest);
    let host = host.rsplit('@').next().unwrap_or(host);
    let host = host.split(':').next().unwrap_or(host);
    Some(host)
}

/// Strip WebVTT cue timing/numbering and collapse the consecutive repeated
/// lines auto-generated YouTube captions produce (each cue re-shows the
/// tail of the previous one) into a plain transcript.
pub fn parse_vtt_transcript(vtt: &str) -> String {
    let mut lines_out: Vec<String> = Vec::new();
    for line in vtt.lines() {
        let line = line.trim();
        if line.is_empty()
            || line == "WEBVTT"
            || line.starts_with("Kind:")
            || line.starts_with("Language:")
            || line.contains("-->")
            || line.chars().all(|c| c.is_ascii_digit())
        {
            continue;
        }
        let cleaned = strip_vtt_tags(line);
        if cleaned.is_empty() {
            continue;
        }
        if lines_out.last().map(String::as_str) != Some(cleaned.as_str()) {
            lines_out.push(cleaned);
        }
    }
    lines_out.join(" ")
}

/// Remove `<00:00:01.234><c>...</c>`-style inline VTT tags some auto-sub
/// tracks embed for word-level timing.
fn strip_vtt_tags(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut in_tag = false;
    for ch in line.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.trim().to_string()
}

/// Guess a file extension from an HTTP response's `Content-Type` so a
/// fetched URL body can be handed to `markitdown` as a real file rather
/// than untyped stdin.
pub fn extension_for_content_type(content_type: &str) -> &'static str {
    let mime = content_type.split(';').next().unwrap_or("").trim();
    match mime {
        "application/pdf" => "pdf",
        "text/plain" => "txt",
        "text/markdown" => "md",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => "docx",
        _ => "html",
    }
}

pub fn build_import_prompt(source_label: &str, extracted_text: &str) -> String {
    format!(
        "Organize the following extracted content from \"{source_label}\" into a single, \
well-structured wiki document. Summarize and structure it for future retrieval — do not \
just repeat it verbatim.\n\n\
Respond with exactly this shape and nothing else:\n\
TITLE: <short human title, no markdown>\n\
CONTEXT: <one sentence situating this document for retrieval>\n\
---\n\
<body in markdown: the structured digest, self-contained>\n\n\
Extracted content:\n{extracted_text}"
    )
}

fn markitdown_binary() -> Result<PathBuf, String> {
    crate::cli_agent_runtime::find_cli_binary(
        "markitdown",
        Vec::new(),
        "markitdown",
        "pip install markitdown (or: brew install markitdown)",
    )
}

fn ytdlp_binary() -> Result<PathBuf, String> {
    crate::cli_agent_runtime::find_cli_binary(
        "yt-dlp",
        Vec::new(),
        "yt-dlp",
        "pip install yt-dlp (or: brew install yt-dlp)",
    )
}

fn run_markitdown(path: &Path) -> Result<String, String> {
    let binary = markitdown_binary()?;
    let output = crate::hidden_command(&binary)
        .arg(path)
        .output()
        .map_err(|e| format!("Failed to run markitdown: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "markitdown failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Extract markdown text from a local (or dropped) file. Plain markdown/
/// text files are read directly; everything else goes through markitdown.
pub fn convert_local_file_to_markdown(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    let is_plain_text = matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("md") | Some("markdown") | Some("txt")
    );
    if is_plain_text {
        return std::fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"));
    }
    run_markitdown(path)
}

/// Fetch a generic URL and convert its body to markdown via markitdown.
pub fn fetch_url_as_markdown(url: &str) -> Result<String, String> {
    let response =
        reqwest::blocking::get(url).map_err(|e| format!("Failed to fetch {url}: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Failed to fetch {url}: HTTP {}", response.status()));
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("text/html")
        .to_string();
    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    let extension = extension_for_content_type(&content_type);
    let mut tmp = tempfile::Builder::new()
        .suffix(&format!(".{extension}"))
        .tempfile()
        .map_err(|e| format!("Failed to create temp file: {e}"))?;
    tmp.write_all(&bytes)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;

    run_markitdown(tmp.path())
}

/// Fetch a YouTube video's auto-generated captions and return plain text.
pub fn fetch_youtube_transcript(url: &str) -> Result<String, String> {
    let binary = ytdlp_binary()?;
    let dir = tempfile::tempdir().map_err(|e| format!("Failed to create temp dir: {e}"))?;
    let output_template = dir.path().join("transcript");

    let output = crate::hidden_command(&binary)
        .args([
            "--skip-download",
            "--write-auto-sub",
            "--sub-format",
            "vtt",
            "--sub-langs",
            "en",
            "-o",
        ])
        .arg(&output_template)
        .arg(url)
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "yt-dlp failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let vtt_path = std::fs::read_dir(dir.path())
        .map_err(|e| format!("Failed to read temp dir: {e}"))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .find(|path| path.extension().and_then(|e| e.to_str()) == Some("vtt"))
        .ok_or_else(|| {
            "yt-dlp did not produce a caption file (no auto-subs available?)".to_string()
        })?;

    let vtt =
        std::fs::read_to_string(&vtt_path).map_err(|e| format!("Failed to read captions: {e}"))?;
    Ok(parse_vtt_transcript(&vtt))
}

/// Frontmatter for an imported document: the shared skeleton plus a
/// `source:`/`project:` metadata field.
pub fn import_frontmatter(
    title: &str,
    context: &str,
    last_updated: &str,
    source: &str,
    project: Option<&str>,
) -> String {
    let mut fm = default_frontmatter(ArtifactKind::Document, title, last_updated);
    fm = fm.replacen("context: \n", &format!("context: {context}\n"), 1);
    crate::rhizome_write_location::push_frontmatter_field(&mut fm, "source", source);
    if let Some(project) = project.filter(|p| !p.is_empty()) {
        crate::rhizome_write_location::push_frontmatter_field(&mut fm, "project", project);
    }
    fm
}

pub fn write_imported_document(
    vault_path: &Path,
    card: &crate::rhizome_distill::ParsedCard,
    source: &str,
    project: Option<&str>,
    last_updated: &str,
) -> Result<(String, PathBuf), String> {
    let slug = crate::rhizome_distill::slugify(&card.title);
    let (slug, path) =
        crate::rhizome_write_location::unique_slug_path(vault_path, ArtifactKind::Document, &slug);
    let frontmatter = import_frontmatter(&card.title, &card.context, last_updated, source, project);
    let contents = format!("{frontmatter}\n{}\n", card.body);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {e}"))?;
    }
    std::fs::write(&path, contents).map_err(|e| format!("Failed to write document: {e}"))?;
    Ok((slug, path))
}

/// Thin wrapper over [`crate::vault_events`], the single event writer.
pub fn append_import_event(
    vault_path: &Path,
    source: &str,
    project: Option<&str>,
    trigger: &str,
    artifact_path: &str,
) -> Result<(), String> {
    crate::vault_events::append(
        vault_path,
        &crate::vault_events::VaultEvent::new("source-imported", trigger)
            .project(project)
            .artifact_path(artifact_path)
            .field("source", source),
    )
}

/// End to end: extract text from the source, prompt the agent to structure
/// it, write the document, log the event.
/// End to end against an [`AiRunTarget`] (CLI agent or direct-API model):
/// extract text from the source, run the structuring prompt through the
/// shared target runner, then write + log exactly as before.
#[allow(clippy::too_many_arguments)]
pub fn run_import_via_target(
    vault_path: &Path,
    source: &str,
    project: Option<&str>,
    trigger: &str,
    target: crate::ai_run_target::AiRunTarget,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    run_import_via_target_with_model_runner(
        vault_path,
        source,
        project,
        trigger,
        target,
        on_line,
        |req, emit| crate::ai_models::run_ai_model_stream(req, emit),
    )
}

/// Same as [`run_import_via_target`] with the direct-API model runner
/// injected, so the end-to-end write can be exercised with a fake completion
/// instead of a real network endpoint.
#[allow(clippy::too_many_arguments)]
pub(crate) fn run_import_via_target_with_model_runner<R>(
    vault_path: &Path,
    source: &str,
    project: Option<&str>,
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
    let extracted = match classify_source(source) {
        SourceKind::LocalFile(path) => {
            on_line("Converting local file...");
            convert_local_file_to_markdown(Path::new(&path))?
        }
        SourceKind::YouTube(url) => {
            on_line("Fetching YouTube transcript...");
            fetch_youtube_transcript(&url)?
        }
        SourceKind::Url(url) => {
            on_line("Fetching URL...");
            fetch_url_as_markdown(&url)?
        }
    };
    if extracted.trim().is_empty() {
        return Err(format!("No content could be extracted from: {source}"));
    }

    let prompt = build_import_prompt(source, &extracted);
    let response = crate::ai_run_target::run_prompt_via_target_with_model_runner(
        vault_path,
        &target,
        prompt,
        on_line,
        model_runner,
    )?;

    let card = crate::rhizome_distill::parse_agent_response(&response);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let (slug, path) = write_imported_document(vault_path, &card, source, project, &today)?;
    let artifact_path = crate::rhizome_write_location::relative_to_vault(vault_path, &path);
    append_import_event(vault_path, source, project, trigger, &artifact_path)?;
    Ok(format!(
        "Imported \"{}\" and saved as {slug}.md",
        card.title
    ))
}

#[allow(clippy::too_many_arguments)]
pub fn run_import_via_agent(
    vault_path: &Path,
    source: &str,
    project: Option<&str>,
    trigger: &str,
    agent: crate::ai_agents::AiAgentId,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    run_import_via_target(
        vault_path,
        source,
        project,
        trigger,
        crate::ai_run_target::AiRunTarget::Agent(agent),
        on_line,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_youtube_urls() {
        assert_eq!(
            classify_source("https://www.youtube.com/watch?v=abc123"),
            SourceKind::YouTube("https://www.youtube.com/watch?v=abc123".to_string())
        );
        assert_eq!(
            classify_source("https://youtu.be/abc123"),
            SourceKind::YouTube("https://youtu.be/abc123".to_string())
        );
    }

    #[test]
    fn classifies_generic_urls() {
        assert_eq!(
            classify_source("https://example.com/article"),
            SourceKind::Url("https://example.com/article".to_string())
        );
        assert_eq!(
            classify_source("http://example.com"),
            SourceKind::Url("http://example.com".to_string())
        );
    }

    #[test]
    fn classifies_local_paths() {
        assert_eq!(
            classify_source("/Users/alex/notes.pdf"),
            SourceKind::LocalFile("/Users/alex/notes.pdf".to_string())
        );
        assert_eq!(
            classify_source("  ~/Downloads/paper.pdf  "),
            SourceKind::LocalFile("~/Downloads/paper.pdf".to_string())
        );
    }

    #[test]
    fn parses_vtt_transcript_stripping_timing_and_dedup() {
        let vtt = "WEBVTT\nKind: captions\nLanguage: en\n\n\
00:00:00.000 --> 00:00:02.000\nHello and welcome\n\n\
00:00:02.000 --> 00:00:04.000\nHello and welcome to the show\n\n\
00:00:04.000 --> 00:00:06.000\nto the show today\n";
        let text = parse_vtt_transcript(vtt);
        assert_eq!(
            text,
            "Hello and welcome Hello and welcome to the show to the show today"
        );
    }

    #[test]
    fn strips_inline_vtt_word_timing_tags() {
        let vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<00:00:00.100><c> Hello</c><00:00:00.500><c> world</c>\n";
        let text = parse_vtt_transcript(vtt);
        assert_eq!(text, "Hello world");
    }

    #[test]
    fn extension_for_content_type_covers_common_types() {
        assert_eq!(extension_for_content_type("application/pdf"), "pdf");
        assert_eq!(
            extension_for_content_type("text/html; charset=utf-8"),
            "html"
        );
        assert_eq!(extension_for_content_type("text/plain"), "txt");
        assert_eq!(extension_for_content_type("text/markdown"), "md");
        assert_eq!(
            extension_for_content_type("application/octet-stream"),
            "html"
        );
    }

    #[test]
    fn build_import_prompt_includes_source_label_and_text() {
        let prompt = build_import_prompt("https://example.com/article", "some extracted text");
        assert!(prompt.contains("https://example.com/article"));
        assert!(prompt.contains("some extracted text"));
        assert!(prompt.contains("TITLE:"));
    }

    #[test]
    fn import_frontmatter_includes_source_and_project() {
        let fm = import_frontmatter(
            "My Article",
            "An article about something.",
            "2026-07-09",
            "https://example.com/article",
            Some("tolaria"),
        );
        assert!(fm.contains("type: source"));
        assert!(fm.contains("source: https://example.com/article"));
        assert!(fm.contains("project: tolaria"));
    }

    #[test]
    fn import_frontmatter_keeps_source_and_project_inside_the_block() {
        // Regression: these were appended after the closing `---`, so they
        // parsed as body text and no frontmatter reader ever saw them.
        // `.contains()` cannot tell the difference — parse instead.
        let fm = import_frontmatter(
            "My Article",
            "An article.",
            "2026-07-09",
            "https://example.com/article",
            Some("rhizome"),
        );
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        let parsed = matter.parse(&fm);
        let gray_matter::Pod::Hash(map) = parsed.data.expect("frontmatter should parse") else {
            panic!("expected a frontmatter hash");
        };
        assert_eq!(
            map.get("source").unwrap().as_string().unwrap(),
            "https://example.com/article"
        );
        assert_eq!(map.get("project").unwrap().as_string().unwrap(), "rhizome");
        assert_eq!(parsed.content.trim(), "", "nothing should spill into body");
    }

    #[test]
    fn convert_local_file_to_markdown_reads_plain_text_directly() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("notes.md");
        std::fs::write(&path, "# Hello\n\nSome notes.").unwrap();
        let result = convert_local_file_to_markdown(&path).unwrap();
        assert_eq!(result, "# Hello\n\nSome notes.");
    }

    #[test]
    fn convert_local_file_to_markdown_errors_on_missing_file() {
        let result = convert_local_file_to_markdown(Path::new("/nonexistent/path.pdf"));
        assert!(result.is_err());
    }

    #[test]
    fn write_imported_document_lands_under_documents_dir() {
        let dir = tempfile::tempdir().unwrap();
        let card = crate::rhizome_distill::ParsedCard {
            title: "My Article".to_string(),
            context: "An article.".to_string(),
            body: "Body text.".to_string(),
        };
        let (slug, path) = write_imported_document(
            dir.path(),
            &card,
            "https://example.com/article",
            None,
            "2026-07-09",
        )
        .unwrap();
        assert_eq!(slug, "my-article");
        assert_eq!(
            path,
            dir.path().join("wiki/sources/documents/my-article.md")
        );
        let contents = std::fs::read_to_string(&path).unwrap();
        assert!(contents.contains("source: https://example.com/article"));
    }

    #[test]
    fn append_import_event_writes_jsonl_line() {
        let dir = tempfile::tempdir().unwrap();
        append_import_event(
            dir.path(),
            "https://example.com",
            Some("tolaria"),
            "manual",
            "wiki/sources/documents/article.md",
        )
        .unwrap();
        let content = std::fs::read_to_string(dir.path().join(".rhizome/events.jsonl")).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(content.trim()).unwrap();
        assert_eq!(parsed["type"], "source-imported");
        assert_eq!(parsed["source"], "https://example.com");
        assert_eq!(parsed["project"], "tolaria");
        assert_eq!(parsed["trigger"], "manual");
        assert_eq!(parsed["artifact_path"], "wiki/sources/documents/article.md");
    }

    #[test]
    fn import_via_injected_api_model_writes_document_and_logs_event() {
        use crate::ai_models::{
            AiModelCapabilities, AiModelDefinition, AiModelProvider, AiModelProviderKind,
        };

        let dir = tempfile::tempdir().unwrap();
        let source_file = dir.path().join("notes.md");
        std::fs::write(&source_file, "# Raw notes\n\nSome content to structure.").unwrap();

        let target = crate::ai_run_target::AiRunTarget::ApiModel {
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
        };

        let mut lines = Vec::new();
        let message = run_import_via_target_with_model_runner(
            dir.path(),
            source_file.to_str().unwrap(),
            Some("tolaria"),
            "manual",
            target,
            &mut |line| lines.push(line.to_string()),
            |req, emit| {
                assert!(req.message.contains("Some content to structure."));
                emit(crate::ai_agents::AiAgentStreamEvent::TextDelta {
                    text:
                        "TITLE: Structured Notes\nCONTEXT: A digest.\n---\nThe structured digest."
                            .into(),
                });
                Ok(String::new())
            },
        )
        .unwrap();

        assert!(
            message.contains("saved as structured-notes.md"),
            "got: {message}"
        );
        let doc_path = dir
            .path()
            .join("wiki/sources/documents/structured-notes.md");
        let contents = std::fs::read_to_string(&doc_path).unwrap();
        assert!(contents.contains("title: Structured Notes"));
        assert!(contents.contains("project: tolaria"));
        assert!(contents.contains("The structured digest."));

        let events = std::fs::read_to_string(dir.path().join(".rhizome/events.jsonl")).unwrap();
        assert!(events.contains("\"type\":\"source-imported\""));
    }

    /// Exercises the real markitdown subprocess. Needs `markitdown` on
    /// PATH; run manually with `cargo test --manifest-path
    /// src-tauri/Cargo.toml rhizome_import::tests::live_markitdown_converts_a_real_file
    /// -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn live_markitdown_converts_a_real_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.txt");
        std::fs::write(&path, "Plain text content for markitdown.").unwrap();
        // .txt is read directly by design (see convert_local_file_to_markdown),
        // so exercise markitdown itself via run_markitdown on a non-plain-text
        // extension instead.
        let html_path = dir.path().join("test.html");
        std::fs::write(
            &html_path,
            "<html><body><h1>Hello</h1><p>World.</p></body></html>",
        )
        .unwrap();
        let result = run_markitdown(&html_path).expect("markitdown should be on PATH");
        assert!(result.contains("Hello"));
    }

    /// Exercises a real network fetch + markitdown conversion. Run manually.
    #[test]
    #[ignore]
    fn live_fetch_url_as_markdown_converts_a_real_page() {
        let result = fetch_url_as_markdown("https://example.com").expect("fetch should succeed");
        assert!(result.to_lowercase().contains("example"));
    }

    /// Exercises a real yt-dlp caption fetch against a long-standing public
    /// talk with confirmed English captions (Sir Ken Robinson, "Do Schools
    /// Kill Creativity?", TED 2006 — one of the platform's most-viewed
    /// videos). Needs `yt-dlp` on PATH and network access. Run manually —
    /// auto-sub availability/format is a YouTube implementation detail that
    /// can drift, per ADR-0150.
    #[test]
    #[ignore]
    fn live_fetch_youtube_transcript_from_a_real_video() {
        let result = fetch_youtube_transcript("https://www.youtube.com/watch?v=iCvmsMzlF7o")
            .expect("yt-dlp should fetch auto-generated captions");
        assert!(!result.trim().is_empty());
    }

    /// Exercises the full live import path end to end against a tempdir
    /// (never the real vault). Run manually — costs tokens and needs
    /// `claude`/`markitdown` on PATH.
    #[test]
    #[ignore]
    fn live_import_via_claude_code_writes_a_real_document() {
        let dir = tempfile::tempdir().unwrap();
        let mut lines = Vec::new();
        let result = run_import_via_agent(
            dir.path(),
            "https://example.com",
            None,
            "manual",
            crate::ai_agents::AiAgentId::ClaudeCode,
            &mut |line| lines.push(line.to_string()),
        );
        let message = result.expect("live import should succeed");
        assert!(message.contains("saved as"));
        let documents_dir = dir.path().join("wiki/sources/documents");
        let written: Vec<_> = std::fs::read_dir(&documents_dir)
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        assert_eq!(written.len(), 1);
    }
}
