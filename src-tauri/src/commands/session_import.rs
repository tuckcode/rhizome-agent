//! Tauri surface for the session-import engine.
//!
//! Wraps `session_import::{preview, run}` so Settings can scan Claude Code
//! history and write vault notes under `Imports/<source>/`. The Prime
//! session-list half is not wired here yet — `import_jsonl` replaces the
//! active session rather than minting list rows (see the 2026-09-01 plan).

use chrono::Utc;
use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::commands::expand_tilde;
use crate::session_import::adapters::claude_code_scan::{
    default_projects_dir, scan_projects_dir, ScannedSession,
};
use crate::session_import::ledger::{ledger_path_in, read_ledger_at, write_ledger_at, ImportLedger};
use crate::session_import::preview::{preview_import, PlannedAction, PlannedSession};
use crate::session_import::run::{record_outcome, run_vault_import};
use crate::session_import::selection::SelectionPolicy;

const LEDGER_DIR: &str = ".rhizome";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionImportPreviewResponse {
    pub source: String,
    pub projects_dir: Option<String>,
    pub found: usize,
    pub will_import: usize,
    pub vault_only: usize,
    pub with_session_row_planned: usize,
    pub skipped_duplicate: usize,
    pub needs_confirmation: usize,
    /// Sessions that would get a Prime row once that writer exists. Counted
    /// for honesty in the UI; this command still writes vault notes only.
    pub session_list_not_yet_wired: bool,
    pub sessions: Vec<SessionImportPreviewRow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionImportPreviewRow {
    pub source_session_id: String,
    pub project_key: String,
    pub title: String,
    pub message_count: usize,
    pub action: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionImportRunResponse {
    pub written_notes: Vec<String>,
    pub imported: usize,
    pub skipped: usize,
    pub failed: usize,
    pub failures: Vec<SessionImportFailure>,
    pub session_list_not_yet_wired: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionImportFailure {
    pub source_session_id: String,
    pub error: String,
}

fn vault_ledger_path(vault_path: &Path) -> PathBuf {
    ledger_path_in(&vault_path.join(LEDGER_DIR))
}

fn load_ledger(vault_path: &Path) -> ImportLedger {
    read_ledger_at(&vault_ledger_path(vault_path))
}

fn save_ledger(vault_path: &Path, ledger: &ImportLedger) -> Result<(), String> {
    write_ledger_at(&vault_ledger_path(vault_path), ledger)
        .map_err(|err| format!("Failed to write import ledger: {err}"))
}

fn require_vault_dir(vault_path: &str) -> Result<PathBuf, String> {
    let expanded = expand_tilde(vault_path);
    let path = PathBuf::from(expanded.as_ref());
    if !path.is_dir() {
        return Err("Open a vault before importing chat history.".to_string());
    }
    Ok(path)
}

fn action_label(action: &PlannedAction) -> String {
    match action {
        PlannedAction::ImportWithSessionRow => "import_with_session_row".to_string(),
        PlannedAction::ImportToVaultOnly => "import_to_vault_only".to_string(),
        PlannedAction::Skip(_) => "skip".to_string(),
        PlannedAction::Confirm { .. } => "needs_confirmation".to_string(),
    }
}

fn preview_row(session: &PlannedSession) -> SessionImportPreviewRow {
    SessionImportPreviewRow {
        source_session_id: session.source_session_id.clone(),
        project_key: session.project_key.clone(),
        title: session.title.clone(),
        message_count: session.message_count,
        action: action_label(&session.action),
    }
}

fn build_preview(
    scanned: &[ScannedSession],
    ledger: &ImportLedger,
    projects_dir: Option<PathBuf>,
) -> SessionImportPreviewResponse {
    let preview = preview_import(scanned, ledger, SelectionPolicy::default());
    SessionImportPreviewResponse {
        source: "claude_code".to_string(),
        projects_dir: projects_dir.map(|path| path.to_string_lossy().into_owned()),
        found: preview.counts.found,
        will_import: preview.counts.with_session_row + preview.counts.vault_only,
        vault_only: preview.counts.vault_only,
        with_session_row_planned: preview.counts.with_session_row,
        skipped_duplicate: preview.counts.skipped_duplicate,
        needs_confirmation: preview.counts.needs_confirmation,
        session_list_not_yet_wired: true,
        sessions: preview.sessions.iter().map(preview_row).collect(),
    }
}

fn scan_claude_code() -> (Vec<ScannedSession>, Option<PathBuf>) {
    let Some(root) = default_projects_dir() else {
        return (Vec::new(), None);
    };
    if !root.is_dir() {
        return (Vec::new(), Some(root));
    }
    let scanned = scan_projects_dir(&root);
    (scanned, Some(root))
}

/// Preview what a Claude Code import would write into the open vault.
#[tauri::command]
pub fn preview_claude_code_session_import(
    vault_path: String,
) -> Result<SessionImportPreviewResponse, String> {
    let vault = require_vault_dir(&vault_path)?;
    let ledger = load_ledger(&vault);
    let (scanned, projects_dir) = scan_claude_code();
    Ok(build_preview(&scanned, &ledger, projects_dir))
}

/// Import Claude Code sessions as vault notes under `Imports/claude-code/`.
///
/// Fuzzy duplicates (`needs_confirmation`) are left untouched in this pass —
/// the Settings UI shows the count and does not invent a review sheet yet.
/// Sessions marked for a Prime list row still get vault notes only.
#[tauri::command]
pub fn run_claude_code_session_import(
    vault_path: String,
) -> Result<SessionImportRunResponse, String> {
    let vault = require_vault_dir(&vault_path)?;
    let mut ledger = load_ledger(&vault);
    let (scanned, _) = scan_claude_code();
    let preview = preview_import(&scanned, &ledger, SelectionPolicy::default());
    let imported_at = Utc::now().to_rfc3339();
    let outcome = run_vault_import(&scanned, &preview, &vault, &imported_at);
    record_outcome(&mut ledger, &outcome);
    save_ledger(&vault, &ledger)?;

    let imported = outcome
        .ledger_entries
        .iter()
        .filter(|entry| {
            matches!(
                entry.status,
                crate::session_import::ledger::ImportStatus::Imported
            )
        })
        .count();
    let skipped = outcome
        .ledger_entries
        .iter()
        .filter(|entry| {
            matches!(
                entry.status,
                crate::session_import::ledger::ImportStatus::SkippedDuplicate
            )
        })
        .count();

    Ok(SessionImportRunResponse {
        written_notes: outcome.written_notes,
        imported,
        skipped,
        failed: outcome.failures.len(),
        failures: outcome
            .failures
            .into_iter()
            .map(|(source_session_id, error)| SessionImportFailure {
                source_session_id,
                error,
            })
            .collect(),
        session_list_not_yet_wired: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session_import::adapters::claude_code_scan::ScannedSession;
    use crate::session_import::adapters::claude_code::ParsedSession;
    use crate::session_import::fingerprint::{DateSpan, ImportedMessage};
    use crate::session_import::ledger::{ImportDestination, ImportLedgerEntry, ImportStatus};
    use std::fs;
    use tempfile::TempDir;

    fn message(role: &str, content: &str) -> ImportedMessage {
        ImportedMessage {
            role: role.to_string(),
            content: content.to_string(),
        }
    }

    fn scanned(id: &str, title: &str) -> ScannedSession {
        ScannedSession {
            project_key: "demo".to_string(),
            path: PathBuf::from(format!("/tmp/{id}.jsonl")),
            session: ParsedSession {
                source_session_id: id.to_string(),
                title: title.to_string(),
                messages: vec![
                    message("user", "hello there friend"),
                    message("assistant", "hi back at you with enough text"),
                    message("user", "one more turn please"),
                    message("assistant", "sure thing, continuing the chat"),
                ],
                date_span: Some(DateSpan {
                    first_day: 20_000,
                    last_day: 20_001,
                }),
                cwd: None,
                git_branch: None,
            },
        }
    }

    #[test]
    fn preview_reports_importable_sessions() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let scanned = vec![scanned("a", "First chat")];
        let response = build_preview(&scanned, &ImportLedger::default(), None);
        assert_eq!(response.found, 1);
        assert_eq!(response.will_import, 1);
        assert!(response.session_list_not_yet_wired);
        assert_eq!(response.sessions[0].title, "First chat");
    }

    #[test]
    fn run_writes_notes_and_ledger() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        let scanned = vec![scanned("a", "First chat")];
        let preview = preview_import(&scanned, &ImportLedger::default(), SelectionPolicy::default());
        let outcome = run_vault_import(&scanned, &preview, &vault, "2026-09-06T00:00:00Z");
        let mut ledger = ImportLedger::default();
        record_outcome(&mut ledger, &outcome);
        save_ledger(&vault, &ledger).unwrap();

        assert_eq!(outcome.written_notes.len(), 1);
        assert!(vault.join(&outcome.written_notes[0]).exists());
        assert!(vault_ledger_path(&vault).exists());
        assert!(ledger.has_imported_source("claude_code", "a"));
    }

    #[test]
    fn second_preview_skips_already_imported() {
        let mut ledger = ImportLedger::default();
        ledger.record(ImportLedgerEntry {
            id: "1".to_string(),
            content_fingerprint: "sha256:irrelevant".to_string(),
            fuzzy_fingerprint: None,
            message_count: Some(4),
            source_app: "claude_code".to_string(),
            source_session_id: "a".to_string(),
            source_path: None,
            imported_at: "2026-09-06T00:00:00Z".to_string(),
            destination: ImportDestination::default(),
            status: ImportStatus::Imported,
        });
        let response = build_preview(&[scanned("a", "First")], &ledger, None);
        assert_eq!(response.skipped_duplicate, 1);
        assert_eq!(response.will_import, 0);
    }
}
