use std::io::Read;
use std::path::Path;
use std::time::Duration;

use crate::hidden_command;
use crate::rhizome_write_location::ArtifactKind;

const CLI_TIMEOUT_SECS: u64 = 120;
const MAX_OUTPUT_BYTES: usize = 1_048_576; // 1MB

/// After a successful Distill/Import/Generate write, mark the vault's warm
/// search index stale so the very next Ask/MCP search reindexes before
/// serving results — otherwise a page written mid-session stays invisible
/// to search until the app restarts (`RhizomeSearchService::invalidate`).
fn invalidate_search_on_success(
    app: &tauri::AppHandle,
    vault_path: &str,
    result: &Result<String, String>,
) {
    use tauri::Manager;

    if result.is_err() {
        return;
    }
    let service = app.state::<crate::rhizome_search::service::RhizomeSearchService>();
    service.invalidate(Path::new(vault_path));
}

/// List the vault's user-authored research formats.
#[tauri::command]
pub fn list_research_formats(
    vault_path: String,
) -> Vec<crate::rhizome_research_formats::CustomFormat> {
    crate::rhizome_research_formats::load(Path::new(&vault_path))
}

/// Save (or replace) one research format and return the full list back, so
/// the caller never has to re-fetch to stay in sync.
#[tauri::command]
pub fn save_research_format(
    vault_path: String,
    title: String,
    instruction: String,
    id: Option<String>,
) -> Result<Vec<crate::rhizome_research_formats::CustomFormat>, String> {
    let id = id
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| crate::rhizome_research_formats::slug_for(&title));
    crate::rhizome_research_formats::save(
        Path::new(&vault_path),
        &crate::rhizome_research_formats::CustomFormat {
            id,
            title: title.trim().to_string(),
            instruction: instruction.trim().to_string(),
        },
    )
}

/// Delete one research format by id, returning the remaining list.
#[tauri::command]
pub fn delete_research_format(
    vault_path: String,
    id: String,
) -> Result<Vec<crate::rhizome_research_formats::CustomFormat>, String> {
    crate::rhizome_research_formats::delete(Path::new(&vault_path), &id)
}

/// Execute a Rhizome CLI tool and return its stdout.
#[tauri::command]
pub fn call_rhizome_tool(
    app: tauri::AppHandle,
    name: String,
    args: std::collections::HashMap<String, String>,
) -> Result<String, String> {
    use tauri::Emitter;
    let run_cli = |args: &[&str]| -> Result<String, String> {
        run_cli_streaming(args, &[], &mut |line: &str| {
            let _ = app.emit("rhizome-progress", serde_json::json!({ "line": line }));
        })
    };
    // Validate vaultPath if present
    if let Some(vp) = args.get("vaultPath") {
        let p = Path::new(vp);
        if !p.exists() {
            return Err(format!("vaultPath does not exist: {}", vp));
        }
        if !p.is_dir() {
            return Err(format!("vaultPath is not a directory: {}", vp));
        }
    }

    match name.as_str() {
        "rhizome_search" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            let query = args.get("query").ok_or("Missing query")?;
            let limit: usize = args.get("limit").and_then(|s| s.parse().ok()).unwrap_or(10);
            search_rhizome_wiki_local(&app, vault, query, limit)
        }
        "rhizome_lint" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            run_cli(&["rhizome-lint", vault, "--format", "text"])
        }
        "rhizome_graph_summary" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            run_cli(&["rhizome-graph", "summary", vault])
        }
        name if name.starts_with("rhizome_graph_") && name != "rhizome_graph_summary" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            let query = crate::rhizome_api::graph_query_from_tool(name, &args)?;
            crate::rhizome_api::graph_query(Path::new(vault), &query)
        }
        "rhizome_wiki_graph" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            crate::rhizome_api::build_wiki_graph(Path::new(vault))
        }
        // The write verbs share one resolver with the async job path
        // (`rhizome_jobs::build_verb_call`) so the caller-supplied `trigger`
        // is decided in exactly one place. `rhizome_save_capture` runs no
        // agent, so it is only ever reached here — a cancel affordance for a
        // few-millisecond file write would be noise.
        "rhizome_distill"
        | "rhizome_import_source"
        | "rhizome_repo_research"
        | "rhizome_save_capture" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            let result = crate::rhizome_jobs::build_verb_call(&name, &args)?.execute(
                Path::new(vault),
                &mut |line: &str| {
                    let _ = app.emit("rhizome-progress", serde_json::json!({ "line": line }));
                },
            );
            invalidate_search_on_success(&app, vault, &result);
            result
        }
        "rhizome_scan_library" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            scan_vault_library(vault)
        }
        "rhizome_read_events" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            read_vault_events(vault)
        }
        "rhizome_append_event" => {
            let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
            let event_type = args
                .get("type")
                .map(String::as_str)
                .filter(|t| !t.is_empty())
                .unwrap_or("capture");
            let artifact_path = args
                .get("artifact_path")
                .or_else(|| args.get("artifactPath"))
                .ok_or("Missing artifact_path")?;
            let trigger = resolve_append_event_trigger(args.get("trigger").map(String::as_str));
            let project = args.get("project").filter(|p| !p.is_empty());
            crate::rhizome_distill::append_vault_event(
                Path::new(vault),
                event_type,
                project.map(String::as_str),
                trigger,
                artifact_path,
            )?;
            Ok(serde_json::json!({ "ok": true }).to_string())
        }
        _ => Err(format!("Unknown tool: {}", name)),
    }
}

/// Run a CLI, invoking `on_line` for every stdout line as it arrives.
/// Collected stdout (capped at MAX_OUTPUT_BYTES) is returned on success.
/// `envs` are set on the child process (e.g. `GIT_TERMINAL_PROMPT=0` for
/// the repo-research clone path).
pub(crate) fn run_cli_streaming(
    args: &[&str],
    envs: &[(&str, &str)],
    on_line: &mut dyn FnMut(&str),
) -> Result<String, String> {
    use std::io::BufRead;

    if args.is_empty() {
        return Err("Empty command".into());
    }
    let mut child = hidden_command(args[0])
        .args(&args[1..])
        .envs(
            envs.iter()
                .copied()
                .map(|(k, v)| (k.to_string(), v.to_string())),
        )
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", args[0], e))?;

    // Reader thread streams stdout lines over a channel while we poll for exit.
    let (tx, rx) = std::sync::mpsc::channel::<String>();
    let stdout_pipe = child.stdout.take();
    let reader = std::thread::spawn(move || {
        if let Some(out) = stdout_pipe {
            for line in std::io::BufReader::new(out).lines().map_while(Result::ok) {
                if tx.send(line).is_err() {
                    break;
                }
            }
        }
    });

    let mut collected = String::new();
    let drain = |collected: &mut String, on_line: &mut dyn FnMut(&str)| {
        while let Ok(line) = rx.try_recv() {
            on_line(&line);
            if collected.len() < MAX_OUTPUT_BYTES {
                collected.push_str(&line);
                collected.push('\n');
            }
        }
    };

    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(CLI_TIMEOUT_SECS);
    loop {
        drain(&mut collected, on_line);
        match child.try_wait() {
            Ok(Some(status)) => {
                let _ = reader.join();
                drain(&mut collected, on_line);
                if status.success() {
                    return Ok(collected);
                }
                let stderr = child
                    .stderr
                    .as_mut()
                    .map(|s| {
                        let mut buf = Vec::new();
                        s.read_to_end(&mut buf).ok();
                        String::from_utf8_lossy(&buf).to_string()
                    })
                    .unwrap_or_default();
                return Err(format!("{} failed: {}", args[0], stderr.trim()));
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("{} timed out after {}s", args[0], CLI_TIMEOUT_SECS));
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => return Err(format!("{} process error: {}", args[0], e)),
        }
    }
}

/// Search the vault's Rhizome `wiki/` tree via the resident Rust index
/// (One Brain step 3b) instead of shelling the Python `rhizome-search` CLI.
/// The index is lazily built on first use per vault and kept warm in
/// `RhizomeSearchService` for the rest of the app session.
fn search_rhizome_wiki_local(
    app: &tauri::AppHandle,
    vault_path: &str,
    query: &str,
    limit: usize,
) -> Result<String, String> {
    use tauri::Manager;

    let service = app.state::<crate::rhizome_search::service::RhizomeSearchService>();
    crate::rhizome_api::search_with_service(service.inner(), Path::new(vault_path), query, limit)
}

/// Scan the vault's artifact tree (see `docs/VAULT_CONTRACT.md`) and return
/// JSON with found items, one artifact kind at a time. Scans the nested
/// `wiki/` layout, or the flat pre-`wiki/` layout for vaults that already
/// use it (see `rhizome_write_location::vault_uses_flat_layout`).
fn scan_vault_library(vault_path: &str) -> Result<String, String> {
    let vault = Path::new(vault_path);
    let mut items: Vec<String> = Vec::new();

    for kind in ArtifactKind::ALL {
        let rel_dir = crate::rhizome_write_location::artifact_dir(vault, kind);
        let dir = vault.join(rel_dir);
        scan_dir_items(&dir, kind.item_type(), kind.tag(), rel_dir, &mut items);
    }

    Ok(format!("[{}]", items.join(",")))
}

fn scan_dir_items(
    dir: &std::path::Path,
    item_type: &str,
    tag: &str,
    relative_prefix: &str,
    items: &mut Vec<String>,
) {
    use std::fs;

    if !dir.is_dir() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".md") {
                continue;
            }
            let modified = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let title = name
                .strip_suffix(".md")
                .unwrap_or(&name)
                .replace(['-', '_'], " ");
            let desc_str = if let Ok(content) = fs::read_to_string(&path) {
                content
                    .lines()
                    .skip_while(|l| l.starts_with("---"))
                    .skip(1)
                    .find(|l| !l.starts_with("---") && !l.trim().is_empty())
                    .map(|l| l.trim().to_string())
                    .unwrap_or_default()
            } else {
                String::new()
            };
            let relative_path = format!("{}/{}", relative_prefix, name);
            items.push(format!(
                r#"{{"id":"{}","path":"{}","title":"{}","description":"{}","type":"{}","tag":"{}","date":{}}}"#,
                name, relative_path, title, desc_str.replace('"', "'"), item_type, tag, modified
            ));
        }
    }
}

/// Resolve the `trigger` recorded by the `rhizome_append_event` verb.
///
/// Defaults to `"mcp"`, **not** `"menu_bar"`. This verb is reachable by any
/// external agent over the MCP bridge, so the old default silently
/// attributed every agent save to the menu-bar companion — the most specific
/// UI surface in the app, and almost never the actual origin. See
/// `docs/plans/2026-07-31-save-path-audit-session-status.md` finding 5.
///
/// Split out of the dispatcher because that takes a `tauri::AppHandle` and
/// cannot be unit-tested; this mirrors the resolution/execution split
/// `rhizome_jobs::build_verb_call` already uses.
///
/// Note the value is still an arbitrary caller-supplied string — there is no
/// allow-list, and adding one is deliberately out of scope until the trigger
/// vocabulary is settled.
fn resolve_append_event_trigger(explicit: Option<&str>) -> &str {
    match explicit {
        Some(trigger) if !trigger.is_empty() => trigger,
        _ => "mcp",
    }
}

/// Read vault events from .rhizome/events.jsonl, newest first.
fn read_vault_events(vault_path: &str) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let events_path = Path::new(vault_path).join(".rhizome").join("events.jsonl");
    if !events_path.exists() {
        return Ok("[]".to_string());
    }
    let content =
        fs::read_to_string(&events_path).map_err(|e| format!("Failed to read events: {}", e))?;

    // Parse per line and drop what doesn't parse, rather than concatenating
    // raw lines into `[...]`. The log is append-only across schema versions
    // and written by several paths, so a blank line, a truncated final
    // append, or a hand-edit is realistic — and the frontend parses the whole
    // batch in one `JSON.parse` inside a bare `catch {}`
    // (useMenuBarCompanionVault.ts), so malformed output blanks the entire
    // activity feed silently instead of degrading. Skipping after `.rev()`
    // and before `.take(200)` also means bad lines don't consume window slots.
    let events: Vec<serde_json::Value> = content
        .lines()
        .rev()
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .take(200)
        .collect();
    serde_json::to_string(&events).map_err(|e| format!("Failed to encode events: {}", e))
}

#[cfg(test)]
mod append_event_trigger_tests {
    use super::*;

    /// Finding 5: the old default was "menu_bar", which attributed every
    /// agent save to the menu-bar companion.
    #[test]
    fn defaults_to_mcp_when_the_caller_says_nothing() {
        assert_eq!(resolve_append_event_trigger(None), "mcp");
    }

    #[test]
    fn treats_an_empty_string_as_unset() {
        assert_eq!(resolve_append_event_trigger(Some("")), "mcp");
    }

    #[test]
    fn honours_an_explicit_trigger() {
        assert_eq!(resolve_append_event_trigger(Some("inbox")), "inbox");
    }
}

#[cfg(test)]
mod read_vault_events_tests {
    use super::*;

    fn vault_with_events(lines: &str) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".rhizome")).unwrap();
        std::fs::write(dir.path().join(".rhizome/events.jsonl"), lines).unwrap();
        dir
    }

    fn read(dir: &tempfile::TempDir) -> Vec<serde_json::Value> {
        let raw = read_vault_events(dir.path().to_str().unwrap()).unwrap();
        serde_json::from_str(&raw).expect("read_vault_events must return parseable JSON")
    }

    #[test]
    fn returns_empty_array_when_no_events_file() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            read_vault_events(dir.path().to_str().unwrap()).unwrap(),
            "[]"
        );
    }

    #[test]
    fn returns_newest_first() {
        let dir =
            vault_with_events("{\"type\":\"distill\",\"n\":1}\n{\"type\":\"capture\",\"n\":2}\n");
        let events = read(&dir);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["n"], 2, "newest event must come first");
    }

    /// The whole point: one bad line must not take out the other 199.
    /// The frontend does a single JSON.parse inside a bare `catch {}`
    /// (useMenuBarCompanionVault.ts), so invalid output blanks the feed
    /// silently rather than degrading.
    #[test]
    fn skips_a_malformed_line_and_keeps_the_rest() {
        let dir = vault_with_events(
            "{\"type\":\"distill\",\"n\":1}\nthis is not json\n{\"type\":\"capture\",\"n\":2}\n",
        );
        let events = read(&dir);
        assert_eq!(
            events.len(),
            2,
            "valid events must survive a malformed neighbour"
        );
        assert_eq!(events[0]["n"], 2);
        assert_eq!(events[1]["n"], 1);
    }

    /// A blank line is the likeliest real corruption and already breaks the
    /// old string-concatenation path, which emits `[{..},,{..}]`.
    #[test]
    fn skips_blank_lines() {
        let dir =
            vault_with_events("{\"type\":\"distill\",\"n\":1}\n\n{\"type\":\"capture\",\"n\":2}\n");
        let events = read(&dir);
        assert_eq!(events.len(), 2);
    }

    /// A truncated final line is what an interrupted append leaves behind.
    #[test]
    fn skips_a_truncated_trailing_line() {
        let dir = vault_with_events("{\"type\":\"distill\",\"n\":1}\n{\"type\":\"capt");
        let events = read(&dir);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["n"], 1);
    }

    /// Malformed lines must not consume slots in the 200-event window.
    #[test]
    fn caps_at_200_valid_events_not_200_lines() {
        // Garbage must sit at the END: the reader walks backwards from the
        // newest line, so leading garbage would never be reached and the
        // test would pass without exercising anything.
        let mut lines = String::new();
        for n in 0..250 {
            lines.push_str(&format!("{{\"type\":\"distill\",\"n\":{n}}}\n"));
        }
        for _ in 0..50 {
            lines.push_str("garbage\n");
        }
        let dir = vault_with_events(&lines);
        let events = read(&dir);
        assert_eq!(events.len(), 200, "garbage must not consume window slots");
        assert_eq!(events[0]["n"], 249, "newest valid event first");
    }
}

#[cfg(test)]
mod library_scan_tests {
    use super::*;

    #[test]
    fn scan_vault_library_emits_vault_relative_paths_per_category() {
        let vault = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(vault.path().join("wiki/sources/repos")).unwrap();
        std::fs::create_dir_all(vault.path().join("wiki/sources/documents")).unwrap();
        std::fs::create_dir_all(vault.path().join("wiki/entities")).unwrap();
        std::fs::create_dir_all(vault.path().join("wiki/concepts")).unwrap();
        std::fs::write(
            vault.path().join("wiki/sources/repos/my-repo.md"),
            "# My Repo\n\nA wiki.",
        )
        .unwrap();
        std::fs::write(
            vault.path().join("wiki/sources/documents/paper.md"),
            "# Paper\n\nA doc.",
        )
        .unwrap();
        std::fs::write(
            vault.path().join("wiki/entities/alice.md"),
            "# Alice\n\nA person.",
        )
        .unwrap();
        std::fs::write(
            vault.path().join("wiki/concepts/recursion.md"),
            "# Recursion\n\nA concept.",
        )
        .unwrap();

        let json = scan_vault_library(vault.path().to_str().unwrap()).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        let items = parsed.as_array().unwrap();
        assert_eq!(items.len(), 4);

        let path_for = |name: &str| {
            items
                .iter()
                .find(|item| item["id"] == name)
                .and_then(|item| item["path"].as_str())
                .map(|s| s.to_string())
        };

        assert_eq!(
            path_for("my-repo.md"),
            Some("wiki/sources/repos/my-repo.md".to_string())
        );
        assert_eq!(
            path_for("paper.md"),
            Some("wiki/sources/documents/paper.md".to_string())
        );
        assert_eq!(
            path_for("alice.md"),
            Some("wiki/entities/alice.md".to_string())
        );
        assert_eq!(
            path_for("recursion.md"),
            Some("wiki/concepts/recursion.md".to_string())
        );
    }

    /// C17: on a nested `wiki/`-layout vault, Ask/search results and
    /// Library-panel items must agree on the path for the *same* file —
    /// both vault-root-relative, both carrying the `wiki/` prefix. Before
    /// the fix, `format_search_hits` returned the search index's own
    /// wiki-root-relative id (`"entities/alice.md"`, no prefix) while
    /// `scan_vault_library` returned the vault-root-relative
    /// `"wiki/entities/alice.md"` — silently wrong `onOpenNote` resolution
    /// for Ask results the moment a vault used the nested layout. See
    /// C17-OPEN in docs/HANDOFF.md.
    #[test]
    fn search_result_path_matches_library_scan_path_on_nested_layout() {
        let vault = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(vault.path().join("wiki/entities")).unwrap();
        std::fs::write(
            vault.path().join("wiki/entities/alice.md"),
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        )
        .unwrap();

        // Library-panel path for this file.
        let library_json = scan_vault_library(vault.path().to_str().unwrap()).unwrap();
        let library_items: serde_json::Value = serde_json::from_str(&library_json).unwrap();
        let library_path = library_items
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["id"] == "alice.md")
            .and_then(|item| item["path"].as_str())
            .map(|s| s.to_string())
            .expect("alice.md should appear in the library scan");

        // Search-result path for the same file: `hit.id` is wiki-root-relative
        // (the search index's own on-disk convention, unchanged by the fix)
        // the way `RhizomeSearchIndex::search` would actually produce it.
        let hit = crate::rhizome_search::SearchHit {
            id: "entities/alice.md".to_string(),
            path: "entities/alice.md".to_string(),
            title: "Alice".to_string(),
            score: 1.0,
        };
        let search_json =
            crate::rhizome_api::format_search_hits(vault.path(), "distributed", vec![hit]).unwrap();
        let search_results: serde_json::Value = serde_json::from_str(&search_json).unwrap();
        let search_path = search_results
            .as_array()
            .unwrap()
            .first()
            .and_then(|r| r["path"].as_str())
            .map(|s| s.to_string())
            .expect("search results should contain one hit");

        assert_eq!(
            search_path, library_path,
            "Ask-result and Library-panel paths must be byte-identical for the same file"
        );
        assert_eq!(search_path, "wiki/entities/alice.md");
    }

    #[test]
    fn scan_vault_library_scans_flat_layout_when_vault_has_no_wiki_dir() {
        let vault = tempfile::tempdir().unwrap();
        std::fs::write(vault.path().join("RHIZOME_VAULT.md"), "# Rhizome Vault\n").unwrap();
        std::fs::create_dir_all(vault.path().join("concepts")).unwrap();
        std::fs::create_dir_all(vault.path().join("sources/repos")).unwrap();
        std::fs::write(
            vault.path().join("concepts/recursion.md"),
            "# Recursion\n\nA concept.",
        )
        .unwrap();
        std::fs::write(
            vault.path().join("sources/repos/my-repo.md"),
            "# My Repo\n\nA wiki.",
        )
        .unwrap();

        let json = scan_vault_library(vault.path().to_str().unwrap()).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        let items = parsed.as_array().unwrap();
        assert_eq!(items.len(), 2);

        let path_for = |name: &str| {
            items
                .iter()
                .find(|item| item["id"] == name)
                .and_then(|item| item["path"].as_str())
                .map(|s| s.to_string())
        };
        assert_eq!(
            path_for("recursion.md"),
            Some("concepts/recursion.md".to_string())
        );
        assert_eq!(
            path_for("my-repo.md"),
            Some("sources/repos/my-repo.md".to_string())
        );
        assert!(!vault.path().join("wiki").exists());
    }

    #[test]
    fn run_cli_streaming_reports_each_stdout_line_and_collects_output() {
        let mut lines: Vec<String> = Vec::new();
        let out = run_cli_streaming(
            &["sh", "-c", "printf 'first\\nsecond\\n'"],
            &[],
            &mut |line| lines.push(line.to_string()),
        )
        .unwrap();
        assert_eq!(lines, vec!["first", "second"]);
        assert_eq!(out, "first\nsecond\n");
    }

    #[test]
    fn run_cli_streaming_surfaces_stderr_on_failure() {
        let err = run_cli_streaming(&["sh", "-c", "echo boom >&2; exit 3"], &[], &mut |_| {})
            .unwrap_err();
        assert!(err.contains("boom"), "unexpected error: {err}");
    }

    #[test]
    fn run_cli_streaming_sets_child_env() {
        let out = run_cli_streaming(
            &["sh", "-c", "printf '%s' \"$MARKER\""],
            &[("MARKER", "env-visible")],
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(out, "env-visible\n");
    }

    #[test]
    fn scan_vault_library_returns_empty_array_for_empty_vault() {
        let vault = tempfile::tempdir().unwrap();
        let json = scan_vault_library(vault.path().to_str().unwrap()).unwrap();
        assert_eq!(json, "[]");
    }
}
