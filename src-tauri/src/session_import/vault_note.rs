//! Turning an imported session into a vault note.
//!
//! This is the destination that always runs when a vault is attached, and the
//! one that carries the memory story: a note is searchable years later, whereas
//! a session-list row is a convenience. It is also the cheap one — writing a
//! file costs nothing and displaces nothing, which is why selection only limits
//! the *other* destination.
//!
//! Layout and frontmatter follow the plan's decided shape:
//! `Imports/<source>/<yyyy-mm-dd>-<slug>.md`, `type: Imported Session`.

use crate::rhizome_distill::slugify;
use crate::session_import::fingerprint::ImportedMessage;

/// Top-level folder that holds every import, whatever its source.
pub const IMPORTS_FOLDER: &str = "Imports";
/// Frontmatter type, so imports can be found as a category as well as a folder.
pub const IMPORTED_SESSION_TYPE: &str = "Imported Session";

/// Longest slug in a filename, so one long opening message cannot produce a
/// path the filesystem refuses.
const MAX_SLUG_CHARS: usize = 60;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultNoteRequest {
    pub source_app: String,
    pub source_session_id: String,
    pub title: String,
    pub messages: Vec<ImportedMessage>,
    /// `yyyy-mm-dd` for the filename; the day the conversation started.
    pub started_on: String,
    /// ISO-8601, when this import ran.
    pub imported_at: String,
    pub content_fingerprint: String,
    /// Present once the session-list copy exists, absent for vault-only imports.
    pub prime_session_id: Option<String>,
    /// The app this thread originally came from, when the source declares it.
    pub original_app: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultNote {
    /// Vault-relative path, `/`-separated.
    pub relative_path: String,
    pub contents: String,
}

/// Where an imported session's note belongs, relative to the vault root.
pub fn note_relative_path(source_app: &str, started_on: &str, title: &str) -> String {
    let source = slugify(source_app);
    let slug = bounded_slug(title);
    format!("{IMPORTS_FOLDER}/{source}/{started_on}-{slug}.md")
}

fn bounded_slug(title: &str) -> String {
    let slug = slugify(title);
    if slug.chars().count() <= MAX_SLUG_CHARS {
        return slug;
    }
    let truncated: String = slug.chars().take(MAX_SLUG_CHARS).collect();
    truncated.trim_end_matches('-').to_string()
}

/// Render the note a vault writer should create.
///
/// Frontmatter is machine-readable provenance; the body is the conversation as
/// a person would read it. `rhizome_import: true` marks these as ours so a
/// later sweep can find every imported note without parsing paths.
pub fn render_vault_note(request: &VaultNoteRequest) -> VaultNote {
    let mut contents = String::new();
    contents.push_str("---\n");
    contents.push_str(&format!("type: {IMPORTED_SESSION_TYPE}\n"));
    contents.push_str(&format!(
        "source_app: {}\n",
        yaml_scalar(&request.source_app)
    ));
    contents.push_str(&format!(
        "source_session_id: {}\n",
        yaml_scalar(&request.source_session_id)
    ));
    contents.push_str(&format!(
        "imported_at: {}\n",
        yaml_scalar(&request.imported_at)
    ));
    contents.push_str(&format!(
        "content_fingerprint: {}\n",
        yaml_scalar(&request.content_fingerprint)
    ));
    contents.push_str("rhizome_import: true\n");
    contents.push_str(&format!(
        "provenance: {}\n",
        if request.original_app.is_some() {
            "reimported"
        } else {
            "native"
        }
    ));
    if let Some(original) = &request.original_app {
        contents.push_str(&format!("original_app: {}\n", yaml_scalar(original)));
    }
    if let Some(session_id) = &request.prime_session_id {
        contents.push_str(&format!("prime_session_id: {}\n", yaml_scalar(session_id)));
    }
    contents.push_str("---\n\n");
    contents.push_str(&format!("# {}\n", request.title.trim()));

    for message in &request.messages {
        contents.push_str(&format!(
            "\n## {}\n\n{}\n",
            speaker(&message.role),
            message.content.trim()
        ));
    }

    VaultNote {
        relative_path: note_relative_path(&request.source_app, &request.started_on, &request.title),
        contents,
    }
}

/// Roles as a reader would name them, not as the source's schema spells them.
fn speaker(role: &str) -> &str {
    match role {
        "user" => "You",
        "assistant" => "Assistant",
        other => other,
    }
}

/// Quote a frontmatter value when YAML would otherwise misread it.
///
/// Session ids and fingerprints contain colons (`sha256:…`), which YAML reads
/// as a nested mapping — an unquoted fingerprint makes the whole note's
/// frontmatter unparseable.
fn yaml_scalar(value: &str) -> String {
    let needs_quotes =
        value.is_empty() || value.contains([':', '#', '\'', '"', '\n']) || value.trim() != value;
    if !needs_quotes {
        return value.to_string();
    }
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> VaultNoteRequest {
        VaultNoteRequest {
            source_app: "claude_code".to_string(),
            source_session_id: "abc-123".to_string(),
            title: "How do wikilinks work?".to_string(),
            messages: vec![
                ImportedMessage::new("user", "How do wikilinks work?"),
                ImportedMessage::new("assistant", "They link notes by title."),
            ],
            started_on: "2026-08-30".to_string(),
            imported_at: "2026-09-05T10:00:00Z".to_string(),
            content_fingerprint: "sha256:abcdef".to_string(),
            prime_session_id: None,
            original_app: None,
        }
    }

    #[test]
    fn files_a_note_under_imports_by_source_and_date() {
        let path = note_relative_path("claude_code", "2026-08-30", "How do wikilinks work?");

        assert_eq!(
            path,
            "Imports/claude-code/2026-08-30-how-do-wikilinks-work.md"
        );
    }

    #[test]
    fn keeps_the_filename_to_a_sane_length() {
        let long = "a ".repeat(200);
        let path = note_relative_path("claude_code", "2026-08-30", &long);

        let stem = path.rsplit('/').next().unwrap();
        assert!(stem.chars().count() <= MAX_SLUG_CHARS + "2026-08-30-.md".len());
        assert!(!stem.contains("--"));
    }

    #[test]
    fn falls_back_to_a_usable_name_for_an_unsluggable_title() {
        let path = note_relative_path("claude_code", "2026-08-30", "!!! ???");

        assert_eq!(path, "Imports/claude-code/2026-08-30-untitled.md");
    }

    #[test]
    fn writes_the_transcript_under_reader_facing_headings() {
        let note = render_vault_note(&request());

        assert!(note.contents.contains("# How do wikilinks work?"));
        assert!(note.contents.contains("## You\n\nHow do wikilinks work?"));
        assert!(note
            .contents
            .contains("## Assistant\n\nThey link notes by title."));
    }

    #[test]
    fn marks_the_note_as_an_import_with_its_provenance() {
        let note = render_vault_note(&request());

        assert!(note.contents.starts_with("---\n"));
        assert!(note.contents.contains("type: Imported Session\n"));
        assert!(note.contents.contains("rhizome_import: true\n"));
        assert!(note.contents.contains("provenance: native\n"));
        assert!(!note.contents.contains("original_app:"));
        assert!(!note.contents.contains("prime_session_id:"));
    }

    #[test]
    fn records_the_original_app_for_a_reimported_thread() {
        let mut reimported = request();
        reimported.original_app = Some("chatgpt".to_string());

        let note = render_vault_note(&reimported);

        assert!(note.contents.contains("provenance: reimported\n"));
        assert!(note.contents.contains("original_app: chatgpt\n"));
    }

    #[test]
    fn links_the_session_row_when_one_was_created() {
        let mut with_session = request();
        with_session.prime_session_id = Some("prime-9".to_string());

        let note = render_vault_note(&with_session);

        assert!(note.contents.contains("prime_session_id: prime-9\n"));
    }

    /// A fingerprint is `sha256:…`; unquoted, YAML reads the colon as a nested
    /// mapping and the whole note's frontmatter stops parsing.
    #[test]
    fn quotes_frontmatter_values_that_would_break_yaml() {
        let note = render_vault_note(&request());

        assert!(note
            .contents
            .contains("content_fingerprint: \"sha256:abcdef\"\n"));
        assert!(note
            .contents
            .contains("imported_at: \"2026-09-05T10:00:00Z\"\n"));
        // Plain values stay unquoted.
        assert!(note.contents.contains("source_app: claude_code\n"));
    }

    #[test]
    fn escapes_a_quote_inside_a_frontmatter_value() {
        let mut awkward = request();
        awkward.source_session_id = "we\"ird: id".to_string();

        let note = render_vault_note(&awkward);

        assert!(note
            .contents
            .contains(r#"source_session_id: "we\"ird: id""#));
    }

    #[test]
    fn renders_a_session_with_no_messages_as_a_titled_note() {
        let mut empty = request();
        empty.messages.clear();

        let note = render_vault_note(&empty);

        assert!(note.contents.contains("# How do wikilinks work?"));
        assert!(!note.contents.contains("## You"));
    }
}
