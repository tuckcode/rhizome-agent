//! What the Prime harness is doing beyond answering the current message.
//!
//! Prime is not a model in a chat box. It carries a persistent **goal** with a
//! token budget, schedules its own recurring re-entry (**heartbeats** and
//! **schedules**), and spawns subagents. Rhizome rendered none of it, so the
//! app showed a chatbot while the harness ran underneath.
//!
//! **Correction, 2026-08-16, re-probed against the daemon transport Rhizome
//! actually uses (0.7.2):** a prior pass (2026-08-15) claimed `get_state.goal`
//! answers. That was wrong for the daemon — confirmed live by sending
//! `get_state` right after creating a real goal and getting back a payload
//! with no `goal` key at all (`modes/daemon/daemon-session-list.js`'s
//! `summaryForActiveSession`, what daemon `get_state` returns, never sets one;
//! only RPC mode's summarizer does). The daemon command that does carry it is
//! `get_connection_state` (`createConnectionState` in the installed daemon,
//! wrapping `createAgentConnectionState` from `modes/agent-connection/
//! snapshot.js`, which sets `goal: session.goalState` directly). Its shape
//! also differs from what was assumed: the budget field is `tokenBudget`, not
//! `remainingTokens` — captured live from a real active goal:
//! `{active, status, goalId, objective, tokenBudget, tokensUsed,
//! timeUsedSeconds, continuationsUsed, createdAt, updatedAt}`.
//!
//! `list_heartbeats` and `list_schedules` were not re-verified against a real
//! heartbeat/schedule in this pass; `heartbeats_list`/`cron_list` (the daemon
//! command names actually used) are unchanged from the 2026-08-15 probe.
//!
//! **We do not own these shapes.** Every field is optional and unknown keys are
//! ignored, so a Prime release that adds or renames one degrades to a quieter
//! band rather than a failed command.

use serde::Serialize;

/// The persistent objective the harness re-prompts toward across turns.
///
/// Observed idle shape (via `get_connection_state`):
/// `{active, status, tokensUsed, timeUsedSeconds, continuationsUsed}`. An
/// active goal also carries `objective` and `tokenBudget`; `remaining_tokens`
/// is derived here as `tokenBudget - tokensUsed` since Prime's payload has no
/// remaining-budget field of its own — inventing one that matched neither
/// name is how the `model_change` parse went wrong previously, so this
/// computes it instead of guessing a key.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeGoalState {
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub objective: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens_used: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_budget: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remaining_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_used_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub continuations_used: Option<u64>,
}

/// A recurring internal prompt the agent scheduled for itself.
///
/// Field names are read defensively: no live heartbeat existed while this was
/// written (`list_heartbeats` returned `[]`), so the item shape is inferred
/// from the `rlm-heartbeat` skill's API rather than observed. Anything missing
/// simply does not render.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeScheduledWork {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

/// Everything the band shows, in one payload.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeAgentActivity {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub goal: Option<PrimeGoalState>,
    pub heartbeats: Vec<PrimeScheduledWork>,
    pub schedules: Vec<PrimeScheduledWork>,
    /// Reasoning effort the session is running at, from `get_state`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking_level: Option<String>,
}

/// Read the goal out of a `get_connection_state` payload.
///
/// Returns `None` when the key is absent entirely — an older Prime, a shape
/// change, or (as `get_state` turned out to be) simply the wrong command —
/// so the band omits the goal rather than claiming an idle one.
pub fn goal_from_state(state: &serde_json::Value) -> Option<PrimeGoalState> {
    let goal = state.get("goal")?;
    if !goal.is_object() {
        return None;
    }
    let tokens_used = goal["tokensUsed"].as_u64();
    let token_budget = first_u64(goal, &["tokenBudget", "token_budget"]);
    // Prime reports usage and budget, not what's left — derive it rather than
    // guess at a remaining-budget field name it does not send.
    let remaining_tokens = match (token_budget, tokens_used) {
        (Some(budget), Some(used)) => Some(budget.saturating_sub(used)),
        _ => first_u64(goal, &["remainingTokens", "tokenBudgetRemaining"]),
    };
    Some(PrimeGoalState {
        active: goal["active"].as_bool().unwrap_or(false),
        status: goal["status"].as_str().map(str::to_string),
        objective: first_string(goal, &["objective", "text", "description", "prompt"]),
        tokens_used,
        token_budget,
        remaining_tokens,
        time_used_seconds: goal["timeUsedSeconds"].as_u64(),
        continuations_used: goal["continuationsUsed"].as_u64(),
    })
}

/// Read a list of scheduled work from a `list_heartbeats` / `list_schedules`
/// payload. Prime names the arrays differently (`heartbeats` vs `jobs`).
pub fn scheduled_work_from_response(
    data: &serde_json::Value,
    keys: &[&str],
) -> Vec<PrimeScheduledWork> {
    keys.iter()
        .find_map(|key| data.get(*key).and_then(|value| value.as_array()))
        .map(|items| {
            items
                .iter()
                .map(|item| PrimeScheduledWork {
                    id: first_string(item, &["id", "jobId", "job_id"]),
                    label: first_string(item, &["label", "name", "prompt", "description"]),
                    interval: first_string(item, &["interval", "every", "schedule", "cron"]),
                    status: first_string(item, &["status", "state"]),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn first_string(value: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(|found| found.as_str()))
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

fn first_u64(value: &serde_json::Value, keys: &[&str]) -> Option<u64> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(|found| found.as_u64()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Captured from a live `get_connection_state` on 2026-08-16, idle session.
    #[test]
    fn an_idle_goal_parses_without_inventing_an_objective() {
        let state = serde_json::json!({
            "goal": {
                "active": false,
                "status": "idle",
                "tokensUsed": 0,
                "timeUsedSeconds": 0,
                "continuationsUsed": 0
            }
        });

        let goal = goal_from_state(&state).expect("goal present");

        assert!(!goal.active);
        assert_eq!(goal.status.as_deref(), Some("idle"));
        assert_eq!(goal.objective, None, "idle goals carry no objective text");
        assert_eq!(goal.tokens_used, Some(0));
    }

    /// Captured verbatim from a live `get_connection_state` on 2026-08-16
    /// against an active goal — Prime sends `tokenBudget`, not
    /// `remainingTokens`; this is the shape a guessed field name would have
    /// silently missed.
    #[test]
    fn an_active_goal_derives_remaining_budget_from_token_budget_and_tokens_used() {
        let state = serde_json::json!({
            "goal": {
                "active": true,
                "status": "active",
                "goalId": "ef5e700c-f2c1-417d-9db1-13876a625531",
                "objective": "ship the release notes",
                "tokenBudget": 200_000,
                "tokensUsed": 120_000,
                "timeUsedSeconds": 12,
                "continuationsUsed": 3,
                "createdAt": 1_786_915_608_002_u64,
                "updatedAt": 1_786_915_608_002_u64
            }
        });

        let goal = goal_from_state(&state).expect("goal present");

        assert!(goal.active);
        assert_eq!(goal.objective.as_deref(), Some("ship the release notes"));
        assert_eq!(goal.tokens_used, Some(120_000));
        assert_eq!(goal.token_budget, Some(200_000));
        assert_eq!(goal.remaining_tokens, Some(80_000));
    }

    /// A future Prime that actually sends a remaining-budget field directly
    /// (rather than budget + used) must still be read, not ignored because
    /// `tokenBudget` was absent.
    #[test]
    fn remaining_tokens_falls_back_to_an_explicit_field_when_budget_is_absent() {
        let state = serde_json::json!({
            "goal": {
                "active": true,
                "objective": "ship it",
                "tokensUsed": 1000,
                "remainingTokens": 500
            }
        });

        let goal = goal_from_state(&state).expect("goal present");

        assert_eq!(goal.token_budget, None);
        assert_eq!(goal.remaining_tokens, Some(500));
    }

    /// An older Prime, or a renamed key. The band should omit the goal rather
    /// than render a confident "idle" that was never reported.
    #[test]
    fn a_state_without_a_goal_yields_nothing() {
        assert_eq!(goal_from_state(&serde_json::json!({})), None);
        assert_eq!(goal_from_state(&serde_json::json!({"goal": null})), None);
    }

    #[test]
    fn heartbeats_and_schedules_read_from_their_own_array_names() {
        let heartbeats = scheduled_work_from_response(
            &serde_json::json!({"heartbeats": [{"id": "hb-1", "label": "tests", "interval": "5m"}]}),
            &["heartbeats"],
        );
        let jobs = scheduled_work_from_response(
            &serde_json::json!({"jobs": [{"jobId": "job-1", "name": "nightly"}]}),
            &["jobs", "schedules"],
        );

        assert_eq!(heartbeats[0].label.as_deref(), Some("tests"));
        assert_eq!(heartbeats[0].interval.as_deref(), Some("5m"));
        assert_eq!(jobs[0].id.as_deref(), Some("job-1"));
        assert_eq!(jobs[0].label.as_deref(), Some("nightly"));
    }

    /// The observed live responses. Nothing scheduled is the normal case and
    /// must not read as an error.
    #[test]
    fn empty_lists_are_normal() {
        assert!(scheduled_work_from_response(
            &serde_json::json!({"heartbeats": []}),
            &["heartbeats"]
        )
        .is_empty());
        assert!(scheduled_work_from_response(&serde_json::json!({}), &["jobs"]).is_empty());
    }

    /// We do not own this format; an item with nothing we recognise still
    /// counts as scheduled work rather than disappearing from the count.
    #[test]
    fn an_unrecognised_item_still_counts() {
        let work = scheduled_work_from_response(
            &serde_json::json!({"heartbeats": [{"somethingNew": 1}]}),
            &["heartbeats"],
        );

        assert_eq!(work.len(), 1);
        assert_eq!(work[0].label, None);
    }
}
