//! The import ledger: the source of truth for "already in Rhizome".
//!
//! Dedup cannot live in the vault or the Prime session list, because an import
//! may write to either, both, or (on a skip) neither. The ledger is the one
//! place that remembers every decision, so re-running an import is a no-op and
//! a second source does not re-add threads the first one already brought.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const IMPORT_LEDGER_FILE: &str = "import-ledger.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportStatus {
    Imported,
    SkippedDuplicate,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DestinationKind {
    PrimeSession,
    /// Recorded when the user skipped, so a later run can still see the decision.
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDestination {
    pub kind: DestinationKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// Set only when a vault was attached at import time (plan: both-when-vault).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vault_note_path: Option<String>,
}

impl Default for ImportDestination {
    fn default() -> Self {
        Self {
            kind: DestinationKind::PrimeSession,
            session_id: None,
            vault_note_path: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLedgerEntry {
    pub id: String,
    pub content_fingerprint: String,
    /// Absent on entries written before fuzzy matching existed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fuzzy_fingerprint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message_count: Option<usize>,
    pub source_app: String,
    pub source_session_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
    pub imported_at: String,
    #[serde(default)]
    pub destination: ImportDestination,
    pub status: ImportStatus,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLedger {
    #[serde(default)]
    pub entries: Vec<ImportLedgerEntry>,
}

impl ImportLedger {
    pub fn record(&mut self, entry: ImportLedgerEntry) {
        self.entries.push(entry);
    }

    /// Entries that actually landed. A skip or a failure must not block a retry,
    /// so only `Imported` counts as "already in Rhizome".
    pub fn imported_entries(&self) -> impl Iterator<Item = &ImportLedgerEntry> {
        self.entries
            .iter()
            .filter(|entry| entry.status == ImportStatus::Imported)
    }

    pub fn has_imported_source(&self, source_app: &str, source_session_id: &str) -> bool {
        self.imported_entries().any(|entry| {
            entry.source_app == source_app && entry.source_session_id == source_session_id
        })
    }

    pub fn has_imported_fingerprint(&self, content_fingerprint: &str) -> bool {
        self.imported_entries()
            .any(|entry| entry.content_fingerprint == content_fingerprint)
    }
}

pub fn ledger_path_in(config_dir: &Path) -> PathBuf {
    config_dir.join(IMPORT_LEDGER_FILE)
}

/// Read the ledger, treating a missing or unreadable file as "nothing imported".
///
/// A corrupt ledger must not make the app unusable: the worst case of starting
/// empty is that the user is asked about duplicates again, which is recoverable.
/// Silently importing everything twice would not be, so callers still run the
/// dedup rules against whatever this returns.
pub fn read_ledger_at(path: &Path) -> ImportLedger {
    let Ok(contents) = std::fs::read_to_string(path) else {
        return ImportLedger::default();
    };
    serde_json::from_str(&contents).unwrap_or_default()
}

pub fn write_ledger_at(path: &Path, ledger: &ImportLedger) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let serialized = serde_json::to_string_pretty(ledger)
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))?;
    std::fs::write(path, serialized)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(
        app: &str,
        session: &str,
        fingerprint: &str,
        status: ImportStatus,
    ) -> ImportLedgerEntry {
        ImportLedgerEntry {
            id: format!("{app}-{session}"),
            content_fingerprint: fingerprint.to_string(),
            fuzzy_fingerprint: None,
            message_count: Some(4),
            source_app: app.to_string(),
            source_session_id: session.to_string(),
            source_path: None,
            imported_at: "2026-09-05T00:00:00Z".to_string(),
            destination: ImportDestination::default(),
            status,
        }
    }

    #[test]
    fn counts_only_imported_entries_as_already_present() {
        let mut ledger = ImportLedger::default();
        ledger.record(entry("claude", "a", "sha256:aaa", ImportStatus::Imported));
        ledger.record(entry(
            "cursor",
            "b",
            "sha256:bbb",
            ImportStatus::SkippedDuplicate,
        ));
        ledger.record(entry("hermes", "c", "sha256:ccc", ImportStatus::Failed));

        assert!(ledger.has_imported_source("claude", "a"));
        assert!(!ledger.has_imported_source("cursor", "b"));
        assert!(!ledger.has_imported_source("hermes", "c"));
        assert!(ledger.has_imported_fingerprint("sha256:aaa"));
        assert!(!ledger.has_imported_fingerprint("sha256:ccc"));
        assert_eq!(ledger.imported_entries().count(), 1);
    }

    #[test]
    fn does_not_confuse_the_same_session_id_from_two_apps() {
        let mut ledger = ImportLedger::default();
        ledger.record(entry(
            "claude",
            "shared-id",
            "sha256:aaa",
            ImportStatus::Imported,
        ));

        assert!(ledger.has_imported_source("claude", "shared-id"));
        assert!(!ledger.has_imported_source("cursor", "shared-id"));
    }

    #[test]
    fn round_trips_through_disk() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = ledger_path_in(dir.path());
        let mut ledger = ImportLedger::default();
        ledger.record(entry("claude", "a", "sha256:aaa", ImportStatus::Imported));

        write_ledger_at(&path, &ledger).unwrap();
        let loaded = read_ledger_at(&path);

        assert!(loaded.has_imported_source("claude", "a"));
        assert_eq!(loaded.entries.len(), 1);
    }

    #[test]
    fn creates_missing_parent_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nested/deeper").join(IMPORT_LEDGER_FILE);

        write_ledger_at(&path, &ImportLedger::default()).unwrap();

        assert!(path.exists());
    }

    /// A first run has no ledger, and a damaged one must not brick importing.
    #[test]
    fn treats_a_missing_or_corrupt_ledger_as_empty() {
        let dir = tempfile::TempDir::new().unwrap();
        let missing = ledger_path_in(dir.path());
        assert_eq!(read_ledger_at(&missing).entries.len(), 0);

        let corrupt = dir.path().join("corrupt.json");
        std::fs::write(&corrupt, "{ not json").unwrap();
        assert_eq!(read_ledger_at(&corrupt).entries.len(), 0);
    }

    /// Entries written before fuzzy matching existed still have to load.
    #[test]
    fn reads_entries_without_the_optional_fuzzy_fields() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("legacy.json");
        std::fs::write(
            &path,
            r#"{"entries":[{"id":"1","contentFingerprint":"sha256:aaa","sourceApp":"claude","sourceSessionId":"a","importedAt":"2026-09-05T00:00:00Z","status":"imported"}]}"#,
        )
        .unwrap();

        let ledger = read_ledger_at(&path);

        assert!(ledger.has_imported_source("claude", "a"));
        assert_eq!(ledger.entries[0].fuzzy_fingerprint, None);
        assert_eq!(
            ledger.entries[0].destination.kind,
            DestinationKind::PrimeSession
        );
    }
}
