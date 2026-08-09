//! One Brain step 4c: rebuild `rhizome_repo_research` (the Generate tab) on
//! the agent layer + write resolver instead of shelling the Python
//! `rhizome-research`/`rhizome-repo-wiki` CLIs. See
//! `docs/plans/2026-07-09-one-brain-step4-scope.md`.
//!
//! The agent layer's Safe tool allowlist has no Bash and no web tools, so a
//! remote repository is cloned Rust-side into `<vault>/.rhizome/repo-cache/`
//! and the agent subprocess's cwd is pointed at the checkout; research is
//! grounded in reading real files (Read/Glob/Grep/LS), never web search.

use std::path::{Path, PathBuf};

use crate::rhizome_distill::slugify;

/// What the Generate tab's free-text `repo` input resolves to: a directory
/// already on disk, or a GitHub reference to clone into the repo cache.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RepoReference {
    Local(PathBuf),
    Remote {
        /// Normalized https clone URL.
        url: String,
        /// `owner-repo`, also the wiki filename slug.
        slug: String,
        /// `owner/repo`, for prompts and history events.
        display: String,
    },
}

/// Parse a GitHub `owner/repo` pair out of a URL path or bare token.
fn parse_owner_repo(s: &str) -> Option<(String, String)> {
    let mut parts = s.split('/');
    let owner = parts.next()?.trim();
    let repo = parts.next()?.trim().trim_end_matches(".git");
    if parts.next().is_some_and(|rest| !rest.is_empty()) {
        return None;
    }
    let valid = |t: &str| {
        !t.is_empty()
            && t.chars()
                .all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
    };
    if valid(owner) && valid(repo) {
        Some((owner.to_string(), repo.to_string()))
    } else {
        None
    }
}

/// Classify the Generate tab's free-text input. Local paths must exist as
/// directories; remote references accept `https://github.com/owner/repo`,
/// `git@github.com:owner/repo.git`, and bare `owner/repo`.
pub fn classify_repo_reference(repo: &str) -> Result<RepoReference, String> {
    let repo = repo.trim();
    if repo.is_empty() {
        return Err("Repository reference is empty".to_string());
    }

    // Absolute or home-relative paths are local-only: never cloned.
    if repo.starts_with('/') || repo.starts_with("~/") {
        let expanded = if let Some(rest) = repo.strip_prefix("~/") {
            dirs::home_dir()
                .ok_or("Cannot resolve home directory")?
                .join(rest)
        } else {
            PathBuf::from(repo)
        };
        if !expanded.is_dir() {
            return Err(format!("Local repository path does not exist: {repo}"));
        }
        return Ok(RepoReference::Local(expanded));
    }

    let remote = |owner: String, repo_name: String| RepoReference::Remote {
        url: format!("https://github.com/{owner}/{repo_name}.git"),
        slug: slugify(&format!("{owner}-{repo_name}")),
        display: format!("{owner}/{repo_name}"),
    };

    if let Some(rest) = repo
        .strip_prefix("https://github.com/")
        .or_else(|| repo.strip_prefix("http://github.com/"))
        .or_else(|| repo.strip_prefix("github.com/"))
    {
        let rest = rest.trim_end_matches('/');
        if let Some((owner, name)) = parse_owner_repo(rest) {
            return Ok(remote(owner, name));
        }
        return Err(format!("Unrecognized GitHub URL: {repo}"));
    }

    if let Some(rest) = repo.strip_prefix("git@github.com:") {
        if let Some((owner, name)) = parse_owner_repo(rest) {
            return Ok(remote(owner, name));
        }
        return Err(format!("Unrecognized GitHub SSH reference: {repo}"));
    }

    if let Some((owner, name)) = parse_owner_repo(repo) {
        return Ok(remote(owner, name));
    }

    Err(format!(
        "Cannot interpret \"{repo}\" as a local directory or GitHub repository (owner/repo)"
    ))
}

/// Human-facing name for prompts and events: `owner/repo` or dir basename.
pub fn repo_display_name(reference: &RepoReference) -> String {
    match reference {
        RepoReference::Local(path) => path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
        RepoReference::Remote { display, .. } => display.clone(),
    }
}

/// Wiki filename slug — repo identity, not the agent's chosen title, so
/// re-researching the same repo lands under a predictable name.
pub fn repo_slug(reference: &RepoReference) -> String {
    match reference {
        RepoReference::Local(_) => slugify(&repo_display_name(reference)),
        RepoReference::Remote { slug, .. } => slug.clone(),
    }
}

/// Research rounds per UI depth. Unknown values collapse to 1, matching the
/// old dispatch arm's `_ => "1"` fallback.
pub fn rounds_for_depth(depth: &str) -> u32 {
    match depth {
        "deep" => 3,
        "regular" => 2,
        _ => 1,
    }
}

/// Where a remote reference's shallow clone lives. Persists across runs so
/// re-research is a fetch, not a fresh clone (see ADR-0151).
pub fn repo_cache_dir(vault_path: &Path, slug: &str) -> PathBuf {
    vault_path.join(".rhizome").join("repo-cache").join(slug)
}

/// Make the referenced repository readable on disk and return its path.
/// Local references pass through untouched (never cloned, never written).
/// Remote references are shallow-cloned into the repo cache, or updated in
/// place when the cache dir already exists. `GIT_TERMINAL_PROMPT=0` makes
/// private/nonexistent repos fail fast with git's stderr instead of hanging
/// on a credential prompt.
pub fn ensure_local_repo(
    vault_path: &Path,
    reference: &RepoReference,
    on_line: &mut dyn FnMut(&str),
) -> Result<PathBuf, String> {
    let (url, slug) = match reference {
        RepoReference::Local(path) => return Ok(path.clone()),
        RepoReference::Remote { url, slug, .. } => (url, slug),
    };

    const GIT_ENV: &[(&str, &str)] = &[("GIT_TERMINAL_PROMPT", "0")];
    let dir = repo_cache_dir(vault_path, slug);
    let dir_str = dir.to_string_lossy().to_string();

    if dir.join(".git").is_dir() {
        on_line(&format!("Updating cached clone of {url}..."));
        crate::rhizome_commands::run_cli_streaming(
            &["git", "-C", &dir_str, "fetch", "--depth", "1", "origin"],
            GIT_ENV,
            on_line,
        )?;
        crate::rhizome_commands::run_cli_streaming(
            &["git", "-C", &dir_str, "reset", "--hard", "FETCH_HEAD"],
            GIT_ENV,
            on_line,
        )?;
    } else {
        on_line(&format!("Cloning {url}..."));
        if let Some(parent) = dir.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create repo cache dir: {e}"))?;
        }
        crate::rhizome_commands::run_cli_streaming(
            &["git", "clone", "--depth", "1", url, &dir_str],
            GIT_ENV,
            on_line,
        )?;
    }
    Ok(dir)
}

/// One imperative synthesis instruction per Generate-tab mode (ids and
/// intent from `RhizomeFormatModal.tsx`'s RESEARCH_MODES). Unknown ids fall
/// back to `architecture`, the panel's default.
pub fn mode_instruction(mode: &str) -> &'static str {
    match mode {
        "first-hour" => "Write a fast orientation guide: which files to read first and in what order, the entry points, a local glossary of repo-specific terms, and what to ignore at first.",
        "eli5" => "Explain in plain language what this repository does, using one careful analogy, without losing grounding in the actual source: what moves where, and why each part exists.",
        "hidden-lessons" => "Surface the non-obvious implementation details: hidden constraints, edge cases, workarounds, failure modes, and hard-won lessons visible in the code and tests.",
        "reusable-patterns" => "Extract the designs worth reusing elsewhere: each pattern, why it works, when not to copy it, and how to port it.",
        "feature-scout" => "Write a scout report of the product surface: feature inventory, workflows, CLI commands, hidden power moves, and what is worth demoing or copying.",
        "mental-model" => "Distill a durable mental model of how the system behaves: core invariants, state ownership, boundaries, failure modes, and where changes are safe.",
        "debugging-atlas" => "Write a practical debugging guide: common failure modes, symptoms, which logs and probes to check first, root-cause paths, and recovery flows.",
        "integration-plan" => "Write a concrete integration plan: the integration surface (APIs, hooks, events, CLI), data contracts, auth and error handling, and a step-by-step plan naming exact files.",
        "agent-handoff" => "Write everything an AI agent needs to work effectively in this repo: environment setup, test commands, CI gates, conventions, generated files, and do-not-touch areas.",
        _ => "Produce a comprehensive developer reference: entry points, data flow, key abstractions, and a component/tech-stack map.",
    }
}

/// Prompt for one research round. The agent's cwd is the repo checkout;
/// research is grounded in reading files, and rounds after the first carry
/// the accumulated raw findings forward.
pub fn build_round_prompt(repo_name: &str, round: u32, total: u32, prior_findings: &str) -> String {
    let continuation = if prior_findings.trim().is_empty() {
        String::new()
    } else {
        format!(
            "\nFindings from earlier rounds:\n{prior_findings}\n\n\
Go deeper this round: verify uncertain claims above, answer the open \
questions, and explore areas not yet covered.\n"
        )
    };
    format!(
        "You are researching the repository \"{repo_name}\" (research round {round} of {total}).\n\
Explore the codebase in the current working directory using Read, Glob, Grep, and LS.\n\
Do not create, modify, or delete any files.\n\
{continuation}\
Respond with:\n\
FINDINGS:\n\
- <concrete findings, each grounded in a specific file path>\n\
OPEN QUESTIONS:\n\
- <what a further round should investigate, or \"none\">"
    )
}

/// Prompt for the final synthesis call: turn accumulated findings into one
/// contract-conformant wiki page in the strict `TITLE:`/`CONTEXT:`/`---`/
/// body shape `parse_agent_response` understands.
pub fn build_synthesis_prompt(repo_name: &str, mode: &str, findings: &str) -> String {
    format!(
        "Using the research findings below about the repository \"{repo_name}\", \
write a single wiki page.\n\
{instruction}\n\
Ground every claim in the findings; cite file paths where relevant.\n\
Respond with exactly this shape and nothing else:\n\
TITLE: <short human title, no markdown>\n\
CONTEXT: <one sentence situating this page for retrieval>\n\
---\n\
<body in markdown: the wiki page, self-contained>\n\n\
Research findings:\n{findings}",
        instruction = mode_instruction(mode),
    )
}

/// Frontmatter for a repo wiki page: the shared skeleton plus `source:`
/// (the repo reference, mirroring import's precedent), `mode:`, and an
/// optional `project:` (parity with distill/import).
pub fn wiki_frontmatter(
    title: &str,
    context: &str,
    last_updated: &str,
    repo: &str,
    mode: &str,
    project: Option<&str>,
) -> String {
    let mut fm = crate::rhizome_write_location::default_frontmatter(
        crate::rhizome_write_location::ArtifactKind::RepoWiki,
        title,
        last_updated,
    );
    fm = fm.replacen("context: \n", &format!("context: {context}\n"), 1);
    fm.push_str(&format!("source: {repo}\n"));
    fm.push_str(&format!("mode: {mode}\n"));
    if let Some(project) = project.filter(|p| !p.is_empty()) {
        fm.push_str(&format!("project: {project}\n"));
    }
    fm
}

/// Write the synthesized page as a contract-conformant RepoWiki artifact at
/// `wiki/sources/repos/<slug>.md`. Slug is the repo identity, not the
/// agent's title; collisions dedupe with a numeric suffix.
#[allow(clippy::too_many_arguments)]
pub fn write_repo_wiki(
    vault_path: &Path,
    card: &crate::rhizome_distill::ParsedCard,
    repo: &str,
    mode: &str,
    project: Option<&str>,
    slug: &str,
    last_updated: &str,
) -> Result<(String, PathBuf), String> {
    let (slug, path) = crate::rhizome_write_location::unique_slug_path(
        vault_path,
        crate::rhizome_write_location::ArtifactKind::RepoWiki,
        slug,
    );
    let frontmatter = wiki_frontmatter(
        &card.title,
        &card.context,
        last_updated,
        repo,
        mode,
        project,
    );
    let contents = format!("{frontmatter}\n{}\n", card.body);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {e}"))?;
    }
    std::fs::write(&path, contents).map_err(|e| format!("Failed to write wiki page: {e}"))?;
    Ok((slug, path))
}

/// `.rhizome/events.jsonl` lines matching the JS MCP handler's field set
/// (`mcp-server/index.js` handleRhizomeRepoResearch) plus `trigger`
/// (`"manual"` today; Alpha-3's inbox automation passes `"inbox"`), so the
/// History tab sees in-app runs identically to MCP-triggered ones.
///
/// Thin wrapper over [`crate::vault_events`], the single event writer.
pub fn append_research_started(
    vault_path: &Path,
    mode: &str,
    repo: &str,
    depth: &str,
    project: Option<&str>,
    trigger: &str,
) -> Result<(), String> {
    crate::vault_events::append(
        vault_path,
        &crate::vault_events::VaultEvent::new("research-started", trigger)
            .project(project)
            .field("mode", mode)
            .field("repo", repo)
            .field("depth", depth),
    )
}

#[allow(clippy::too_many_arguments)]
pub fn append_research_finished(
    vault_path: &Path,
    mode: &str,
    repo: &str,
    project: Option<&str>,
    trigger: &str,
    artifact_path: &str,
) -> Result<(), String> {
    crate::vault_events::append(
        vault_path,
        &crate::vault_events::VaultEvent::new("research-finished", trigger)
            .project(project)
            .artifact_path(artifact_path)
            .field("mode", mode)
            .field("repo", repo),
    )
}

/// Run one agent call with cwd at the repo checkout, collecting the full
/// text response and forwarding progress to `on_line`.
fn run_agent_round(
    repo_dir: &Path,
    prompt: String,
    agent: crate::ai_agents::AiAgentId,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    use crate::ai_agents::{AiAgentPermissionMode, AiAgentStreamEvent, AiAgentStreamRequest};

    let request = AiAgentStreamRequest {
        agent,
        message: prompt,
        system_prompt: None,
        // The agent layer uses this as the subprocess cwd — pointed at the
        // repo so Read/Glob/Grep ground the research in real files.
        vault_path: repo_dir.to_string_lossy().to_string(),
        vault_paths: Vec::new(),
        permission_mode: Some(AiAgentPermissionMode::Safe),
        event_name: None,
    };

    let mut response = String::new();
    crate::ai_agents::run_ai_agent_stream(request, |event| match event {
        AiAgentStreamEvent::TextDelta { text: delta } => {
            response.push_str(&delta);
            on_line(&delta);
        }
        AiAgentStreamEvent::ToolStart { tool_name, .. } => on_line(&format!("[{tool_name}]")),
        AiAgentStreamEvent::Error { message } => on_line(&format!("Error: {message}")),
        _ => {}
    })?;
    Ok(response)
}

/// End to end: classify the reference, make the repo readable, run N
/// grounded research rounds plus one synthesis call through the agent
/// layer, write the wiki page into the vault (the agent never writes the
/// artifact), and log the history events. `on_line` feeds the panel's
/// `rhizome-progress` live log, same shape the CLI shell-out produced.
#[allow(clippy::too_many_arguments)]
pub fn run_repo_research_via_agent(
    vault_path: &Path,
    repo: &str,
    mode: &str,
    depth: &str,
    project: Option<&str>,
    agent: crate::ai_agents::AiAgentId,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    let reference = classify_repo_reference(repo)?;
    let repo_name = repo_display_name(&reference);
    let slug = repo_slug(&reference);
    let rounds = rounds_for_depth(depth);

    append_research_started(vault_path, mode, repo, depth, project, "manual")?;
    let repo_dir = ensure_local_repo(vault_path, &reference, on_line)?;

    let mut findings = String::new();
    for round in 1..=rounds {
        on_line(&format!("Research round {round} of {rounds}..."));
        let prompt = build_round_prompt(&repo_name, round, rounds, &findings);
        let response = run_agent_round(&repo_dir, prompt, agent, on_line)?;
        findings.push_str(&response);
        findings.push('\n');
    }

    on_line("Synthesizing wiki page...");
    let synthesis = run_agent_round(
        &repo_dir,
        build_synthesis_prompt(&repo_name, mode, &findings),
        agent,
        on_line,
    )?;

    let card = crate::rhizome_distill::parse_agent_response(&synthesis);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let (slug, path) = write_repo_wiki(vault_path, &card, repo, mode, project, &slug, &today)?;
    let artifact_path = crate::rhizome_write_location::relative_to_vault(vault_path, &path);
    append_research_finished(vault_path, mode, repo, project, "manual", &artifact_path)?;
    Ok(format!("Researched \"{repo_name}\" and saved as {slug}.md"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_https_url_variants_to_same_remote() {
        for input in [
            "https://github.com/rust-lang/cargo",
            "https://github.com/rust-lang/cargo.git",
            "https://github.com/rust-lang/cargo/",
            "github.com/rust-lang/cargo",
        ] {
            let r = classify_repo_reference(input).unwrap();
            assert_eq!(
                r,
                RepoReference::Remote {
                    url: "https://github.com/rust-lang/cargo.git".into(),
                    slug: "rust-lang-cargo".into(),
                    display: "rust-lang/cargo".into(),
                },
                "input: {input}"
            );
        }
    }

    #[test]
    fn classifies_ssh_reference() {
        let r = classify_repo_reference("git@github.com:knispo/rhizome.git").unwrap();
        match r {
            RepoReference::Remote { url, slug, display } => {
                assert_eq!(url, "https://github.com/knispo/rhizome.git");
                assert_eq!(slug, "knispo-rhizome");
                assert_eq!(display, "knispo/rhizome");
            }
            other => panic!("expected Remote, got {other:?}"),
        }
    }

    #[test]
    fn classifies_bare_owner_repo() {
        let r = classify_repo_reference("octocat/Hello-World").unwrap();
        match r {
            RepoReference::Remote { url, slug, display } => {
                assert_eq!(url, "https://github.com/octocat/Hello-World.git");
                assert_eq!(slug, "octocat-hello-world");
                assert_eq!(display, "octocat/Hello-World");
            }
            other => panic!("expected Remote, got {other:?}"),
        }
    }

    #[test]
    fn classifies_existing_local_dir() {
        let dir = tempfile::tempdir().unwrap();
        let r = classify_repo_reference(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(r, RepoReference::Local(dir.path().to_path_buf()));
    }

    #[test]
    fn errors_on_missing_local_path() {
        let err = classify_repo_reference("/definitely/not/a/real/dir").unwrap_err();
        assert!(err.contains("does not exist"), "err: {err}");
    }

    #[test]
    fn errors_on_garbage_input() {
        for input in ["not a repo!!", "owner/repo/extra", "", "   "] {
            assert!(classify_repo_reference(input).is_err(), "input: {input:?}");
        }
    }

    #[test]
    fn display_name_and_slug_for_local_dir() {
        let dir = tempfile::tempdir().unwrap();
        let repo_dir = dir.path().join("My Repo");
        std::fs::create_dir(&repo_dir).unwrap();
        let r = classify_repo_reference(repo_dir.to_str().unwrap()).unwrap();
        assert_eq!(repo_display_name(&r), "My Repo");
        assert_eq!(repo_slug(&r), "my-repo");
    }

    #[test]
    fn rounds_for_depth_maps_ui_values() {
        assert_eq!(rounds_for_depth("fast"), 1);
        assert_eq!(rounds_for_depth("regular"), 2);
        assert_eq!(rounds_for_depth("deep"), 3);
        assert_eq!(rounds_for_depth("unknown"), 1);
    }

    #[test]
    fn ensure_local_repo_passes_local_reference_through() {
        let vault = tempfile::tempdir().unwrap();
        let repo = tempfile::tempdir().unwrap();
        let reference = RepoReference::Local(repo.path().to_path_buf());
        let mut lines = Vec::new();
        let path = ensure_local_repo(vault.path(), &reference, &mut |l| lines.push(l.to_string()))
            .unwrap();
        assert_eq!(path, repo.path());
        assert!(lines.is_empty(), "local refs must not touch git: {lines:?}");
        assert!(!vault.path().join(".rhizome").exists());
    }

    #[test]
    fn ensure_local_repo_surfaces_git_stderr_on_bad_remote() {
        let vault = tempfile::tempdir().unwrap();
        // file:// URL to a nonexistent path fails fast, offline.
        let reference = RepoReference::Remote {
            url: "file:///definitely/not/a/repo".into(),
            slug: "bad-remote".into(),
            display: "bad/remote".into(),
        };
        let err = ensure_local_repo(vault.path(), &reference, &mut |_| {}).unwrap_err();
        assert!(err.contains("git failed"), "err: {err}");
    }

    /// Live network test: clones a tiny public repo twice — first call
    /// clones, second call fetch-updates the cached checkout. Needs `git`
    /// and network, so `#[ignore]`d; run manually with
    /// `cargo test --manifest-path src-tauri/Cargo.toml
    /// rhizome_repo_research::tests::live_ensure_local_repo_clones_then_updates
    /// -- --ignored --nocapture` when changing the clone wiring.
    #[test]
    #[ignore]
    fn live_ensure_local_repo_clones_then_updates() {
        let vault = tempfile::tempdir().unwrap();
        let reference = classify_repo_reference("octocat/Hello-World").unwrap();

        let mut lines = Vec::new();
        let path = ensure_local_repo(vault.path(), &reference, &mut |l| lines.push(l.to_string()))
            .unwrap();
        assert!(path.join(".git").is_dir());
        assert!(lines.iter().any(|l| l.starts_with("Cloning ")), "{lines:?}");

        let mut lines2 = Vec::new();
        let path2 = ensure_local_repo(vault.path(), &reference, &mut |l| {
            lines2.push(l.to_string())
        })
        .unwrap();
        assert_eq!(path, path2);
        assert!(
            lines2.iter().any(|l| l.starts_with("Updating ")),
            "second call should update, not re-clone: {lines2:?}"
        );
    }

    #[test]
    fn repo_cache_dir_nests_under_rhizome_dotdir() {
        assert_eq!(
            repo_cache_dir(Path::new("/vault"), "octocat-hello-world"),
            PathBuf::from("/vault/.rhizome/repo-cache/octocat-hello-world")
        );
    }

    #[test]
    fn round_prompt_first_round_omits_prior_findings() {
        let p = build_round_prompt("owner/repo", 1, 3, "");
        assert!(p.contains("\"owner/repo\""));
        assert!(p.contains("round 1 of 3"));
        assert!(p.contains("Do not create, modify, or delete any files."));
        assert!(p.contains("FINDINGS:"));
        assert!(p.contains("OPEN QUESTIONS:"));
        assert!(!p.contains("Findings from earlier rounds"));
    }

    #[test]
    fn round_prompt_later_rounds_carry_findings_forward() {
        let p = build_round_prompt("owner/repo", 2, 3, "- main.rs is the entry point");
        assert!(p.contains("round 2 of 3"));
        assert!(p.contains("Findings from earlier rounds:"));
        assert!(p.contains("- main.rs is the entry point"));
        assert!(p.contains("verify uncertain claims"));
    }

    #[test]
    fn synthesis_prompt_includes_mode_instruction_and_shape() {
        let p = build_synthesis_prompt("owner/repo", "eli5", "- finding one");
        assert!(p.contains("\"owner/repo\""));
        assert!(p.contains(mode_instruction("eli5")));
        assert!(p.contains("TITLE:"));
        assert!(p.contains("CONTEXT:"));
        assert!(p.contains("- finding one"));
    }

    #[test]
    fn mode_instruction_covers_all_ten_modes_distinctly() {
        let modes = [
            "architecture",
            "first-hour",
            "eli5",
            "hidden-lessons",
            "reusable-patterns",
            "feature-scout",
            "mental-model",
            "debugging-atlas",
            "integration-plan",
            "agent-handoff",
        ];
        let instructions: std::collections::HashSet<_> =
            modes.iter().map(|m| mode_instruction(m)).collect();
        assert_eq!(instructions.len(), modes.len());
        // Unknown ids fall back to the architecture instruction.
        assert_eq!(
            mode_instruction("nonsense"),
            mode_instruction("architecture")
        );
    }

    #[test]
    fn wiki_frontmatter_includes_context_source_and_mode() {
        let fm = wiki_frontmatter(
            "Cargo Architecture",
            "How cargo's build pipeline fits together.",
            "2026-07-10",
            "rust-lang/cargo",
            "architecture",
            None,
        );
        assert!(fm.contains("title: Cargo Architecture"));
        assert!(fm.contains("type: wiki"));
        assert!(fm.contains("context: How cargo's build pipeline fits together."));
        assert!(fm.contains("source: rust-lang/cargo"));
        assert!(fm.contains("mode: architecture"));
        assert!(!fm.contains("project:"));
    }

    #[test]
    fn wiki_frontmatter_includes_project_when_given() {
        let fm = wiki_frontmatter(
            "Cargo Architecture",
            "A map.",
            "2026-07-10",
            "rust-lang/cargo",
            "architecture",
            Some("rhizome"),
        );
        assert!(fm.contains("project: rhizome"));
    }

    #[test]
    fn write_repo_wiki_lands_under_repos_dir_and_dedupes() {
        let dir = tempfile::tempdir().unwrap();
        let card = crate::rhizome_distill::ParsedCard {
            title: "Cargo Architecture".to_string(),
            context: "A map.".to_string(),
            body: "Body text.".to_string(),
        };
        let (slug, path) = write_repo_wiki(
            dir.path(),
            &card,
            "rust-lang/cargo",
            "architecture",
            Some("rhizome"),
            "rust-lang-cargo",
            "2026-07-10",
        )
        .unwrap();
        assert_eq!(slug, "rust-lang-cargo");
        assert_eq!(
            path,
            dir.path().join("wiki/sources/repos/rust-lang-cargo.md")
        );
        let contents = std::fs::read_to_string(&path).unwrap();
        assert!(contents.contains("title: Cargo Architecture"));
        assert!(contents.contains("Body text."));
        assert!(contents.contains("project: rhizome"));

        let (slug2, path2) = write_repo_wiki(
            dir.path(),
            &card,
            "rust-lang/cargo",
            "eli5",
            None,
            "rust-lang-cargo",
            "2026-07-10",
        )
        .unwrap();
        assert_eq!(slug2, "rust-lang-cargo-2");
        assert!(path2.ends_with("rust-lang-cargo-2.md"));
    }

    /// Exercises the real live path end to end: a real agent CLI subprocess
    /// reading a real (tiny, local) repo fixture, a real wiki page written
    /// to a tempdir vault. Costs tokens and needs `claude` on PATH, so it's
    /// `#[ignore]`d — run manually with `cargo test --manifest-path
    /// src-tauri/Cargo.toml
    /// rhizome_repo_research::tests::live_repo_research_via_claude_code_writes_a_wiki_page
    /// -- --ignored --nocapture` when changing the orchestrator wiring.
    #[test]
    #[ignore]
    fn live_repo_research_via_claude_code_writes_a_wiki_page() {
        let vault = tempfile::tempdir().unwrap();
        let repo = tempfile::tempdir().unwrap();
        std::fs::write(
            repo.path().join("main.rs"),
            "/// Adds two numbers.\nfn add(a: i32, b: i32) -> i32 { a + b }\nfn main() { println!(\"{}\", add(1, 2)); }\n",
        )
        .unwrap();
        std::fs::write(
            repo.path().join("README.md"),
            "# adder\nA tiny demo crate that adds two numbers.\n",
        )
        .unwrap();

        let mut lines = Vec::new();
        let result = run_repo_research_via_agent(
            vault.path(),
            repo.path().to_str().unwrap(),
            "eli5",
            "fast",
            Some("rhizome"),
            crate::ai_agents::AiAgentId::ClaudeCode,
            &mut |line| lines.push(line.to_string()),
        );

        let message = result.expect("live repo research should succeed");
        assert!(
            message.contains("saved as"),
            "unexpected message: {message}"
        );
        assert!(!lines.is_empty(), "expected progress lines");

        let repos_dir = vault.path().join("wiki/sources/repos");
        let written: Vec<_> = std::fs::read_dir(&repos_dir)
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        assert_eq!(written.len(), 1, "expected exactly one wiki page");
        let contents = std::fs::read_to_string(&written[0]).unwrap();
        assert!(contents.contains("type: wiki"));
        assert!(contents.contains("mode: eli5"));
        assert!(contents.contains("project: rhizome"));

        let events = std::fs::read_to_string(vault.path().join(".rhizome/events.jsonl")).unwrap();
        assert!(events.contains("\"type\":\"research-started\""));
        assert!(events.contains("\"type\":\"research-finished\""));
    }

    #[test]
    fn research_events_match_js_mcp_field_sets() {
        let dir = tempfile::tempdir().unwrap();
        append_research_started(
            dir.path(),
            "architecture",
            "owner/repo",
            "deep",
            Some("rhizome"),
            "manual",
        )
        .unwrap();
        append_research_finished(
            dir.path(),
            "architecture",
            "owner/repo",
            Some("rhizome"),
            "manual",
            "wiki/sources/repos/owner-repo.md",
        )
        .unwrap();
        let content = std::fs::read_to_string(dir.path().join(".rhizome/events.jsonl")).unwrap();
        let lines: Vec<serde_json::Value> = content
            .lines()
            .map(|l| serde_json::from_str(l).unwrap())
            .collect();
        assert_eq!(lines.len(), 2);

        let started = &lines[0];
        assert_eq!(started["type"], "research-started");
        assert_eq!(started["mode"], "architecture");
        assert_eq!(started["repo"], "owner/repo");
        assert_eq!(started["depth"], "deep");
        assert_eq!(started["project"], "rhizome");
        assert_eq!(started["trigger"], "manual");
        assert!(started["timestamp"].is_string());

        let finished = &lines[1];
        assert_eq!(finished["type"], "research-finished");
        assert_eq!(finished["mode"], "architecture");
        assert_eq!(finished["repo"], "owner/repo");
        assert_eq!(finished["project"], "rhizome");
        assert_eq!(finished["trigger"], "manual");
        assert_eq!(
            finished["artifact_path"],
            "wiki/sources/repos/owner-repo.md"
        );
        // JS writes no depth on the finished event — match exactly.
        assert!(finished.get("depth").is_none());
        assert!(finished["timestamp"].is_string());
    }
}
