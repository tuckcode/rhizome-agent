//! Mycelium helpers: list Prime sessions and run Mindwalk as a local sidecar.

use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

const MYCELIUM_SIDECAR_PORT: u16 = 18765;
static SIDECAR: Mutex<Option<Child>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeSessionEntry {
    pub name: String,
    pub path: String,
    pub mtime_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhichBinaryResult {
    pub found: bool,
    pub path: Option<String>,
}

fn mtime_ms(path: &Path) -> Option<u64> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let duration = modified.duration_since(SystemTime::UNIX_EPOCH).ok()?;
    Some(duration.as_millis() as u64)
}

/// Sessions available to bridge into Mindwalk, newest first.
///
/// The scan itself lives in `prime_sessions` — Mycelium and the session list
/// read the same directory for different jobs, and two scanners drift. This
/// keeps Mycelium's own row shape (filename as `name`) so its view is
/// unchanged; the session list derives a human title instead.
pub fn list_prime_sessions() -> Result<Vec<PrimeSessionEntry>, String> {
    Ok(crate::prime_sessions::session_files()?
        .into_iter()
        .map(|path| PrimeSessionEntry {
            name: session_display_name(&path),
            mtime_ms: mtime_ms(&path),
            path: path.to_string_lossy().into_owned(),
        })
        .collect())
}

/// What to call a session in the Mycelium picker.
///
/// The same title the sessions list shows, so one session is not two different
/// things in two places. This used to be the bare filename, which is Prime's
/// uuid — a column of `01a04c21-91d5-76aa-….jsonl` that names nothing and
/// cannot be told apart at a glance. The uuid stays as the fallback for a log
/// too damaged to summarise, because a row with no label at all is worse.
fn session_display_name(path: &Path) -> String {
    let filename = || {
        path.file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default()
    };
    crate::prime_sessions::summarize_file(path)
        .ok()
        .and_then(|summary| summary.title)
        .map(|title| title.trim().to_string())
        .filter(|title| !title.is_empty())
        .unwrap_or_else(filename)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MindwalkSidecarStatus {
    pub url: String,
    pub mode: String,
}

/// Pull the first loopback URL out of Mindwalk's startup banner.
pub fn extract_mindwalk_url(text: &str) -> Option<String> {
    for raw in text.split_whitespace() {
        let trimmed = raw.trim_matches(|c: char| c == '(' || c == ')' || c == '"' || c == '\'');
        if let Some(rest) = trimmed
            .strip_prefix("http://127.0.0.1:")
            .or_else(|| trimmed.strip_prefix("http://localhost:"))
        {
            let port: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            if !port.is_empty() {
                return Some(format!("http://127.0.0.1:{port}"));
            }
        }
    }
    None
}

fn mindwalk_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(home) = dirs::home_dir() {
        out.push(home.join(".local").join("bin").join("mindwalk"));
        out.push(home.join("go").join("bin").join("mindwalk"));
    }
    out.push(PathBuf::from("/opt/homebrew/bin/mindwalk"));
    out.push(PathBuf::from("/usr/local/bin/mindwalk"));
    if let Ok(path) = std::env::var("PATH") {
        let sep = if cfg!(windows) { ';' } else { ':' };
        for dir in path.split(sep) {
            let name = if cfg!(windows) {
                "mindwalk.exe"
            } else {
                "mindwalk"
            };
            out.push(Path::new(dir).join(name));
        }
    }
    out
}

fn resolve_mindwalk_binary() -> Option<PathBuf> {
    mindwalk_candidates()
        .into_iter()
        .find(|path| path.is_file())
}

fn prime_sessions_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "no home".to_string())?;
    Ok(home.join(".prime").join("agent").join("sessions"))
}

fn stop_sidecar_locked(slot: &mut Option<Child>) {
    if let Some(mut child) = slot.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

pub fn stop_mindwalk_sidecar() -> Result<(), String> {
    let mut slot = SIDECAR
        .lock()
        .map_err(|_| "mycelium sidecar lock poisoned".to_string())?;
    stop_sidecar_locked(&mut slot);
    Ok(())
}

fn watch_pipe_for_url<R: std::io::Read + Send + 'static>(
    pipe: Option<R>,
    tx: std::sync::mpsc::Sender<String>,
) {
    if let Some(pipe) = pipe {
        std::thread::spawn(move || {
            let reader = BufReader::new(pipe);
            let mut collected = String::new();
            for line in reader.lines().map_while(Result::ok) {
                collected.push_str(&line);
                collected.push('\n');
                if let Some(url) = extract_mindwalk_url(&collected) {
                    let _ = tx.send(url);
                    return;
                }
            }
        });
    }
}

fn wait_for_sidecar_url(child: &mut Child, fallback: &str) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel::<String>();
    watch_pipe_for_url(child.stderr.take(), tx.clone());
    watch_pipe_for_url(child.stdout.take(), tx);
    match rx.recv_timeout(Duration::from_secs(8)) {
        Ok(url) => Ok(url),
        Err(_) => {
            if child.try_wait().ok().flatten().is_some() {
                Err("Mycelium sidecar failed to start.".into())
            } else {
                Ok(fallback.to_string())
            }
        }
    }
}

pub fn start_mindwalk_sidecar(
    session_path: Option<&str>,
    theme: Option<&str>,
) -> Result<MindwalkSidecarStatus, String> {
    let binary = resolve_mindwalk_binary().ok_or_else(|| {
        "Mycelium sidecar could not start. Install Mindwalk, then retry.".to_string()
    })?;
    let sessions = prime_sessions_dir()?;
    let mut slot = SIDECAR
        .lock()
        .map_err(|_| "mycelium sidecar lock poisoned".to_string())?;
    stop_sidecar_locked(&mut slot);

    let fallback = format!("http://127.0.0.1:{MYCELIUM_SIDECAR_PORT}");
    let mut command = Command::new(&binary);
    let mode = if let Some(path) = session_path {
        let bridged = write_bridged_session(path)?;
        command.arg("open").arg("--no-open").arg(&bridged);
        "session"
    } else {
        command
            .arg("serve")
            .arg("--no-open")
            .arg("--port")
            .arg(MYCELIUM_SIDECAR_PORT.to_string())
            .arg("--pi-dir")
            .arg(&sessions);
        "overview"
    };
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Mycelium sidecar could not start: {e}"))?;
    let url = match wait_for_sidecar_url(&mut child, &fallback) {
        Ok(url) => url,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
    };
    *slot = Some(child);
    // Hand the view the skinned URL, not the sidecar's. The proxy passes every
    // byte through untouched except the HTML document, so engine upgrades keep
    // arriving for free — see `mycelium_skin`. A proxy that fails to bind is
    // cosmetic, not fatal: fall back to the raw engine rather than a dead view.
    let url = match crate::mycelium_skin::start_skin_proxy(&url, theme.unwrap_or("dark")) {
        Ok(skinned) => skinned,
        Err(error) => {
            log::warn!("mycelium skin proxy unavailable, serving unskinned: {error}");
            url
        }
    };
    Ok(MindwalkSidecarStatus {
        url,
        mode: mode.to_string(),
    })
}

pub fn which_binary(name: &str) -> WhichBinaryResult {
    // Security: only allow known tool names
    let allowed = matches!(name, "mindwalk" | "prime-agent");
    if !allowed {
        return WhichBinaryResult {
            found: false,
            path: None,
        };
    }
    let output = Command::new("which").arg(name).output();
    match output {
        Ok(out) if out.status.success() => {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if path.is_empty() {
                WhichBinaryResult {
                    found: false,
                    path: None,
                }
            } else {
                WhichBinaryResult {
                    found: true,
                    path: Some(path),
                }
            }
        }
        _ => WhichBinaryResult {
            found: false,
            path: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn which_rejects_unknown_binaries() {
        let r = which_binary("rm");
        assert!(!r.found);
    }

    #[test]
    fn list_sessions_ok_when_missing_dir() {
        // Should not panic; may be empty on CI
        let _ = list_prime_sessions();
    }

    #[test]
    fn extracts_loopback_url_from_banner() {
        assert_eq!(
            extract_mindwalk_url("Serving UI at http://127.0.0.1:18765\n"),
            Some("http://127.0.0.1:18765".into())
        );
        assert_eq!(
            extract_mindwalk_url("open (http://localhost:56843)"),
            Some("http://127.0.0.1:56843".into())
        );
        assert_eq!(extract_mindwalk_url("no url here"), None);
    }
}

fn write_bridged_session(path: &str) -> Result<PathBuf, String> {
    let path_buf = PathBuf::from(path);
    let sessions = prime_sessions_dir()?;
    let canonical = path_buf
        .canonicalize()
        .map_err(|e| format!("canonicalize: {e}"))?;
    if !canonical.starts_with(&sessions) {
        return Err("Refusing to open a session outside ~/.prime/agent/sessions".into());
    }
    let raw = std::fs::read_to_string(&canonical).map_err(|e| format!("read session: {e}"))?;
    let (bridged, _rewritten) = bridge_prime_session_jsonl(&raw);
    let out_name = format!(
        "{}.mindwalk-bridge.jsonl",
        canonical
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("session")
    );
    let out_path = sessions.join(out_name);
    std::fs::write(&out_path, bridged).map_err(|e| format!("write bridge: {e}"))?;
    Ok(out_path)
}

fn bridge_prime_session_jsonl(raw: &str) -> (String, usize) {
    let mut rewritten = 0usize;
    let mut out_lines = Vec::new();
    for line in raw.lines() {
        if line.trim().is_empty() {
            out_lines.push(line.to_string());
            continue;
        }
        match serde_json::from_str::<serde_json::Value>(line) {
            Ok(mut value) => {
                rewritten += rewrite_value(&mut value);
                out_lines.push(value.to_string());
            }
            Err(_) => out_lines.push(line.to_string()),
        }
    }
    let mut bridged = out_lines.join("\n");
    if raw.ends_with('\n') {
        bridged.push('\n');
    }
    (bridged, rewritten)
}

fn rewrite_value(value: &mut serde_json::Value) -> usize {
    let mut count = 0usize;
    match value {
        serde_json::Value::Array(items) => {
            for item in items {
                count += rewrite_value(item);
            }
        }
        serde_json::Value::Object(map) => {
            let is_tool_call = map.get("type").and_then(|v| v.as_str()) == Some("toolCall");
            let tool_name = map
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if is_tool_call {
                if let Some(name) = tool_name {
                    if name.eq_ignore_ascii_case("ipython") {
                        let code = map
                            .get("arguments")
                            .and_then(|a| a.get("code"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        if let Some(code) = code {
                            if let Some(bash) = extract_bash_from_ipython(&code) {
                                map.insert("name".into(), serde_json::Value::String("bash".into()));
                                if let Some(args) = map.get_mut("arguments") {
                                    if let Some(obj) = args.as_object_mut() {
                                        obj.insert(
                                            "command".into(),
                                            serde_json::Value::String(bash),
                                        );
                                        obj.remove("code");
                                    }
                                }
                                count += 1;
                            }
                        }
                    }
                }
            }
            for (_k, v) in map.iter_mut() {
                count += rewrite_value(v);
            }
        }
        _ => {}
    }
    count
}

pub(crate) fn extract_bash_from_ipython(code: &str) -> Option<String> {
    let trimmed = code.trim_start_matches('\u{feff}');
    let mut lines = trimmed.lines();
    let first = lines.next()?.trim();
    if first == "%%bash" || first == "%%sh" {
        return Some(lines.collect::<Vec<_>>().join("\n"));
    }
    None
}

#[cfg(test)]
mod display_name_tests {
    use super::*;

    /// The picker used to list Prime's uuids. A column of
    /// `01a04c21-….jsonl` rows names nothing and cannot be told apart.
    #[test]
    fn a_session_is_listed_under_its_title_not_its_uuid() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir
            .path()
            .join("01a04c21-91d5-76aa-8b75-350604727830.jsonl");
        std::fs::write(
            &log,
            "{\"type\":\"session_info\",\"name\":\"Trace why search misses aliases\"}\n",
        )
        .unwrap();
        assert_eq!(
            session_display_name(&log),
            "Trace why search misses aliases"
        );
    }

    /// A log too damaged to summarise still gets a row. No label at all is
    /// worse than an unfriendly one.
    #[test]
    fn an_unreadable_log_falls_back_to_its_filename() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("broken.jsonl");
        assert_eq!(session_display_name(&log), "broken.jsonl");
    }
}

#[cfg(test)]
mod bridge_tests {
    use super::*;

    #[test]
    fn rewrites_ipython_bash_magic() {
        let line = r#"{"type":"message","message":{"role":"assistant","content":[{"type":"toolCall","name":"ipython","arguments":{"code":"%%bash\nrg foo\n"}}]}}"#;
        let (bridged, n) = bridge_prime_session_jsonl(line);
        assert_eq!(n, 1);
        assert!(bridged.contains("\"bash\""));
        assert!(bridged.contains("rg foo"));
        assert!(!bridged.contains("%%bash"));
    }
}
