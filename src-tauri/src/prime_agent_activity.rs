//! What the Prime harness is doing beyond answering the current message.
//!
//! Prime is not a model in a chat box. It carries a persistent **goal** with a
//! token budget, schedules its own recurring re-entry (**heartbeats** and
//! **schedules**), and spawns subagents. Rhizome rendered none of it, so the
//! app showed a chatbot while the harness ran underneath.
//!
//! This gathers the parts the RPC surface exposes. Probed 2026-08-15:
//! `get_state.goal`, `list_heartbeats` and `list_schedules` all answer.
//!
//! **We do not own these shapes.** Every field is optional and unknown keys are
//! ignored, so a Prime release that adds or renames one degrades to a quieter
//! band rather than a failed command.

use serde::Serialize;

/// The persistent objective the harness re-prompts toward across turns.
///
/// Observed idle shape: `{active, status, tokensUsed, timeUsedSeconds,
/// continuationsUsed}`. An active goal also carries its objective text and a
/// remaining budget; those are optional here because an idle session never
/// shows them and inventing a name for a field we have not seen is how the
/// `model_change` parse went wrong.
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

/// Read the goal out of a `get_state` payload.
///
/// Returns `None` when the key is absent entirely — an older Prime, or a shape
/// change — so the band omits the goal rather than claiming an idle one.
pub fn goal_from_state(state: &serde_json::Value) -> Option<PrimeGoalState> {
    let goal = state.get("goal")?;
    if !goal.is_object() {
        return None;
    }
    Some(PrimeGoalState {
        active: goal["active"].as_bool().unwrap_or(false),
        status: goal["status"].as_str().map(str::to_string),
        objective: first_string(goal, &["objective", "text", "description", "prompt"]),
        tokens_used: goal["tokensUsed"].as_u64(),
        remaining_tokens: first_u64(goal, &["remainingTokens", "tokenBudgetRemaining"]),
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

    /// Captured from a live `get_state` on 2026-08-15, idle session.
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

    #[test]
    fn an_active_goal_reports_its_objective_and_budget() {
        let state = serde_json::json!({
            "goal": {
                "active": true,
                "status": "running",
                "objective": "ship the release notes",
                "tokensUsed": 120_000,
                "remainingTokens": 80_000,
                "continuationsUsed": 3
            }
        });

        let goal = goal_from_state(&state).expect("goal present");

        assert!(goal.active);
        assert_eq!(goal.objective.as_deref(), Some("ship the release notes"));
        assert_eq!(goal.tokens_used, Some(120_000));
        assert_eq!(goal.remaining_tokens, Some(80_000));
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
