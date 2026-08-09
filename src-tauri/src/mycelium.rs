//! Mycelium helpers: list Prime sessions, detect Mindwalk, open bridged sessions.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

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

fn prime_sessions_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".prime").join("agent").join("sessions"))
}

fn mtime_ms(path: &Path) -> Option<u64> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let duration = modified.duration_since(SystemTime::UNIX_EPOCH).ok()?;
    Some(duration.as_millis() as u64)
}

pub fn list_prime_sessions() -> Result<Vec<PrimeSessionEntry>, String> {
    let dir = prime_sessions_dir().ok_or_else(|| "Could not resolve home directory".to_string())?;
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut entries = Vec::new();
    let read = std::fs::read_dir(&dir).map_err(|e| format!("read sessions dir: {e}"))?;
    for entry in read.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.ends_with(".jsonl") {
            continue;
        }
        // Skip bridge artifacts
        if name.contains(".mindwalk-bridge.") {
            continue;
        }
        entries.push(PrimeSessionEntry {
            name,
            path: path.to_string_lossy().into_owned(),
            mtime_ms: mtime_ms(&path),
        });
    }
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.mtime_ms));
    Ok(entries)
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

pub fn run_mindwalk_open(path: &str) -> Result<String, String> {
    let path_buf = PathBuf::from(path);
    if !path_buf.is_file() {
        return Err(format!("Session file not found: {path}"));
    }
    // Only allow opening under the user's home .prime sessions (or temp) for safety
    let home = dirs::home_dir().ok_or_else(|| "no home".to_string())?;
    let sessions = home.join(".prime").join("agent").join("sessions");
    let canonical = path_buf
        .canonicalize()
        .map_err(|e| format!("canonicalize: {e}"))?;
    if !canonical.starts_with(&sessions) {
        return Err("Refusing to open a session outside ~/.prime/agent/sessions".into());
    }
    let which = which_binary("mindwalk");
    if !which.found {
        return Err("mindwalk not found on PATH".into());
    }
    let status = Command::new("mindwalk")
        .arg("open")
        .arg(&canonical)
        .spawn()
        .map_err(|e| format!("spawn mindwalk: {e}"))?;
    // Detached — don't wait for UI to close
    drop(status);
    Ok(canonical.to_string_lossy().into_owned())
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
}

/// Read a Prime session, rewrite ipython %%bash → bash-shaped toolCalls, write bridge file, open Mindwalk.
pub fn bridge_and_open_prime_session(path: &str) -> Result<String, String> {
    let path_buf = PathBuf::from(path);
    let home = dirs::home_dir().ok_or_else(|| "no home".to_string())?;
    let sessions = home.join(".prime").join("agent").join("sessions");
    let canonical = path_buf
        .canonicalize()
        .map_err(|e| format!("canonicalize: {e}"))?;
    if !canonical.starts_with(&sessions) {
        return Err("Refusing to open a session outside ~/.prime/agent/sessions".into());
    }
    let raw = std::fs::read_to_string(&canonical).map_err(|e| format!("read session: {e}"))?;
    let (bridged, rewritten) = bridge_prime_session_jsonl(&raw);
    let out_name = format!(
        "{}.mindwalk-bridge.jsonl",
        canonical
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("session")
    );
    let out_path = sessions.join(out_name);
    std::fs::write(&out_path, bridged).map_err(|e| format!("write bridge: {e}"))?;
    let _ = rewritten;
    run_mindwalk_open(out_path.to_str().unwrap_or_default())?;
    Ok(out_path.to_string_lossy().into_owned())
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

fn extract_bash_from_ipython(code: &str) -> Option<String> {
    let trimmed = code.trim_start_matches('\u{feff}');
    let mut lines = trimmed.lines();
    let first = lines.next()?.trim();
    if first == "%%bash" || first == "%%sh" {
        return Some(lines.collect::<Vec<_>>().join("\n"));
    }
    None
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
