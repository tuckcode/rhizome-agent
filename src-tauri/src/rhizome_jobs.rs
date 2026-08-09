//! Async job system for cancellable Research panel and inbox operations.
//!
//! Wraps the three write verbs (distill, import, repo_research) in
//! cancellable background tasks. The frontend gets a job ID back
//! immediately and receives lifecycle events; it can send a cancel
//! command at any time.
//!
//! Cancel plumbing reuses `ai_agent_processes::with_stream_id` /
//! `abort_stream`, which kill the spawned agent child process. This
//! only works for operations that go through `run_ai_agent_stream`
//! (distill, import, repo_research all do).
//!
//! ## Event contract
//!
//! | Event | Payload | Fires |
//! |-------|---------|-------|
//! | `rhizome-job-progress-{id}` | `{ "line": "..." }` | Per progress event (same as `rhizome-progress`) |
//! | `rhizome-job-complete-{id}` | `{ "output": "..." }` | On successful completion |
//! | `rhizome-job-error-{id}` | `{ "error": "..." }` | On failure |
//!
//! Read-only ops (search, scan_library, read_events) stay on the
//! synchronous `call_rhizome_tool` path — too fast to need a cancel
//! affordance.

use std::collections::HashMap;
use std::path::Path;

use tauri::Emitter;

/// Trigger recorded in `.rhizome/events.jsonl` when the caller does not say
/// where the capture came from — i.e. someone typed it into the app.
const DEFAULT_TRIGGER: &str = "manual";

/// A research write verb with every argument already resolved.
///
/// Argument resolution ([`build_verb_call`]) is deliberately separated from
/// execution ([`VerbCall::execute`]) so the resolution half is pure and
/// unit-testable without an `AppHandle`.
///
/// This is ONE of several places that decide `trigger` (`manual`,
/// `menu_bar`, `session_auto`, `browser_extension`, …) — **not the only
/// one**, despite what this comment claimed until 2026-07-31. It is also
/// decided at `rhizome_commands.rs:127` (from caller args, defaulting to
/// `"menu_bar"`), hardcoded at `rhizome_repo_research.rs:432,456`,
/// `menu_bar_capture.rs:129` and `commands/vault/file_cmds.rs:158,182`, and
/// omitted entirely by every one of `mcp-server/index.js`'s ten event
/// writes.
///
/// Nor is it "the field the activity log uses": the feed
/// (`src/utils/menuBarActivity.ts:63-67`) reads only `type`, a target field
/// and `timestamp`. **Nothing reads `trigger` back.** See
/// `docs/plans/2026-07-31-save-path-audit-session-status.md` findings 1-3.
#[derive(Debug, Clone)]
pub(crate) enum VerbCall {
    Distill {
        text: String,
        project: Option<String>,
        kind: Option<String>,
        trigger: String,
        target: Option<crate::ai_run_target::AiRunTarget>,
    },
    ImportSource {
        source: String,
        project: Option<String>,
        trigger: String,
        target: Option<crate::ai_run_target::AiRunTarget>,
    },
    RepoResearch {
        repo: String,
        mode: String,
        depth: String,
        project: Option<String>,
        agent: Option<crate::ai_agents::AiAgentId>,
    },
    /// File a page into the vault with no agent call — the save-only lane the
    /// browser extension's "Save URL" uses. See `crate::inbox_action`.
    SaveCapture {
        capture: crate::inbox_action::CaptureRequest,
        trigger: String,
    },
}

/// Fetch an argument, treating an empty string as absent.
fn arg<'a>(args: &'a HashMap<String, String>, key: &str) -> Option<&'a str> {
    args.get(key).map(String::as_str).filter(|v| !v.is_empty())
}

/// Resolve `args` into a [`VerbCall`] for one of the three research write
/// verbs. Pure: no I/O beyond the agent/model lookup `AiRunTarget::from_arg`
/// already performs. Unknown verbs are rejected here.
pub(crate) fn build_verb_call(
    name: &str,
    args: &HashMap<String, String>,
) -> Result<VerbCall, String> {
    let project = arg(args, "project").map(str::to_string);
    let trigger = arg(args, "trigger").unwrap_or(DEFAULT_TRIGGER).to_string();
    let target = || {
        arg(args, "target")
            .or_else(|| arg(args, "agent"))
            .and_then(crate::ai_run_target::AiRunTarget::from_arg)
    };

    match name {
        "rhizome_distill" => Ok(VerbCall::Distill {
            text: args
                .get("text")
                .ok_or_else(|| "Missing text".to_string())?
                .clone(),
            project,
            kind: arg(args, "kind").map(str::to_string),
            trigger,
            target: target(),
        }),
        "rhizome_import_source" => Ok(VerbCall::ImportSource {
            source: args
                .get("source")
                .ok_or_else(|| "Missing source".to_string())?
                .clone(),
            project,
            trigger,
            target: target(),
        }),
        "rhizome_repo_research" => Ok(VerbCall::RepoResearch {
            repo: args
                .get("repo")
                .ok_or_else(|| "Missing repo".to_string())?
                .clone(),
            mode: arg(args, "mode").unwrap_or("architecture").to_string(),
            depth: arg(args, "depth").unwrap_or("fast").to_string(),
            project,
            agent: arg(args, "agent").and_then(crate::ai_agents::parse_agent_id),
        }),
        "rhizome_save_capture" => Ok(VerbCall::SaveCapture {
            capture: crate::inbox_action::CaptureRequest {
                title: arg(args, "title").unwrap_or_default().to_string(),
                source: args
                    .get("source")
                    .ok_or_else(|| "Missing source".to_string())?
                    .clone(),
                context: arg(args, "context").unwrap_or_default().to_string(),
                body: arg(args, "text").unwrap_or_default().to_string(),
            },
            trigger,
        }),
        other => Err(format!("Unknown job verb: {other}")),
    }
}

impl VerbCall {
    /// Run the resolved verb against `vault`, streaming progress to `on_line`.
    pub(crate) fn execute(
        self,
        vault: &Path,
        on_line: &mut dyn FnMut(&str),
    ) -> Result<String, String> {
        match self {
            VerbCall::Distill {
                text,
                project,
                kind,
                trigger,
                target,
            } => crate::rhizome_api::distill(
                vault,
                &text,
                project.as_deref(),
                kind.as_deref(),
                &trigger,
                target,
                on_line,
            ),
            VerbCall::ImportSource {
                source,
                project,
                trigger,
                target,
            } => crate::rhizome_api::import_source(
                vault,
                &source,
                project.as_deref(),
                &trigger,
                target,
                on_line,
            ),
            VerbCall::RepoResearch {
                repo,
                mode,
                depth,
                project,
                agent,
            } => crate::rhizome_api::repo_research(
                vault,
                &repo,
                &mode,
                &depth,
                project.as_deref(),
                agent,
                on_line,
            ),
            VerbCall::SaveCapture { capture, trigger } => {
                crate::inbox_action::save_capture(vault, &capture, &trigger)
            }
        }
    }
}

/// Unique job ID format — `rhizome-job-<uuid>`.
fn job_event_name(job_id: &str, suffix: &str) -> String {
    format!("rhizome-job-{suffix}-{job_id}")
}

/// Emit a progress line event scoped to a job.
fn emit_progress(app: &tauri::AppHandle, job_id: &str, line: &str) {
    let _ = app.emit(
        &job_event_name(job_id, "progress"),
        serde_json::json!({ "line": line }),
    );
}

/// Emit the old generic `rhizome-progress` event too (backward compat).
fn emit_progress_legacy(app: &tauri::AppHandle, line: &str) {
    let _ = app.emit("rhizome-progress", serde_json::json!({ "line": line }));
}

/// Run a single Research-panel write verb as a cancellable job.
///
/// Returns immediately after spawning. The spawned task emits
/// completion/error events on the scoped channel.
fn run_job_blocking(
    app: tauri::AppHandle,
    job_id: String,
    name: String,
    args: std::collections::HashMap<String, String>,
) {
    use tauri::Manager;

    let vault_path = match args.get("vaultPath") {
        Some(vp) => vp.clone(),
        None => {
            let _ = app.emit(
                &job_event_name(&job_id, "error"),
                serde_json::json!({ "error": "Missing vaultPath" }),
            );
            return;
        }
    };

    let vault = Path::new(&vault_path);

    let result = crate::ai_agent_processes::with_stream_id(job_id.clone(), || {
        let mut on_line = |line: &str| {
            emit_progress(&app, &job_id, line);
            emit_progress_legacy(&app, line);
        };

        build_verb_call(&name, &args)?.execute(vault, &mut on_line)
    });

    // Invalidate search on success (same as `call_rhizome_tool` does).
    if result.is_ok() {
        let service = app.state::<crate::rhizome_search::service::RhizomeSearchService>();
        service.invalidate(Path::new(&vault_path));
    }

    let complete_name = job_event_name(&job_id, "complete");
    let error_name = job_event_name(&job_id, "error");

    match result {
        Ok(output) => {
            let _ = app.emit(&complete_name, serde_json::json!({ "output": output }));
        }
        Err(error) => {
            let _ = app.emit(&error_name, serde_json::json!({ "error": error }));
        }
    }
}

// ── Tauri commands ───────────────────────────────────────────────────────────

/// Start a cancellable rhizome job. Returns immediately; results arrive
/// via `rhizome-job-complete-{jobId}` / `rhizome-job-error-{jobId}` events.
#[tauri::command]
pub async fn start_rhizome_job(
    app: tauri::AppHandle,
    job_id: String,
    name: String,
    args: std::collections::HashMap<String, String>,
) -> Result<(), String> {
    // Validate the job_id format early.
    if job_id.is_empty() || job_id.contains('/') || job_id.contains('\\') {
        return Err("Invalid job ID".into());
    }

    // Emit started event so the frontend knows the job is accepted.
    let _ = app.emit(
        &format!("rhizome-job-started-{job_id}"),
        serde_json::json!({ "name": &name }),
    );

    tokio::task::spawn_blocking(move || {
        run_job_blocking(app, job_id, name, args);
    });

    Ok(())
}

/// Cancel a running rhizome job by killing its spawned agent subprocess.
#[tauri::command]
pub fn cancel_rhizome_job(job_id: String) -> Result<bool, String> {
    if job_id.is_empty() || job_id.contains('/') || job_id.contains('\\') {
        return Err("Invalid job ID".into());
    }
    crate::ai_agent_processes::abort_stream(&job_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn job_event_name_formats_correctly() {
        assert_eq!(
            job_event_name("abc-123", "progress"),
            "rhizome-job-progress-abc-123"
        );
        assert_eq!(
            job_event_name("abc-123", "complete"),
            "rhizome-job-complete-abc-123"
        );
        assert_eq!(
            job_event_name("abc-123", "error"),
            "rhizome-job-error-abc-123"
        );
    }

    fn args(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    /// Trigger of the built call, whichever verb it is (repo_research has none).
    fn trigger_of(call: &VerbCall) -> Option<&str> {
        match call {
            VerbCall::Distill { trigger, .. }
            | VerbCall::ImportSource { trigger, .. }
            | VerbCall::SaveCapture { trigger, .. } => Some(trigger.as_str()),
            VerbCall::RepoResearch { .. } => None,
        }
    }

    #[test]
    fn save_capture_honours_caller_supplied_trigger() {
        for caller_trigger in ["browser_extension", "menu_bar", "inbox"] {
            let call = build_verb_call(
                "rhizome_save_capture",
                &args(&[
                    ("source", "https://example.com/a"),
                    ("trigger", caller_trigger),
                ]),
            )
            .unwrap();
            assert_eq!(trigger_of(&call), Some(caller_trigger));
        }
    }

    #[test]
    fn save_capture_resolves_every_field_the_extension_sends() {
        let call = build_verb_call(
            "rhizome_save_capture",
            &args(&[
                ("source", "https://example.com/a"),
                ("title", "A Page"),
                ("context", "Why it matters."),
                ("text", "The article body."),
                ("trigger", "browser_extension"),
            ]),
        )
        .unwrap();
        match call {
            VerbCall::SaveCapture { capture, .. } => {
                assert_eq!(capture.source, "https://example.com/a");
                assert_eq!(capture.title, "A Page");
                assert_eq!(capture.context, "Why it matters.");
                assert_eq!(capture.body, "The article body.");
            }
            other => panic!("expected SaveCapture, got {other:?}"),
        }
    }

    #[test]
    fn save_capture_needs_only_a_source() {
        let call = build_verb_call(
            "rhizome_save_capture",
            &args(&[("source", "https://example.com/a")]),
        )
        .unwrap();
        match call {
            VerbCall::SaveCapture { capture, .. } => {
                assert_eq!(capture.source, "https://example.com/a");
                assert!(capture.title.is_empty());
                assert!(capture.body.is_empty());
            }
            other => panic!("expected SaveCapture, got {other:?}"),
        }
        assert_eq!(
            build_verb_call("rhizome_save_capture", &args(&[])).unwrap_err(),
            "Missing source"
        );
    }

    #[test]
    fn distill_honours_caller_supplied_trigger() {
        for caller_trigger in ["menu_bar", "session_auto", "browser_extension", "inbox"] {
            let call = build_verb_call(
                "rhizome_distill",
                &args(&[("text", "hello"), ("trigger", caller_trigger)]),
            )
            .unwrap();
            assert_eq!(trigger_of(&call), Some(caller_trigger));
        }
    }

    #[test]
    fn import_source_honours_caller_supplied_trigger() {
        for caller_trigger in ["menu_bar", "session_auto", "browser_extension"] {
            let call = build_verb_call(
                "rhizome_import_source",
                &args(&[
                    ("source", "https://example.com"),
                    ("trigger", caller_trigger),
                ]),
            )
            .unwrap();
            assert_eq!(trigger_of(&call), Some(caller_trigger));
        }
    }

    #[test]
    fn trigger_defaults_to_manual_when_caller_omits_it() {
        let distill = build_verb_call("rhizome_distill", &args(&[("text", "hello")])).unwrap();
        assert_eq!(trigger_of(&distill), Some("manual"));

        let import = build_verb_call(
            "rhizome_import_source",
            &args(&[("source", "https://example.com")]),
        )
        .unwrap();
        assert_eq!(trigger_of(&import), Some("manual"));
    }

    #[test]
    fn empty_trigger_is_treated_as_absent() {
        let call =
            build_verb_call("rhizome_distill", &args(&[("text", "hi"), ("trigger", "")])).unwrap();
        assert_eq!(trigger_of(&call), Some("manual"));
    }

    #[test]
    fn distill_resolves_text_project_and_kind() {
        let call = build_verb_call(
            "rhizome_distill",
            &args(&[
                ("text", "some note"),
                ("project", "rhizome"),
                ("kind", "concept"),
            ]),
        )
        .unwrap();
        match call {
            VerbCall::Distill {
                text,
                project,
                kind,
                ..
            } => {
                assert_eq!(text, "some note");
                assert_eq!(project.as_deref(), Some("rhizome"));
                assert_eq!(kind.as_deref(), Some("concept"));
            }
            other => panic!("expected Distill, got {other:?}"),
        }
    }

    #[test]
    fn empty_project_and_kind_resolve_to_none() {
        let call = build_verb_call(
            "rhizome_distill",
            &args(&[("text", "t"), ("project", ""), ("kind", "")]),
        )
        .unwrap();
        match call {
            VerbCall::Distill { project, kind, .. } => {
                assert!(project.is_none());
                assert!(kind.is_none());
            }
            other => panic!("expected Distill, got {other:?}"),
        }
    }

    #[test]
    fn import_source_resolves_source_and_project() {
        let call = build_verb_call(
            "rhizome_import_source",
            &args(&[("source", "https://example.com/a"), ("project", "p")]),
        )
        .unwrap();
        match call {
            VerbCall::ImportSource {
                source, project, ..
            } => {
                assert_eq!(source, "https://example.com/a");
                assert_eq!(project.as_deref(), Some("p"));
            }
            other => panic!("expected ImportSource, got {other:?}"),
        }
    }

    #[test]
    fn repo_research_defaults_mode_and_depth() {
        let call =
            build_verb_call("rhizome_repo_research", &args(&[("repo", "owner/repo")])).unwrap();
        match call {
            VerbCall::RepoResearch {
                repo,
                mode,
                depth,
                project,
                agent,
            } => {
                assert_eq!(repo, "owner/repo");
                assert_eq!(mode, "architecture");
                assert_eq!(depth, "fast");
                assert!(project.is_none());
                assert!(agent.is_none());
            }
            other => panic!("expected RepoResearch, got {other:?}"),
        }
    }

    #[test]
    fn repo_research_honours_explicit_mode_depth_and_project() {
        let call = build_verb_call(
            "rhizome_repo_research",
            &args(&[
                ("repo", "owner/repo"),
                ("mode", "onboarding"),
                ("depth", "deep"),
                ("project", "proj"),
            ]),
        )
        .unwrap();
        match call {
            VerbCall::RepoResearch {
                mode,
                depth,
                project,
                ..
            } => {
                assert_eq!(mode, "onboarding");
                assert_eq!(depth, "deep");
                assert_eq!(project.as_deref(), Some("proj"));
            }
            other => panic!("expected RepoResearch, got {other:?}"),
        }
    }

    #[test]
    fn missing_required_args_are_rejected_per_verb() {
        assert_eq!(
            build_verb_call("rhizome_distill", &args(&[])).unwrap_err(),
            "Missing text"
        );
        assert_eq!(
            build_verb_call("rhizome_import_source", &args(&[])).unwrap_err(),
            "Missing source"
        );
        assert_eq!(
            build_verb_call("rhizome_repo_research", &args(&[])).unwrap_err(),
            "Missing repo"
        );
    }

    #[test]
    fn unknown_verb_is_rejected_with_the_job_error_message() {
        assert_eq!(
            build_verb_call("rhizome_search", &args(&[])).unwrap_err(),
            "Unknown job verb: rhizome_search"
        );
    }

    #[test]
    fn cancel_with_empty_id_returns_false_not_error() {
        // abort_stream returns Ok(false) when no child is registered — it's not
        // an error, just a no-op.
        let result = crate::ai_agent_processes::abort_stream("");
        assert!(matches!(result, Ok(false)));
    }
}
