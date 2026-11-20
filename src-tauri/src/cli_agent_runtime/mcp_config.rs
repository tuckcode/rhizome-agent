pub(crate) fn rhizome_node_mcp_server(
    mcp_server_path: &str,
    vault_path: &str,
    vault_paths: &[String],
    include_ui_bridge_env: bool,
) -> serde_json::Value {
    let mut env = serde_json::json!({
        "VAULT_PATH": vault_path,
        "VAULT_PATHS": super::active_vault_paths_json(vault_path, vault_paths)
    });

    if include_ui_bridge_env {
        env["WS_UI_PORT"] = serde_json::json!("9711");
    }

    serde_json::json!({
        "command": "node",
        "args": [mcp_server_path],
        "env": env
    })
}

/// Approval-only MCP server for the Claude Code engine (ADR-0191 step 4).
/// It gets the broker address and token, and no vault paths.
pub(crate) fn rhizome_approval_mcp_server(
    approval_server_path: &str,
    endpoint: &crate::claude_code_approval::ApprovalEndpoint,
) -> serde_json::Value {
    use crate::claude_code_approval::{
        APPROVAL_ADDR_ENV, APPROVAL_TIMEOUT_ENV, APPROVAL_TOKEN_ENV,
    };
    // The MCP side waits a little longer than the broker, so the broker's
    // own deny (with its message) normally arrives first.
    let mcp_timeout_ms = endpoint.timeout.as_millis().saturating_add(15_000);
    serde_json::json!({
        "command": "node",
        "args": [approval_server_path],
        "env": {
            APPROVAL_ADDR_ENV: endpoint.addr.to_string(),
            APPROVAL_TOKEN_ENV: endpoint.token,
            APPROVAL_TIMEOUT_ENV: mcp_timeout_ms.to_string(),
        }
    })
}
