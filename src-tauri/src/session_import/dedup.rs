//! The five-step import dedup decision.
//!
//! People arrive with nested history: one app already holding threads exported
//! from another. Without this, the same conversation shows up twice under
//! different names. The rules are deliberately source-agnostic — no adapter
//! names appear here — so any pair of apps dedups the same way.

use crate::session_import::fingerprint::{
    content_fingerprint, fuzzy_fingerprint, DateSpan, ImportedMessage,
};
use crate::session_import::ledger::ImportLedger;

/// How far two message counts may drift and still be called a possible match.
const FUZZY_COUNT_TOLERANCE: usize = 2;

/// Where a candidate came from, when the export says so.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Provenance {
    /// Set when this export is itself a copy of a thread from another app.
    pub reimported_from: Option<ReimportOrigin>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReimportOrigin {
    pub source_app: String,
    pub source_session_id: String,
}

/// A session an adapter is offering to import.
#[derive(Debug, Clone)]
pub struct ImportCandidate {
    pub source_app: String,
    pub source_session_id: String,
    pub messages: Vec<ImportedMessage>,
    pub date_span: Option<DateSpan>,
    pub provenance: Provenance,
}

impl ImportCandidate {
    pub fn content_fingerprint(&self) -> String {
        content_fingerprint(&self.messages, self.date_span)
    }

    pub fn fuzzy_fingerprint(&self) -> String {
        fuzzy_fingerprint(&self.messages)
    }
}

/// Why a candidate was skipped, so the UI can say something true about it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SkipReason {
    /// Rule 1 — same source session already imported.
    AlreadyImported,
    /// Rule 2 — this exact content is already here, from some source.
    ContentAlreadyImported,
    /// Rule 3 — a reimported copy whose canonical original is already here.
    OriginalAlreadyImported,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImportDecision {
    Import,
    Skip(SkipReason),
    /// Rule 4 — close enough to ask about; the UI defaults to skipping.
    ConfirmPossibleDuplicate {
        existing_fingerprint: String,
    },
}

/// Decide what to do with one candidate, applying the plan's rules in order.
pub fn decide(candidate: &ImportCandidate, ledger: &ImportLedger) -> ImportDecision {
    if ledger.has_imported_source(&candidate.source_app, &candidate.source_session_id) {
        return ImportDecision::Skip(SkipReason::AlreadyImported);
    }

    let fingerprint = candidate.content_fingerprint();
    if ledger.has_imported_fingerprint(&fingerprint) {
        return ImportDecision::Skip(SkipReason::ContentAlreadyImported);
    }

    if let Some(origin) = &candidate.provenance.reimported_from {
        if ledger.has_imported_source(&origin.source_app, &origin.source_session_id) {
            return ImportDecision::Skip(SkipReason::OriginalAlreadyImported);
        }
    }

    if let Some(existing_fingerprint) = fuzzy_match(candidate, ledger) {
        return ImportDecision::ConfirmPossibleDuplicate {
            existing_fingerprint,
        };
    }

    ImportDecision::Import
}

fn fuzzy_match(candidate: &ImportCandidate, ledger: &ImportLedger) -> Option<String> {
    let candidate_fuzzy = candidate.fuzzy_fingerprint();
    let candidate_count = candidate.messages.len();
    ledger
        .imported_entries()
        .find(|entry| {
            entry.fuzzy_fingerprint.as_deref() == Some(candidate_fuzzy.as_str())
                && entry
                    .message_count
                    .is_some_and(|count| count.abs_diff(candidate_count) <= FUZZY_COUNT_TOLERANCE)
        })
        .map(|entry| entry.content_fingerprint.clone())
}

/// Rank competing *new* copies of one conversation within a single batch.
///
/// Not a fixed "app X loses" rule: prefer whichever copy is closest to the
/// original, since an aggregator's copy is the one likeliest to have dropped
/// tool calls or truncated a tail.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum SourceRank {
    /// A copy that says it came from somewhere else, origin unknown to us.
    UnknownReimport,
    /// A copy that names the app it was reimported from.
    KnownReimport,
    /// The app's own session log or its own export.
    Native,
}

pub fn source_rank(candidate: &ImportCandidate) -> SourceRank {
    match &candidate.provenance.reimported_from {
        None => SourceRank::Native,
        Some(origin) if origin.source_app.trim().is_empty() => SourceRank::UnknownReimport,
        Some(_) => SourceRank::KnownReimport,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session_import::ledger::{ImportDestination, ImportLedgerEntry, ImportStatus};

    fn messages(count: usize) -> Vec<ImportedMessage> {
        (0..count)
            .map(|index| {
                let role = if index % 2 == 0 { "user" } else { "assistant" };
                ImportedMessage::new(role, format!("message {index}"))
            })
            .collect()
    }

    fn candidate(app: &str, session: &str, message_count: usize) -> ImportCandidate {
        ImportCandidate {
            source_app: app.to_string(),
            source_session_id: session.to_string(),
            messages: messages(message_count),
            date_span: None,
            provenance: Provenance::default(),
        }
    }

    fn imported_entry(candidate: &ImportCandidate) -> ImportLedgerEntry {
        ImportLedgerEntry {
            id: "entry-1".to_string(),
            content_fingerprint: candidate.content_fingerprint(),
            fuzzy_fingerprint: Some(candidate.fuzzy_fingerprint()),
            message_count: Some(candidate.messages.len()),
            source_app: candidate.source_app.clone(),
            source_session_id: candidate.source_session_id.clone(),
            source_path: None,
            imported_at: "2026-09-05T00:00:00Z".to_string(),
            destination: ImportDestination::default(),
            status: ImportStatus::Imported,
        }
    }

    #[test]
    fn imports_a_session_the_ledger_has_never_seen() {
        let ledger = ImportLedger::default();

        assert_eq!(
            decide(&candidate("claude", "a", 6), &ledger),
            ImportDecision::Import
        );
    }

    /// Rule 1: re-running the same import is a no-op, which is what makes the
    /// Settings "import again" button safe to press.
    #[test]
    fn skips_a_source_session_already_imported() {
        let existing = candidate("claude", "a", 6);
        let mut ledger = ImportLedger::default();
        ledger.record(imported_entry(&existing));

        assert_eq!(
            decide(&existing, &ledger),
            ImportDecision::Skip(SkipReason::AlreadyImported),
        );
    }

    /// Rule 2: the same conversation arriving from a different app is still
    /// the same conversation.
    #[test]
    fn skips_matching_content_from_a_different_source() {
        let mut ledger = ImportLedger::default();
        ledger.record(imported_entry(&candidate("claude", "a", 6)));

        let same_content_elsewhere = candidate("cursor", "z", 6);

        assert_eq!(
            decide(&same_content_elsewhere, &ledger),
            ImportDecision::Skip(SkipReason::ContentAlreadyImported),
        );
    }

    /// Rule 3: an aggregator's copy names its original; if we already have the
    /// canonical one, the copy adds nothing.
    #[test]
    fn skips_a_reimported_copy_whose_original_is_already_here() {
        let mut ledger = ImportLedger::default();
        ledger.record(imported_entry(&candidate("claude", "original-1", 6)));

        let mut copy = candidate("cursor", "copy-1", 9);
        copy.provenance.reimported_from = Some(ReimportOrigin {
            source_app: "claude".to_string(),
            source_session_id: "original-1".to_string(),
        });

        assert_eq!(
            decide(&copy, &ledger),
            ImportDecision::Skip(SkipReason::OriginalAlreadyImported),
        );
    }

    #[test]
    fn imports_a_reimported_copy_whose_original_is_absent() {
        let ledger = ImportLedger::default();
        let mut copy = candidate("cursor", "copy-1", 9);
        copy.provenance.reimported_from = Some(ReimportOrigin {
            source_app: "claude".to_string(),
            source_session_id: "never-imported".to_string(),
        });

        assert_eq!(decide(&copy, &ledger), ImportDecision::Import);
    }

    /// Rule 4: a truncated export is a question for the user, not a silent
    /// skip and not a silent duplicate.
    #[test]
    fn asks_about_a_close_but_not_identical_copy() {
        let full = candidate("claude", "a", 8);
        let mut ledger = ImportLedger::default();
        ledger.record(imported_entry(&full));

        // Same opening and same last message, two fewer in between.
        let mut truncated = candidate("cursor", "z", 8);
        truncated.messages.remove(4);
        truncated.messages.remove(4);

        assert_eq!(
            decide(&truncated, &ledger),
            ImportDecision::ConfirmPossibleDuplicate {
                existing_fingerprint: full.content_fingerprint(),
            },
        );
    }

    #[test]
    fn imports_when_the_length_gap_is_past_the_fuzzy_tolerance() {
        let full = candidate("claude", "a", 12);
        let mut ledger = ImportLedger::default();
        ledger.record(imported_entry(&full));

        let mut much_shorter = candidate("cursor", "z", 12);
        much_shorter.messages.drain(3..9);

        assert_eq!(decide(&much_shorter, &ledger), ImportDecision::Import);
    }

    /// A failed attempt must not block a later retry.
    #[test]
    fn ignores_ledger_entries_that_did_not_import() {
        let attempted = candidate("claude", "a", 6);
        let mut failed = imported_entry(&attempted);
        failed.status = ImportStatus::Failed;
        let mut ledger = ImportLedger::default();
        ledger.record(failed);

        assert_eq!(decide(&attempted, &ledger), ImportDecision::Import);
    }

    #[test]
    fn ranks_a_native_copy_above_a_reimported_one() {
        let native = candidate("claude", "a", 6);

        let mut known_reimport = candidate("cursor", "b", 6);
        known_reimport.provenance.reimported_from = Some(ReimportOrigin {
            source_app: "claude".to_string(),
            source_session_id: "a".to_string(),
        });

        let mut unknown_reimport = candidate("aggregator", "c", 6);
        unknown_reimport.provenance.reimported_from = Some(ReimportOrigin {
            source_app: "  ".to_string(),
            source_session_id: "unknown".to_string(),
        });

        assert!(source_rank(&native) > source_rank(&known_reimport));
        assert!(source_rank(&known_reimport) > source_rank(&unknown_reimport));
    }

    /// The plan's worked example, end to end: aggregator first, canonical
    /// second, then a re-run of the aggregator.
    #[test]
    fn handles_the_nested_reimport_chain() {
        let mut ledger = ImportLedger::default();

        // 1. Aggregator import; this thread came from the canonical app.
        let mut from_aggregator = candidate("aggregator", "agg-1", 6);
        from_aggregator.provenance.reimported_from = Some(ReimportOrigin {
            source_app: "canonical".to_string(),
            source_session_id: "canon-1".to_string(),
        });
        assert_eq!(decide(&from_aggregator, &ledger), ImportDecision::Import);
        ledger.record(imported_entry(&from_aggregator));

        // 2. The canonical app's own copy is the same content — skipped.
        let canonical_same = candidate("canonical", "canon-1", 6);
        assert_eq!(
            decide(&canonical_same, &ledger),
            ImportDecision::Skip(SkipReason::ContentAlreadyImported),
        );

        // 3. A genuinely new canonical thread still imports.
        let canonical_new = candidate("canonical", "canon-2", 10);
        assert_eq!(decide(&canonical_new, &ledger), ImportDecision::Import);

        // 4. Re-running the aggregator is a no-op.
        assert_eq!(
            decide(&from_aggregator, &ledger),
            ImportDecision::Skip(SkipReason::AlreadyImported),
        );
    }
}
