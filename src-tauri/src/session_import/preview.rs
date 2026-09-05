//! What an import *would* do, computed before anything is written.
//!
//! The plan requires explicit consent: show counts before importing, never
//! silently touch a third-party app's data. That means the expensive decisions —
//! scan, dedup, selection — have to be answerable without side effects, so the
//! same code can answer "here is what we found" and then carry out exactly what
//! it described.
//!
//! Nothing here writes. It reads source logs and the ledger, and returns a plan.

use crate::session_import::adapters::claude_code_scan::ScannedSession;
use crate::session_import::dedup::{decide, ImportDecision, SkipReason};
use crate::session_import::ledger::ImportLedger;
use crate::session_import::selection::{select_for_session_list, SelectionPolicy};

/// What will happen to one discovered session.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlannedAction {
    /// Import to the vault, and give it a session-list row.
    ImportWithSessionRow,
    /// Import to the vault only — real, but not worth the expensive path.
    ImportToVaultOnly,
    /// Already in Rhizome; write nothing.
    Skip(SkipReason),
    /// Close to something already imported — ask before doing anything.
    Confirm { existing_fingerprint: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedSession {
    pub source_session_id: String,
    pub project_key: String,
    pub title: String,
    pub message_count: usize,
    pub action: PlannedAction,
}

/// Counts for the sentence the UI shows before the user commits to anything.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ImportPreviewCounts {
    pub found: usize,
    pub with_session_row: usize,
    pub vault_only: usize,
    pub skipped_duplicate: usize,
    pub needs_confirmation: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportPreview {
    pub counts: ImportPreviewCounts,
    pub sessions: Vec<PlannedSession>,
}

/// Decide what an import of `scanned` would do, given what is already imported.
///
/// Dedup runs first and selection second, deliberately: a session already in
/// Rhizome should not consume a project's session-row quota, or a re-run would
/// quietly demote a real candidate each time.
pub fn preview_import(
    scanned: &[ScannedSession],
    ledger: &ImportLedger,
    policy: SelectionPolicy,
) -> ImportPreview {
    let mut decided: Vec<(&ScannedSession, ImportDecision)> = Vec::with_capacity(scanned.len());
    for session in scanned {
        let candidate = session.clone().session.into_candidate();
        decided.push((session, decide(&candidate, ledger)));
    }

    let importable: Vec<_> = decided
        .iter()
        .filter(|(_, decision)| matches!(decision, ImportDecision::Import))
        .map(|(session, _)| session.selection_input())
        .collect();
    let selection = select_for_session_list(&importable, policy);

    let mut counts = ImportPreviewCounts {
        found: scanned.len(),
        ..ImportPreviewCounts::default()
    };
    let mut sessions = Vec::with_capacity(scanned.len());

    for (scanned_session, decision) in decided {
        let id = &scanned_session.session.source_session_id;
        let action = match decision {
            ImportDecision::Skip(reason) => {
                counts.skipped_duplicate += 1;
                PlannedAction::Skip(reason)
            }
            ImportDecision::ConfirmPossibleDuplicate {
                existing_fingerprint,
            } => {
                counts.needs_confirmation += 1;
                PlannedAction::Confirm {
                    existing_fingerprint,
                }
            }
            ImportDecision::Import => {
                if selection.for_session_list.iter().any(|chosen| chosen == id) {
                    counts.with_session_row += 1;
                    PlannedAction::ImportWithSessionRow
                } else {
                    counts.vault_only += 1;
                    PlannedAction::ImportToVaultOnly
                }
            }
        };
        sessions.push(PlannedSession {
            source_session_id: id.clone(),
            project_key: scanned_session.project_key.clone(),
            title: scanned_session.session.title.clone(),
            message_count: scanned_session.session.messages.len(),
            action,
        });
    }

    ImportPreview { counts, sessions }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session_import::adapters::claude_code::ParsedSession;
    use crate::session_import::fingerprint::{DateSpan, ImportedMessage};
    use crate::session_import::ledger::{ImportDestination, ImportLedgerEntry, ImportStatus};
    use std::path::PathBuf;

    fn scanned(project: &str, id: &str, message_count: usize, day: i64) -> ScannedSession {
        // Content varies by session id: two sessions with identical text are
        // genuinely duplicates, and the fuzzy rule is right to say so.
        let messages = (0..message_count)
            .map(|index| {
                let role = if index % 2 == 0 { "user" } else { "assistant" };
                ImportedMessage::new(
                    role,
                    format!("session {id} message {index}, long enough to be substantive"),
                )
            })
            .collect();
        ScannedSession {
            project_key: project.to_string(),
            path: PathBuf::from(format!("/logs/{id}.jsonl")),
            session: ParsedSession {
                source_session_id: id.to_string(),
                title: format!("Session {id}"),
                messages,
                date_span: Some(DateSpan {
                    first_day: day,
                    last_day: day,
                }),
                cwd: None,
                git_branch: None,
            },
        }
    }

    fn ledger_with(session: &ScannedSession) -> ImportLedger {
        let candidate = session.clone().session.into_candidate();
        let mut ledger = ImportLedger::default();
        ledger.record(ImportLedgerEntry {
            id: "e1".to_string(),
            content_fingerprint: candidate.content_fingerprint(),
            fuzzy_fingerprint: Some(candidate.fuzzy_fingerprint()),
            message_count: Some(candidate.messages.len()),
            source_app: candidate.source_app.clone(),
            source_session_id: candidate.source_session_id.clone(),
            source_path: None,
            imported_at: "2026-09-05T00:00:00Z".to_string(),
            destination: ImportDestination::default(),
            status: ImportStatus::Imported,
        });
        ledger
    }

    #[test]
    fn plans_a_first_import_of_everything_it_found() {
        let scanned_sessions = vec![
            scanned("alpha", "a1", 8, 30),
            scanned("alpha", "a2", 8, 20),
            scanned("beta", "b1", 8, 10),
        ];

        let preview = preview_import(
            &scanned_sessions,
            &ImportLedger::default(),
            SelectionPolicy::default(),
        );

        assert_eq!(preview.counts.found, 3);
        assert_eq!(preview.counts.with_session_row, 3);
        assert_eq!(preview.counts.vault_only, 0);
        assert_eq!(preview.counts.skipped_duplicate, 0);
    }

    #[test]
    fn sends_the_overflow_of_a_busy_project_to_the_vault_only() {
        let scanned_sessions: Vec<ScannedSession> = (0..10)
            .map(|index| scanned("busy", &format!("s{index}"), 8, index))
            .collect();

        let preview = preview_import(
            &scanned_sessions,
            &ImportLedger::default(),
            SelectionPolicy::default(),
        );

        assert_eq!(preview.counts.found, 10);
        assert_eq!(preview.counts.with_session_row, 3);
        assert_eq!(preview.counts.vault_only, 7);
        // Nothing is dropped: every session still lands in the vault.
        assert_eq!(
            preview.counts.with_session_row + preview.counts.vault_only,
            preview.counts.found,
        );
    }

    #[test]
    fn reports_an_already_imported_session_as_a_skip() {
        let existing = scanned("alpha", "a1", 8, 30);
        let ledger = ledger_with(&existing);

        let preview = preview_import(&[existing], &ledger, SelectionPolicy::default());

        assert_eq!(preview.counts.skipped_duplicate, 1);
        assert_eq!(preview.counts.with_session_row, 0);
        assert!(matches!(
            preview.sessions[0].action,
            PlannedAction::Skip(SkipReason::AlreadyImported),
        ));
    }

    /// A session already in Rhizome must not consume a project's quota, or
    /// re-running an import would demote a real candidate every time.
    #[test]
    fn an_already_imported_session_does_not_spend_a_session_row_slot() {
        let already = scanned("alpha", "old", 8, 100);
        let ledger = ledger_with(&already);
        let scanned_sessions = vec![
            already,
            scanned("alpha", "n1", 8, 40),
            scanned("alpha", "n2", 8, 30),
            scanned("alpha", "n3", 8, 20),
        ];

        let preview = preview_import(&scanned_sessions, &ledger, SelectionPolicy::default());

        assert_eq!(preview.counts.skipped_duplicate, 1);
        assert_eq!(preview.counts.with_session_row, 3);
        assert_eq!(preview.counts.vault_only, 0);
    }

    #[test]
    fn accounts_for_every_scanned_session_exactly_once() {
        let scanned_sessions: Vec<ScannedSession> = (0..12)
            .map(|index| scanned("alpha", &format!("s{index}"), 8, index))
            .collect();

        let preview = preview_import(
            &scanned_sessions,
            &ImportLedger::default(),
            SelectionPolicy::default(),
        );

        assert_eq!(preview.sessions.len(), preview.counts.found);
        assert_eq!(
            preview.counts.with_session_row
                + preview.counts.vault_only
                + preview.counts.skipped_duplicate
                + preview.counts.needs_confirmation,
            preview.counts.found,
        );
    }

    #[test]
    fn previews_nothing_for_an_empty_scan() {
        let preview = preview_import(&[], &ImportLedger::default(), SelectionPolicy::default());

        assert_eq!(preview.counts, ImportPreviewCounts::default());
        assert!(preview.sessions.is_empty());
    }

    /// The preview is what the import then carries out, so it must not depend
    /// on anything that changes between the two.
    #[test]
    fn is_repeatable_for_the_same_input() {
        let scanned_sessions: Vec<ScannedSession> = (0..6)
            .map(|index| scanned("alpha", &format!("s{index}"), 8, index))
            .collect();

        let first = preview_import(
            &scanned_sessions,
            &ImportLedger::default(),
            SelectionPolicy::default(),
        );
        let second = preview_import(
            &scanned_sessions,
            &ImportLedger::default(),
            SelectionPolicy::default(),
        );

        assert_eq!(first, second);
    }
}

/// Opt-in probe: what an import of this machine's real Claude Code history
/// would propose. Ignored by default — it reads a developer's own directory.
/// `cargo test --lib real_import_preview -- --ignored --nocapture`
#[cfg(test)]
mod real_preview {
    use super::*;
    use crate::session_import::adapters::claude_code_scan::{
        default_projects_dir, scan_projects_dir,
    };

    #[test]
    #[ignore = "reads the developer's own ~/.claude/projects"]
    fn real_import_preview_is_proportionate() {
        let Some(root) = default_projects_dir() else {
            return;
        };
        let scanned = scan_projects_dir(&root);
        if scanned.is_empty() {
            return;
        }
        let preview = preview_import(
            &scanned,
            &ImportLedger::default(),
            SelectionPolicy::default(),
        );
        let projects: std::collections::BTreeSet<&str> = scanned
            .iter()
            .map(|session| session.project_key.as_str())
            .collect();

        println!(
            "found={} projects={} session_rows={} vault_only={} confirm={}",
            preview.counts.found,
            projects.len(),
            preview.counts.with_session_row,
            preview.counts.vault_only,
            preview.counts.needs_confirmation,
        );
        assert_eq!(preview.sessions.len(), preview.counts.found);
    }
}
