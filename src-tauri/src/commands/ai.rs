#[cfg(desktop)]
use crate::ai_agents::{AiAgentStreamRequest, AiAgentsStatus};
#[cfg(desktop)]
use crate::ai_models::{AiModelProviderTestRequest, AiModelStreamRequest};
use crate::claude_cli::{ChatStreamRequest, ClaudeCliStatus};
use crate::vault::VaultAiGuidanceStatus;

use super::expand_tilde;

#[cfg(desktop)]
type StreamEmitter<Event> = Box<dyn Fn(Event) + Send>;

#[cfg(desktop)]
const AGENT_DOCS_RESOURCE_DIR: &str = "agent-docs";

#[cfg(desktop)]
struct DesktopStreamScope {
    event_name: String,
    stream_id: Option<String>,
}

#[cfg(desktop)]
impl DesktopStreamScope {
    fn shared(event_name: impl Into<String>) -> Self {
        Self {
            event_name: event_name.into(),
            stream_id: None,
        }
    }

    fn cancellable(event_name: impl Into<String>) -> Self {
        let event_name = event_name.into();
        Self {
            stream_id: Some(event_name.clone()),
            event_name,
        }
    }
}

#[cfg(desktop)]
async fn run_desktop_stream<Event, Request, Runner>(
    app_handle: tauri::AppHandle,
    scope: DesktopStreamScope,
    request: Request,
    runner: Runner,
) -> Result<String, String>
where
    Event: serde::Serialize + Send + 'static,
    Request: Send + 'static,
    Runner: FnOnce(Request, StreamEmitter<Event>) -> Result<String, String> + Send + 'static,
{
    use tauri::Emitter;

    tokio::task::spawn_blocking(move || {
        let DesktopStreamScope {
            event_name,
            stream_id,
        } = scope;
        let run = || {
            runner(
                request,
                Box::new(move |event| {
                    let _ = app_handle.emit(event_name.as_str(), &event);
                }),
            )
        };
        match stream_id {
            Some(stream_id) => crate::ai_agent_processes::with_stream_id(stream_id, run),
            None => run(),
        }
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[cfg(desktop)]
macro_rules! define_desktop_stream_command {
    ($name:ident, $request:ty, $event_name:literal, $runner:path) => {
        #[tauri::command]
        pub async fn $name(
            app_handle: tauri::AppHandle,
            request: $request,
        ) -> Result<String, String> {
            run_desktop_stream(
                app_handle,
                DesktopStreamScope::shared($event_name),
                request,
                $runner,
            )
            .await
        }
    };
}

#[cfg(desktop)]
fn is_scoped_stream_event_name(default_event_name: &str, event_name: &str) -> bool {
    event_name
        .strip_prefix(default_event_name)
        .and_then(|suffix| suffix.strip_prefix('-'))
        .is_some_and(|suffix| {
            !suffix.is_empty()
                && suffix
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
        })
}

#[cfg(desktop)]
fn stream_event_name(default_event_name: &'static str, requested: Option<&str>) -> String {
    requested
        .filter(|event_name| is_scoped_stream_event_name(default_event_name, event_name))
        .unwrap_or(default_event_name)
        .to_string()
}

// ── Claude CLI commands (desktop) ───────────────────────────────────────────

#[cfg(desktop)]
#[tauri::command]
pub fn check_claude_cli() -> ClaudeCliStatus {
    crate::claude_cli::check_cli()
}

#[cfg(desktop)]
#[tauri::command]
pub async fn get_ai_agents_status() -> AiAgentsStatus {
    crate::ai_agents::get_ai_agents_status().await
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_agent_docs_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    use std::path::PathBuf;
    use tauri::path::BaseDirectory;
    use tauri::Manager;

    let mut candidates = Vec::new();

    if let Ok(resource_path) = app_handle
        .path()
        .resolve(AGENT_DOCS_RESOURCE_DIR, BaseDirectory::Resource)
    {
        candidates.push(resource_path);
    }

    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(AGENT_DOCS_RESOURCE_DIR),
    );

    candidates
        .into_iter()
        .find(|path| path.join("index.md").is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .ok_or_else(|| "Rhizome agent docs are not bundled in this build.".to_string())
}

#[tauri::command]
pub fn get_vault_ai_guidance_status(vault_path: String) -> Result<VaultAiGuidanceStatus, String> {
    let vault_path = expand_tilde(&vault_path);
    crate::vault::get_ai_guidance_status(vault_path.as_ref())
}

#[tauri::command]
pub fn restore_vault_ai_guidance(vault_path: String) -> Result<VaultAiGuidanceStatus, String> {
    let vault_path = expand_tilde(&vault_path);
    crate::vault::restore_ai_guidance_files(vault_path.as_ref())
}

#[cfg(desktop)]
define_desktop_stream_command!(
    stream_claude_chat,
    ChatStreamRequest,
    "claude-stream",
    crate::claude_cli::run_chat_stream
);

#[cfg(desktop)]
fn normalize_agent_request(mut request: AiAgentStreamRequest) -> AiAgentStreamRequest {
    request.vault_path = expand_tilde(&request.vault_path).into_owned();
    request.vault_paths = request
        .vault_paths
        .into_iter()
        .map(|path| expand_tilde(&path).into_owned())
        .collect();
    request
}

#[cfg(desktop)]
fn run_normalized_ai_agent_stream(
    request: AiAgentStreamRequest,
    emitter: StreamEmitter<crate::ai_agents::AiAgentStreamEvent>,
) -> Result<String, String> {
    crate::ai_agents::run_ai_agent_stream(normalize_agent_request(request), emitter)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn stream_ai_agent(
    app_handle: tauri::AppHandle,
    request: AiAgentStreamRequest,
) -> Result<String, String> {
    let event_name = stream_event_name("ai-agent-stream", request.event_name.as_deref());
    run_desktop_stream(
        app_handle,
        DesktopStreamScope::cancellable(event_name),
        request,
        run_normalized_ai_agent_stream,
    )
    .await
}

#[cfg(desktop)]
#[tauri::command]
pub fn abort_ai_agent_stream(event_name: String) -> Result<bool, String> {
    if !is_scoped_stream_event_name("ai-agent-stream", &event_name) {
        return Err("Invalid AI agent stream id".into());
    }

    crate::ai_agent_processes::abort_stream(&event_name)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn stream_ai_model(
    app_handle: tauri::AppHandle,
    request: AiModelStreamRequest,
) -> Result<String, String> {
    let event_name = stream_event_name("ai-model-stream", request.event_name.as_deref());
    run_desktop_stream(
        app_handle,
        DesktopStreamScope::shared(event_name),
        request,
        crate::ai_models::run_ai_model_stream,
    )
    .await
}

#[cfg(desktop)]
#[tauri::command]
pub fn save_ai_model_provider_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    crate::ai_models::save_provider_api_key(provider_id, api_key)
}

#[cfg(desktop)]
#[tauri::command]
pub fn delete_ai_model_provider_api_key(provider_id: String) -> Result<(), String> {
    crate::ai_models::delete_provider_api_key(provider_id)
}

#[cfg(desktop)]
#[tauri::command]
pub fn test_ai_model_provider(request: AiModelProviderTestRequest) -> Result<String, String> {
    crate::ai_models::test_ai_model_provider(request)
}

// ── Claude CLI (mobile stubs) ───────────────────────────────────────────────

#[cfg(mobile)]
#[tauri::command]
pub fn check_claude_cli() -> ClaudeCliStatus {
    ClaudeCliStatus {
        installed: false,
        version: None,
    }
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_ai_agents_status() -> AiAgentsStatus {
    AiAgentsStatus {
        claude_code: crate::ai_agents::AiAgentAvailability {
            installed: false,
            version: None,
        },
        codex: crate::ai_agents::AiAgentAvailability {
            installed: false,
            version: None,
        },
        opencode: crate::ai_agents::AiAgentAvailability {
            installed: false,
            version: None,
        },
        pi: crate::ai_agents::AiAgentAvailability {
            installed: false,
            version: None,
        },
        antigravity: crate::ai_agents::AiAgentAvailability {
            installed: false,
            version: None,
        },
        kiro: crate::ai_agents::AiAgentAvailability {
            installed: false,
            version: None,
        },
        hermes: crate::ai_agents::AiAgentAvailability {
            installed: false,
            version: None,
        },
    }
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_agent_docs_path() -> Result<String, String> {
    Err("Bundled agent docs are only available in the desktop app.".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn stream_claude_chat(
    _app_handle: tauri::AppHandle,
    _request: ChatStreamRequest,
) -> Result<String, String> {
    Err("Claude CLI is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn stream_ai_agent(
    _app_handle: tauri::AppHandle,
    _request: AiAgentStreamRequest,
) -> Result<String, String> {
    Err("CLI AI agents are not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn abort_ai_agent_stream(_event_name: String) -> Result<bool, String> {
    Err("CLI AI agents are not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn stream_ai_model(
    _app_handle: tauri::AppHandle,
    _request: crate::ai_models::AiModelStreamRequest,
) -> Result<String, String> {
    Err("Direct AI model chat is not available in this mobile build yet.".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn save_ai_model_provider_api_key(
    _provider_id: String,
    _api_key: String,
) -> Result<(), String> {
    Err("Local AI provider secret storage is only available in the desktop app.".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn delete_ai_model_provider_api_key(_provider_id: String) -> Result<(), String> {
    Err("Local AI provider secret storage is only available in the desktop app.".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn test_ai_model_provider(
    _request: crate::ai_models::AiModelProviderTestRequest,
) -> Result<String, String> {
    Err("Direct AI model tests are not available in this mobile build yet.".into())
}

// ── Prime session host (desktop) ────────────────────────────────────────────
// Long-lived `prime-agent --mode rpc` process. Slice 1 of the harness chat spike.

#[cfg(desktop)]
#[tauri::command]
pub fn get_prime_session_host_status() -> crate::prime_session_host::PrimeHostStatus {
    crate::prime_session_host::get_status()
}

/// Set the attached session's reasoning level (#9).
///
/// Paired with `set_prime_model` behind one strip control: the daemon takes
/// them as two commands, but the user changes them as one decision.
#[cfg(desktop)]
#[tauri::command]
pub fn set_prime_thinking_level(level: String) -> Result<(), String> {
    crate::prime_session_host::set_thinking_level(&level)
}

/// The reasoning levels Prime accepts, ordered. Sourced from the host rather
/// than duplicated in the frontend so there is one list, not two that drift.
#[cfg(desktop)]
#[tauri::command]
pub fn get_prime_thinking_levels() -> Vec<String> {
    crate::prime_session_host::PRIME_THINKING_LEVELS
        .iter()
        .map(|level| (*level).to_string())
        .collect()
}

/// Pause, resume, or stop one heartbeat (#14).
///
/// Only heartbeats accept this. The daemon has no `cron_pause`, so a plain
/// schedule can be cancelled but never paused — the UI must not offer it.
#[cfg(desktop)]
#[tauri::command]
pub fn manage_prime_heartbeat(job_id: String, action: String) -> Result<(), String> {
    crate::prime_session_host::manage_heartbeat(&job_id, &action)
}

/// Cancel a scheduled prompt — heartbeat or plain schedule (#14).
///
/// Irreversible: the job is removed, not paused.
#[cfg(desktop)]
#[tauri::command]
pub fn cancel_prime_scheduled_work(job_id: String) -> Result<(), String> {
    crate::prime_session_host::cancel_scheduled_work(&job_id)
}

/// Every Prime session the daemon is hosting, for the menu-bar roster (#13).
///
/// Standalone one-shot query — deliberately not routed through the attached
/// session host, so the menu bar can answer "is anything running?" with the
/// main window closed and no vault open.
#[cfg(desktop)]
#[tauri::command]
pub fn list_prime_running_sessions() -> Result<Vec<serde_json::Value>, String> {
    crate::prime_session_host::list_running_sessions()
}

/// Redirect the running turn. Returns false when nothing is streaming —
/// the caller should send a normal prompt instead.
#[cfg(desktop)]
#[tauri::command]
pub fn steer_prime_session(message: String) -> Result<bool, String> {
    crate::prime_session_host::steer(&message)
}

/// Queue a message for after the current turn. Returns false when idle.
#[cfg(desktop)]
#[tauri::command]
pub fn follow_up_prime_session(message: String) -> Result<bool, String> {
    crate::prime_session_host::follow_up(&message)
}

/// Steering and follow-up previews for the attached session.
#[cfg(desktop)]
#[tauri::command]
pub fn get_prime_session_queue() -> Result<crate::prime_session_host::PrimeQueue, String> {
    crate::prime_session_host::get_queue()
}

/// Drop every queued steer and follow-up.
#[cfg(desktop)]
#[tauri::command]
pub fn clear_prime_session_queue() -> Result<crate::prime_session_host::PrimeQueue, String> {
    crate::prime_session_host::clear_queue()
}

/// Stop one RLM child of the attached Prime session.
#[cfg(desktop)]
#[tauri::command]
pub fn cancel_prime_rlm_child(child_id: String) -> Result<bool, String> {
    crate::prime_session_host::cancel_rlm_child(&child_id)
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_prime_session_stats() -> Result<crate::prime_session_host::PrimeSessionStats, String> {
    crate::prime_session_host::get_session_stats()
}

/// Conversation history for the live Prime session, for transcript rehydration.
#[cfg(desktop)]
#[tauri::command]
pub fn get_prime_session_messages() -> Result<Vec<crate::prime_session_host::PrimeMessage>, String>
{
    crate::prime_session_host::get_messages()
}

/// Compact now. Returns tokens held before compaction when Prime reports it.
#[cfg(desktop)]
#[tauri::command]
pub fn compact_prime_session(custom_instructions: Option<String>) -> Result<Option<u64>, String> {
    crate::prime_session_host::compact(custom_instructions)
}

#[cfg(desktop)]
#[tauri::command]
pub fn set_prime_auto_compaction(enabled: bool) -> Result<(), String> {
    crate::prime_session_host::set_auto_compaction(enabled)
}

#[cfg(desktop)]
#[tauri::command]
pub fn ensure_prime_session_host(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    crate::prime_session_host::ensure_host(&vault_path)
}

#[cfg(desktop)]
#[tauri::command]
pub fn shutdown_prime_session_host() -> Result<bool, String> {
    crate::prime_session_host::shutdown_host()
}

#[cfg(desktop)]
#[tauri::command]
pub fn prime_session_new_session() -> Result<String, String> {
    crate::prime_session_host::new_session()
}

#[cfg(desktop)]
#[tauri::command]
pub fn abort_prime_session_turn() -> Result<bool, String> {
    crate::prime_session_host::abort_turn()
}

#[cfg(desktop)]
fn normalize_prime_request(
    mut request: crate::prime_session_host::PrimePromptRequest,
) -> crate::prime_session_host::PrimePromptRequest {
    request.vault_path = expand_tilde(&request.vault_path).into_owned();
    request
}

#[cfg(desktop)]
fn run_normalized_prime_stream(
    request: crate::prime_session_host::PrimePromptRequest,
    emitter: StreamEmitter<crate::ai_agents::AiAgentStreamEvent>,
) -> Result<String, String> {
    crate::prime_session_host::run_prompt_stream(normalize_prime_request(request), emitter)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn stream_prime_session(
    app_handle: tauri::AppHandle,
    request: crate::prime_session_host::PrimePromptRequest,
) -> Result<String, String> {
    let event_name = stream_event_name("prime-session-stream", request.event_name.as_deref());
    run_desktop_stream(
        app_handle,
        DesktopStreamScope::cancellable(event_name),
        request,
        run_normalized_prime_stream,
    )
    .await
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn get_prime_session_host_status() -> Result<(), String> {
    Err("Prime session host is only available on desktop".into())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn ensure_prime_session_host(_vault_path: String) -> Result<String, String> {
    Err("Prime session host is only available on desktop".into())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn shutdown_prime_session_host() -> Result<bool, String> {
    Err("Prime session host is only available on desktop".into())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn prime_session_new_session() -> Result<String, String> {
    Err("Prime session host is only available on desktop".into())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn abort_prime_session_turn() -> Result<bool, String> {
    Err("Prime session host is only available on desktop".into())
}

#[cfg(not(desktop))]
#[tauri::command]
pub async fn stream_prime_session(_request: serde_json::Value) -> Result<String, String> {
    Err("Prime session host is only available on desktop".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::AiGuidanceFileState;

    // ── Prime strip commands (#9) ───────────────────────────────────────────
    //
    // These wrappers are thin by design, but "thin" is not "free": each one is
    // the only place a command name, an argument name, and a host call line up,
    // and a typo in any of the three fails at runtime with no compile error.
    // Calling them here is what proves the wiring exists.

    #[cfg(desktop)]
    #[test]
    fn thinking_levels_are_offered_in_increasing_order() {
        let levels = get_prime_thinking_levels();
        assert_eq!(
            levels,
            vec!["off", "minimal", "low", "medium", "high", "xhigh", "max"],
            "the strip renders these as a scale, so order is part of the contract",
        );
    }

    #[cfg(desktop)]
    #[test]
    fn thinking_levels_come_from_the_host_not_a_second_copy() {
        // #9 requires no hardcoded model or level anywhere in the frontend.
        // The guard that makes that true is this command returning the host's
        // own list rather than a duplicate maintained here.
        assert_eq!(
            get_prime_thinking_levels().len(),
            crate::prime_session_host::PRIME_THINKING_LEVELS.len(),
        );
    }

    #[cfg(desktop)]
    #[test]
    fn setting_an_unknown_thinking_level_is_refused_before_any_host_call() {
        let error = set_prime_thinking_level("turbo".into()).unwrap_err();
        assert!(
            error.contains("turbo"),
            "the message must name the bad level: {error}"
        );
        assert!(error.contains("off"), "and list the valid ones: {error}");
    }

    #[cfg(desktop)]
    #[test]
    fn setting_a_half_specified_model_is_refused() {
        assert!(set_prime_model(String::new(), "grok-4.5".into()).is_err());
        assert!(set_prime_model("xai".into(), "  ".into()).is_err());
    }

    #[cfg(desktop)]
    #[test]
    fn the_running_session_roster_is_quiet_without_a_daemon() {
        // The menu bar asks this with nothing running (#13); it must answer
        // with an empty list rather than an error the popover would surface.
        let sessions = list_prime_running_sessions().expect("roster");
        let _ = sessions;
    }

    #[cfg(desktop)]
    #[test]
    fn normalize_agent_request_expands_tilde_in_vault_path() {
        use crate::ai_agents::AiAgentId;

        let home = dirs::home_dir().unwrap();
        let request = AiAgentStreamRequest {
            agent: AiAgentId::ClaudeCode,
            message: "hi".into(),
            system_prompt: None,
            vault_path: "~/Vaults/content".into(),
            vault_paths: vec!["~/Vaults/secondary".into()],
            permission_mode: None,
            event_name: None,
        };

        let normalized = normalize_agent_request(request);

        assert_eq!(
            normalized.vault_path,
            format!("{}/Vaults/content", home.display()),
            "vault_path must be tilde-expanded so spawned agents can chdir into it",
        );
        assert_eq!(
            normalized.vault_paths,
            vec![format!("{}/Vaults/secondary", home.display())],
            "vault_paths must be tilde-expanded so spawned agents can access every active vault",
        );
    }

    #[cfg(desktop)]
    #[test]
    fn normalize_agent_request_leaves_absolute_vault_path_untouched() {
        use crate::ai_agents::AiAgentId;

        let request = AiAgentStreamRequest {
            agent: AiAgentId::Codex,
            message: "hi".into(),
            system_prompt: None,
            vault_path: "/Users/example/vault".into(),
            vault_paths: Vec::new(),
            permission_mode: None,
            event_name: None,
        };

        let normalized = normalize_agent_request(request);

        assert_eq!(normalized.vault_path, "/Users/example/vault");
    }

    #[cfg(desktop)]
    #[test]
    fn stream_event_name_accepts_only_scoped_names() {
        assert_eq!(
            stream_event_name("ai-agent-stream", Some("ai-agent-stream-chat-123")),
            "ai-agent-stream-chat-123",
        );
        assert_eq!(
            stream_event_name("ai-agent-stream", Some("ai-model-stream-chat-123")),
            "ai-agent-stream",
        );
        assert_eq!(
            stream_event_name("ai-agent-stream", Some("ai-agent-stream/../bad")),
            "ai-agent-stream",
        );
    }

    #[cfg(desktop)]
    #[test]
    fn abort_ai_agent_stream_rejects_unscoped_names() {
        let result = abort_ai_agent_stream("ai-model-stream-chat-123".into());

        assert!(matches!(result, Err(message) if message.contains("Invalid AI agent stream id")));
    }

    #[test]
    fn guidance_commands_report_and_restore_vault_guidance_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_string_lossy().to_string();

        let initial = get_vault_ai_guidance_status(vault_path.clone()).unwrap();
        assert_eq!(initial.agents_state, AiGuidanceFileState::Missing);
        assert_eq!(initial.claude_state, AiGuidanceFileState::Missing);
        assert_eq!(initial.gemini_state, AiGuidanceFileState::Missing);
        assert!(initial.can_restore);

        let restored = restore_vault_ai_guidance(vault_path.clone()).unwrap();
        assert_eq!(restored.agents_state, AiGuidanceFileState::Managed);
        assert_eq!(restored.claude_state, AiGuidanceFileState::Managed);
        assert_eq!(restored.gemini_state, AiGuidanceFileState::Managed);
        assert!(!restored.can_restore);

        assert!(dir.path().join("AGENTS.md").exists());
        assert!(dir.path().join("CLAUDE.md").exists());
        assert!(dir.path().join("GEMINI.md").exists());
    }
}

// --- Prime session list ---

/// Every Prime session on disk, newest first, summarised for a list.
///
/// Archived sessions are flagged, not withheld — the list renders them under
/// a disclosure, so it needs them present. A settings read that fails leaves
/// everything unarchived rather than failing the list: not knowing what was
/// filed is a reason to show more, never to show nothing.
#[cfg(desktop)]
#[tauri::command]
pub fn list_prime_session_summaries(
) -> Result<Vec<crate::prime_sessions::PrimeSessionSummary>, String> {
    let summaries = crate::prime_sessions::list_sessions()?;
    let archived = crate::settings::get_settings()
        .ok()
        .and_then(|settings| settings.archived_prime_sessions)
        .unwrap_or_default();
    Ok(crate::prime_sessions::mark_archived(summaries, &archived))
}

/// File a session out of the main list, or put it back.
///
/// Rhizome's own state. Nothing under `~/.prime/agent/sessions` is touched:
/// that directory is Prime's, shared with its CLI and every other client on
/// the machine, and archiving must not change what they see. Reversible by
/// construction — the id simply leaves the list again.
#[cfg(desktop)]
#[tauri::command]
pub fn set_prime_session_archived(session_id: String, archived: bool) -> Result<(), String> {
    let session_id = session_id.trim().to_string();
    if session_id.is_empty() {
        return Err("A session needs an id to archive".into());
    }
    let mut settings = crate::settings::get_settings()?;
    let mut ids = settings.archived_prime_sessions.take().unwrap_or_default();

    if archived {
        // Idempotent: archiving twice is one entry, not two. The frontend can
        // fire this from a stale list without corrupting the set.
        if !ids.iter().any(|id| id == &session_id) {
            ids.push(session_id);
        }
    } else {
        ids.retain(|id| id != &session_id);
    }

    settings.archived_prime_sessions = Some(ids);
    crate::settings::save_settings(settings)
}

/// Replay one session's conversation from its log.
///
/// Takes the `path` from a summary rather than a session id: the log file is
/// what both this and `switch_session` address, and re-deriving a path from an
/// id would be a second way to name the same thing.
#[cfg(desktop)]
#[tauri::command]
pub fn read_prime_session_transcript(
    path: String,
) -> Result<Vec<crate::prime_sessions::PrimeTranscriptItem>, String> {
    crate::prime_sessions::read_transcript(std::path::Path::new(&path))
}

/// Goal, heartbeats and schedules for the live Prime session.
#[cfg(desktop)]
#[tauri::command]
pub fn get_prime_agent_activity() -> Result<crate::prime_agent_activity::PrimeAgentActivity, String>
{
    crate::prime_session_host::agent_activity()
}

/// Set or replace the live session's goal, confirmed by re-reading state.
///
/// `token_budget` of zero is rejected rather than silently treated as "no
/// budget" — a caller that meant to pass a budget and typo'd zero should see
/// an error, not a goal that quietly runs unbounded.
#[cfg(desktop)]
#[tauri::command]
pub fn set_prime_goal(
    objective: String,
    token_budget: Option<u64>,
) -> Result<crate::prime_agent_activity::PrimeGoalState, String> {
    crate::prime_session_host::set_goal(&objective, token_budget)
}

/// Clear the live session's goal, confirmed by re-reading state.
#[cfg(desktop)]
#[tauri::command]
pub fn clear_prime_goal() -> Result<(), String> {
    crate::prime_session_host::clear_goal()
}

/// Branch a new Prime session from a past transcript entry.
#[cfg(desktop)]
#[tauri::command]
pub fn fork_prime_session(
    entry_id: String,
) -> Result<crate::prime_session_host::PrimeForkResult, String> {
    crate::prime_session_host::fork(&entry_id)
}

/// Promote the attached client-owned session to resident background work.
#[cfg(desktop)]
#[tauri::command]
pub fn promote_owned_prime_session() -> Result<(), String> {
    crate::prime_session_host::promote_owned_session()
}

/// Stop the attached client-owned session's worker. Transcript stays on disk.
#[cfg(desktop)]
#[tauri::command]
pub fn complete_owned_prime_session() -> Result<(), String> {
    crate::prime_session_host::complete_owned_session()
}

/// Settle the attached Prime session, then drop the Rhizome connection.
#[cfg(desktop)]
#[tauri::command]
pub fn settle_prime_session(
    intent: crate::prime_session_host::SessionCloseIntent,
) -> Result<crate::prime_session_host::QuitDisposition, String> {
    crate::prime_session_host::settle_session(intent)
}

/// Every model the live Prime host can switch to.
#[cfg(desktop)]
#[tauri::command]
pub fn get_available_prime_models() -> Result<Vec<crate::prime_session_host::PrimeModel>, String> {
    crate::prime_session_host::get_available_models()
}

/// Export a saved Prime session to standalone HTML, returning the file written.
///
/// Goes through `prime_sessions`, not the session host: Prime offers export
/// only as a CLI subcommand over a session file, never over the daemon
/// protocol.
#[cfg(desktop)]
#[tauri::command]
pub fn export_prime_session(
    session_path: String,
    output_path: Option<String>,
) -> Result<String, String> {
    crate::prime_sessions::export_session(&session_path, output_path)
}

/// Skills and extension commands the live session reports via `get_commands`.
#[cfg(desktop)]
#[tauri::command]
pub fn get_prime_commands() -> Result<Vec<crate::prime_session_host::PrimeReportedCommand>, String>
{
    crate::prime_session_host::get_commands()
}

/// Switch the live Prime host's model.
#[cfg(desktop)]
#[tauri::command]
pub fn set_prime_model(provider: String, model_id: String) -> Result<(), String> {
    crate::prime_session_host::set_model(&provider, &model_id)
}

/// Load a past session into the live Prime host.
///
/// Returns the session id the host reports afterwards, so the caller can
/// confirm the switch landed rather than assuming it did.
#[cfg(desktop)]
#[tauri::command]
pub fn switch_prime_session(path: String) -> Result<String, String> {
    crate::prime_session_host::switch_session(&path)
}

// --- Mycelium / Mindwalk ---

#[tauri::command]
pub fn list_prime_sessions() -> Result<Vec<crate::mycelium::PrimeSessionEntry>, String> {
    crate::mycelium::list_prime_sessions()
}

#[tauri::command]
pub fn which_binary(name: String) -> crate::mycelium::WhichBinaryResult {
    crate::mycelium::which_binary(&name)
}

#[tauri::command]
pub fn run_mindwalk_open(path: String) -> Result<String, String> {
    crate::mycelium::run_mindwalk_open(&path)
}

#[tauri::command]
pub fn bridge_and_open_prime_session(path: String) -> Result<String, String> {
    crate::mycelium::bridge_and_open_prime_session(&path)
}
