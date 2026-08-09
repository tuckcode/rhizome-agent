//! The `inbox_action` frontmatter contract: how a file dropped in
//! `<vault>/raw/inbox/` declares what should happen to it, instead of leaving
//! the decision to `classify_inbox_file`'s extension heuristic.
//!
//! See `docs/adr/0158-inbox-action-frontmatter-contract.md`.

use std::collections::HashMap;
use std::path::Path;

/// Frontmatter key a capture writes to declare its own routing.
pub const INBOX_ACTION_KEY: &str = "inbox_action";

/// What should happen to a file dropped in `raw/inbox/`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InboxAction {
    /// File the capture into the vault as-is. No agent call, no tokens.
    Save,
    /// Distill the file's text into a Concept card.
    Distill,
    /// Import the source — fetch a URL, convert a document — as a Document.
    Import,
}

impl InboxAction {
    /// Parse a declared `inbox_action:` value. Unknown values return `None` so
    /// the caller falls back to the extension heuristic rather than guessing.
    pub fn from_declared(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "save" => Some(InboxAction::Save),
            "distill" => Some(InboxAction::Distill),
            "import" => Some(InboxAction::Import),
            _ => None,
        }
    }

    /// The canonical `inbox_action:` value for this action.
    pub fn as_str(self) -> &'static str {
        match self {
            InboxAction::Save => "save",
            InboxAction::Distill => "distill",
            InboxAction::Import => "import",
        }
    }
}

/// A capture's frontmatter fields (scalar values only) and its body.
struct Capture {
    fields: HashMap<String, String>,
    body: String,
}

impl Capture {
    fn field(&self, key: &str) -> Option<&str> {
        self.fields
            .get(key)
            .map(String::as_str)
            .filter(|v| !v.is_empty())
    }
}

/// Split `content` into its frontmatter scalars and its body. A file with no
/// frontmatter yields no fields and the whole file as body.
fn parse_capture(content: &str) -> Capture {
    let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
    let parsed = matter.parse(content);
    let mut fields = HashMap::new();
    if let Some(gray_matter::Pod::Hash(map)) = parsed.data {
        for (key, value) in map {
            if let Ok(text) = value.as_string() {
                fields.insert(key, text);
            }
        }
    }
    Capture {
        fields,
        body: parsed.content,
    }
}

/// The `inbox_action` a markdown capture declares in its own frontmatter.
pub fn declared_inbox_action(content: &str) -> Option<InboxAction> {
    InboxAction::from_declared(parse_capture(content).field(INBOX_ACTION_KEY)?)
}

/// Read a markdown file's declared `inbox_action`. Non-markdown files never
/// carry frontmatter, so they are not read at all.
pub fn declared_inbox_action_in_file(path: &Path) -> Option<InboxAction> {
    let is_markdown = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("md") || e.eq_ignore_ascii_case("markdown"));
    if !is_markdown {
        return None;
    }
    declared_inbox_action(&std::fs::read_to_string(path).ok()?)
}

/// A page to file into the vault with no agent involved, as sent by whichever
/// producer captured it — the browser extension over the bridge, or a
/// `raw/inbox/` drop that declared `inbox_action: save`.
///
/// Only `source` is load-bearing; the rest may be empty. A "Save URL" with no
/// readable title and no article text is a legitimate capture — the link is
/// the point.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CaptureRequest {
    pub title: String,
    pub source: String,
    pub context: String,
    pub body: String,
}

/// File a capture into the vault as a Document artifact — the save-only lane,
/// with no agent involved. Returns a human-readable summary the way the agent
/// verbs do, and logs a `type:"capture"` event carrying `trigger` verbatim.
///
/// An empty `title` falls back to the source, so a bare link is filed under
/// its own URL rather than as "untitled".
pub fn save_capture(
    vault_path: &Path,
    capture: &CaptureRequest,
    trigger: &str,
) -> Result<String, String> {
    let title = if capture.title.is_empty() {
        capture.source.clone()
    } else {
        capture.title.clone()
    };
    let card = crate::rhizome_distill::ParsedCard {
        title,
        context: capture.context.clone(),
        body: capture.body.clone(),
    };
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let (slug, path) = crate::rhizome_import::write_imported_document(
        vault_path,
        &card,
        &capture.source,
        None,
        &today,
    )?;
    let artifact_path = crate::rhizome_write_location::relative_to_vault(vault_path, &path);
    crate::rhizome_distill::append_vault_event(
        vault_path,
        "capture",
        None,
        trigger,
        &artifact_path,
    )?;
    Ok(format!("Saved \"{}\" as {slug}.md", card.title))
}

/// Read a `raw/inbox/` drop into a [`CaptureRequest`] and file it via
/// [`save_capture`].
///
/// The capture's own frontmatter is *read*, never copied through: the filed
/// page gets contract frontmatter built by
/// [`crate::rhizome_import::import_frontmatter`], so routing directives like
/// `inbox_action:` stay out of the vault.
pub fn save_captured_file(
    vault_path: &Path,
    file_path: &Path,
    trigger: &str,
) -> Result<String, String> {
    let content = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read capture {}: {e}", file_path.display()))?;
    let parsed = parse_capture(&content);

    let stem = || {
        file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("untitled")
            .to_string()
    };
    let capture = CaptureRequest {
        title: parsed
            .field("title")
            .map(str::to_string)
            .unwrap_or_else(stem),
        // `source_url` is what a browser capture sends; `source` is what a
        // hand-written drop is more likely to use. Neither is required — a
        // plain dropped file is its own source.
        source: parsed
            .field("source_url")
            .or_else(|| parsed.field("source"))
            .map(str::to_string)
            .unwrap_or_else(|| {
                file_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(stem)
            }),
        context: parsed.field("context").unwrap_or_default().to_string(),
        body: parsed.body.trim().to_string(),
    };
    save_capture(vault_path, &capture, trigger)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(dir: &Path, name: &str, content: &str) -> std::path::PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn parses_every_declared_action_case_insensitively() {
        for (declared, expected) in [
            ("save", InboxAction::Save),
            ("Save", InboxAction::Save),
            ("  DISTILL  ", InboxAction::Distill),
            ("import", InboxAction::Import),
        ] {
            assert_eq!(
                InboxAction::from_declared(declared),
                Some(expected),
                "{declared}"
            );
        }
    }

    #[test]
    fn unknown_declared_action_is_none_not_a_guess() {
        for declared in ["", "  ", "archive", "distil", "save-url"] {
            assert_eq!(InboxAction::from_declared(declared), None, "{declared}");
        }
    }

    #[test]
    fn action_round_trips_through_its_canonical_string() {
        for action in [InboxAction::Save, InboxAction::Distill, InboxAction::Import] {
            assert_eq!(InboxAction::from_declared(action.as_str()), Some(action));
        }
    }

    #[test]
    fn reads_the_declared_action_out_of_frontmatter() {
        let content = "---\ntitle: A Page\ninbox_action: save\nsource_url: https://example.com/a\n---\n\nBody text.\n";
        assert_eq!(declared_inbox_action(content), Some(InboxAction::Save));
    }

    #[test]
    fn no_frontmatter_or_no_key_declares_nothing() {
        for content in [
            "Just prose, no frontmatter at all.\n",
            "---\ntitle: A Page\n---\n\nBody.\n",
            "---\ntitle: A Page\ninbox_action: shred\n---\n\nBody.\n",
        ] {
            assert_eq!(declared_inbox_action(content), None, "{content}");
        }
    }

    #[test]
    fn only_markdown_files_are_read_for_a_declared_action() {
        let dir = tempfile::tempdir().unwrap();
        let declared = "---\ninbox_action: distill\n---\n\nBody.\n";
        assert_eq!(
            declared_inbox_action_in_file(&write(dir.path(), "page.md", declared)),
            Some(InboxAction::Distill)
        );
        // A .txt or .pdf never carries frontmatter — don't read it looking for
        // one (a PDF isn't even UTF-8).
        assert_eq!(
            declared_inbox_action_in_file(&write(dir.path(), "page.txt", declared)),
            None
        );
        assert_eq!(
            declared_inbox_action_in_file(&write(dir.path(), "paper.pdf", declared)),
            None
        );
        assert_eq!(
            declared_inbox_action_in_file(&dir.path().join("missing.md")),
            None
        );
    }

    #[test]
    fn save_writes_a_document_artifact_without_an_agent() {
        let vault = tempfile::tempdir().unwrap();
        let inbox = vault.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();
        let file = write(
            &inbox,
            "capture.md",
            "---\ntitle: Idempotency Explained\ninbox_action: save\nsource_url: https://example.com/idempotency\ncontext: A short primer.\n---\n\nPUT is idempotent; POST is not.\n",
        );

        let summary = save_captured_file(vault.path(), &file, "browser_extension").unwrap();
        assert!(summary.contains("Idempotency Explained"), "got: {summary}");

        let written = vault
            .path()
            .join("wiki/sources/documents/idempotency-explained.md");
        let contents = std::fs::read_to_string(&written).expect("document should be written");
        assert!(contents.contains("title: Idempotency Explained"));
        assert!(contents.contains("type: source"));
        assert!(contents.contains("source: https://example.com/idempotency"));
        assert!(contents.contains("context: A short primer."));
        assert!(contents.contains("PUT is idempotent; POST is not."));
        // The capture's own routing directive is an instruction to the inbox,
        // not content — it must not end up in the filed page.
        assert!(!contents.contains(INBOX_ACTION_KEY));
    }

    #[test]
    fn save_logs_a_capture_event_carrying_the_callers_trigger() {
        let vault = tempfile::tempdir().unwrap();
        let inbox = vault.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();
        let file = write(
            &inbox,
            "capture.md",
            "---\ntitle: A Page\ninbox_action: save\n---\n\nBody.\n",
        );

        save_captured_file(vault.path(), &file, "browser_extension").unwrap();

        let events = std::fs::read_to_string(vault.path().join(".rhizome/events.jsonl")).unwrap();
        let event: serde_json::Value = serde_json::from_str(events.trim()).unwrap();
        assert_eq!(event["type"], "capture");
        assert_eq!(event["trigger"], "browser_extension");
        assert_eq!(event["artifact_path"], "wiki/sources/documents/a-page.md");
    }

    #[test]
    fn save_falls_back_to_the_file_stem_when_no_title_is_declared() {
        let vault = tempfile::tempdir().unwrap();
        let inbox = vault.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();
        let file = write(
            &inbox,
            "some-dropped-page.md",
            "Body with no frontmatter.\n",
        );

        save_captured_file(vault.path(), &file, "inbox").unwrap();

        let written = vault
            .path()
            .join("wiki/sources/documents/some-dropped-page.md");
        let contents = std::fs::read_to_string(&written).expect("document should be written");
        assert!(contents.contains("title: some-dropped-page"));
        assert!(contents.contains("Body with no frontmatter."));
    }

    #[test]
    fn save_capture_files_a_page_sent_as_fields_with_no_file_on_disk() {
        let vault = tempfile::tempdir().unwrap();
        let summary = save_capture(
            vault.path(),
            &CaptureRequest {
                title: "Idempotency Explained".to_string(),
                source: "https://example.com/idempotency".to_string(),
                context: "A short primer.".to_string(),
                body: "PUT is idempotent; POST is not.".to_string(),
            },
            "browser_extension",
        )
        .unwrap();
        assert!(summary.contains("Idempotency Explained"), "got: {summary}");

        let contents = std::fs::read_to_string(
            vault
                .path()
                .join("wiki/sources/documents/idempotency-explained.md"),
        )
        .expect("document should be written");
        assert!(contents.contains("title: Idempotency Explained"));
        assert!(contents.contains("type: source"));
        assert!(contents.contains("source: https://example.com/idempotency"));
        assert!(contents.contains("context: A short primer."));
        assert!(contents.contains("PUT is idempotent; POST is not."));

        let events = std::fs::read_to_string(vault.path().join(".rhizome/events.jsonl")).unwrap();
        let event: serde_json::Value = serde_json::from_str(events.trim()).unwrap();
        assert_eq!(event["type"], "capture");
        assert_eq!(event["trigger"], "browser_extension");
    }

    #[test]
    fn save_capture_titles_a_bare_link_by_its_url() {
        // "Save URL" on a page whose title the extension could not read: the
        // link is still the whole point, so it must not become "untitled".
        let vault = tempfile::tempdir().unwrap();
        save_capture(
            vault.path(),
            &CaptureRequest {
                title: String::new(),
                source: "https://example.com/deep/article".to_string(),
                context: String::new(),
                body: String::new(),
            },
            "browser_extension",
        )
        .unwrap();

        let docs = vault.path().join("wiki/sources/documents");
        let written: Vec<_> = std::fs::read_dir(&docs)
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        assert_eq!(written.len(), 1);
        let contents = std::fs::read_to_string(&written[0]).unwrap();
        assert!(
            contents.contains("title: https://example.com/deep/article"),
            "got: {contents}"
        );
    }

    #[test]
    fn save_dedupes_rather_than_overwriting_an_existing_page() {
        let vault = tempfile::tempdir().unwrap();
        let inbox = vault.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();

        let first = write(&inbox, "a-page.md", "---\ntitle: A Page\n---\n\nFirst.\n");
        save_captured_file(vault.path(), &first, "browser_extension").unwrap();
        let second = write(
            &inbox,
            "a-page-again.md",
            "---\ntitle: A Page\n---\n\nSecond.\n",
        );
        save_captured_file(vault.path(), &second, "browser_extension").unwrap();

        let docs = vault.path().join("wiki/sources/documents");
        assert!(docs.join("a-page.md").is_file());
        assert!(docs.join("a-page-2.md").is_file());
        assert!(std::fs::read_to_string(docs.join("a-page.md"))
            .unwrap()
            .contains("First."));
    }
}
