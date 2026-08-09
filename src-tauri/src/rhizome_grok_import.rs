//! Phase 1b completion (ADR-0152): port `rhizome-grok-import` off the Python
//! CLI. Reads Grok-Wiki's JSON wiki files and writes them as structured
//! Rhizome markdown pages under `sources/repos/<owner>-<repo>/`. Behavior
//! mirrors `rhizome/grok_import.py` 1:1 — this is the last Python dependency
//! in `rhizome_commands.rs`.

use std::io::Write as _;
use std::path::{Path, PathBuf};

use regex::Regex;

use crate::rhizome_write_location::{artifact_dir, ArtifactKind};

/// Default Grok-Wiki data directory Grok Desktop writes its exported wikis
/// to. `None` when `$HOME` can't be resolved (headless/CI).
pub fn default_grok_wiki_dir() -> Option<PathBuf> {
    dirs::home_dir()
        .map(|h| h.join("Library/Application Support/ai.grokwiki.desktop/grok-wiki/users"))
}

/// Find all Grok-Wiki JSON files under `data_dir` (`*/wikis/*.json`), sorted
/// for stable output.
pub fn find_grok_wiki_files(data_dir: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let Ok(users) = std::fs::read_dir(data_dir) else {
        return found;
    };
    for user_entry in users.flatten() {
        let wikis_dir = user_entry.path().join("wikis");
        let Ok(wikis) = std::fs::read_dir(&wikis_dir) else {
            continue;
        };
        for wiki_entry in wikis.flatten() {
            let path = wiki_entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                found.push(path);
            }
        }
    }
    found.sort();
    found
}

/// Convert Grok-Wiki's `<details><summary>` blocks to Rhizome `> [!info]`
/// callouts, strip the remaining HTML tags Grok-Wiki emits, and decode the
/// handful of entities it uses.
pub fn strip_details(html_content: &str) -> String {
    let details_re =
        Regex::new(r"(?s)<details>\s*<summary>([^<]*?)</summary>\s*(.*?)\s*</details>")
            .expect("static regex is valid");
    let converted = details_re.replace_all(html_content, "> [!info] $1\n$2");

    let tags_re = Regex::new(r"(?i)</?(?:br|p|div|span|strong|em|b|i|ul|ol|li|code|pre|hr)\s*/?>")
        .expect("static regex is valid");
    let stripped = tags_re.replace_all(&converted, "");

    stripped
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
        .to_string()
}

/// Convert a single Grok-Wiki page's raw content to Rhizome markdown.
pub fn convert_grok_page(content: &str) -> String {
    let answer_re = Regex::new(r"(?i)</?ANSWER\s*/?>").expect("static regex is valid");
    let unwrapped = answer_re.replace_all(content, "").trim().to_string();
    strip_details(&unwrapped)
}

fn str_field<'a>(data: &'a serde_json::Value, key: &str, default: &'a str) -> &'a str {
    data.get(key).and_then(|v| v.as_str()).unwrap_or(default)
}

fn rhizome_mode(wiki_style: &str) -> &'static str {
    match wiki_style {
        "basic" | "technical" => "architecture",
        "first-30" => "first-hour",
        "feature-scout" => "feature-scout",
        "worth-stealing" => "reusable-patterns",
        "hidden-quirks" => "hidden-lessons",
        "pattern-discovery" => "pattern-discovery",
        "mental-model" => "mental-model",
        "eli5" => "eli5",
        "repo-comparison" => "repo-comparison",
        "debugging-atlas" => "debugging-atlas",
        "tech-reader" => "tech-reader",
        "documentation" => "documentation",
        _ => "architecture",
    }
}

/// Build Rhizome frontmatter from a Grok-Wiki JSON document's top-level
/// metadata (owner/repo/style/model/generatedAt).
pub fn build_frontmatter(data: &serde_json::Value, now: &str) -> String {
    let style = str_field(data, "wikiStyle", "technical");
    let owner = str_field(data, "owner", "unknown");
    let repo = str_field(data, "repo", "unknown");
    let source_url = str_field(data, "repoUrl", "");
    let model = data
        .get("pageModel")
        .and_then(|v| v.as_str())
        .or_else(|| data.get("model").and_then(|v| v.as_str()))
        .unwrap_or("unknown");
    let generated_at = str_field(data, "generatedAt", now);

    format!(
        "---\n\
         type: source\n\
         scope: shared\n\
         agent: grok-wiki\n\
         mode: {mode}\n\
         source_repo: {owner}/{repo}\n\
         source_url: {source_url}\n\
         model: {model}\n\
         generated_at: {generated_at}\n\
         imported_at: {now}\n\
         ---\n\n",
        mode = rhizome_mode(style),
    )
}

/// Extract a page's title from `structure.pages[].title`, falling back to a
/// title-cased derivation from its id (`page-foo-bar` -> `Foo Bar`).
fn page_title(pid: &str, structure: &serde_json::Value) -> String {
    if let Some(pages) = structure.get("pages").and_then(|v| v.as_array()) {
        for p in pages {
            if p.get("id").and_then(|v| v.as_str()) == Some(pid) {
                if let Some(title) = p.get("title").and_then(|v| v.as_str()) {
                    return title.to_string();
                }
            }
        }
    }
    let name = pid.strip_prefix("page-").unwrap_or(pid).replace('-', " ");
    let titled = name
        .split(' ')
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                Some(first) => first.to_uppercase().collect::<String>() + c.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    if titled.is_empty() {
        pid.to_string()
    } else {
        titled
    }
}

/// Result of importing a single Grok-Wiki JSON file.
#[derive(Debug)]
pub struct GrokImportResult {
    pub owner: String,
    pub repo: String,
    pub page_count: usize,
    pub written: Vec<String>,
}

/// Import one Grok-Wiki JSON file into `vault_path`. Placement goes through
/// the shared vault contract (`ArtifactKind::RepoWiki` — nested
/// `wiki/sources/repos/<slug>/` or flat `sources/repos/<slug>/` depending on
/// the vault's layout) rather than the Python CLI's always-flat
/// `<arg>/sources/repos/...`, so imported pages land where search/Library
/// already look. Writes an `index.md`, one `.md` per page, and a
/// `grok-import` `.rhizome/events.jsonl` entry — mirrors
/// `rhizome/grok_import.py::import_wiki` otherwise.
pub fn import_wiki(
    vault_path: &Path,
    json_path: &Path,
    now: &str,
) -> Result<GrokImportResult, String> {
    let raw = std::fs::read_to_string(json_path)
        .map_err(|e| format!("Failed to read {}: {e}", json_path.display()))?;
    let data: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("Invalid Grok-Wiki JSON: {e}"))?;

    let owner = str_field(&data, "owner", "unknown").to_string();
    let repo = str_field(&data, "repo", "unknown").to_string();
    let style = str_field(&data, "wikiStyle", "technical").to_string();
    let slug = format!("{owner}-{repo}");
    let empty_pages = serde_json::Map::new();
    let pages = data
        .get("pages")
        .and_then(|v| v.as_object())
        .unwrap_or(&empty_pages);
    let empty_structure = serde_json::Value::Object(serde_json::Map::new());
    let structure = data.get("structure").unwrap_or(&empty_structure);

    let repo_dir = vault_path
        .join(artifact_dir(vault_path, ArtifactKind::RepoWiki))
        .join(&slug);
    std::fs::create_dir_all(&repo_dir).map_err(|e| format!("Failed to create dir: {e}"))?;

    let page_order: Vec<String> =
        if let Some(struct_pages) = structure.get("pages").and_then(|v| v.as_array()) {
            struct_pages
                .iter()
                .filter_map(|p| p.get("id").and_then(|v| v.as_str()).map(String::from))
                .collect()
        } else {
            pages.keys().cloned().collect()
        };

    let mut written = Vec::new();

    let model = data
        .get("pageModel")
        .and_then(|v| v.as_str())
        .or_else(|| data.get("model").and_then(|v| v.as_str()))
        .unwrap_or("unknown");
    let generated_at = str_field(&data, "generatedAt", "unknown");

    let mut index_content = build_frontmatter(&data, now);
    index_content.push_str(&format!("# {owner}/{repo}\n\n"));
    index_content.push_str(&format!("**Style:** {style}\n"));
    index_content.push_str(&format!("**Pages:** {}\n", pages.len()));
    index_content.push_str(&format!("**Model:** {model}\n"));
    index_content.push_str(&format!("**Generated:** {generated_at}\n\n"));
    if let Some(desc) = structure.get("description").and_then(|v| v.as_str()) {
        if !desc.is_empty() {
            index_content.push_str(&format!("{desc}\n\n"));
        }
    }
    index_content.push_str("## Pages\n\n");
    for pid in &page_order {
        if pages.contains_key(pid) {
            let title = page_title(pid, structure);
            index_content.push_str(&format!("- [[{pid}|{title}]]\n"));
        }
    }
    let index_path = repo_dir.join("index.md");
    std::fs::write(&index_path, &index_content)
        .map_err(|e| format!("Failed to write index.md: {e}"))?;
    written.push(
        index_path
            .strip_prefix(vault_path)
            .unwrap_or(&index_path)
            .to_string_lossy()
            .to_string(),
    );

    for pid in &page_order {
        let Some(page) = pages.get(pid) else { continue };
        let content = page.get("content").and_then(|v| v.as_str()).unwrap_or("");
        if content.is_empty() {
            continue;
        }
        let title = page_title(pid, structure);
        let mut markdown = build_frontmatter(&data, now);
        markdown.push_str(&format!("# {title}\n\n"));
        markdown.push_str(&convert_grok_page(content));
        markdown.push('\n');
        let page_path = repo_dir.join(format!("{pid}.md"));
        std::fs::write(&page_path, &markdown)
            .map_err(|e| format!("Failed to write {pid}.md: {e}"))?;
        written.push(
            page_path
                .strip_prefix(vault_path)
                .unwrap_or(&page_path)
                .to_string_lossy()
                .to_string(),
        );
    }

    append_grok_import_event(vault_path, &owner, &repo, pages.len(), written.len(), now)?;

    Ok(GrokImportResult {
        owner,
        repo,
        page_count: pages.len(),
        written,
    })
}

fn append_grok_import_event(
    vault_path: &Path,
    owner: &str,
    repo: &str,
    page_count: usize,
    file_count: usize,
    now: &str,
) -> Result<(), String> {
    let events_dir = vault_path.join(".rhizome");
    std::fs::create_dir_all(&events_dir).map_err(|e| format!("Failed to create dir: {e}"))?;
    let events_path = events_dir.join("events.jsonl");
    let event = serde_json::json!({
        "type": "grok-import",
        "owner": owner,
        "repo": repo,
        "pages": page_count,
        "files": file_count,
        "timestamp": now,
    });
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&events_path)
        .map_err(|e| format!("Failed to open events log: {e}"))?;
    file.write_all(format!("{event}\n").as_bytes())
        .map_err(|e| format!("Failed to write events log: {e}"))
}

/// Format the `--list` output the same way the Python CLI did.
pub fn format_wiki_listing(files: &[PathBuf]) -> String {
    if files.is_empty() {
        return "No Grok-Wiki files found in default location.".to_string();
    }
    let mut out = format!("Found {} Grok-Wiki wikis:\n\n", files.len());
    for f in files {
        let Ok(raw) = std::fs::read_to_string(f) else {
            continue;
        };
        let Ok(data) = serde_json::from_str::<serde_json::Value>(&raw) else {
            continue;
        };
        let owner = str_field(&data, "owner", "?");
        let repo = str_field(&data, "repo", "?");
        let style = str_field(&data, "wikiStyle", "?");
        let pages = data
            .get("pages")
            .and_then(|v| v.as_object())
            .map(|m| m.len())
            .unwrap_or(0);
        let generated = str_field(&data, "generatedAt", "unknown");
        let generated: String = if generated.chars().count() >= 10 {
            generated.chars().take(10).collect()
        } else {
            "unknown".to_string()
        };
        let name = f.file_name().and_then(|n| n.to_str()).unwrap_or("");
        out.push_str(&format!(
            "  {owner}/{repo:20}  style={style:15}  pages={pages:3}  {generated}  {name}\n"
        ));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn strip_details_converts_to_rhizome_callout() {
        let html = "<details><summary>Note title</summary>Body text</details>";
        assert_eq!(strip_details(html), "> [!info] Note title\nBody text");
    }

    #[test]
    fn strip_details_strips_known_tags_and_decodes_entities() {
        let html = "<p>Hello <strong>World</strong> &amp; friends</p><br/>";
        assert_eq!(strip_details(html), "Hello World & friends");
    }

    #[test]
    fn convert_grok_page_strips_answer_wrapper() {
        let content = "<ANSWER>Some text</ANSWER>";
        assert_eq!(convert_grok_page(content), "Some text");
    }

    #[test]
    fn rhizome_mode_maps_known_styles() {
        assert_eq!(rhizome_mode("first-30"), "first-hour");
        assert_eq!(rhizome_mode("eli5"), "eli5");
        assert_eq!(rhizome_mode("nonsense-style"), "architecture");
    }

    #[test]
    fn build_frontmatter_includes_repo_and_mode() {
        let data = serde_json::json!({
            "owner": "acme", "repo": "widgets", "wikiStyle": "technical",
            "repoUrl": "https://github.com/acme/widgets", "pageModel": "gpt-5",
            "generatedAt": "2026-01-01T00:00:00Z",
        });
        let fm = build_frontmatter(&data, "2026-07-11T00:00:00Z");
        assert!(fm.contains("mode: architecture"));
        assert!(fm.contains("source_repo: acme/widgets"));
        assert!(fm.contains("model: gpt-5"));
        assert!(fm.contains("imported_at: 2026-07-11T00:00:00Z"));
    }

    fn sample_wiki_json() -> serde_json::Value {
        serde_json::json!({
            "owner": "acme",
            "repo": "widgets",
            "wikiStyle": "technical",
            "repoUrl": "https://github.com/acme/widgets",
            "pageModel": "gpt-5",
            "generatedAt": "2026-01-01T00:00:00Z",
            "structure": {
                "description": "Widgets architecture wiki.",
                "pages": [
                    {"id": "page-overview", "title": "Overview"},
                    {"id": "page-internals", "title": "Internals"},
                ]
            },
            "pages": {
                "page-overview": {"content": "<ANSWER><p>Top level overview.</p></ANSWER>"},
                "page-internals": {"content": "<details><summary>Deep dive</summary>Gory details</details>"},
            }
        })
    }

    #[test]
    fn import_wiki_writes_index_and_pages() {
        let dir = TempDir::new().unwrap();
        let json_path = dir.path().join("acme-widgets.json");
        std::fs::write(&json_path, sample_wiki_json().to_string()).unwrap();

        let result = import_wiki(dir.path(), &json_path, "2026-07-11T00:00:00Z").unwrap();

        assert_eq!(result.owner, "acme");
        assert_eq!(result.repo, "widgets");
        assert_eq!(result.page_count, 2);
        assert_eq!(result.written.len(), 3); // index + 2 pages

        let repo_dir = dir.path().join("wiki/sources/repos/acme-widgets");
        let index = std::fs::read_to_string(repo_dir.join("index.md")).unwrap();
        assert!(index.contains("# acme/widgets"));
        assert!(index.contains("[[page-overview|Overview]]"));
        assert!(index.contains("[[page-internals|Internals]]"));

        let overview = std::fs::read_to_string(repo_dir.join("page-overview.md")).unwrap();
        assert!(overview.contains("# Overview"));
        assert!(overview.contains("Top level overview."));
        assert!(!overview.contains("<ANSWER>"));

        let internals = std::fs::read_to_string(repo_dir.join("page-internals.md")).unwrap();
        assert!(internals.contains("> [!info] Deep dive"));
        assert!(internals.contains("Gory details"));
    }

    #[test]
    fn import_wiki_uses_flat_layout_for_flat_layout_vaults() {
        let dir = TempDir::new().unwrap();
        std::fs::write(dir.path().join("RHIZOME_VAULT.md"), "# Rhizome Vault\n").unwrap();
        let json_path = dir.path().join("acme-widgets.json");
        std::fs::write(&json_path, sample_wiki_json().to_string()).unwrap();

        import_wiki(dir.path(), &json_path, "2026-07-11T00:00:00Z").unwrap();

        let repo_dir = dir.path().join("sources/repos/acme-widgets");
        assert!(repo_dir.join("index.md").exists());
        assert!(!dir.path().join("wiki").exists());
    }

    #[test]
    fn import_wiki_skips_pages_with_empty_content() {
        let dir = TempDir::new().unwrap();
        let mut data = sample_wiki_json();
        data["pages"]["page-internals"] = serde_json::json!({"content": ""});
        let json_path = dir.path().join("acme-widgets.json");
        std::fs::write(&json_path, data.to_string()).unwrap();

        let result = import_wiki(dir.path(), &json_path, "2026-07-11T00:00:00Z").unwrap();
        assert_eq!(result.written.len(), 2); // index + only the non-empty page

        let repo_dir = dir.path().join("wiki/sources/repos/acme-widgets");
        assert!(!repo_dir.join("page-internals.md").exists());
    }

    #[test]
    fn import_wiki_appends_events_jsonl() {
        let dir = TempDir::new().unwrap();
        let json_path = dir.path().join("acme-widgets.json");
        std::fs::write(&json_path, sample_wiki_json().to_string()).unwrap();

        import_wiki(dir.path(), &json_path, "2026-07-11T00:00:00Z").unwrap();

        let events = std::fs::read_to_string(dir.path().join(".rhizome/events.jsonl")).unwrap();
        assert!(events.contains("\"type\":\"grok-import\""));
        assert!(events.contains("\"owner\":\"acme\""));
        assert!(events.contains("\"pages\":2"));
    }

    #[test]
    fn import_wiki_rejects_missing_file() {
        let dir = TempDir::new().unwrap();
        let err = import_wiki(dir.path(), &dir.path().join("missing.json"), "now").unwrap_err();
        assert!(err.contains("Failed to read"));
    }

    #[test]
    fn import_wiki_rejects_invalid_json() {
        let dir = TempDir::new().unwrap();
        let json_path = dir.path().join("bad.json");
        std::fs::write(&json_path, "not json").unwrap();
        let err = import_wiki(dir.path(), &json_path, "now").unwrap_err();
        assert!(err.contains("Invalid Grok-Wiki JSON"));
    }

    #[test]
    fn find_grok_wiki_files_scans_user_wikis_dirs() {
        let dir = TempDir::new().unwrap();
        let user_a = dir.path().join("user-a/wikis");
        let user_b = dir.path().join("user-b/wikis");
        std::fs::create_dir_all(&user_a).unwrap();
        std::fs::create_dir_all(&user_b).unwrap();
        std::fs::write(user_a.join("wiki1.json"), "{}").unwrap();
        std::fs::write(user_b.join("wiki2.json"), "{}").unwrap();
        std::fs::write(user_b.join("not-json.txt"), "").unwrap();

        let files = find_grok_wiki_files(dir.path());
        assert_eq!(files.len(), 2);
        assert!(files.iter().all(|f| f.extension().unwrap() == "json"));
    }

    #[test]
    fn find_grok_wiki_files_empty_for_missing_dir() {
        let dir = TempDir::new().unwrap();
        assert!(find_grok_wiki_files(&dir.path().join("nope")).is_empty());
    }

    #[test]
    fn format_wiki_listing_reports_owner_repo_and_page_count() {
        let dir = TempDir::new().unwrap();
        let json_path = dir.path().join("acme-widgets.json");
        std::fs::write(&json_path, sample_wiki_json().to_string()).unwrap();

        let out = format_wiki_listing(&[json_path]);
        assert!(out.contains("Found 1 Grok-Wiki wikis"));
        assert!(out.contains("acme/widgets"));
        assert!(out.contains("pages=  2"));
    }

    #[test]
    fn format_wiki_listing_handles_multi_byte_generated_at() {
        // Regression: `&generated[..10]` byte-slices instead of char-slices,
        // and panics ("byte index 10 is not a char boundary") whenever a
        // multi-byte codepoint straddles byte offset 10 — e.g. four 3-byte
        // '€' is 12 bytes but only 4 chars, so the old `len() >= 10` byte
        // check passed and the byte-slice landed mid-codepoint. Char-counted,
        // 4 chars is under 10, so this correctly falls to "unknown" (Python's
        // under-10 behavior) instead of panicking.
        let dir = TempDir::new().unwrap();
        let mut data = sample_wiki_json();
        data["generatedAt"] = serde_json::json!("€€€€");
        let json_path = dir.path().join("acme-widgets.json");
        std::fs::write(&json_path, data.to_string()).unwrap();

        let out = format_wiki_listing(&[json_path]); // must not panic
        assert!(out.contains("acme/widgets"));
        assert!(out.contains("unknown"));
    }

    #[test]
    fn format_wiki_listing_truncates_multi_byte_generated_at_at_a_char_boundary() {
        // "12345678€9" is 11 chars / 13 bytes, with byte offset 10 landing
        // mid-codepoint inside '€' (bytes 8..11) — exactly what made the old
        // `&generated[..10]` byte-slice panic. Char-counted truncation to 10
        // chars correctly yields "12345678€9"[..10] = "12345678€9"[0..10 chars].
        let dir = TempDir::new().unwrap();
        let mut data = sample_wiki_json();
        data["generatedAt"] = serde_json::json!("12345678€90");
        let json_path = dir.path().join("acme-widgets.json");
        std::fs::write(&json_path, data.to_string()).unwrap();

        let out = format_wiki_listing(&[json_path]); // must not panic
        assert!(out.contains("12345678€9"));
    }

    #[test]
    fn format_wiki_listing_reports_none_found() {
        assert_eq!(
            format_wiki_listing(&[]),
            "No Grok-Wiki files found in default location."
        );
    }
}
