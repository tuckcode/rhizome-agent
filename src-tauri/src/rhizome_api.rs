//! AppHandle-free Rhizome research verb façade (One Brain MCP bridge, ADR-0152).
//!
//! Used by:
//! - `rhizome_commands::call_rhizome_tool` (in-app Research panel, progress via emit)
//! - future `rhizome-tool` sidecar binary (progress via stderr / silent)
//!
//! Search: GUI path reuses the warm `RhizomeSearchService`; standalone path uses
//! reader-only open so it can run while the GUI holds a writer lock.

use crate::rhizome_search::embedder::{FastEmbedTextEmbedder, TextEmbedder};
use crate::rhizome_search::service::RhizomeSearchService;
use crate::rhizome_search::{
    index_dir_for_vault, wiki_root, wiki_root_prefix, RhizomeSearchIndex, SearchHit,
};
use crate::search::SnippetRequest;
use std::path::Path;

#[derive(serde::Serialize)]
pub struct AskResultDto {
    pub path: String,
    pub title: String,
    pub snippet: String,
}

/// Format hybrid search hits the same way the Ask tab / `call_rhizome_tool` do.
pub fn format_search_hits(
    vault_path: &Path,
    query: &str,
    hits: Vec<SearchHit>,
) -> Result<String, String> {
    let root = wiki_root(vault_path);
    let prefix = wiki_root_prefix(vault_path);
    let query_lower = query.to_lowercase();
    let results: Vec<AskResultDto> = hits
        .into_iter()
        .map(|hit| {
            let snippet = std::fs::read_to_string(root.join(&hit.id))
                .map(|content| {
                    SnippetRequest {
                        content: &content,
                        query_lower: &query_lower,
                    }
                    .extract()
                })
                .unwrap_or_default();
            // `hit.id` is relative to `wiki_root` (the search index's own
            // convention, kept stable to avoid a reindex — see C17 in
            // docs/HANDOFF.md). Re-prefix here so the string that crosses
            // to the frontend is vault-root-relative, matching what the
            // Library panel already sends via `artifact_dir`.
            AskResultDto {
                path: format!("{prefix}{}", hit.id),
                title: hit.title,
                snippet,
            }
        })
        .collect();

    serde_json::to_string(&results).map_err(|e| format!("Failed to serialize results: {e}"))
}

/// Search via the app-session warm service (Research panel / Ask tab).
pub fn search_with_service(
    service: &RhizomeSearchService,
    vault_path: &Path,
    query: &str,
    limit: usize,
) -> Result<String, String> {
    let hits = service.search(vault_path, query, limit)?;
    format_search_hits(vault_path, query, hits)
}

/// Search without Tauri state — for the MCP sidecar (and headless callers).
///
/// 1. Prefer reader-only open (works while GUI holds writer lock).
/// 2. If index missing/empty, attempt a short-lived writer build.
/// 3. If the writer lock is held, return a clear busy error (ADR-0152).
pub fn search_standalone(vault_path: &Path, query: &str, limit: usize) -> Result<String, String> {
    search_standalone_with_embedder(vault_path, query, limit, || {
        let cache_dir = index_dir_for_vault(vault_path)?.join("model");
        Ok(Box::new(FastEmbedTextEmbedder::new(&cache_dir)?) as Box<dyn TextEmbedder + Send>)
    })
}

/// Same as [`search_standalone`] with an injectible embedder (tests).
pub fn search_standalone_with_embedder(
    vault_path: &Path,
    query: &str,
    limit: usize,
    build_embedder: impl FnOnce() -> Result<Box<dyn TextEmbedder + Send>, String>,
) -> Result<String, String> {
    let mut embedder = build_embedder()?;

    match RhizomeSearchIndex::open_reader(vault_path) {
        Ok(index) if !index.is_empty() => {
            let hits = index.search(query, limit, embedder.as_mut())?;
            return format_search_hits(vault_path, query, hits);
        }
        Ok(_) | Err(_) => {
            // Fall through to short-lived writer build.
        }
    }

    let mut index = RhizomeSearchIndex::open_or_create(vault_path).map_err(|e| {
        if is_writer_lock_error(&e) {
            format!(
                "Search index is locked by Rhizome Desktop (writer held). \
                 Wait for the app to finish indexing, or run Ask once with the app open. \
                 Detail: {e}"
            )
        } else {
            e
        }
    })?;

    if index.is_empty() {
        index.reindex_all(embedder.as_mut())?;
    }

    let hits = index.search(query, limit, embedder.as_mut())?;
    format_search_hits(vault_path, query, hits)
}

fn is_writer_lock_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("lock") || lower.contains("already") || lower.contains("writer")
}

/// Best-effort first-run seed (Phase 3.3) — never blocks the real write.
/// A failure here (permissions, race) just means the vault stays empty;
/// the actual research write proceeds either way.
fn seed_vault_if_empty(vault_path: &Path) {
    let now = chrono::Utc::now().to_rfc3339();
    let _ = crate::rhizome_vault_seed::seed_if_empty(vault_path, &now);
}

/// Distill via the agent/model layer (AppHandle-free). `trigger` labels the
/// event's origin (`"manual"` from the Research panel, `"inbox"` from
/// automation). `target`, when provided, overrides the default agent — the
/// frontend resolves which agent/model target is actually configured
/// (including live install status), so callers that know it should pass it
/// through rather than let this silently re-derive a possibly-stale default.
/// `None` falls back to the settings-derived default CLI agent.
#[allow(clippy::too_many_arguments)]
pub fn distill(
    vault_path: &Path,
    text: &str,
    project: Option<&str>,
    kind: Option<&str>,
    trigger: &str,
    target: Option<crate::ai_run_target::AiRunTarget>,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    seed_vault_if_empty(vault_path);
    crate::rhizome_distill::run_distill_via_target(
        vault_path,
        text,
        project,
        kind,
        trigger,
        target.unwrap_or_else(|| {
            crate::ai_run_target::AiRunTarget::Agent(
                crate::rhizome_distill::resolve_default_agent_id(),
            )
        }),
        on_line,
    )
}

/// Import source via the agent/model layer (AppHandle-free). `trigger`
/// labels the event's origin (`"manual"` from the Research panel, `"inbox"`
/// from automation). See `distill` for the `target` override contract.
pub fn import_source(
    vault_path: &Path,
    source: &str,
    project: Option<&str>,
    trigger: &str,
    target: Option<crate::ai_run_target::AiRunTarget>,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    seed_vault_if_empty(vault_path);
    crate::rhizome_import::run_import_via_target(
        vault_path,
        source,
        project,
        trigger,
        target.unwrap_or_else(|| {
            crate::ai_run_target::AiRunTarget::Agent(
                crate::rhizome_distill::resolve_default_agent_id(),
            )
        }),
        on_line,
    )
}

/// Which Grok-Wiki file(s) [`grok_import`] should act on — mirrors the
/// Python CLI's `--list` / `<path>` / `--auto` argument shapes.
pub enum GrokImportMode<'a> {
    /// `--list`: describe available wikis in the default Grok-Wiki data dir.
    List,
    /// `<path>`: import one specific Grok-Wiki JSON file.
    One(&'a Path),
    /// `--auto`: import every wiki found in the default Grok-Wiki data dir.
    Auto,
}

/// Grok-Wiki import (AppHandle-free) — last research verb still shelling
/// the Python CLI before this port (ADR-0152, Phase 1b). No agent
/// involved: pure JSON parsing and markdown generation, ported 1:1 from
/// `rhizome/grok_import.py`, except placement now goes through the shared
/// vault contract (`rhizome_grok_import::import_wiki`) instead of the
/// Python CLI's always-flat `sources/repos/...`.
pub fn grok_import(
    vault_path: &Path,
    mode: GrokImportMode,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    use crate::rhizome_grok_import::{
        default_grok_wiki_dir, find_grok_wiki_files, format_wiki_listing, import_wiki,
    };

    let now = chrono::Utc::now().to_rfc3339();

    match mode {
        GrokImportMode::List => {
            let Some(data_dir) = default_grok_wiki_dir() else {
                return Ok("No Grok-Wiki files found in default location.".to_string());
            };
            let files = find_grok_wiki_files(&data_dir);
            Ok(format_wiki_listing(&files))
        }
        GrokImportMode::One(json_path) => {
            if !json_path.exists() {
                return Err(format!("File not found: {}", json_path.display()));
            }
            let result = import_wiki(vault_path, json_path, &now)?;
            let msg = format!(
                "  ✓ {}/{}  → {} pages written\n\nDone. {} pages imported to {}/",
                result.owner,
                result.repo,
                result.written.len(),
                result.written.len(),
                vault_path.display()
            );
            on_line(&msg);
            Ok(msg)
        }
        GrokImportMode::Auto => {
            let Some(data_dir) = default_grok_wiki_dir() else {
                return Ok("No Grok-Wiki files found in default location.".to_string());
            };
            let files = find_grok_wiki_files(&data_dir);
            if files.is_empty() {
                return Ok("No Grok-Wiki files found in default location.".to_string());
            }
            let mut total_written = 0usize;
            let mut lines = Vec::new();
            for f in &files {
                match import_wiki(vault_path, f, &now) {
                    Ok(result) => {
                        let line = format!(
                            "  ✓ {}/{}  → {} pages written",
                            result.owner,
                            result.repo,
                            result.written.len()
                        );
                        total_written += result.written.len();
                        on_line(&line);
                        lines.push(line);
                    }
                    Err(e) => {
                        let name = f.file_name().and_then(|n| n.to_str()).unwrap_or("?");
                        let line = format!("  ✗ {name}: {e}");
                        on_line(&line);
                        lines.push(line);
                    }
                }
            }
            lines.push(format!(
                "\nDone. {total_written} pages imported to {}/sources/repos/",
                vault_path.display()
            ));
            Ok(lines.join("\n"))
        }
    }
}

/// Build the wiki graph (nodes + wikilink/relationship edges, ghost
/// nodes for unresolved targets) as JSON. AppHandle-free — shared by the
/// GUI command layer, the `rhizome-tool` sidecar, and MCP.
pub fn build_wiki_graph(vault_path: &Path) -> Result<String, String> {
    let entries = crate::vault::scan_vault_cached(vault_path)?;
    let graph = crate::vault::graph::build_graph(vault_path, &entries);
    serde_json::to_string(&graph).map_err(|e| format!("Failed to serialize graph: {e}"))
}

/// Repo research via agent layer (AppHandle-free). See `distill` for the
/// `agent` override contract.
#[allow(clippy::too_many_arguments)]
pub fn repo_research(
    vault_path: &Path,
    repo: &str,
    mode: &str,
    depth: &str,
    project: Option<&str>,
    agent: Option<crate::ai_agents::AiAgentId>,
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    seed_vault_if_empty(vault_path);
    crate::rhizome_repo_research::run_repo_research_via_agent(
        vault_path,
        repo,
        mode,
        depth,
        project,
        agent.unwrap_or_else(crate::rhizome_distill::resolve_default_agent_id),
        on_line,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use tempfile::TempDir;

    struct FakeEmbedder;

    impl TextEmbedder for FakeEmbedder {
        fn embed_batch(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
            Ok(texts
                .iter()
                .map(|t| {
                    let mut hasher = DefaultHasher::new();
                    t.hash(&mut hasher);
                    let seed = hasher.finish();
                    (0..8)
                        .map(|i| (((seed >> (i * 8)) & 0xff) as f32 / 255.0) - 0.5)
                        .collect()
                })
                .collect())
        }
    }

    fn write_note(vault: &Path, relative: &str, content: &str) {
        let path = vault.join(relative);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, content).unwrap();
    }

    fn cleanup_index_dir(vault_path: &Path) {
        if let Ok(dir) = index_dir_for_vault(vault_path) {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    #[test]
    fn format_search_hits_serializes_path_title_snippet() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "wiki/entities/alice.md",
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        );
        let hits = vec![SearchHit {
            id: "entities/alice.md".into(),
            path: "entities/alice.md".into(),
            title: "Alice".into(),
            score: 1.0,
        }];
        let json = format_search_hits(dir.path(), "distributed", hits).unwrap();
        assert!(json.contains("Alice"));
        assert!(json.contains("distributed"));
        // C17: the outward path must be vault-root-relative (the `wiki/`
        // prefix reattached), matching the Library panel's convention —
        // not the search index's own wiki-root-relative `hit.id`.
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed[0]["path"], "wiki/entities/alice.md");
    }

    /// C17: on a flat-layout vault (no `wiki/` subdir), the search index's
    /// wiki-root-relative id already equals the vault-root-relative path —
    /// no prefix should be added.
    #[test]
    fn format_search_hits_adds_no_prefix_on_flat_layout() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "entities/alice.md",
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        );
        let hits = vec![SearchHit {
            id: "entities/alice.md".into(),
            path: "entities/alice.md".into(),
            title: "Alice".into(),
            score: 1.0,
        }];
        let json = format_search_hits(dir.path(), "distributed", hits).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed[0]["path"], "entities/alice.md");
    }

    /// Standalone search must succeed while a writer holds the lock
    /// (reader-only path) — ADR-0152 / Phase 1b.
    #[test]
    fn search_standalone_reads_while_writer_held() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "wiki/entities/alice.md",
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        );
        let vault = dir.path();

        let mut writer = RhizomeSearchIndex::open_or_create(vault).unwrap();
        let mut embedder = FakeEmbedder;
        writer.reindex_all(&mut embedder).unwrap();
        assert!(writer.is_writable());

        let json = search_standalone_with_embedder(vault, "distributed", 10, || {
            Ok(Box::new(FakeEmbedder) as Box<dyn TextEmbedder + Send>)
        })
        .unwrap();
        assert!(json.contains("entities/alice.md"));

        drop(writer);
        cleanup_index_dir(vault);
    }

    /// Phase 3.3: every write verb seeds an empty destination vault before
    /// doing its real work, so first-run isn't a blank screen. The agent
    /// call itself will fail in this test environment (no CLI installed) —
    /// that's fine, the point is the seed happens regardless, before that
    /// failure, as a synchronous first step.
    #[test]
    fn distill_seeds_an_empty_destination_vault_before_running() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();

        let _ = distill(vault, "some text", None, None, "manual", None, &mut |_| {});

        assert!(vault.join("RHIZOME_VAULT.md").is_file());
        assert!(vault.join("wiki/concepts/rhizome-concept.md").is_file());
    }

    /// The API-model path writes a real concept card through the same
    /// pipeline the agent path uses. Exercised via the crate-visible
    /// injected-runner distill inner so no network endpoint is hit.
    #[test]
    fn distill_via_api_model_target_writes_a_concept_card() {
        use crate::ai_models::{
            AiModelCapabilities, AiModelDefinition, AiModelProvider, AiModelProviderKind,
        };

        let dir = TempDir::new().unwrap();
        let vault = dir.path();
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

        crate::rhizome_distill::run_distill_via_target_with_model_runner(
            vault,
            "raw text",
            None,
            Some("concept"),
            "manual",
            target,
            &mut |_| {},
            |_req, emit| {
                emit(crate::ai_agents::AiAgentStreamEvent::TextDelta {
                    text: "TITLE: Vector Search\n---\nNearest-neighbour retrieval.".into(),
                });
                Ok(String::new())
            },
        )
        .unwrap();

        let card = vault.join("wiki/concepts/vector-search.md");
        assert!(card.is_file());
        let events = std::fs::read_to_string(vault.join(".rhizome/events.jsonl")).unwrap();
        assert!(events.contains("\"type\":\"distill\""));
    }

    #[test]
    fn distill_does_not_seed_a_vault_that_already_has_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write_note(vault, "my-real-note.md", "# Real note\n");

        let _ = distill(vault, "some text", None, None, "manual", None, &mut |_| {});

        assert!(!vault.join("RHIZOME_VAULT.md").exists());
    }

    /// End-to-end over a real on-disk vault: scan → graph → JSON.
    #[test]
    fn build_wiki_graph_returns_parseable_json_with_ghosts() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "notes/alpha.md",
            "---\ntitle: Alpha\n---\n\nLinks to [[Beta]] and [[Never Written]].",
        );
        write_note(
            dir.path(),
            "notes/beta.md",
            "---\ntitle: Beta\n---\n\nBody.",
        );

        let json = build_wiki_graph(dir.path()).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        let nodes = parsed["nodes"].as_array().unwrap();
        let ids: Vec<&str> = nodes.iter().map(|n| n["id"].as_str().unwrap()).collect();
        assert!(ids.contains(&"notes/alpha.md"));
        assert!(ids.contains(&"notes/beta.md"));
        assert!(ids.contains(&"ghost:never written"));

        let ghost = nodes
            .iter()
            .find(|n| n["id"] == "ghost:never written")
            .unwrap();
        assert_eq!(ghost["ghost"], true);
        assert_eq!(parsed["edges"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn search_standalone_builds_when_index_missing() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "wiki/entities/alice.md",
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        );
        let vault = dir.path();
        cleanup_index_dir(vault);

        let json = search_standalone_with_embedder(vault, "distributed", 10, || {
            Ok(Box::new(FakeEmbedder) as Box<dyn TextEmbedder + Send>)
        })
        .unwrap();
        assert!(json.contains("entities/alice.md"));
        cleanup_index_dir(vault);
    }
}
