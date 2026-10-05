use serde::{Deserialize, Serialize};
use serde_json::Value;

pub(crate) const PROTOCOL_VERSION: u32 = 1;
pub(crate) const CLIENT_NAME: &str = "rhizome-agent";
pub(crate) const CLIENT_TITLE: &str = "Rhizome Agent";
pub(crate) const CLIENT_VERSION: &str = "0.1.0";

#[derive(Debug, Serialize)]
pub(crate) struct JsonRpcRequest<'a> {
    pub jsonrpc: &'static str,
    pub id: u64,
    pub method: &'a str,
    pub params: Value,
}

#[derive(Debug, Serialize)]
pub(crate) struct JsonRpcResponse {
    pub jsonrpc: &'static str,
    pub id: Value,
    pub result: Value,
}

#[derive(Debug, Deserialize)]
pub(crate) struct IncomingMessage {
    pub id: Option<Value>,
    pub method: Option<String>,
    pub params: Option<Value>,
    pub result: Option<Value>,
    pub error: Option<Value>,
}

impl IncomingMessage {
    pub(crate) fn is_response(&self) -> bool {
        self.method.is_none() && (self.result.is_some() || self.error.is_some())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InitializeResult {
    #[serde(default)]
    pub protocol_version: Option<Value>,
    #[serde(default)]
    pub agent_capabilities: Option<AgentCapabilities>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentCapabilities {
    #[serde(default)]
    pub load_session: bool,
    #[serde(default)]
    pub session_capabilities: Option<SessionCapabilities>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionCapabilities {
    #[serde(default)]
    pub resume: Option<Value>,
    #[serde(default)]
    pub close: Option<Value>,
}

impl AgentCapabilities {
    pub(crate) fn can_resume(&self) -> bool {
        self.session_capabilities
            .as_ref()
            .is_some_and(|caps| caps.resume.is_some())
    }

    #[allow(dead_code)]
    pub(crate) fn can_close(&self) -> bool {
        self.session_capabilities
            .as_ref()
            .is_some_and(|caps| caps.close.is_some())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NewSessionResult {
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PermissionOption {
    pub option_id: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub name: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PermissionRequest {
    #[serde(default)]
    #[allow(dead_code)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub tool_call: Option<Value>,
    #[serde(default)]
    pub options: Vec<PermissionOption>,
}

pub(crate) fn initialize_params() -> Value {
    serde_json::json!({
        "protocolVersion": PROTOCOL_VERSION,
        "clientCapabilities": {
            "fs": {
                "readTextFile": false,
                "writeTextFile": false
            },
            "terminal": false
        },
        "clientInfo": {
            "name": CLIENT_NAME,
            "title": CLIENT_TITLE,
            "version": CLIENT_VERSION
        }
    })
}

pub(crate) fn new_session_params(cwd: &str, mcp_servers: &[Value]) -> Value {
    serde_json::json!({
        "cwd": cwd,
        "mcpServers": mcp_servers
    })
}

pub(crate) fn load_session_params(session_id: &str, cwd: &str, mcp_servers: &[Value]) -> Value {
    serde_json::json!({
        "sessionId": session_id,
        "cwd": cwd,
        "mcpServers": mcp_servers
    })
}

pub(crate) fn prompt_params(session_id: &str, text: &str) -> Value {
    serde_json::json!({
        "sessionId": session_id,
        "prompt": [{ "type": "text", "text": text }]
    })
}

pub(crate) fn set_mode_params(session_id: &str, mode_id: &str) -> Value {
    serde_json::json!({
        "sessionId": session_id,
        "modeId": mode_id
    })
}

pub(crate) fn selected_permission_result(option_id: &str) -> Value {
    serde_json::json!({
        "outcome": {
            "outcome": "selected",
            "optionId": option_id
        }
    })
}

pub(crate) fn cancelled_permission_result() -> Value {
    serde_json::json!({
        "outcome": { "outcome": "cancelled" }
    })
}

pub(crate) fn method_not_found(method: &str) -> Value {
    serde_json::json!({
        "code": -32601,
        "message": format!("Method not found: {method}")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn incoming_response_is_detected_without_a_method() {
        let message: IncomingMessage = serde_json::from_value(serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": { "sessionId": "sess_1" }
        }))
        .unwrap();

        assert!(message.is_response());
        assert_eq!(message.result.unwrap()["sessionId"], "sess_1");
    }

    #[test]
    fn initialize_params_advertise_rhizome_as_a_stdio_client() {
        let params = initialize_params();

        assert_eq!(params["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(params["clientInfo"]["name"], CLIENT_NAME);
        assert_eq!(params["clientCapabilities"]["fs"]["writeTextFile"], false);
        assert_eq!(params["clientCapabilities"]["terminal"], false);
    }

    #[test]
    fn agent_capabilities_read_resume_and_load_flags() {
        let caps: AgentCapabilities = serde_json::from_value(serde_json::json!({
            "loadSession": true,
            "sessionCapabilities": { "resume": {}, "close": {} }
        }))
        .unwrap();

        assert!(caps.load_session);
        assert!(caps.can_resume());
        assert!(caps.can_close());
    }
}
