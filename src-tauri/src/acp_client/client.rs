use crate::ai_agent_processes::RegisteredAiAgentChild;
use crate::ai_agents::{AiAgentPermissionMode, AiAgentStreamEvent};
use serde::ser::SerializeMap;
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{ChildStdin, ChildStdout, Stdio};
use std::thread::JoinHandle;

use super::events::{map_session_update, permission_tool_events};
use super::permission::{decide_permission, edit_approval_mode, PermissionDecision};
use super::protocol::{
    cancelled_permission_result, initialize_params, load_session_params, method_not_found,
    new_session_params, prompt_params, selected_permission_result, set_mode_params,
    AgentCapabilities, IncomingMessage, InitializeResult, JsonRpcRequest, JsonRpcResponse,
    NewSessionResult, PermissionRequest,
};

/// How to spawn an ACP agent. Generic: command + args, not Hermes-specific.
#[derive(Debug, Clone)]
pub(crate) struct AcpLaunch {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub extra_env: Vec<(String, String)>,
}

/// One prompt turn against an ACP session.
#[derive(Debug, Clone)]
pub(crate) struct AcpSessionRequest {
    pub cwd: String,
    /// Full composed prompt, including persona and conversation history.
    /// Used when this turn opens a new session.
    pub prompt: String,
    /// Latest user line only. Used when resume/load actually succeeded so
    /// the harness history is not duplicated.
    pub resumed_prompt: Option<String>,
    pub resume_session_id: Option<String>,
    pub mcp_servers: Vec<Value>,
    pub permission_mode: AiAgentPermissionMode,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum EmitPhase {
    Silent,
    Live,
}

struct AcpConnection<F> {
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_id: u64,
    emit: F,
    phase: EmitPhase,
    permission_mode: AiAgentPermissionMode,
    capabilities: AgentCapabilities,
    child: RegisteredAiAgentChild,
    stderr: JoinHandle<String>,
}

/// Spawn an ACP agent, run one prompt turn, then detach.
///
/// The harness owns the session after this returns. Rhizome remembers the
/// session id the agent issued so a later turn can `session/load` or
/// `session/resume`.
pub(crate) fn run_acp_prompt<F>(
    launch: AcpLaunch,
    request: AcpSessionRequest,
    emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let mut connection = AcpConnection::spawn(launch, request.permission_mode, emit)?;
    let result = connection.run_turn(&request);
    let stderr = connection.shutdown();
    match result {
        Ok(session_id) => Ok(session_id),
        Err(error) => {
            if stderr.trim().is_empty() {
                Err(error)
            } else {
                Err(format!("{error}\n{}", first_stderr_lines(&stderr)))
            }
        }
    }
}

impl<F> AcpConnection<F>
where
    F: FnMut(AiAgentStreamEvent),
{
    fn spawn(
        launch: AcpLaunch,
        permission_mode: AiAgentPermissionMode,
        emit: F,
    ) -> Result<Self, String> {
        let mut command = crate::hidden_command(&launch.program);
        crate::cli_agent_runtime::configure_agent_command_environment(
            &mut command,
            &launch.program,
        );
        for arg in &launch.args {
            command.arg(arg);
        }
        for (key, value) in &launch.extra_env {
            command.env(key, value);
        }
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn ACP agent: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "ACP agent has no stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "ACP agent has no stdout".to_string())?;
        let stderr = read_stderr_async(child.stderr.take());
        let child = crate::ai_agent_processes::register_current_stream_child(child);

        Ok(Self {
            stdin,
            stdout: BufReader::new(stdout),
            next_id: 1,
            emit,
            phase: EmitPhase::Silent,
            permission_mode,
            capabilities: AgentCapabilities::default(),
            child,
            stderr,
        })
    }

    fn run_turn(&mut self, request: &AcpSessionRequest) -> Result<String, String> {
        self.handshake()?;
        let (session_id, resumed) = self.open_session(request)?;
        (self.emit)(AiAgentStreamEvent::Init {
            session_id: session_id.clone(),
        });
        if let Some(mode_id) = edit_approval_mode(request.permission_mode) {
            let _ = self.call("session/set_mode", set_mode_params(&session_id, mode_id));
        }
        self.phase = EmitPhase::Live;
        let prompt = if resumed {
            request
                .resumed_prompt
                .as_deref()
                .unwrap_or(request.prompt.as_str())
        } else {
            request.prompt.as_str()
        };
        self.call("session/prompt", prompt_params(&session_id, prompt))?;
        // Do not session/close. The child exits after this turn. Close on an
        // agent that advertises it can drop the row we need for the next load.
        (self.emit)(AiAgentStreamEvent::Done);
        Ok(session_id)
    }

    fn handshake(&mut self) -> Result<(), String> {
        let result = self.call("initialize", initialize_params())?;
        let parsed: InitializeResult = serde_json::from_value(result)
            .map_err(|error| format!("ACP initialize result was not valid: {error}"))?;
        if let Some(Value::Number(number)) = parsed.protocol_version {
            if number.as_u64().is_some_and(|value| value != 1) {
                return Err(format!(
                    "ACP agent negotiated protocol version {number}; Rhizome speaks 1"
                ));
            }
        }
        self.capabilities = parsed.agent_capabilities.unwrap_or_default();
        Ok(())
    }

    fn open_session(&mut self, request: &AcpSessionRequest) -> Result<(String, bool), String> {
        if let Some(resume_id) = request
            .resume_session_id
            .as_deref()
            .map(str::trim)
            .filter(|id| !id.is_empty())
        {
            if self.try_resume(resume_id, request) {
                return Ok((resume_id.to_string(), true));
            }
        }

        self.phase = EmitPhase::Silent;
        let result = self.call(
            "session/new",
            new_session_params(&request.cwd, &request.mcp_servers),
        )?;
        let parsed: NewSessionResult = serde_json::from_value(result)
            .map_err(|error| format!("ACP session/new result was not valid: {error}"))?;
        Ok((parsed.session_id, false))
    }

    fn try_resume(&mut self, session_id: &str, request: &AcpSessionRequest) -> bool {
        self.phase = EmitPhase::Silent;
        let params = load_session_params(session_id, &request.cwd, &request.mcp_servers);
        // Prefer session/load. Hermes session/resume mints a new session when
        // the id is missing and still returns success, so a later prompt on
        // the remembered id fails.
        if self.capabilities.load_session {
            return call_restored_session(self.call("session/load", params));
        }
        self.capabilities.can_resume() && call_restored_session(self.call("session/resume", params))
    }

    fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        self.write_message(&JsonRpcRequest {
            jsonrpc: "2.0",
            id,
            method,
            params,
        })?;
        self.wait_for_response(id)
    }

    fn write_message<T: Serialize>(&mut self, message: &T) -> Result<(), String> {
        let mut line = serde_json::to_string(message)
            .map_err(|error| format!("Failed to encode ACP message: {error}"))?;
        line.push('\n');
        self.stdin
            .write_all(line.as_bytes())
            .map_err(|error| format!("Failed to write ACP stdin: {error}"))?;
        self.stdin
            .flush()
            .map_err(|error| format!("Failed to flush ACP stdin: {error}"))
    }

    fn wait_for_response(&mut self, id: u64) -> Result<Value, String> {
        loop {
            let message = self.read_message()?;
            if message.is_response() {
                if json_rpc_id_matches(&message.id, id) {
                    if let Some(error) = message.error {
                        return Err(format_rpc_error(&error));
                    }
                    return Ok(message.result.unwrap_or(Value::Null));
                }
                continue;
            }

            let Some(method) = message.method.as_deref() else {
                continue;
            };
            self.handle_incoming(method, message.id, message.params.unwrap_or(Value::Null))?;
        }
    }

    fn handle_incoming(
        &mut self,
        method: &str,
        id: Option<Value>,
        params: Value,
    ) -> Result<(), String> {
        match method {
            "session/update" => {
                if self.phase == EmitPhase::Live {
                    if let Some(update) = params.get("update") {
                        for event in map_session_update(update) {
                            (self.emit)(event);
                        }
                    }
                }
                Ok(())
            }
            "session/request_permission" => {
                let request_id =
                    id.ok_or_else(|| "ACP permission request had no id".to_string())?;
                self.answer_permission(request_id, params)
            }
            other => {
                if let Some(request_id) = id {
                    self.write_message(&JsonRpcErrorResponse {
                        jsonrpc: "2.0",
                        id: request_id,
                        error: method_not_found(other),
                    })?;
                }
                Ok(())
            }
        }
    }

    fn answer_permission(&mut self, id: Value, params: Value) -> Result<(), String> {
        let request: PermissionRequest =
            serde_json::from_value(params).unwrap_or(PermissionRequest {
                session_id: None,
                tool_call: None,
                options: Vec::new(),
            });
        let decision = decide_permission(self.permission_mode, &request.options);
        let (result, label) = match &decision {
            PermissionDecision::Selected(option_id) => {
                (selected_permission_result(option_id), option_id.as_str())
            }
            PermissionDecision::Cancelled => (cancelled_permission_result(), "cancelled"),
        };
        if self.phase == EmitPhase::Live {
            for event in permission_tool_events(request.tool_call.as_ref(), label) {
                (self.emit)(event);
            }
        }
        self.write_message(&JsonRpcResponse {
            jsonrpc: "2.0",
            id,
            result,
        })
    }

    fn read_message(&mut self) -> Result<IncomingMessage, String> {
        let mut line = String::new();
        loop {
            line.clear();
            let bytes = self
                .stdout
                .read_line(&mut line)
                .map_err(|error| format!("Failed to read ACP stdout: {error}"))?;
            if bytes == 0 {
                return Err("ACP agent closed stdout".into());
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            return serde_json::from_str(trimmed)
                .map_err(|error| format!("ACP stdout was not JSON-RPC: {error}: {trimmed}"));
        }
    }

    fn shutdown(self) -> String {
        drop(self.stdin);
        let stderr = self.stderr.join().unwrap_or_default();
        let _ = self.child.wait();
        stderr
    }
}

struct JsonRpcErrorResponse {
    jsonrpc: &'static str,
    id: Value,
    error: Value,
}

impl Serialize for JsonRpcErrorResponse {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut map = serializer.serialize_map(Some(3))?;
        map.serialize_entry("jsonrpc", self.jsonrpc)?;
        map.serialize_entry("id", &self.id)?;
        map.serialize_entry("error", &self.error)?;
        map.end()
    }
}

fn json_rpc_id_matches(incoming: &Option<Value>, expected: u64) -> bool {
    match incoming {
        Some(Value::Number(number)) => number.as_u64() == Some(expected),
        Some(Value::String(text)) => text.parse::<u64>().ok() == Some(expected),
        _ => false,
    }
}

fn call_restored_session(result: Result<Value, String>) -> bool {
    match result {
        Ok(Value::Null) => false,
        Ok(_) => true,
        Err(_) => false,
    }
}

fn format_rpc_error(error: &Value) -> String {
    if let Some(message) = error.get("message").and_then(Value::as_str) {
        if let Some(code) = error.get("code") {
            return format!("ACP error {code}: {message}");
        }
        return format!("ACP error: {message}");
    }
    format!("ACP error: {error}")
}

fn first_stderr_lines(stderr: &str) -> String {
    stderr
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join("\n")
}

fn read_stderr_async(stderr: Option<std::process::ChildStderr>) -> JoinHandle<String> {
    std::thread::spawn(move || {
        let Some(mut stderr) = stderr else {
            return String::new();
        };
        let mut output = String::new();
        let _ = stderr.read_to_string(&mut output);
        output
    })
}
