//! Which imported sessions earn a row in the Prime session list.
//!
//! Everything importable goes to the vault — notes are cheap and that is where
//! the durable memory lives. The session list is different: each row costs a
//! `new_session` + `import_jsonl` round trip that displaces whatever session the
//! user has open (see the plan's Destination section). At real scale that is
//! not a background cost — this machine alone holds 316 Claude Code sessions
//! across 17 project folders.
//!
//! So this module answers one narrow question: of everything we could import,
//! which subset is worth the expensive path. Nothing here decides what gets
//! *imported* — only what gets a convenient row.

use std::collections::HashMap;

/// Defaults chosen against the real distribution on this machine (2026-09-05):
/// 316 sessions across 17 project folders, one holding 216 and six holding
/// exactly one.
pub const DEFAULT_PER_PROJECT_LIMIT: usize = 3;
pub const DEFAULT_MIN_MESSAGES: usize = 4;
pub const DEFAULT_MIN_CHARACTERS: usize = 200;
pub const DEFAULT_TOTAL_LIMIT: usize = 150;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SelectionPolicy {
    /// Per project, not overall. A flat cap would be swallowed whole by one
    /// busy project — on this machine a global 5 would take all five rows from
    /// the 216-session folder and show nothing from the other sixteen.
    pub per_project_limit: usize,
    /// Sessions shorter than this are usually "opened it, typed one thing,
    /// closed it" and would fill a slot without earning it.
    pub min_messages: usize,
    /// Guards against the other shape of triviality: enough messages, but all
    /// of them one word.
    pub min_characters: usize,
    /// Backstop for someone with far more projects than this machine has.
    pub total_limit: usize,
}

impl Default for SelectionPolicy {
    fn default() -> Self {
        Self {
            per_project_limit: DEFAULT_PER_PROJECT_LIMIT,
            min_messages: DEFAULT_MIN_MESSAGES,
            min_characters: DEFAULT_MIN_CHARACTERS,
            total_limit: DEFAULT_TOTAL_LIMIT,
        }
    }
}

/// What selection needs to know about a session, independent of its source.
///
/// Deliberately not the parsed session itself: every adapter can describe its
/// sessions this way, so no harness gets its own selection behaviour.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectionInput {
    /// Groups sessions that belong together — a project folder, a workspace,
    /// whatever the source's equivalent is. Sources without one pass a constant.
    pub project_key: String,
    pub source_session_id: String,
    pub message_count: usize,
    pub character_count: usize,
    /// Higher is more recent. Days since epoch, or any monotonic stand-in.
    pub last_active: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotSelected {
    /// Below `min_messages` or `min_characters`.
    TooSlight,
    /// Real session, but its project already contributed its share.
    ProjectQuotaFull,
    /// Real session, but the whole run hit `total_limit`.
    TotalLimitReached,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Selection {
    /// Session ids that earn a row, most recently active first.
    pub for_session_list: Vec<String>,
    /// Everything else, with the reason — so the UI can say "314 imported to
    /// your vault, 35 also added to sessions" rather than going quiet.
    pub vault_only: Vec<(String, NotSelected)>,
}

impl Selection {
    pub fn reason_for(&self, source_session_id: &str) -> Option<NotSelected> {
        self.vault_only
            .iter()
            .find(|(id, _)| id == source_session_id)
            .map(|(_, reason)| *reason)
    }
}

/// Pick the sessions worth a session-list row.
///
/// Order is deliberate: substance first (a trivial session should not consume a
/// project's quota), then recency within each project, then the global
/// backstop. Ties break on session id so a re-run selects the same set.
pub fn select_for_session_list(inputs: &[SelectionInput], policy: SelectionPolicy) -> Selection {
    let mut ranked: Vec<&SelectionInput> = Vec::with_capacity(inputs.len());
    let mut vault_only: Vec<(String, NotSelected)> = Vec::new();

    for input in inputs {
        if input.message_count < policy.min_messages
            || input.character_count < policy.min_characters
        {
            vault_only.push((input.source_session_id.clone(), NotSelected::TooSlight));
        } else {
            ranked.push(input);
        }
    }

    ranked.sort_by(|left, right| {
        right
            .last_active
            .cmp(&left.last_active)
            .then_with(|| left.source_session_id.cmp(&right.source_session_id))
    });

    let mut per_project: HashMap<&str, usize> = HashMap::new();
    let mut for_session_list = Vec::new();

    for input in ranked {
        let taken = per_project.entry(input.project_key.as_str()).or_insert(0);
        if *taken >= policy.per_project_limit {
            vault_only.push((
                input.source_session_id.clone(),
                NotSelected::ProjectQuotaFull,
            ));
            continue;
        }
        if for_session_list.len() >= policy.total_limit {
            vault_only.push((
                input.source_session_id.clone(),
                NotSelected::TotalLimitReached,
            ));
            continue;
        }
        *taken += 1;
        for_session_list.push(input.source_session_id.clone());
    }

    Selection {
        for_session_list,
        vault_only,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(project: &str, id: &str, last_active: i64) -> SelectionInput {
        SelectionInput {
            project_key: project.to_string(),
            source_session_id: id.to_string(),
            message_count: 10,
            character_count: 2_000,
            last_active,
        }
    }

    #[test]
    fn takes_the_most_recent_few_from_each_project() {
        let inputs = vec![
            session("alpha", "a-old", 10),
            session("alpha", "a-mid", 20),
            session("alpha", "a-new", 30),
            session("alpha", "a-newest", 40),
            session("beta", "b-only", 5),
        ];

        let selection = select_for_session_list(&inputs, SelectionPolicy::default());

        assert_eq!(
            selection.for_session_list,
            vec!["a-newest", "a-new", "a-mid", "b-only"]
        );
        assert_eq!(
            selection.reason_for("a-old"),
            Some(NotSelected::ProjectQuotaFull)
        );
    }

    /// The reason for a per-project cap: on this machine a flat limit would
    /// take every slot from the one 216-session folder.
    #[test]
    fn a_busy_project_cannot_crowd_out_quiet_ones() {
        let mut inputs: Vec<SelectionInput> = (0..200)
            .map(|index| session("busy", &format!("busy-{index:03}"), 1_000 + index))
            .collect();
        inputs.push(session("quiet", "quiet-1", 1));

        let selection = select_for_session_list(&inputs, SelectionPolicy::default());

        assert!(selection.for_session_list.contains(&"quiet-1".to_string()));
        let busy_rows = selection
            .for_session_list
            .iter()
            .filter(|id| id.starts_with("busy-"))
            .count();
        assert_eq!(busy_rows, DEFAULT_PER_PROJECT_LIMIT);
    }

    #[test]
    fn skips_sessions_too_short_to_be_worth_a_row() {
        let mut barely_started = session("alpha", "stub", 100);
        barely_started.message_count = 2;
        barely_started.character_count = 40;

        let selection = select_for_session_list(&[barely_started], SelectionPolicy::default());

        assert!(selection.for_session_list.is_empty());
        assert_eq!(selection.reason_for("stub"), Some(NotSelected::TooSlight));
    }

    /// Enough messages, but all of them one word — the other shape of trivial.
    #[test]
    fn skips_sessions_with_enough_messages_but_almost_no_content() {
        let mut terse = session("alpha", "terse", 100);
        terse.message_count = 12;
        terse.character_count = 30;

        let selection = select_for_session_list(&[terse], SelectionPolicy::default());

        assert_eq!(selection.reason_for("terse"), Some(NotSelected::TooSlight));
    }

    /// A trivial session must not consume a slot a real one could have used.
    #[test]
    fn a_trivial_session_does_not_spend_its_project_quota() {
        let mut stub = session("alpha", "stub", 999);
        stub.message_count = 1;
        stub.character_count = 5;
        let inputs = vec![
            stub,
            session("alpha", "real-1", 30),
            session("alpha", "real-2", 20),
            session("alpha", "real-3", 10),
        ];

        let selection = select_for_session_list(&inputs, SelectionPolicy::default());

        assert_eq!(
            selection.for_session_list,
            vec!["real-1", "real-2", "real-3"]
        );
    }

    #[test]
    fn stops_at_the_total_limit_for_someone_with_very_many_projects() {
        let policy = SelectionPolicy {
            total_limit: 4,
            ..SelectionPolicy::default()
        };
        let inputs: Vec<SelectionInput> = (0..10)
            .map(|index| session(&format!("project-{index}"), &format!("s-{index}"), index))
            .collect();

        let selection = select_for_session_list(&inputs, policy);

        assert_eq!(selection.for_session_list.len(), 4);
        assert_eq!(
            selection.reason_for("s-0"),
            Some(NotSelected::TotalLimitReached)
        );
    }

    /// Nothing is lost — a skipped session is still imported to the vault, and
    /// the caller can say why it did not get a row.
    #[test]
    fn accounts_for_every_input_exactly_once() {
        let mut stub = session("alpha", "stub", 5);
        stub.message_count = 1;
        stub.character_count = 5;
        let inputs = vec![
            stub,
            session("alpha", "a-1", 40),
            session("alpha", "a-2", 30),
            session("alpha", "a-3", 20),
            session("alpha", "a-4", 10),
            session("beta", "b-1", 15),
        ];

        let selection = select_for_session_list(&inputs, SelectionPolicy::default());

        assert_eq!(
            selection.for_session_list.len() + selection.vault_only.len(),
            inputs.len(),
        );
    }

    /// Re-running an import must offer the same set, not reshuffle on a tie.
    #[test]
    fn is_stable_when_sessions_share_a_timestamp() {
        let inputs = vec![
            session("alpha", "c", 10),
            session("alpha", "a", 10),
            session("alpha", "b", 10),
            session("alpha", "d", 10),
        ];

        let first = select_for_session_list(&inputs, SelectionPolicy::default());
        let second = select_for_session_list(&inputs, SelectionPolicy::default());

        assert_eq!(first.for_session_list, second.for_session_list);
        assert_eq!(first.for_session_list, vec!["a", "b", "c"]);
    }

    #[test]
    fn selects_nothing_from_nothing() {
        let selection = select_for_session_list(&[], SelectionPolicy::default());

        assert!(selection.for_session_list.is_empty());
        assert!(selection.vault_only.is_empty());
    }
}
