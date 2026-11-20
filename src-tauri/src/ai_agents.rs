use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::task::JoinHandle;

const AI_AGENT_STATUS_PROBE_TIMEOUT: Duration = Duration::from_secs(5);
/// `--version` and `auth status` run one after the other.
const CLAUDE_CODE_STATUS_PROBE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiAgentId {
    /// Rhizome Agent product default — long-lived Prime RPC host.
    Prime,
    ClaudeCode,
    Codex,
    Opencode,
    #[serde(alias = "gemini")]
    Antigravity,
    Kiro,
    Hermes,
}

/// Parse the same snake_case id string the frontend sends (its `agent:<id>`
/// target-id suffix, `src/lib/aiTargets.ts`'s `agentTargetId`) into an
/// `AiAgentId`, so a caller-resolved agent can override the settings-based
/// default instead of every write path silently falling back to it.
pub fn parse_agent_id(value: &str) -> Option<AiAgentId> {
    match value {
        "prime" => Some(AiAgentId::Prime),
        "claude_code" => Some(AiAgentId::ClaudeCode),
        "codex" => Some(AiAgentId::Codex),
        "opencode" => Some(AiAgentId::Opencode),
        "antigravity" | "gemini" => Some(AiAgentId::Antigravity),
        "kiro" => Some(AiAgentId::Kiro),
        "hermes" => Some(AiAgentId::Hermes),
        _ => None,
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AiAgentPermissionMode {
    #[default]
    Safe,
    PowerUser,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiAgentAvailability {
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiAgentsStatus {
    pub prime: AiAgentAvailability,
    pub claude_code: AiAgentAvailability,
    pub codex: AiAgentAvailability,
    pub opencode: AiAgentAvailability,
    pub antigravity: AiAgentAvailability,
    pub kiro: AiAgentAvailability,
    pub hermes: AiAgentAvailability,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind")]
pub enum AiAgentStreamEvent {
    Init {
        session_id: String,
    },
    TextDelta {
        text: String,
    },
    ThinkingDelta {
        text: String,
    },
    ToolStart {
        tool_name: String,
        tool_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        input: Option<String>,
    },
    ToolDone {
        tool_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output: Option<String>,
    },
    Error {
        message: String,
    },
    /// Non-fatal warning. Chat continues; the transcript can show the notice.
    Notice {
        message: String,
    },
    /// Steering / follow-up queue depth changed. Lets the composer show
    /// "2 queued" without tracking its own sends.
    QueueUpdate {
        queued: u64,
    },
    /// Context compaction. `phase` is "start" | "end" | "aborted". Emitted so a
    /// long session never loses context silently — the transcript can show
    /// what happened and roughly how much was compacted.
    Compaction {
        phase: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tokens_before: Option<u64>,
    },
    /// One Prime agent turn finished; a queued follow-up may still stream on
    /// the same `stream_prime_session` socket. Chat seals the current bubble
    /// and retargets to the queued user turn so the interrupt is not buried
    /// inside the first reply.
    /// Claude Code engine asks before a tool runs (ADR-0191 step 4). The app
    /// answers with `reply_ai_agent_approval`. No answer denies.
    ApprovalRequested {
        prompt_id: String,
        tool: String,
        args: String,
        options: Vec<crate::rhizome_loop::ApprovalOption>,
        #[serde(skip_serializing_if = "Option::is_none")]
        path: Option<String>,
        call_id: String,
    },
    /// The ask timed out or the turn ended; drop its card.
    ApprovalDismissed {
        prompt_id: String,
    },
    TurnBoundary,
    Done,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiAgentStreamRequest {
    pub agent: AiAgentId,
    pub message: String,
    pub system_prompt: Option<String>,
    pub vault_path: String,
    #[serde(default)]
    pub vault_paths: Vec<String>,
    pub permission_mode: Option<AiAgentPermissionMode>,
    #[serde(default)]
    pub event_name: Option<String>,
}

impl AiAgentStreamRequest {
    fn permission_mode(&self) -> AiAgentPermissionMode {
        self.permission_mode.unwrap_or_default()
    }
}

/// Probe every supported AI-agent CLI in parallel.
///
/// Each per-agent `check_cli()` is synchronous and can block for up to ~1 s
/// when the binary is missing and we fall through to the login-shell
/// fallback (`/bin/zsh -lc 'command -v <agent>'` etc., evaluating the full
/// shell startup). Running them sequentially used to add ~5 s to cold start
/// when no agents are installed. Fan them out across Tokio's blocking pool
/// so the user-perceived wall time is the slowest single probe rather than
/// the sum of all supported probes.
///
/// A panicking probe is mapped to `installed: false` so the IPC handler
/// always returns a fully populated `AiAgentsStatus` and the frontend can
/// keep rendering.
pub async fn get_ai_agents_status() -> AiAgentsStatus {
    let prime = tokio::task::spawn_blocking(crate::prime_session_host::check_cli);
    let claude = tokio::task::spawn_blocking(availability_from_claude);
    let codex = tokio::task::spawn_blocking(crate::codex_cli::check_cli);
    let opencode = tokio::task::spawn_blocking(crate::opencode_cli::check_cli);
    let antigravity = tokio::task::spawn_blocking(crate::antigravity_cli::check_cli);
    let kiro = tokio::task::spawn_blocking(crate::kiro_cli::check_cli);
    let hermes = tokio::task::spawn_blocking(crate::hermes_cli::check_cli);

    let (prime, claude, codex, opencode, antigravity, kiro, hermes) = tokio::join!(
        availability_or_missing(prime, AI_AGENT_STATUS_PROBE_TIMEOUT),
        availability_or_missing(claude, AI_AGENT_STATUS_PROBE_TIMEOUT),
        availability_or_missing(codex, AI_AGENT_STATUS_PROBE_TIMEOUT),
        availability_or_missing(opencode, AI_AGENT_STATUS_PROBE_TIMEOUT),
        availability_or_missing(antigravity, AI_AGENT_STATUS_PROBE_TIMEOUT),
        availability_or_missing(kiro, AI_AGENT_STATUS_PROBE_TIMEOUT),
        availability_or_missing(hermes, AI_AGENT_STATUS_PROBE_TIMEOUT)
    );

    AiAgentsStatus {
        prime,
        claude_code: claude,
        codex,
        opencode,
        antigravity,
        kiro,
        hermes,
    }
}

/// Settings status for the Claude Code engine. A probe that hangs counts as
/// not found, so Settings never waits on it.
pub async fn claude_code_engine_status() -> crate::claude_cli::ClaudeCodeEngineStatus {
    let probe = tokio::task::spawn_blocking(crate::claude_cli::engine_status);
    match tokio::time::timeout(CLAUDE_CODE_STATUS_PROBE_TIMEOUT, probe).await {
        Ok(Ok(status)) => status,
        Ok(Err(_)) | Err(_) => crate::claude_cli::ClaudeCodeEngineStatus::not_found(),
    }
}

async fn availability_or_missing(
    probe: JoinHandle<AiAgentAvailability>,
    timeout: Duration,
) -> AiAgentAvailability {
    match tokio::time::timeout(timeout, probe).await {
        Ok(Ok(availability)) => availability,
        Ok(Err(_)) | Err(_) => missing_availability(),
    }
}

fn missing_availability() -> AiAgentAvailability {
    AiAgentAvailability {
        installed: false,
        version: None,
    }
}

pub fn run_ai_agent_stream<F>(request: AiAgentStreamRequest, emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let permission_mode = request.permission_mode();
    match request.agent {
        AiAgentId::Prime => run_prime_agent_stream(request, emit),
        AiAgentId::ClaudeCode => run_claude_agent_stream(request, permission_mode, emit),
        AiAgentId::Codex => run_shared_agent_stream(
            request,
            permission_mode,
            crate::codex_cli::run_agent_stream,
            emit,
        ),
        AiAgentId::Opencode => run_shared_agent_stream(
            request,
            permission_mode,
            crate::opencode_cli::run_agent_stream,
            emit,
        ),
        AiAgentId::Antigravity => run_shared_agent_stream(
            request,
            permission_mode,
            crate::antigravity_cli::run_agent_stream,
            emit,
        ),
        AiAgentId::Kiro => run_shared_agent_stream(
            request,
            permission_mode,
            crate::kiro_cli::run_agent_stream,
            emit,
        ),
        AiAgentId::Hermes => run_shared_agent_stream(
            request,
            permission_mode,
            crate::hermes_cli::run_agent_stream,
            emit,
        ),
    }
}

fn run_prime_agent_stream<F>(request: AiAgentStreamRequest, emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let vault_path = if request.vault_path.trim().is_empty() {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| ".".into())
    } else {
        request.vault_path
    };
    let prime_request = crate::prime_session_host::PrimePromptRequest {
        message: request.message,
        // This path is the agent-panel bridge, which has no attachment
        // surface — images arrive only through the chat composer.
        images: Vec::new(),
        system_prompt: crate::settings::compose_agent_profile(
            crate::settings::saved_agent_profile().as_deref(),
            request.system_prompt.as_deref(),
        ),
        vault_path,
        event_name: request.event_name,
        provider: None,
        model_id: None,
        new_session: false,
    };
    crate::prime_session_host::run_prompt_stream(prime_request, emit)
}

fn run_claude_agent_stream<F>(
    request: AiAgentStreamRequest,
    permission_mode: AiAgentPermissionMode,
    emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let mapped = crate::claude_cli::AgentStreamRequest {
        message: request.message,
        system_prompt: request.system_prompt,
        vault_path: request.vault_path,
        vault_paths: request.vault_paths,
        permission_mode,
    };
    run_with_approval_broker(mapped, emit, |req, approval, emit_claude| {
        crate::claude_cli::run_agent_stream_with_approval(req, approval, emit_claude)
    })
}

/// One native chat turn on the Claude Code engine (ADR-0191 step 5): the
/// same broker and profile as the agent path, in the conversation that
/// `session` names.
pub(crate) fn run_claude_engine_turn<F>(
    req: crate::claude_cli::AgentStreamRequest,
    session: Option<crate::claude_invocation::ClaudeSession>,
    emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    run_with_approval_broker(req, emit, move |req, approval, emit_claude| {
        crate::claude_cli::run_agent_stream_in_session(req, approval, session.as_ref(), emit_claude)
    })
}

/// Run one Claude Code turn with an approval broker beside it.
///
/// Claude Code blocks on stdout while it waits for an approval, so the run
/// goes on a worker thread and this thread hands every event, Claude's and
/// the broker's, to `emit`. The worker keeps this stream's id, so
/// `abort_ai_agent_stream` still finds the claude child. When the run ends
/// the broker closes and every waiting ask denies.
fn run_with_approval_broker<F, R>(
    req: crate::claude_cli::AgentStreamRequest,
    mut emit: F,
    run: R,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
    R: FnOnce(
            crate::claude_cli::AgentStreamRequest,
            Option<&crate::claude_code_approval::ApprovalEndpoint>,
            &mut dyn FnMut(crate::claude_cli::ClaudeStreamEvent),
        ) -> Result<String, String>
        + Send,
{
    use crate::claude_code_approval::{ApprovalBroker, DEFAULT_APPROVAL_TIMEOUT};
    use std::sync::mpsc;

    let (tx, rx) = mpsc::channel::<Option<AiAgentStreamEvent>>();
    let broker_tx = tx.clone();
    let vaults = crate::cli_agent_runtime::active_vault_paths(&req.vault_path, &req.vault_paths);
    // No broker means no approvals: claude then runs with every prompt denied.
    let mut broker = ApprovalBroker::start(&vaults, DEFAULT_APPROVAL_TIMEOUT, move |event| {
        let _ = broker_tx.send(Some(map_broker_event(event)));
    })
    .ok();
    let endpoint = broker.as_ref().map(|b| b.endpoint().clone());
    let stream_id = crate::ai_agent_processes::current_stream_id();

    let result = std::thread::scope(|scope| {
        let worker = scope.spawn(move || {
            let mut forward = |event| {
                if let Some(mapped) = map_claude_event(event) {
                    let _ = tx.send(Some(mapped));
                }
            };
            let go = || run(req, endpoint.as_ref(), &mut forward);
            let result = match stream_id {
                Some(id) => crate::ai_agent_processes::with_stream_id(id, go),
                None => go(),
            };
            let _ = tx.send(None);
            result
        });
        while let Ok(Some(event)) = rx.recv() {
            emit(event);
        }
        worker
            .join()
            .unwrap_or_else(|_| Err("Claude Code stopped unexpectedly.".into()))
    });
    if let Some(broker) = broker.as_mut() {
        broker.close();
    }
    result
}

fn map_broker_event(event: crate::claude_code_approval::BrokerEvent) -> AiAgentStreamEvent {
    match event {
        crate::claude_code_approval::BrokerEvent::Requested(ask) => {
            AiAgentStreamEvent::ApprovalRequested {
                prompt_id: ask.prompt_id,
                tool: ask.tool,
                args: ask.args,
                options: ask.options,
                path: ask.path,
                call_id: ask.call_id,
            }
        }
        crate::claude_code_approval::BrokerEvent::Dismissed { prompt_id } => {
            AiAgentStreamEvent::ApprovalDismissed { prompt_id }
        }
    }
}

/// Answer a Claude Code approval card. Unknown choices deny.
pub(crate) fn reply_claude_code_approval(prompt_id: &str, choice: &str) -> bool {
    let reply = match choice {
        "allow_once" => crate::rhizome_loop::ApprovalReply::AllowOnce,
        _ => crate::rhizome_loop::ApprovalReply::Deny,
    };
    crate::claude_code_approval::reply(prompt_id, reply)
}

fn run_shared_agent_stream<F, R>(
    request: AiAgentStreamRequest,
    permission_mode: AiAgentPermissionMode,
    runner: R,
    emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
    R: FnOnce(crate::cli_agent_runtime::AgentStreamRequest, F) -> Result<String, String>,
{
    let mapped = crate::cli_agent_runtime::AgentStreamRequest {
        message: request.message,
        system_prompt: request.system_prompt,
        vault_path: request.vault_path,
        vault_paths: request.vault_paths,
        permission_mode,
    };
    runner(mapped, emit)
}

fn availability_from_claude() -> AiAgentAvailability {
    let status = crate::claude_cli::check_cli();
    AiAgentAvailability {
        installed: status.installed,
        version: status.version,
    }
}

fn map_claude_event(event: crate::claude_cli::ClaudeStreamEvent) -> Option<AiAgentStreamEvent> {
    match event {
        crate::claude_cli::ClaudeStreamEvent::Init { session_id } => {
            Some(AiAgentStreamEvent::Init { session_id })
        }
        crate::claude_cli::ClaudeStreamEvent::TextDelta { text } => {
            Some(AiAgentStreamEvent::TextDelta { text })
        }
        crate::claude_cli::ClaudeStreamEvent::ThinkingDelta { text } => {
            Some(AiAgentStreamEvent::ThinkingDelta { text })
        }
        crate::claude_cli::ClaudeStreamEvent::ToolStart {
            tool_name,
            tool_id,
            input,
        } => Some(AiAgentStreamEvent::ToolStart {
            tool_name,
            tool_id,
            input,
        }),
        crate::claude_cli::ClaudeStreamEvent::ToolDone { tool_id, output } => {
            Some(AiAgentStreamEvent::ToolDone { tool_id, output })
        }
        crate::claude_cli::ClaudeStreamEvent::Error { message } => {
            Some(AiAgentStreamEvent::Error { message })
        }
        crate::claude_cli::ClaudeStreamEvent::Done => Some(AiAgentStreamEvent::Done),
        crate::claude_cli::ClaudeStreamEvent::Result { text, .. } if !text.is_empty() => {
            Some(AiAgentStreamEvent::TextDelta { text })
        }
        crate::claude_cli::ClaudeStreamEvent::Result { .. } => None,
    }
}

#[cfg(test)]
mod tests {
    mod claude_code_approvals {
        use super::super::*;
        use std::io::{BufRead, BufReader, Write};
        use std::net::TcpStream;
        use std::sync::{Arc, Mutex};
        use std::time::{Duration, Instant};

        fn request(vault: &std::path::Path) -> crate::claude_cli::AgentStreamRequest {
            crate::claude_cli::AgentStreamRequest {
                message: "List files".into(),
                system_prompt: None,
                vault_path: vault.display().to_string(),
                vault_paths: Vec::new(),
                permission_mode: AiAgentPermissionMode::PowerUser,
            }
        }

        /// What `mcp-server/approval-bridge.js` sends.
        fn ask_bash(endpoint: &crate::claude_code_approval::ApprovalEndpoint) -> serde_json::Value {
            let mut stream = TcpStream::connect(endpoint.addr).unwrap();
            let body = serde_json::json!({
                "token": endpoint.token,
                "tool_name": "Bash",
                "input": {"command": "ls"},
                "tool_use_id": "toolu_9",
            });
            writeln!(stream, "{body}").unwrap();
            let mut line = String::new();
            BufReader::new(stream).read_line(&mut line).unwrap();
            serde_json::from_str(line.trim()).unwrap()
        }

        fn wait_for_prompt(events: &Arc<Mutex<Vec<AiAgentStreamEvent>>>) -> String {
            let deadline = Instant::now() + Duration::from_secs(5);
            loop {
                let found = events.lock().unwrap().iter().find_map(|event| match event {
                    AiAgentStreamEvent::ApprovalRequested { prompt_id, .. } => {
                        Some(prompt_id.clone())
                    }
                    _ => None,
                });
                if let Some(prompt_id) = found {
                    return prompt_id;
                }
                assert!(Instant::now() < deadline, "no approval card");
                std::thread::sleep(Duration::from_millis(10));
            }
        }

        #[test]
        fn an_ask_shows_a_card_and_the_answer_reaches_claude_code() {
            let vault = tempfile::tempdir().unwrap();
            let events = Arc::new(Mutex::new(Vec::new()));
            let sink = Arc::clone(&events);
            let watcher = Arc::clone(&events);
            let answered = std::thread::spawn(move || {
                let prompt_id = wait_for_prompt(&watcher);
                assert!(reply_claude_code_approval(&prompt_id, "allow_once"));
            });
            let result = run_with_approval_broker(
                request(vault.path()),
                move |event| sink.lock().unwrap().push(event),
                |_req, approval, emit| {
                    let endpoint = approval.expect("approval endpoint").clone();
                    let reply = ask_bash(&endpoint);
                    emit(crate::claude_cli::ClaudeStreamEvent::TextDelta {
                        text: reply["behavior"].as_str().unwrap().into(),
                    });
                    Ok("session".into())
                },
            );
            answered.join().unwrap();
            assert_eq!(result.unwrap(), "session");
            let events = events.lock().unwrap();
            assert!(events.iter().any(|event| matches!(
                event,
                AiAgentStreamEvent::ApprovalRequested { tool, call_id, .. }
                    if tool == "Bash" && call_id == "toolu_9"
            )));
            assert!(events.iter().any(
                |event| matches!(event, AiAgentStreamEvent::TextDelta { text } if text == "allow")
            ));
        }

        #[test]
        fn ending_the_turn_denies_a_waiting_ask() {
            let vault = tempfile::tempdir().unwrap();
            let events = Arc::new(Mutex::new(Vec::new()));
            let sink = Arc::clone(&events);
            let asker: Arc<Mutex<Option<std::thread::JoinHandle<serde_json::Value>>>> =
                Arc::new(Mutex::new(None));
            let asker_slot = Arc::clone(&asker);
            let watcher = Arc::clone(&events);
            run_with_approval_broker(
                request(vault.path()),
                move |event| sink.lock().unwrap().push(event),
                move |_req, approval, _emit| {
                    let endpoint = approval.unwrap().clone();
                    *asker_slot.lock().unwrap() =
                        Some(std::thread::spawn(move || ask_bash(&endpoint)));
                    // Claude Code exits (cancel, crash) while the card is up.
                    wait_for_prompt(&watcher);
                    Err("claude exited".into())
                },
            )
            .unwrap_err();
            let reply = asker.lock().unwrap().take().unwrap().join().unwrap();
            assert_eq!(reply["behavior"], "deny");
        }

        #[test]
        fn a_choice_other_than_allow_once_denies() {
            assert!(!reply_claude_code_approval("no-such-prompt", "allow_once"));
            assert!(!reply_claude_code_approval(
                "no-such-prompt",
                "allow_session"
            ));
        }
    }

    use super::*;

    #[test]
    fn parse_agent_id_round_trips_every_frontend_target_id() {
        assert_eq!(parse_agent_id("prime"), Some(AiAgentId::Prime));
        assert_eq!(parse_agent_id("claude_code"), Some(AiAgentId::ClaudeCode));
        assert_eq!(parse_agent_id("codex"), Some(AiAgentId::Codex));
        assert_eq!(parse_agent_id("opencode"), Some(AiAgentId::Opencode));
        assert_eq!(parse_agent_id("antigravity"), Some(AiAgentId::Antigravity));
        assert_eq!(parse_agent_id("gemini"), Some(AiAgentId::Antigravity));
        assert_eq!(parse_agent_id("kiro"), Some(AiAgentId::Kiro));
        assert_eq!(parse_agent_id("hermes"), Some(AiAgentId::Hermes));
    }

    #[test]
    fn parse_agent_id_rejects_unknown_or_empty_strings() {
        assert_eq!(parse_agent_id("not-a-real-agent"), None);
        assert_eq!(parse_agent_id(""), None);
    }

    fn request_with_permission(
        permission_mode: Option<AiAgentPermissionMode>,
    ) -> AiAgentStreamRequest {
        AiAgentStreamRequest {
            agent: AiAgentId::Codex,
            message: "Summarize this vault".into(),
            system_prompt: None,
            vault_path: "/tmp/vault".into(),
            vault_paths: Vec::new(),
            permission_mode,
            event_name: None,
        }
    }

    #[test]
    fn stream_request_uses_default_or_explicit_permission_mode() {
        assert_eq!(
            request_with_permission(None).permission_mode(),
            AiAgentPermissionMode::Safe
        );
        assert_eq!(
            request_with_permission(Some(AiAgentPermissionMode::PowerUser)).permission_mode(),
            AiAgentPermissionMode::PowerUser
        );
    }

    #[tokio::test]
    async fn normalize_status_contains_all_agents() {
        let status = get_ai_agents_status().await;
        let install_flags = [
            status.prime.installed,
            status.claude_code.installed,
            status.codex.installed,
            status.opencode.installed,
            status.antigravity.installed,
            status.kiro.installed,
            status.hermes.installed,
        ];

        assert!(install_flags
            .iter()
            .all(|installed| matches!(installed, true | false)));
    }

    #[tokio::test]
    async fn availability_probe_timeout_returns_missing_status() {
        let handle = tokio::task::spawn_blocking(|| {
            std::thread::sleep(std::time::Duration::from_millis(50));
            AiAgentAvailability {
                installed: true,
                version: Some("late".into()),
            }
        });

        let status = availability_or_missing(handle, std::time::Duration::from_millis(1)).await;

        assert!(!status.installed);
        assert_eq!(status.version, None);
    }

    #[test]
    fn map_claude_done_event_preserves_completion_signal() {
        let mapped = map_claude_event(crate::claude_cli::ClaudeStreamEvent::Done);

        assert!(matches!(mapped, Some(AiAgentStreamEvent::Done)));
    }

    #[test]
    fn map_claude_text_events_preserve_stream_data() {
        assert!(matches!(
            map_claude_event(crate::claude_cli::ClaudeStreamEvent::Init {
                session_id: "session-1".into(),
            }),
            Some(AiAgentStreamEvent::Init { session_id }) if session_id == "session-1"
        ));
        assert!(matches!(
            map_claude_event(crate::claude_cli::ClaudeStreamEvent::TextDelta {
                text: "visible output".into(),
            }),
            Some(AiAgentStreamEvent::TextDelta { text }) if text == "visible output"
        ));
        assert!(matches!(
            map_claude_event(crate::claude_cli::ClaudeStreamEvent::ThinkingDelta {
                text: "thinking".into(),
            }),
            Some(AiAgentStreamEvent::ThinkingDelta { text }) if text == "thinking"
        ));
    }

    #[test]
    fn map_claude_tool_events_preserve_stream_data() {
        let started = map_claude_event(crate::claude_cli::ClaudeStreamEvent::ToolStart {
            tool_name: "Read".into(),
            tool_id: "tool-1".into(),
            input: Some("{\"file\":\"note.md\"}".into()),
        });
        let finished = map_claude_event(crate::claude_cli::ClaudeStreamEvent::ToolDone {
            tool_id: "tool-1".into(),
            output: Some("done".into()),
        });

        assert!(matches!(
            started,
            Some(AiAgentStreamEvent::ToolStart { tool_name, tool_id, input })
                if tool_name == "Read"
                    && tool_id == "tool-1"
                    && input.as_deref() == Some("{\"file\":\"note.md\"}")
        ));
        assert!(matches!(
            finished,
            Some(AiAgentStreamEvent::ToolDone { tool_id, output })
                if tool_id == "tool-1" && output.as_deref() == Some("done")
        ));
    }

    #[test]
    fn map_claude_error_event_preserves_message() {
        let mapped = map_claude_event(crate::claude_cli::ClaudeStreamEvent::Error {
            message: "missing auth".into(),
        });

        assert!(matches!(
            mapped,
            Some(AiAgentStreamEvent::Error { message }) if message == "missing auth"
        ));
    }

    #[test]
    fn map_claude_result_event_preserves_final_text() {
        let mapped = map_claude_event(crate::claude_cli::ClaudeStreamEvent::Result {
            text: "Final answer from Claude".into(),
            session_id: "session-1".into(),
        });

        assert!(matches!(
            mapped,
            Some(AiAgentStreamEvent::TextDelta { text }) if text == "Final answer from Claude"
        ));
    }

    #[test]
    fn map_claude_empty_result_event_is_ignored() {
        let mapped = map_claude_event(crate::claude_cli::ClaudeStreamEvent::Result {
            text: String::new(),
            session_id: "session-1".into(),
        });

        assert!(mapped.is_none());
    }
}
