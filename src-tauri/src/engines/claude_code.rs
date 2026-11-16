//! Claude Code as a native chat engine (ADR-0191 step 5).
//!
//! Each turn runs the user's own `claude` with the step 3 profile and the
//! step 4 approval bridge. Turns go to Rhizome's native log, through the
//! same writer as Rhizome's own engine, so the ADR-0183 redaction runs on
//! every line. Rhizome picks the Claude Code session id, keeps it in a
//! sidecar next to the log, and never reads Claude's own session files.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::ai_agents::{AiAgentPermissionMode, AiAgentStreamEvent};
use crate::claude_cli::AgentStreamRequest;
use crate::claude_invocation::ClaudeSession;
use crate::engines::native_log::{self, NativeSessionWriter, SessionHeader};
use crate::rhizome_loop::{ApprovalReply, DurableEvent};

use super::{ChatControl, ChatEngine, EngineEvent};

/// The saved target of a Claude Code chat.
pub const CLAUDE_CODE_TARGET: &str = "agent:claude_code";

/// Shown when Claude Code has lost the conversation behind a chat.
pub const RESUME_FAILED: &str = "Claude Code no longer has this conversation, so this chat is read-only. Start a new chat to keep going.";

const NO_VAULT: &str = "Claude Code needs a vault to work in. Open a vault, then start a new chat.";
const NO_CONVERSATION: &str = "No conversation found";
const ALREADY_IN_USE: &str = "already in use";
const SAVE_FAILED: &str = "Couldn't save this chat";

/// How long `claude` gets after SIGINT, and again after SIGTERM.
const STOP_GRACE: Duration = Duration::from_secs(3);
/// A cancel that lands before the child is registered keeps trying this long.
const CANCEL_RETRY_FOR: Duration = Duration::from_secs(2);
const CANCEL_RETRY_EVERY: Duration = Duration::from_millis(50);

/// The chat's settings, fixed when the chat starts.
#[derive(Clone, Debug)]
pub struct ClaudeCodeSettings {
    pub vault_path: Option<String>,
    pub vault_paths: Vec<String>,
    pub permission_mode: AiAgentPermissionMode,
    pub system_prompt: Option<String>,
}

/// Runs one `claude` turn. Tests swap in a script.
pub(crate) type ClaudeRunner = Arc<
    dyn Fn(
            AgentStreamRequest,
            Option<ClaudeSession>,
            &mut dyn FnMut(AiAgentStreamEvent),
        ) -> Result<String, String>
        + Send
        + Sync,
>;

/// What Rhizome keeps about the Claude Code conversation behind a chat.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
struct Sidecar {
    session_id: String,
    /// Claude Code has created the conversation, so later turns resume it.
    #[serde(default)]
    started: bool,
    /// Claude Code could not find the conversation. The chat is read-only.
    #[serde(default)]
    resume_failed: bool,
}

impl Sidecar {
    fn fresh() -> Self {
        Self {
            session_id: uuid::Uuid::new_v4().hyphenated().to_string(),
            started: false,
            resume_failed: false,
        }
    }

    fn session(&self) -> ClaudeSession {
        if self.started {
            ClaudeSession::Resume(self.session_id.clone())
        } else {
            ClaudeSession::New(self.session_id.clone())
        }
    }
}

fn sidecar_path(session_id: &str) -> Result<PathBuf, String> {
    Ok(native_log::session_log_path(session_id)?.with_extension("claude-code.json"))
}

fn read_sidecar(session_id: &str) -> Option<Sidecar> {
    let text = std::fs::read_to_string(sidecar_path(session_id).ok()?).ok()?;
    serde_json::from_str(&text).ok()
}

fn write_sidecar(session_id: &str, sidecar: &Sidecar) -> Result<(), String> {
    let path = sidecar_path(session_id)?;
    let json = serde_json::to_string(sidecar)
        .map_err(|error| format!("save Claude Code session: {error}"))?;
    let tmp = path.with_extension("claude-code.json.tmp");
    std::fs::write(&tmp, json).map_err(|error| format!("save Claude Code session: {error}"))?;
    std::fs::rename(&tmp, &path).map_err(|error| format!("save Claude Code session: {error}"))
}

/// True when this chat's Claude Code conversation is gone: Claude Code could
/// not resume it, or the chat has turns but Rhizome has no conversation id.
pub fn conversation_lost(session_id: &str, has_turns: bool) -> bool {
    match read_sidecar(session_id) {
        Some(sidecar) => sidecar.resume_failed,
        None => has_turns,
    }
}

/// Drop Rhizome's note of the conversation when its chat is deleted.
/// Claude Code's own copy is the user's and stays where it is.
pub fn forget_conversation(session_id: &str) {
    if let Ok(path) = sidecar_path(session_id) {
        let _ = std::fs::remove_file(path);
    }
}

struct Shared {
    stream_id: Mutex<String>,
    running: AtomicBool,
    cancel: Mutex<Option<String>>,
}

/// The Claude Code engine for one native chat.
pub struct ClaudeCodeEngine {
    settings: ClaudeCodeSettings,
    runner: ClaudeRunner,
    shared: Arc<Shared>,
    writer: Option<NativeSessionWriter>,
    log_id: String,
    sidecar: Sidecar,
}

impl ClaudeCodeEngine {
    pub fn new(settings: ClaudeCodeSettings) -> Self {
        Self::with_runner(
            settings,
            Arc::new(|req, session, emit| {
                crate::ai_agents::run_claude_engine_turn(req, session, emit)
            }),
        )
    }

    pub(crate) fn with_runner(settings: ClaudeCodeSettings, runner: ClaudeRunner) -> Self {
        Self {
            settings,
            runner,
            shared: Arc::new(Shared {
                stream_id: Mutex::new(String::new()),
                running: AtomicBool::new(false),
                cancel: Mutex::new(None),
            }),
            writer: None,
            log_id: String::new(),
            sidecar: Sidecar::default(),
        }
    }

    fn header(&self, session_id: &str) -> SessionHeader {
        SessionHeader {
            version: native_log::NATIVE_LOG_VERSION,
            session_id: session_id.to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            target: CLAUDE_CODE_TARGET.into(),
            permission_mode: native_log::permission_mode_label(self.settings.permission_mode),
            vault_path: self.settings.vault_path.clone(),
            vault_paths: self.settings.vault_paths.clone(),
            system_prompt: self.settings.system_prompt.clone(),
            reasoning_level: None,
        }
    }

    fn save_sidecar(&self) -> Result<(), String> {
        write_sidecar(&self.log_id, &self.sidecar)
    }

    fn request(&self, prompt: &str, vault_path: String) -> AgentStreamRequest {
        AgentStreamRequest {
            message: prompt.to_string(),
            system_prompt: self.settings.system_prompt.clone(),
            vault_path,
            vault_paths: self.settings.vault_paths.clone(),
            permission_mode: self.settings.permission_mode,
        }
    }

    fn run(&self, prompt: &str, vault_path: &str, turn: &mut Turn<'_>) -> Result<String, String> {
        let runner = Arc::clone(&self.runner);
        let request = self.request(prompt, vault_path.to_string());
        let session = self.sidecar.session();
        let stream_id = self.shared.stream_id.lock().expect("stream id").clone();
        crate::ai_agent_processes::with_stream_id(stream_id, || {
            runner(request, Some(session), &mut |event| turn.on_event(event))
        })
    }
}

impl ChatEngine for ClaudeCodeEngine {
    fn control(&self) -> Box<dyn ChatControl> {
        Box::new(ClaudeCodeControl {
            shared: Arc::clone(&self.shared),
        })
    }

    fn ensure_log(&mut self, session_id: &str) -> Result<(), String> {
        if self.writer.is_some() {
            return Ok(());
        }
        let path = native_log::session_log_path(session_id)?;
        if path.exists() {
            let opened = native_log::open_session_log(session_id)?;
            let live_id = opened
                .successor_id
                .clone()
                .unwrap_or_else(|| session_id.to_string());
            let events = if live_id == session_id {
                opened.events
            } else {
                native_log::open_session_log(&live_id)?.events
            };
            self.writer = Some(native_log::open_session_writer(
                &live_id,
                native_log::next_seq_after(&events),
            )?);
            self.log_id = live_id.clone();
            self.sidecar = match read_sidecar(&live_id).or_else(|| read_sidecar(session_id)) {
                Some(sidecar) => sidecar,
                // A chat with turns but no saved conversation cannot resume.
                None if !events.is_empty() => Sidecar {
                    resume_failed: true,
                    ..Sidecar::fresh()
                },
                None => Sidecar::fresh(),
            };
            self.save_sidecar()?;
        } else {
            self.writer = Some(native_log::create_session_log(&self.header(session_id))?);
            self.log_id = session_id.to_string();
            self.sidecar = Sidecar::fresh();
            self.save_sidecar()?;
        }
        *self.shared.stream_id.lock().expect("stream id") =
            format!("native-claude-code:{}", self.log_id);
        Ok(())
    }

    fn start_turn(
        &mut self,
        prompt: &str,
        _continuation: bool,
        sink: Box<dyn FnMut(EngineEvent) + Send>,
    ) -> Result<(), String> {
        let Some(mut writer) = self.writer.take() else {
            let mut sink = sink;
            sink(EngineEvent::error("native session log is not open", true));
            return Ok(());
        };
        let mut turn = Turn::new(&mut writer, sink);
        let result = self.drive(prompt, &mut turn);
        drop(turn);
        self.writer = Some(writer);
        result
    }
}

impl ClaudeCodeEngine {
    fn drive(&mut self, prompt: &str, turn: &mut Turn<'_>) -> Result<(), String> {
        if self.sidecar.resume_failed {
            turn.emit(EngineEvent::error(RESUME_FAILED, true));
            return Ok(());
        }
        let Some(vault_path) = self
            .settings
            .vault_path
            .clone()
            .filter(|path| !path.trim().is_empty())
        else {
            turn.emit(EngineEvent::error(NO_VAULT, true));
            return Ok(());
        };
        turn.record(&DurableEvent::User {
            text: prompt.to_string(),
        });
        *self.shared.cancel.lock().expect("cancel cause") = None;
        self.shared.running.store(true, Ordering::SeqCst);
        let mut result = self.run(prompt, &vault_path, turn);
        // The app quit between Claude creating the conversation and Rhizome
        // saving that it did. Resume it instead.
        if !self.sidecar.started && failure_mentions(&result, turn, ALREADY_IN_USE) {
            self.sidecar.started = true;
            let _ = self.save_sidecar();
            turn.errors.clear();
            result = self.run(prompt, &vault_path, turn);
        }
        self.shared.running.store(false, Ordering::SeqCst);
        turn.flush_assistant();
        self.note_conversation(&result);

        if let Some(cause) = self.shared.cancel.lock().expect("cancel cause").take() {
            turn.record(&DurableEvent::Cancelled {
                cause: cause.clone(),
            });
            turn.emit(EngineEvent::Cancelled { cause });
            return Ok(());
        }
        let failure = match &result {
            Err(message) => Some(message.clone()),
            Ok(_) => turn.errors.last().cloned(),
        };
        let Some(message) = failure else {
            turn.record(&DurableEvent::TurnEnd);
            turn.emit(EngineEvent::TurnEnd);
            return Ok(());
        };
        if self.sidecar.started && message.contains(NO_CONVERSATION) {
            self.sidecar.resume_failed = true;
            if let Err(error) = self.save_sidecar() {
                turn.emit(EngineEvent::error(format!("{SAVE_FAILED}: {error}"), false));
            }
            turn.record(&DurableEvent::ModelFailed {
                message: RESUME_FAILED.into(),
            });
            turn.emit(EngineEvent::error(RESUME_FAILED, true));
            return Ok(());
        }
        turn.record(&DurableEvent::ModelFailed {
            message: message.clone(),
        });
        turn.emit(EngineEvent::error(message, true));
        Ok(())
    }

    /// Claude Code reports the conversation id once it has made it.
    fn note_conversation(&mut self, result: &Result<String, String>) {
        let Ok(reported) = result else {
            return;
        };
        let Ok(reported) = uuid::Uuid::parse_str(reported.trim()) else {
            return;
        };
        let reported = reported.hyphenated().to_string();
        if self.sidecar.started && self.sidecar.session_id == reported {
            return;
        }
        self.sidecar.started = true;
        self.sidecar.session_id = reported;
        let _ = self.save_sidecar();
    }
}

fn failure_mentions(result: &Result<String, String>, turn: &Turn<'_>, needle: &str) -> bool {
    match result {
        Err(message) => message.contains(needle),
        Ok(_) => turn.errors.iter().any(|message| message.contains(needle)),
    }
}

/// One turn's state: the log writer, the chat's sink, and what to flush.
struct Turn<'a> {
    writer: &'a mut NativeSessionWriter,
    sink: Box<dyn FnMut(EngineEvent) + Send>,
    assistant: String,
    tools: HashMap<String, String>,
    errors: Vec<String>,
    save_failed: bool,
}

impl<'a> Turn<'a> {
    fn new(writer: &'a mut NativeSessionWriter, sink: Box<dyn FnMut(EngineEvent) + Send>) -> Self {
        Self {
            writer,
            sink,
            assistant: String::new(),
            tools: HashMap::new(),
            errors: Vec::new(),
            save_failed: false,
        }
    }

    fn emit(&mut self, event: EngineEvent) {
        (self.sink)(event);
    }

    fn record(&mut self, event: &DurableEvent) {
        if let Err(error) = self.writer.append(event) {
            if !self.save_failed {
                self.save_failed = true;
                self.emit(EngineEvent::error(format!("{SAVE_FAILED}: {error}"), false));
            }
        }
    }

    fn flush_assistant(&mut self) {
        if self.assistant.is_empty() {
            return;
        }
        let text = std::mem::take(&mut self.assistant);
        self.record(&DurableEvent::Assistant { text });
    }

    fn on_event(&mut self, event: AiAgentStreamEvent) {
        match event {
            AiAgentStreamEvent::TextDelta { text } => {
                self.assistant.push_str(&text);
                self.emit(EngineEvent::TextDelta { text });
            }
            AiAgentStreamEvent::ToolStart {
                tool_name,
                tool_id,
                input,
            } => {
                self.flush_assistant();
                self.tools.insert(tool_id.clone(), tool_name.clone());
                let args = input.unwrap_or_default();
                self.record(&DurableEvent::ToolCall {
                    id: tool_id.clone(),
                    name: tool_name.clone(),
                    args: args.clone(),
                });
                self.emit(EngineEvent::ToolCall {
                    id: tool_id,
                    name: tool_name,
                    args,
                });
            }
            AiAgentStreamEvent::ToolDone { tool_id, output } => {
                let name = self
                    .tools
                    .get(&tool_id)
                    .cloned()
                    .unwrap_or_else(|| "tool".into());
                let output = output.unwrap_or_default();
                self.record(&DurableEvent::ToolResult {
                    id: tool_id.clone(),
                    name: name.clone(),
                    output: output.clone(),
                });
                self.emit(EngineEvent::ToolResult {
                    id: tool_id,
                    name,
                    output,
                });
            }
            AiAgentStreamEvent::ApprovalRequested {
                prompt_id,
                tool,
                args,
                options,
                path,
                call_id,
            } => self.emit(EngineEvent::ApprovalRequested {
                prompt_id,
                tool,
                args,
                options,
                path,
                preview: None,
                created: None,
                overwrite: None,
                notes: None,
                capped: None,
                call_id,
            }),
            AiAgentStreamEvent::ApprovalDismissed { prompt_id } => {
                self.emit(EngineEvent::ApprovalDismissed { prompt_id })
            }
            AiAgentStreamEvent::Error { message } => self.errors.push(message),
            AiAgentStreamEvent::Notice { message } => self.emit(EngineEvent::error(message, false)),
            AiAgentStreamEvent::Init { .. }
            | AiAgentStreamEvent::ThinkingDelta { .. }
            | AiAgentStreamEvent::QueueUpdate { .. }
            | AiAgentStreamEvent::Compaction { .. }
            | AiAgentStreamEvent::TurnBoundary
            | AiAgentStreamEvent::Done => {}
        }
    }
}

struct ClaudeCodeControl {
    shared: Arc<Shared>,
}

/// The card offers Allow once and Deny. A session grant is not offered, so
/// it denies like every other answer that is not Allow once.
fn claude_reply(reply: ApprovalReply) -> ApprovalReply {
    match reply {
        ApprovalReply::AllowOnce => ApprovalReply::AllowOnce,
        _ => ApprovalReply::Deny,
    }
}

impl ChatControl for ClaudeCodeControl {
    fn cancel(&self, cause: &str) {
        if !self.shared.running.load(Ordering::SeqCst) {
            return;
        }
        *self.shared.cancel.lock().expect("cancel cause") = Some(cause.to_string());
        let stream_id = self.shared.stream_id.lock().expect("stream id").clone();
        if matches!(
            crate::ai_agent_processes::interrupt_stream(&stream_id, STOP_GRACE),
            Ok(true)
        ) {
            return;
        }
        // The cancel beat the child's start. Keep trying while the turn runs.
        let shared = Arc::clone(&self.shared);
        std::thread::spawn(move || {
            let started = Instant::now();
            while started.elapsed() < CANCEL_RETRY_FOR && shared.running.load(Ordering::SeqCst) {
                std::thread::sleep(CANCEL_RETRY_EVERY);
                if matches!(
                    crate::ai_agent_processes::interrupt_stream(&stream_id, STOP_GRACE),
                    Ok(true)
                ) {
                    return;
                }
            }
        });
    }

    fn reply_approval(&self, prompt_id: &str, reply: ApprovalReply) {
        crate::claude_code_approval::reply(prompt_id, claude_reply(reply));
    }

    fn settle_on_quit(&self) {
        self.cancel("quit");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::panic::{catch_unwind, AssertUnwindSafe};
    use std::sync::mpsc;

    fn with_temp_home<T>(body: impl FnOnce() -> T) -> T {
        let _shared = crate::app_config::TEST_CONFIG_ENV
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let home = tempfile::tempdir().unwrap();
        let previous = std::env::var_os("HOME");
        let previous_config = std::env::var_os("XDG_CONFIG_HOME");
        std::env::set_var("HOME", home.path());
        std::env::set_var("XDG_CONFIG_HOME", home.path().join(".config"));
        let result = catch_unwind(AssertUnwindSafe(body));
        match previous_config {
            Some(value) => std::env::set_var("XDG_CONFIG_HOME", value),
            None => std::env::remove_var("XDG_CONFIG_HOME"),
        }
        match previous {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match result {
            Ok(value) => value,
            Err(panic) => std::panic::resume_unwind(panic),
        }
    }

    fn chat(n: u8) -> String {
        format!("00000000-0000-4000-8000-{n:012}")
    }

    fn settings() -> ClaudeCodeSettings {
        ClaudeCodeSettings {
            vault_path: Some("/tmp/vault".into()),
            vault_paths: Vec::new(),
            permission_mode: AiAgentPermissionMode::Safe,
            system_prompt: None,
        }
    }

    type Seen = Arc<Mutex<Vec<Option<ClaudeSession>>>>;

    /// A runner that plays `script` and reports the id Claude would.
    fn scripted(
        script: Vec<AiAgentStreamEvent>,
        result: Result<String, String>,
    ) -> (ClaudeRunner, Seen) {
        let seen: Seen = Arc::new(Mutex::new(Vec::new()));
        let log = Arc::clone(&seen);
        let runner: ClaudeRunner = Arc::new(move |_req, session, emit| {
            log.lock().unwrap().push(session.clone());
            for event in script.clone() {
                emit(event);
            }
            match (&result, &session) {
                (Ok(id), _) if !id.is_empty() => Ok(id.clone()),
                (Ok(_), Some(ClaudeSession::New(id) | ClaudeSession::Resume(id))) => Ok(id.clone()),
                (other, _) => other.clone(),
            }
        });
        (runner, seen)
    }

    fn collect() -> (
        Box<dyn FnMut(EngineEvent) + Send>,
        mpsc::Receiver<EngineEvent>,
    ) {
        let (tx, rx) = mpsc::channel();
        (
            Box::new(move |event| {
                let _ = tx.send(event);
            }),
            rx,
        )
    }

    fn turn(engine: &mut ClaudeCodeEngine, prompt: &str) -> Vec<EngineEvent> {
        let (sink, rx) = collect();
        engine.start_turn(prompt, false, sink).unwrap();
        rx.try_iter().collect()
    }

    fn tool_turn() -> Vec<AiAgentStreamEvent> {
        vec![
            AiAgentStreamEvent::Init {
                session_id: "ignored".into(),
            },
            AiAgentStreamEvent::TextDelta {
                text: "Looking.".into(),
            },
            AiAgentStreamEvent::ToolStart {
                tool_name: "Read".into(),
                tool_id: "toolu_1".into(),
                input: Some("{\"file_path\":\"/tmp/vault/a.md\"}".into()),
            },
            AiAgentStreamEvent::ToolDone {
                tool_id: "toolu_1".into(),
                output: Some("hello".into()),
            },
            AiAgentStreamEvent::TextDelta {
                text: "Done.".into(),
            },
            AiAgentStreamEvent::Done,
        ]
    }

    #[test]
    fn a_turn_is_saved_in_the_native_log_as_claude_code() {
        with_temp_home(|| {
            let (runner, seen) = scripted(tool_turn(), Ok(String::new()));
            let mut engine = ClaudeCodeEngine::with_runner(settings(), runner);
            engine.ensure_log(&chat(1)).unwrap();
            let events = turn(&mut engine, "Read a.md");
            assert_eq!(events.last(), Some(&EngineEvent::TurnEnd));

            let opened = native_log::open_session_log(&chat(1)).unwrap();
            assert_eq!(opened.header.target, CLAUDE_CODE_TARGET);
            assert_eq!(
                opened.events,
                vec![
                    DurableEvent::User {
                        text: "Read a.md".into()
                    },
                    DurableEvent::Assistant {
                        text: "Looking.".into()
                    },
                    DurableEvent::ToolCall {
                        id: "toolu_1".into(),
                        name: "Read".into(),
                        args: "{\"file_path\":\"/tmp/vault/a.md\"}".into(),
                    },
                    DurableEvent::ToolResult {
                        id: "toolu_1".into(),
                        name: "Read".into(),
                        output: "hello".into(),
                    },
                    DurableEvent::Assistant {
                        text: "Done.".into()
                    },
                    DurableEvent::TurnEnd,
                ]
            );
            let first = seen.lock().unwrap()[0].clone();
            assert!(matches!(first, Some(ClaudeSession::New(_))));
        });
    }

    #[test]
    fn later_turns_resume_the_same_conversation() {
        with_temp_home(|| {
            let (runner, seen) = scripted(tool_turn(), Ok(String::new()));
            let mut engine = ClaudeCodeEngine::with_runner(settings(), Arc::clone(&runner));
            engine.ensure_log(&chat(2)).unwrap();
            turn(&mut engine, "one");
            turn(&mut engine, "two");
            drop(engine);

            // A restart reopens the same log and keeps resuming.
            let mut reopened = ClaudeCodeEngine::with_runner(settings(), runner);
            reopened.ensure_log(&chat(2)).unwrap();
            turn(&mut reopened, "three");

            let seen = seen.lock().unwrap().clone();
            let Some(ClaudeSession::New(id)) = seen[0].clone() else {
                panic!("first turn must name a new conversation: {seen:?}");
            };
            assert_eq!(seen[1], Some(ClaudeSession::Resume(id.clone())));
            assert_eq!(seen[2], Some(ClaudeSession::Resume(id)));
        });
    }

    #[test]
    fn a_lost_conversation_makes_the_chat_read_only() {
        with_temp_home(|| {
            let (runner, _) = scripted(tool_turn(), Ok(String::new()));
            let mut engine = ClaudeCodeEngine::with_runner(settings(), runner);
            engine.ensure_log(&chat(3)).unwrap();
            turn(&mut engine, "one");

            let (lost, seen) = scripted(
                vec![AiAgentStreamEvent::Error {
                    message: "No conversation found with session ID: x".into(),
                }],
                Ok(String::new()),
            );
            engine.runner = lost;
            let events = turn(&mut engine, "two");
            assert_eq!(
                events.last(),
                Some(&EngineEvent::error(RESUME_FAILED, true))
            );
            assert!(conversation_lost(&chat(3), true));

            // The next send does not run claude again.
            let events = turn(&mut engine, "three");
            assert_eq!(events, vec![EngineEvent::error(RESUME_FAILED, true)]);
            assert_eq!(seen.lock().unwrap().len(), 1);
        });
    }

    #[test]
    fn a_log_with_turns_but_no_conversation_does_not_resume() {
        with_temp_home(|| {
            let (runner, seen) = scripted(tool_turn(), Ok(String::new()));
            let mut engine = ClaudeCodeEngine::with_runner(settings(), Arc::clone(&runner));
            engine.ensure_log(&chat(4)).unwrap();
            turn(&mut engine, "one");
            drop(engine);
            std::fs::remove_file(sidecar_path(&chat(4)).unwrap()).unwrap();

            let mut reopened = ClaudeCodeEngine::with_runner(settings(), runner);
            reopened.ensure_log(&chat(4)).unwrap();
            assert!(conversation_lost(&chat(4), true));
            let events = turn(&mut reopened, "two");
            assert_eq!(events, vec![EngineEvent::error(RESUME_FAILED, true)]);
            assert_eq!(seen.lock().unwrap().len(), 1);
        });
    }

    #[test]
    fn a_conversation_claude_already_made_is_resumed() {
        with_temp_home(|| {
            let calls = Arc::new(Mutex::new(Vec::new()));
            let log = Arc::clone(&calls);
            let runner: ClaudeRunner = Arc::new(move |_req, session, emit| {
                log.lock().unwrap().push(session.clone());
                match session {
                    Some(ClaudeSession::New(_)) => {
                        emit(AiAgentStreamEvent::Error {
                            message: "Session ID x is already in use.".into(),
                        });
                        Ok(String::new())
                    }
                    Some(ClaudeSession::Resume(id)) => {
                        emit(AiAgentStreamEvent::TextDelta { text: "ok".into() });
                        Ok(id)
                    }
                    None => Err("no session".into()),
                }
            });
            let mut engine = ClaudeCodeEngine::with_runner(settings(), runner);
            engine.ensure_log(&chat(5)).unwrap();
            let events = turn(&mut engine, "hi");
            assert_eq!(events.last(), Some(&EngineEvent::TurnEnd));
            let calls = calls.lock().unwrap().clone();
            assert!(matches!(calls[0], Some(ClaudeSession::New(_))));
            assert!(matches!(calls[1], Some(ClaudeSession::Resume(_))));
        });
    }

    #[test]
    fn a_cancelled_turn_is_saved_as_cancelled() {
        with_temp_home(|| {
            let control_slot: Arc<Mutex<Option<Box<dyn ChatControl>>>> = Arc::new(Mutex::new(None));
            let slot = Arc::clone(&control_slot);
            let runner: ClaudeRunner = Arc::new(move |_req, session, emit| {
                emit(AiAgentStreamEvent::TextDelta {
                    text: "partial".into(),
                });
                if let Some(control) = slot.lock().unwrap().as_ref() {
                    control.cancel("user");
                }
                match session {
                    Some(ClaudeSession::New(id) | ClaudeSession::Resume(id)) => Ok(id),
                    None => Ok(String::new()),
                }
            });
            let mut engine = ClaudeCodeEngine::with_runner(settings(), runner);
            engine.ensure_log(&chat(6)).unwrap();
            *control_slot.lock().unwrap() = Some(engine.control());
            let events = turn(&mut engine, "go");
            assert_eq!(
                events.last(),
                Some(&EngineEvent::Cancelled {
                    cause: "user".into()
                })
            );
            let saved = native_log::open_session_log(&chat(6)).unwrap().events;
            assert_eq!(
                saved.last(),
                Some(&DurableEvent::Cancelled {
                    cause: "user".into()
                })
            );
            assert!(!saved.contains(&DurableEvent::TurnEnd));
        });
    }

    #[test]
    fn a_cancel_while_idle_does_nothing() {
        let engine =
            ClaudeCodeEngine::with_runner(settings(), scripted(vec![], Ok(String::new())).0);
        engine.control().cancel("user");
        assert!(engine.shared.cancel.lock().unwrap().is_none());
    }

    #[test]
    fn a_failed_run_is_saved_as_a_model_failure() {
        with_temp_home(|| {
            let (runner, _) = scripted(
                vec![AiAgentStreamEvent::Error {
                    message: "Claude Code is not signed in.".into(),
                }],
                Ok(String::new()),
            );
            let mut engine = ClaudeCodeEngine::with_runner(settings(), runner);
            engine.ensure_log(&chat(7)).unwrap();
            let events = turn(&mut engine, "hi");
            assert_eq!(
                events.last(),
                Some(&EngineEvent::error("Claude Code is not signed in.", true))
            );
            let saved = native_log::open_session_log(&chat(7)).unwrap().events;
            assert_eq!(
                saved.last(),
                Some(&DurableEvent::ModelFailed {
                    message: "Claude Code is not signed in.".into()
                })
            );
            assert!(!conversation_lost(&chat(7), true));
        });
    }

    #[test]
    fn approval_asks_reach_the_chat_with_their_call_id() {
        with_temp_home(|| {
            let (runner, _) = scripted(
                vec![AiAgentStreamEvent::ApprovalRequested {
                    prompt_id: "p1".into(),
                    tool: "Edit".into(),
                    args: "{}".into(),
                    options: Vec::new(),
                    path: Some("/tmp/vault/a.md".into()),
                    call_id: "toolu_9".into(),
                }],
                Ok(String::new()),
            );
            let mut engine = ClaudeCodeEngine::with_runner(settings(), runner);
            engine.ensure_log(&chat(8)).unwrap();
            let events = turn(&mut engine, "edit");
            assert!(events.iter().any(|event| matches!(
                event,
                EngineEvent::ApprovalRequested { prompt_id, call_id, .. }
                    if prompt_id == "p1" && call_id == "toolu_9"
            )));
        });
    }

    #[test]
    fn deleting_a_chat_forgets_its_conversation() {
        with_temp_home(|| {
            let (runner, _) = scripted(tool_turn(), Ok(String::new()));
            let mut engine = ClaudeCodeEngine::with_runner(settings(), runner);
            engine.ensure_log(&chat(11)).unwrap();
            assert!(sidecar_path(&chat(11)).unwrap().exists());
            forget_conversation(&chat(11));
            assert!(!sidecar_path(&chat(11)).unwrap().exists());
        });
    }

    #[test]
    fn only_allow_once_allows() {
        assert_eq!(
            claude_reply(ApprovalReply::AllowOnce),
            ApprovalReply::AllowOnce
        );
        assert_eq!(
            claude_reply(ApprovalReply::AllowSession),
            ApprovalReply::Deny
        );
        assert_eq!(claude_reply(ApprovalReply::Deny), ApprovalReply::Deny);
        assert_eq!(claude_reply(ApprovalReply::Cancelled), ApprovalReply::Deny);
    }

    #[test]
    fn a_chat_without_a_vault_does_not_run_claude() {
        with_temp_home(|| {
            let (runner, seen) = scripted(tool_turn(), Ok(String::new()));
            let mut engine = ClaudeCodeEngine::with_runner(
                ClaudeCodeSettings {
                    vault_path: None,
                    ..settings()
                },
                runner,
            );
            engine.ensure_log(&chat(9)).unwrap();
            let events = turn(&mut engine, "hi");
            assert_eq!(events, vec![EngineEvent::error(NO_VAULT, true)]);
            assert!(seen.lock().unwrap().is_empty());
        });
    }

    #[test]
    fn secrets_are_redacted_before_they_reach_the_log() {
        with_temp_home(|| {
            let secret = format!("API_KEY={}", "ab".repeat(300));
            let (runner, _) = scripted(
                vec![AiAgentStreamEvent::TextDelta {
                    text: secret.clone(),
                }],
                Ok(String::new()),
            );
            let mut engine = ClaudeCodeEngine::with_runner(settings(), runner);
            engine.ensure_log(&chat(10)).unwrap();
            turn(&mut engine, "hi");
            let raw =
                std::fs::read_to_string(native_log::session_log_path(&chat(10)).unwrap()).unwrap();
            assert!(!raw.contains(&"ab".repeat(300)), "secret reached the log");
        });
    }
}
