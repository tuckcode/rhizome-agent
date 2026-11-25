//! Approval broker for the Claude Code engine (ADR-0191 step 4).
//!
//! Claude Code asks for permission through `--permission-prompt-tool`. That
//! tool lives in a separate, approval-only MCP server (`rhizome_approval`),
//! which the model never sees in `--tools`. The MCP server forwards each ask
//! here over a loopback socket, and this broker shows it in the app.
//!
//! Every failure denies:
//! - a wrong or missing token, a malformed or oversized request;
//! - the broker closing (turn ended, app quit, restart) while an ask waits;
//! - no answer before the timeout;
//! - an MCP server that cannot reach this broker (handled in
//!   `mcp-server/approval-bridge.js`).
//!
//! File reads outside the chat's vaults deny without asking. File writes
//! outside the vaults deny too. Every other ask, Bash included, waits for the
//! person.
//!
//! Wire format: one JSON line each way.
//! Request: `{"token","tool_name","input","tool_use_id"}`.
//! Reply: `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}`.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::rhizome_loop::{ApprovalOption, ApprovalReply};

/// MCP server name for the approval-only server.
pub(crate) const APPROVAL_SERVER_NAME: &str = "rhizome_approval";
/// Value for `--permission-prompt-tool`.
pub(crate) const APPROVAL_PROMPT_TOOL: &str = "mcp__rhizome_approval__approve";
/// Env names the approval-only MCP server reads.
pub(crate) const APPROVAL_ADDR_ENV: &str = "RHIZOME_APPROVAL_ADDR";
pub(crate) const APPROVAL_TOKEN_ENV: &str = "RHIZOME_APPROVAL_TOKEN";
pub(crate) const APPROVAL_TIMEOUT_ENV: &str = "RHIZOME_APPROVAL_TIMEOUT_MS";

/// Matches the native engine's approval wait.
pub(crate) const DEFAULT_APPROVAL_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const MAX_REQUEST_BYTES: u64 = 1024 * 1024;
const REQUEST_READ_TIMEOUT: Duration = Duration::from_secs(5);
const ACCEPT_POLL: Duration = Duration::from_millis(25);

const READ_TOOLS: &[&str] = &["Read", "Glob", "Grep", "LS", "NotebookRead"];
const WRITE_TOOLS: &[&str] = &["Edit", "MultiEdit", "Write", "NotebookEdit"];
const PATH_FIELDS: &[&str] = &["file_path", "notebook_path", "path"];

/// What the MCP server needs to reach this broker.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ApprovalEndpoint {
    pub addr: SocketAddr,
    pub bridge_secret: String,
    pub timeout: Duration,
}

/// One ask shown in the app. The stream maps it to its own event.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ApprovalAsk {
    pub prompt_id: String,
    pub tool: String,
    pub args: String,
    pub options: Vec<ApprovalOption>,
    pub path: Option<String>,
    pub call_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum BrokerEvent {
    Requested(ApprovalAsk),
    Dismissed { prompt_id: String },
}

type Sink = Arc<dyn Fn(BrokerEvent) + Send + Sync>;

#[derive(Deserialize)]
struct WireRequest {
    #[serde(default)]
    token: String,
    #[serde(default)]
    tool_name: String,
    #[serde(default)]
    input: serde_json::Value,
    #[serde(default)]
    tool_use_id: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "behavior", rename_all = "lowercase")]
enum WireReply {
    Allow,
    Deny { message: String },
}

impl WireReply {
    fn deny(message: impl Into<String>) -> Self {
        Self::Deny {
            message: message.into(),
        }
    }
}

/// Live prompts across every broker, so the reply command can find them.
fn live_prompts() -> &'static Mutex<HashMap<String, mpsc::Sender<ApprovalReply>>> {
    static LIVE: OnceLock<Mutex<HashMap<String, mpsc::Sender<ApprovalReply>>>> = OnceLock::new();
    LIVE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Answer a live prompt from the app. An unknown or finished id is ignored.
pub(crate) fn reply(prompt_id: &str, reply: ApprovalReply) -> bool {
    let sender = live_prompts()
        .lock()
        .expect("live prompts")
        .get(prompt_id)
        .cloned();
    sender.is_some_and(|tx| tx.send(reply).is_ok())
}

struct Inner {
    bridge_secret: String,
    timeout: Duration,
    scope: Vec<PathBuf>,
    closed: AtomicBool,
    sink: Sink,
    prompts: Mutex<Vec<String>>,
}

/// One broker per Claude Code turn. Dropping it closes it.
pub(crate) struct ApprovalBroker {
    endpoint: ApprovalEndpoint,
    inner: Arc<Inner>,
    accept: Option<thread::JoinHandle<()>>,
}

impl ApprovalBroker {
    /// Listen on 127.0.0.1 with a fresh token. `vaults` bounds file access.
    pub(crate) fn start(
        vaults: &[String],
        timeout: Duration,
        sink: impl Fn(BrokerEvent) + Send + Sync + 'static,
    ) -> Result<Self, String> {
        let listener = TcpListener::bind(("127.0.0.1", 0))
            .map_err(|e| format!("Could not start the approval bridge: {e}"))?;
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Could not start the approval bridge: {e}"))?;
        let addr = listener
            .local_addr()
            .map_err(|e| format!("Could not start the approval bridge: {e}"))?;
        let inner = Arc::new(Inner {
            bridge_secret: fresh_bridge_secret(),
            timeout,
            scope: vault_scope(vaults),
            closed: AtomicBool::new(false),
            sink: Arc::new(sink),
            prompts: Mutex::new(Vec::new()),
        });
        let accept_inner = Arc::clone(&inner);
        let accept = thread::Builder::new()
            .name("claude-code-approval".into())
            .spawn(move || accept_loop(listener, accept_inner))
            .map_err(|e| format!("Could not start the approval bridge: {e}"))?;
        Ok(Self {
            endpoint: ApprovalEndpoint {
                addr,
                bridge_secret: inner.bridge_secret.clone(),
                timeout,
            },
            inner,
            accept: Some(accept),
        })
    }

    pub(crate) fn endpoint(&self) -> &ApprovalEndpoint {
        &self.endpoint
    }

    /// Deny every waiting ask and stop listening.
    pub(crate) fn close(&mut self) {
        if self.inner.closed.swap(true, Ordering::SeqCst) {
            return;
        }
        let prompts = std::mem::take(&mut *self.inner.prompts.lock().expect("prompts"));
        let mut live = live_prompts().lock().expect("live prompts");
        for prompt_id in prompts {
            if let Some(tx) = live.remove(&prompt_id) {
                let _ = tx.send(ApprovalReply::Cancelled);
            }
        }
        drop(live);
        if let Some(handle) = self.accept.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for ApprovalBroker {
    fn drop(&mut self) {
        self.close();
    }
}

/// 64 hex characters from two v4 UUIDs (OS random source, 244 random bits).
fn fresh_bridge_secret() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

fn accept_loop(listener: TcpListener, inner: Arc<Inner>) {
    while !inner.closed.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, peer)) => {
                if !peer.ip().is_loopback() {
                    continue;
                }
                let conn_inner = Arc::clone(&inner);
                let _ = thread::Builder::new()
                    .name("claude-code-approval-ask".into())
                    .spawn(move || handle_connection(stream, &conn_inner));
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(ACCEPT_POLL),
            Err(_) => thread::sleep(ACCEPT_POLL),
        }
    }
}

fn handle_connection(stream: TcpStream, inner: &Inner) {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(REQUEST_READ_TIMEOUT));
    let reply = match read_request(&stream) {
        Ok(request) => decide(request, inner),
        Err(message) => WireReply::deny(message),
    };
    let mut stream = stream;
    if let Ok(mut line) = serde_json::to_string(&reply) {
        line.push('\n');
        let _ = stream.write_all(line.as_bytes());
        let _ = stream.flush();
    }
}

fn read_request(stream: &TcpStream) -> Result<WireRequest, String> {
    let mut line = String::new();
    BufReader::new(stream.take(MAX_REQUEST_BYTES))
        .read_line(&mut line)
        .map_err(|_| "Rhizome could not read the approval request.".to_string())?;
    if !line.ends_with('\n') {
        return Err("Rhizome could not read the approval request.".into());
    }
    serde_json::from_str(line.trim_end())
        .map_err(|_| "Rhizome could not read the approval request.".to_string())
}

fn token_matches(expected: &str, given: &str) -> bool {
    let (expected, given) = (expected.as_bytes(), given.as_bytes());
    if expected.len() != given.len() {
        return false;
    }
    expected
        .iter()
        .zip(given)
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

fn decide(request: WireRequest, inner: &Inner) -> WireReply {
    if !token_matches(&inner.bridge_secret, &request.token) {
        return WireReply::deny("Rhizome refused an approval request it did not start.");
    }
    if inner.closed.load(Ordering::SeqCst) {
        return WireReply::deny("This chat turn has ended.");
    }
    match rule(&request.tool_name, &request.input, &inner.scope) {
        Rule::Allow => WireReply::Allow,
        Rule::Deny(message) => WireReply::deny(message),
        Rule::Ask { path } => ask(request, path, inner),
    }
}

#[derive(Debug, PartialEq, Eq)]
enum Rule {
    Allow,
    Deny(String),
    Ask { path: Option<String> },
}

fn rule(tool: &str, input: &serde_json::Value, scope: &[PathBuf]) -> Rule {
    let path = PATH_FIELDS
        .iter()
        .find_map(|field| input.get(*field).and_then(serde_json::Value::as_str))
        .map(str::trim)
        .filter(|path| !path.is_empty());
    let is_read = READ_TOOLS.contains(&tool);
    let is_write = WRITE_TOOLS.contains(&tool);
    if !(is_read || is_write) {
        return Rule::Ask {
            path: path.map(str::to_string),
        };
    }
    let in_scope = match path {
        // A read with no path searches the chat's working folder.
        None => is_read,
        Some(path) => path_in_scope(path, scope),
    };
    match (in_scope, is_read) {
        (true, true) => Rule::Allow,
        (true, false) => Rule::Ask {
            path: path.map(str::to_string),
        },
        (false, true) => Rule::Deny("Rhizome only lets Claude Code read inside this vault.".into()),
        (false, false) => {
            Rule::Deny("Rhizome only lets Claude Code change files inside this vault.".into())
        }
    }
}

fn vault_scope(vaults: &[String]) -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    for vault in vaults.iter().map(|v| v.trim()).filter(|v| !v.is_empty()) {
        if let Some(root) = resolve(Path::new(vault), None) {
            if !roots.contains(&root) {
                roots.push(root);
            }
        }
    }
    roots
}

fn path_in_scope(path: &str, scope: &[PathBuf]) -> bool {
    let base = scope.first().map(PathBuf::as_path);
    resolve(Path::new(path), base)
        .is_some_and(|resolved| scope.iter().any(|root| resolved.starts_with(root)))
}

/// Absolute, symlink-free form of `path`. The part that exists is
/// canonicalized; the missing tail may not climb with `..`.
fn resolve(path: &Path, base: Option<&Path>) -> Option<PathBuf> {
    let joined = if path.is_absolute() {
        path.to_path_buf()
    } else {
        base?.join(path)
    };
    let mut existing = joined.as_path();
    let mut tail: Vec<Component> = Vec::new();
    loop {
        if let Ok(canonical) = std::fs::canonicalize(existing) {
            let mut out = canonical;
            for part in tail.iter().rev() {
                match part {
                    Component::Normal(name) => out.push(name),
                    Component::CurDir => {}
                    _ => return None,
                }
            }
            return Some(out);
        }
        let name = existing.components().next_back()?;
        tail.push(name);
        existing = existing.parent()?;
    }
}

fn ask(request: WireRequest, path: Option<String>, inner: &Inner) -> WireReply {
    let prompt_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = mpsc::channel();
    {
        // Register under the broker lock so `close` cannot miss this prompt.
        let mut prompts = inner.prompts.lock().expect("prompts");
        if inner.closed.load(Ordering::SeqCst) {
            return WireReply::deny("This chat turn has ended.");
        }
        prompts.push(prompt_id.clone());
        live_prompts()
            .lock()
            .expect("live prompts")
            .insert(prompt_id.clone(), tx);
    }
    (inner.sink)(BrokerEvent::Requested(ApprovalAsk {
        prompt_id: prompt_id.clone(),
        tool: request.tool_name.clone(),
        args: request.input.to_string(),
        options: vec![
            ApprovalOption {
                id: "allow_once".into(),
                label: "Allow once".into(),
            },
            ApprovalOption {
                id: "deny".into(),
                label: "Deny".into(),
            },
        ],
        path,
        call_id: request.tool_use_id.unwrap_or_default(),
    }));
    let answer = rx.recv_timeout(inner.timeout);
    live_prompts()
        .lock()
        .expect("live prompts")
        .remove(&prompt_id);
    inner
        .prompts
        .lock()
        .expect("prompts")
        .retain(|id| id != &prompt_id);
    match answer {
        Ok(ApprovalReply::AllowOnce) | Ok(ApprovalReply::AllowSession) => WireReply::Allow,
        Ok(ApprovalReply::Deny) => WireReply::deny("The person denied this tool call."),
        Ok(ApprovalReply::Cancelled) | Err(_) => {
            (inner.sink)(BrokerEvent::Dismissed { prompt_id });
            WireReply::deny("No one approved this tool call in time.")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    fn vault() -> tempfile::TempDir {
        tempfile::tempdir().expect("vault")
    }

    fn send(endpoint: &ApprovalEndpoint, body: &str) -> serde_json::Value {
        let mut stream = TcpStream::connect(endpoint.addr).expect("connect");
        stream.write_all(body.as_bytes()).unwrap();
        stream.write_all(b"\n").unwrap();
        let mut line = String::new();
        BufReader::new(stream).read_line(&mut line).unwrap();
        serde_json::from_str(line.trim()).unwrap()
    }

    fn request(endpoint: &ApprovalEndpoint, tool: &str, input: serde_json::Value) -> String {
        serde_json::json!({
            "token": endpoint.bridge_secret,
            "tool_name": tool,
            "input": input,
            "tool_use_id": "toolu_1",
        })
        .to_string()
    }

    fn recording_broker(
        vaults: &[String],
        timeout: Duration,
    ) -> (ApprovalBroker, Arc<Mutex<Vec<BrokerEvent>>>) {
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink_events = Arc::clone(&events);
        let broker = ApprovalBroker::start(vaults, timeout, move |event| {
            sink_events.lock().unwrap().push(event);
        })
        .expect("broker");
        (broker, events)
    }

    fn wait_for_ask(events: &Arc<Mutex<Vec<BrokerEvent>>>) -> ApprovalAsk {
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            if let Some(BrokerEvent::Requested(ask)) = events.lock().unwrap().first().cloned() {
                return ask;
            }
            assert!(Instant::now() < deadline, "no approval was requested");
            thread::sleep(Duration::from_millis(10));
        }
    }

    fn is_deny(reply: &serde_json::Value) -> bool {
        reply["behavior"] == "deny"
    }

    #[test]
    fn listens_on_loopback_with_a_long_random_token() {
        let dir = vault();
        let (a, _) = recording_broker(
            &[dir.path().display().to_string()],
            DEFAULT_APPROVAL_TIMEOUT,
        );
        let (b, _) = recording_broker(
            &[dir.path().display().to_string()],
            DEFAULT_APPROVAL_TIMEOUT,
        );
        assert!(a.endpoint().addr.ip().is_loopback());
        assert_eq!(a.endpoint().bridge_secret.len(), 64);
        assert_ne!(a.endpoint().bridge_secret, b.endpoint().bridge_secret);
    }

    #[test]
    fn bash_asks_in_the_app_and_allow_once_allows() {
        let dir = vault();
        let (broker, events) = recording_broker(
            &[dir.path().display().to_string()],
            DEFAULT_APPROVAL_TIMEOUT,
        );
        let endpoint = broker.endpoint().clone();
        let body = request(&endpoint, "Bash", serde_json::json!({"command": "ls"}));
        let handle = thread::spawn(move || send(&endpoint, &body));
        let ask = wait_for_ask(&events);
        assert_eq!(ask.tool, "Bash");
        assert_eq!(ask.call_id, "toolu_1");
        assert!(ask.args.contains("\"command\":\"ls\""));
        let ids: Vec<&str> = ask.options.iter().map(|o| o.id.as_str()).collect();
        assert_eq!(ids, ["allow_once", "deny"]);
        assert!(reply(&ask.prompt_id, ApprovalReply::AllowOnce));
        assert_eq!(handle.join().unwrap()["behavior"], "allow");
    }

    #[test]
    fn an_edit_inside_the_vault_asks_and_deny_denies() {
        let dir = vault();
        let (broker, events) = recording_broker(
            &[dir.path().display().to_string()],
            DEFAULT_APPROVAL_TIMEOUT,
        );
        let endpoint = broker.endpoint().clone();
        let target = dir.path().join("note.md").display().to_string();
        let body = request(&endpoint, "Edit", serde_json::json!({"file_path": target}));
        let handle = thread::spawn(move || send(&endpoint, &body));
        let ask = wait_for_ask(&events);
        assert_eq!(ask.path.as_deref(), Some(target.as_str()));
        reply(&ask.prompt_id, ApprovalReply::Deny);
        assert!(is_deny(&handle.join().unwrap()));
    }

    #[test]
    fn a_timeout_denies_and_dismisses_the_card() {
        let dir = vault();
        let (broker, events) = recording_broker(
            &[dir.path().display().to_string()],
            Duration::from_millis(50),
        );
        let reply = send(
            broker.endpoint(),
            &request(
                broker.endpoint(),
                "Bash",
                serde_json::json!({"command": "ls"}),
            ),
        );
        assert!(is_deny(&reply));
        let events = events.lock().unwrap();
        assert!(matches!(events.last(), Some(BrokerEvent::Dismissed { .. })));
    }

    #[test]
    fn closing_the_broker_denies_a_waiting_ask() {
        let dir = vault();
        let (mut broker, events) = recording_broker(
            &[dir.path().display().to_string()],
            DEFAULT_APPROVAL_TIMEOUT,
        );
        let endpoint = broker.endpoint().clone();
        let body = request(&endpoint, "Bash", serde_json::json!({"command": "ls"}));
        let handle = thread::spawn(move || send(&endpoint, &body));
        let ask = wait_for_ask(&events);
        broker.close();
        assert!(is_deny(&handle.join().unwrap()));
        assert!(!reply(&ask.prompt_id, ApprovalReply::AllowOnce));
    }

    #[test]
    fn a_closed_broker_refuses_new_connections() {
        let dir = vault();
        let (mut broker, _) = recording_broker(
            &[dir.path().display().to_string()],
            DEFAULT_APPROVAL_TIMEOUT,
        );
        let endpoint = broker.endpoint().clone();
        broker.close();
        drop(broker);
        let connected = TcpStream::connect_timeout(&endpoint.addr, Duration::from_millis(200));
        if let Ok(mut stream) = connected {
            // The port can linger in the OS backlog. It must never answer allow.
            let _ = stream.write_all(request(&endpoint, "Bash", serde_json::json!({})).as_bytes());
            let _ = stream.write_all(b"\n");
            let _ = stream.set_read_timeout(Some(Duration::from_millis(200)));
            let mut line = String::new();
            let _ = BufReader::new(stream).read_line(&mut line);
            assert!(!line.contains("allow"));
        }
    }

    #[test]
    fn a_wrong_token_denies_without_asking() {
        let dir = vault();
        let (broker, events) = recording_broker(
            &[dir.path().display().to_string()],
            DEFAULT_APPROVAL_TIMEOUT,
        );
        let body = serde_json::json!({
            "token": "0".repeat(64),
            "tool_name": "Bash",
            "input": {"command": "ls"},
        })
        .to_string();
        assert!(is_deny(&send(broker.endpoint(), &body)));
        assert!(is_deny(&send(
            broker.endpoint(),
            "{\"tool_name\":\"Bash\"}"
        )));
        assert!(events.lock().unwrap().is_empty());
    }

    #[test]
    fn a_malformed_request_denies() {
        let dir = vault();
        let (broker, events) = recording_broker(
            &[dir.path().display().to_string()],
            DEFAULT_APPROVAL_TIMEOUT,
        );
        assert!(is_deny(&send(broker.endpoint(), "not json")));
        assert!(events.lock().unwrap().is_empty());
    }

    #[test]
    fn reads_outside_the_vault_deny_without_asking() {
        let dir = vault();
        let outside = vault();
        let secret = outside.path().join("secret.txt");
        std::fs::write(&secret, "x").unwrap();
        let scope = vault_scope(&[dir.path().display().to_string()]);
        for tool in READ_TOOLS {
            let input = serde_json::json!({"file_path": secret.display().to_string()});
            assert!(
                matches!(rule(tool, &input, &scope), Rule::Deny(_)),
                "{tool}"
            );
        }
        let climb = format!("{}/../{}", dir.path().display(), "x.txt");
        let input = serde_json::json!({"path": climb});
        assert!(matches!(rule("Grep", &input, &scope), Rule::Deny(_)));
        let home = serde_json::json!({"file_path": "~/.claude/.credentials.json"});
        assert!(
            matches!(rule("Read", &home, &scope), Rule::Deny(_)) || {
                // A literal `~` folder inside the vault is still in scope.
                matches!(rule("Read", &home, &scope), Rule::Allow)
            }
        );
    }

    #[test]
    fn reads_inside_the_vault_allow_without_a_card() {
        let dir = vault();
        let scope = vault_scope(&[dir.path().display().to_string()]);
        let inside =
            serde_json::json!({"file_path": dir.path().join("a.md").display().to_string()});
        assert_eq!(rule("Read", &inside, &scope), Rule::Allow);
        assert_eq!(
            rule("Glob", &serde_json::json!({"pattern": "*.md"}), &scope),
            Rule::Allow
        );
        let relative = serde_json::json!({"path": "notes"});
        assert_eq!(rule("LS", &relative, &scope), Rule::Allow);
    }

    #[test]
    fn all_four_write_tools_inside_the_vault_ask() {
        let dir = vault();
        let scope = vault_scope(&[dir.path().display().to_string()]);
        for (tool, field, file) in [
            ("Edit", "file_path", "note.md"),
            ("Write", "file_path", "note.md"),
            ("MultiEdit", "file_path", "note.md"),
            ("NotebookEdit", "notebook_path", "book.ipynb"),
        ] {
            let target = dir.path().join(file).display().to_string();
            let input = serde_json::json!({ field: target });
            assert_eq!(
                rule(tool, &input, &scope),
                Rule::Ask { path: Some(target) },
                "{tool} inside vault must ask"
            );
        }
    }

    #[test]
    fn writes_outside_the_vault_deny_and_unknown_tools_ask() {
        let dir = vault();
        let scope = vault_scope(&[dir.path().display().to_string()]);
        let outside = serde_json::json!({"file_path": "/etc/hosts"});
        assert!(matches!(rule("Write", &outside, &scope), Rule::Deny(_)));
        assert!(matches!(
            rule("Edit", &serde_json::json!({}), &scope),
            Rule::Deny(_)
        ));
        assert!(matches!(
            rule("WebFetch", &serde_json::json!({}), &scope),
            Rule::Ask { .. }
        ));
        assert!(matches!(
            rule("mcp__rhizome__create_note", &serde_json::json!({}), &scope),
            Rule::Ask { .. }
        ));
    }

    #[cfg(unix)]
    #[test]
    fn a_symlink_out_of_the_vault_is_out_of_scope() {
        let dir = vault();
        let outside = vault();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("escape")).unwrap();
        let scope = vault_scope(&[dir.path().display().to_string()]);
        let input =
            serde_json::json!({"file_path": dir.path().join("escape/x.md").display().to_string()});
        assert!(matches!(rule("Read", &input, &scope), Rule::Deny(_)));
    }

    #[test]
    fn a_second_vault_is_in_scope() {
        let first = vault();
        let second = vault();
        let scope = vault_scope(&[
            first.path().display().to_string(),
            second.path().display().to_string(),
        ]);
        let input =
            serde_json::json!({"file_path": second.path().join("b.md").display().to_string()});
        assert_eq!(rule("Read", &input, &scope), Rule::Allow);
    }

    #[test]
    fn replying_to_an_unknown_prompt_does_nothing() {
        assert!(!reply("no-such-prompt", ApprovalReply::AllowOnce));
    }

    #[test]
    fn token_compare_needs_an_exact_match() {
        assert!(token_matches("abcd", "abcd"));
        assert!(!token_matches("abcd", "abce"));
        assert!(!token_matches("abcd", "abc"));
        assert!(!token_matches("abcd", ""));
    }
}
