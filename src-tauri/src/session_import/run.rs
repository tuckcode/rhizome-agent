//! Carrying out the vault half of an import.
//!
//! Writes one note per session under `Imports/<source>/` and returns the ledger
//! entries describing what happened. The session-list half is separate and
//! blocked on a decision (see the plan's Destination section) — this half has no
//! such blocker, needs no daemon, and is where the durable memory lives, so it
//! stands on its own.
//!
//! Only ever writes inside the vault it is given. Source logs are read
//! elsewhere and never modified.

use std::path::{Path, PathBuf};

use crate::session_import::adapters::claude_code_scan::ScannedSession;
use crate::session_import::ledger::{
    DestinationKind, ImportDestination, ImportLedger, ImportLedgerEntry, ImportStatus,
};
use crate::session_import::preview::{ImportPreview, PlannedAction};
use crate::session_import::vault_note::{render_vault_note, VaultNoteRequest};

/// How many suffixes to try before giving up on a colliding filename.
const MAX_COLLISION_ATTEMPTS: usize = 100;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ImportOutcome {
    /// Vault-relative paths written, in the order they were written.
    pub written_notes: Vec<String>,
    /// Ledger entries for everything decided, including skips and failures.
    pub ledger_entries: Vec<ImportLedgerEntry>,
    /// Sessions that could not be written, with the reason, so the UI can say
    /// so rather than silently reporting fewer imports than it promised.
    pub failures: Vec<(String, String)>,
}

/// Write the vault notes an already-computed preview calls for.
///
/// Takes the preview rather than recomputing, so what is written is exactly
/// what the user was shown. `imported_at` is passed in rather than read from the
/// clock so a run is reproducible in tests.
pub fn run_vault_import(
    scanned: &[ScannedSession],
    preview: &ImportPreview,
    vault_root: &Path,
    imported_at: &str,
) -> ImportOutcome {
    let mut outcome = ImportOutcome::default();

    for planned in &preview.sessions {
        let Some(session) = scanned
            .iter()
            .find(|candidate| candidate.session.source_session_id == planned.source_session_id)
        else {
            continue;
        };

        // A skip is still recorded: the decision is what stops the next run
        // asking the same question again.
        let status = match &planned.action {
            PlannedAction::Skip(_) => Some(ImportStatus::SkippedDuplicate),
            PlannedAction::Confirm { .. } => None,
            PlannedAction::ImportWithSessionRow | PlannedAction::ImportToVaultOnly => None,
        };
        if let Some(status) = status {
            outcome
                .ledger_entries
                .push(ledger_entry(session, imported_at, None, status));
            continue;
        }
        // Awaiting the user's answer is not a decision yet, so nothing is
        // written and nothing is recorded.
        if matches!(planned.action, PlannedAction::Confirm { .. }) {
            continue;
        }

        let candidate = session.clone().session.into_candidate();
        let note = render_vault_note(&VaultNoteRequest {
            source_app: candidate.source_app.clone(),
            source_session_id: candidate.source_session_id.clone(),
            title: session.session.title.clone(),
            messages: session.session.messages.clone(),
            started_on: started_on(session),
            imported_at: imported_at.to_string(),
            content_fingerprint: candidate.content_fingerprint(),
            prime_session_id: None,
            original_app: candidate
                .provenance
                .reimported_from
                .as_ref()
                .map(|origin| origin.source_app.clone()),
        });

        match write_note(vault_root, &note.relative_path, &note.contents) {
            Ok(written_path) => {
                outcome.ledger_entries.push(ledger_entry(
                    session,
                    imported_at,
                    Some(written_path.clone()),
                    ImportStatus::Imported,
                ));
                outcome.written_notes.push(written_path);
            }
            Err(error) => {
                outcome
                    .failures
                    .push((planned.source_session_id.clone(), error.to_string()));
                outcome.ledger_entries.push(ledger_entry(
                    session,
                    imported_at,
                    None,
                    ImportStatus::Failed,
                ));
            }
        }
    }

    outcome
}

/// Apply an outcome's entries to the ledger.
pub fn record_outcome(ledger: &mut ImportLedger, outcome: &ImportOutcome) {
    for entry in &outcome.ledger_entries {
        ledger.record(entry.clone());
    }
}

fn started_on(session: &ScannedSession) -> String {
    session
        .session
        .date_span
        .and_then(|span| {
            chrono::DateTime::from_timestamp(span.first_day * 86_400, 0)
                .map(|date| date.format("%Y-%m-%d").to_string())
        })
        .unwrap_or_else(|| "undated".to_string())
}

fn ledger_entry(
    session: &ScannedSession,
    imported_at: &str,
    vault_note_path: Option<String>,
    status: ImportStatus,
) -> ImportLedgerEntry {
    let candidate = session.clone().session.into_candidate();
    ImportLedgerEntry {
        id: uuid::Uuid::new_v4().to_string(),
        content_fingerprint: candidate.content_fingerprint(),
        fuzzy_fingerprint: Some(candidate.fuzzy_fingerprint()),
        message_count: Some(candidate.messages.len()),
        source_app: candidate.source_app,
        source_session_id: candidate.source_session_id,
        source_path: Some(session.path.to_string_lossy().into_owned()),
        imported_at: imported_at.to_string(),
        destination: ImportDestination {
            // The session-list half is not built yet, so a vault note is
            // currently the only destination an import actually reaches.
            kind: if vault_note_path.is_some() {
                DestinationKind::PrimeSession
            } else {
                DestinationKind::None
            },
            session_id: None,
            vault_note_path,
        },
        status,
    }
}

/// Write a note, never overwriting one that is already there.
///
/// Two conversations on the same day with the same opening line produce the
/// same path. Overwriting would silently destroy the first import — and on a
/// re-run, a user's own edits to an imported note. Returns the path actually
/// written, which may carry a disambiguating suffix.
fn write_note(vault_root: &Path, relative_path: &str, contents: &str) -> std::io::Result<String> {
    let (stem, extension) = relative_path
        .rsplit_once(".md")
        .map(|(stem, _)| (stem, ".md"))
        .unwrap_or((relative_path, ""));

    for attempt in 0..MAX_COLLISION_ATTEMPTS {
        let candidate = if attempt == 0 {
            relative_path.to_string()
        } else {
            format!("{stem}-{}{extension}", attempt + 1)
        };
        let absolute = absolute_note_path(vault_root, &candidate);
        if absolute.exists() {
            continue;
        }
        if let Some(parent) = absolute.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&absolute, contents)?;
        return Ok(candidate);
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::AlreadyExists,
        format!("{MAX_COLLISION_ATTEMPTS} notes already exist at {relative_path}"),
    ))
}

fn absolute_note_path(vault_root: &Path, relative_path: &str) -> PathBuf {
    relative_path
        .split('/')
        .fold(vault_root.to_path_buf(), |path, segment| path.join(segment))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session_import::adapters::claude_code::ParsedSession;
    use crate::session_import::fingerprint::{DateSpan, ImportedMessage};
    use crate::session_import::preview::preview_import;
    use crate::session_import::selection::SelectionPolicy;

    const IMPORTED_AT: &str = "2026-09-05T10:00:00Z";

    fn scanned(id: &str, title: &str, day: i64) -> ScannedSession {
        ScannedSession {
            project_key: "project-a".to_string(),
            path: PathBuf::from(format!("/logs/{id}.jsonl")),
            session: ParsedSession {
                source_session_id: id.to_string(),
                title: title.to_string(),
                messages: vec![
                    ImportedMessage::new("user", format!("opening question for {id}, long enough")),
                    ImportedMessage::new("assistant", format!("a substantive answer for {id}")),
                    ImportedMessage::new("user", format!("a follow up for {id} with real text")),
                    ImportedMessage::new("assistant", format!("closing thoughts for {id} here")),
                ],
                date_span: Some(DateSpan {
                    first_day: day,
                    last_day: day,
                }),
                cwd: None,
                git_branch: None,
            },
        }
    }

    fn run(sessions: &[ScannedSession], root: &Path) -> ImportOutcome {
        let preview = preview_import(
            sessions,
            &ImportLedger::default(),
            SelectionPolicy::default(),
        );
        run_vault_import(sessions, &preview, root, IMPORTED_AT)
    }

    #[test]
    fn writes_one_note_per_session_under_imports() {
        let dir = tempfile::TempDir::new().unwrap();
        let sessions = vec![
            scanned("s1", "Wikilink research", 20_300),
            scanned("s2", "Graph layout", 20_301),
        ];

        let outcome = run(&sessions, dir.path());

        assert_eq!(outcome.written_notes.len(), 2);
        assert!(outcome.failures.is_empty());
        for path in &outcome.written_notes {
            assert!(path.starts_with("Imports/claude-code/"));
            assert!(dir.path().join(path).exists());
        }
    }

    #[test]
    fn the_note_holds_the_conversation_and_its_provenance() {
        let dir = tempfile::TempDir::new().unwrap();
        let sessions = vec![scanned("s1", "Wikilink research", 20_300)];

        let outcome = run(&sessions, dir.path());
        let written = std::fs::read_to_string(dir.path().join(&outcome.written_notes[0])).unwrap();

        assert!(written.contains("type: Imported Session"));
        assert!(written.contains("source_app: claude_code"));
        assert!(written.contains("# Wikilink research"));
        assert!(written.contains("opening question for s1"));
    }

    /// Two conversations on one day with the same opening line collide.
    /// Overwriting would destroy the first import silently.
    #[test]
    fn never_overwrites_an_existing_note() {
        let dir = tempfile::TempDir::new().unwrap();
        let sessions = vec![
            scanned("s1", "Same title", 20_300),
            scanned("s2", "Same title", 20_300),
        ];

        let outcome = run(&sessions, dir.path());

        assert_eq!(outcome.written_notes.len(), 2);
        assert_ne!(outcome.written_notes[0], outcome.written_notes[1]);
        let first = std::fs::read_to_string(dir.path().join(&outcome.written_notes[0])).unwrap();
        let second = std::fs::read_to_string(dir.path().join(&outcome.written_notes[1])).unwrap();
        assert!(first.contains("for s1"));
        assert!(second.contains("for s2"));
    }

    #[test]
    fn records_a_ledger_entry_for_every_note_it_wrote() {
        let dir = tempfile::TempDir::new().unwrap();
        let sessions = vec![scanned("s1", "One", 20_300), scanned("s2", "Two", 20_301)];

        let outcome = run(&sessions, dir.path());

        assert_eq!(outcome.ledger_entries.len(), 2);
        for entry in &outcome.ledger_entries {
            assert_eq!(entry.status, ImportStatus::Imported);
            assert!(entry.destination.vault_note_path.is_some());
            assert!(entry.content_fingerprint.starts_with("sha256:"));
            assert_eq!(entry.imported_at, IMPORTED_AT);
        }
    }

    /// The whole point of the ledger: a second run must do nothing.
    #[test]
    fn a_second_run_writes_nothing_new() {
        let dir = tempfile::TempDir::new().unwrap();
        let sessions = vec![scanned("s1", "One", 20_300), scanned("s2", "Two", 20_301)];

        let first = run(&sessions, dir.path());
        let mut ledger = ImportLedger::default();
        record_outcome(&mut ledger, &first);

        let second_preview = preview_import(&sessions, &ledger, SelectionPolicy::default());
        let second = run_vault_import(&sessions, &second_preview, dir.path(), IMPORTED_AT);

        assert!(second.written_notes.is_empty());
        assert_eq!(second_preview.counts.skipped_duplicate, 2);
        for entry in &second.ledger_entries {
            assert_eq!(entry.status, ImportStatus::SkippedDuplicate);
        }
    }

    #[test]
    fn writes_nothing_for_an_empty_scan() {
        let dir = tempfile::TempDir::new().unwrap();

        let outcome = run(&[], dir.path());

        assert!(outcome.written_notes.is_empty());
        assert!(outcome.ledger_entries.is_empty());
        assert!(!dir.path().join("Imports").exists());
    }

    #[test]
    fn dates_a_session_with_no_timestamps_rather_than_failing() {
        let dir = tempfile::TempDir::new().unwrap();
        let mut undated = scanned("s1", "No dates", 20_300);
        undated.session.date_span = None;

        let outcome = run(&[undated], dir.path());

        assert_eq!(outcome.written_notes.len(), 1);
        assert!(outcome.written_notes[0].contains("undated"));
    }
}

/// Opt-in end-to-end probe: import this machine's real Claude Code history into
/// a throwaway vault, then re-run to prove the second pass is a no-op.
/// Ignored by default — reads a developer's own directory.
/// `cargo test --lib real_end_to_end_import -- --ignored --nocapture`
#[cfg(test)]
mod real_end_to_end {
    use super::*;
    use crate::session_import::adapters::claude_code_scan::{
        default_projects_dir, scan_projects_dir,
    };
    use crate::session_import::preview::preview_import;
    use crate::session_import::selection::SelectionPolicy;

    #[test]
    #[ignore = "reads the developer's own ~/.claude/projects"]
    fn real_end_to_end_import_is_idempotent() {
        let Some(root) = default_projects_dir() else {
            return;
        };
        let scanned = scan_projects_dir(&root);
        if scanned.is_empty() {
            return;
        }
        let vault = tempfile::TempDir::new().unwrap();

        let preview = preview_import(
            &scanned,
            &ImportLedger::default(),
            SelectionPolicy::default(),
        );
        let first = run_vault_import(&scanned, &preview, vault.path(), "2026-09-05T10:00:00Z");
        let mut ledger = ImportLedger::default();
        record_outcome(&mut ledger, &first);

        let second_preview = preview_import(&scanned, &ledger, SelectionPolicy::default());
        let second = run_vault_import(
            &scanned,
            &second_preview,
            vault.path(),
            "2026-09-05T11:00:00Z",
        );

        println!(
            "first_run_notes={} failures={} second_run_notes={} second_run_skips={}",
            first.written_notes.len(),
            first.failures.len(),
            second.written_notes.len(),
            second_preview.counts.skipped_duplicate,
        );

        assert!(!first.written_notes.is_empty(), "imported nothing");
        assert!(first.failures.is_empty(), "failures: {:?}", first.failures);
        assert!(
            second.written_notes.is_empty(),
            "a second import wrote {} notes",
            second.written_notes.len(),
        );
        // Every note written is a real file with frontmatter.
        for path in &first.written_notes {
            let contents = std::fs::read_to_string(vault.path().join(path)).unwrap();
            assert!(contents.starts_with("---\n"), "{path} has no frontmatter");
        }
    }
}
