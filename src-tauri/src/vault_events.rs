//! The single writer for `.rhizome/events.jsonl`.
//!
//! Until 2026-07-31 four independent writers each re-implemented the same
//! `OpenOptions::new().append(true)` block with divergent field sets, and a
//! real 15-event log contained **five** distinct shapes — 33% of records
//! carrying no `trigger` at all. `docs/VAULT_CONTRACT.md` already made
//! artifact *paths* drift-proof by routing every writer through one
//! resolver; this module does the same for the *event log*.
//!
//! The invariant: `type`, `trigger` and `timestamp` are on every record this
//! module writes. Kind-specific fields (`mode`, `repo`, `depth`, `source`)
//! ride along as extras so existing shapes stay byte-compatible.
//!
//! `mcp-server/index.js` is deliberately still separate — it is a different
//! runtime, and five of its event types (`search`, `lint`, `graph-summary`,
//! `wiki-generate-*`) have no Rust path at all. See
//! `docs/plans/2026-07-31-save-path-audit-session-status.md` finding 3.

use serde_json::{Map, Value};
use std::path::Path;

/// One activity-log record.
///
/// Built with `new` plus chained setters so a caller cannot construct one
/// that is missing `trigger` — the failure mode that produced a third of the
/// untriggered records already on disk.
#[derive(Debug, Clone)]
pub struct VaultEvent {
    event_type: String,
    trigger: String,
    project: Option<String>,
    artifact_path: Option<String>,
    extra: Map<String, Value>,
}

impl VaultEvent {
    pub fn new(event_type: &str, trigger: &str) -> Self {
        Self {
            event_type: event_type.to_string(),
            trigger: trigger.to_string(),
            project: None,
            artifact_path: None,
            extra: Map::new(),
        }
    }

    pub fn project(mut self, project: Option<&str>) -> Self {
        self.project = project.map(str::to_string);
        self
    }

    pub fn artifact_path(mut self, path: &str) -> Self {
        self.artifact_path = Some(path.to_string());
        self
    }

    /// A kind-specific field (`mode`, `repo`, `depth`, `source`, …).
    pub fn field(mut self, key: &str, value: &str) -> Self {
        self.extra.insert(key.to_string(), Value::from(value));
        self
    }

    fn to_json(&self) -> Value {
        let mut map = Map::new();
        map.insert("type".into(), Value::from(self.event_type.as_str()));
        // `project` is always present (null when absent) to match the shape
        // already on disk; `artifact_path` is omitted when there isn't one,
        // because research-started genuinely has no artifact yet.
        map.insert(
            "project".into(),
            match &self.project {
                Some(p) => Value::from(p.as_str()),
                None => Value::Null,
            },
        );
        map.insert("trigger".into(), Value::from(self.trigger.as_str()));
        if let Some(path) = &self.artifact_path {
            map.insert("artifact_path".into(), Value::from(path.as_str()));
        }
        for (key, value) in &self.extra {
            map.insert(key.clone(), value.clone());
        }
        map.insert(
            "timestamp".into(),
            Value::from(chrono::Utc::now().to_rfc3339()),
        );
        Value::Object(map)
    }
}

/// Append one record to `<vault>/.rhizome/events.jsonl`, creating the
/// directory and file if needed.
pub fn append(vault_path: &Path, event: &VaultEvent) -> Result<(), String> {
    use std::io::Write;

    let events_dir = vault_path.join(".rhizome");
    std::fs::create_dir_all(&events_dir).map_err(|e| format!("Failed to create dir: {e}"))?;
    let events_path = events_dir.join("events.jsonl");
    let line = format!("{}\n", event.to_json());
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&events_path)
        .map_err(|e| format!("Failed to open events log: {e}"))?;
    file.write_all(line.as_bytes())
        .map_err(|e| format!("Failed to write events log: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read_events(dir: &Path) -> Vec<Value> {
        std::fs::read_to_string(dir.join(".rhizome/events.jsonl"))
            .unwrap()
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l).unwrap())
            .collect()
    }

    /// The invariant this module exists to enforce.
    #[test]
    fn every_record_carries_type_trigger_and_timestamp() {
        let dir = tempfile::tempdir().unwrap();
        append(dir.path(), &VaultEvent::new("distill", "inbox")).unwrap();

        let events = read_events(dir.path());
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["type"], "distill");
        assert_eq!(events[0]["trigger"], "inbox");
        assert!(events[0]["timestamp"]
            .as_str()
            .is_some_and(|t| !t.is_empty()));
    }

    #[test]
    fn creates_the_rhizome_dir_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!dir.path().join(".rhizome").exists());
        append(dir.path(), &VaultEvent::new("capture", "menu_bar")).unwrap();
        assert!(dir.path().join(".rhizome/events.jsonl").exists());
    }

    #[test]
    fn appends_rather_than_truncating() {
        let dir = tempfile::tempdir().unwrap();
        append(dir.path(), &VaultEvent::new("distill", "manual")).unwrap();
        append(dir.path(), &VaultEvent::new("capture", "menu_bar")).unwrap();

        let events = read_events(dir.path());
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["type"], "distill");
        assert_eq!(events[1]["type"], "capture");
    }

    #[test]
    fn project_is_null_when_absent_and_set_when_present() {
        let dir = tempfile::tempdir().unwrap();
        append(dir.path(), &VaultEvent::new("distill", "manual")).unwrap();
        append(
            dir.path(),
            &VaultEvent::new("distill", "manual").project(Some("alpha")),
        )
        .unwrap();

        let events = read_events(dir.path());
        assert!(events[0]["project"].is_null());
        assert_eq!(events[1]["project"], "alpha");
    }

    /// research-started has no artifact yet, so the key must be absent
    /// rather than null — that is the shape already on disk.
    #[test]
    fn artifact_path_is_omitted_when_not_set() {
        let dir = tempfile::tempdir().unwrap();
        append(dir.path(), &VaultEvent::new("research-started", "manual")).unwrap();
        assert!(!read_events(dir.path())[0]
            .as_object()
            .unwrap()
            .contains_key("artifact_path"));
    }

    #[test]
    fn carries_kind_specific_extras() {
        let dir = tempfile::tempdir().unwrap();
        append(
            dir.path(),
            &VaultEvent::new("research-started", "manual")
                .field("mode", "repo")
                .field("repo", "knispo/rhizome")
                .field("depth", "deep"),
        )
        .unwrap();

        let event = &read_events(dir.path())[0];
        assert_eq!(event["mode"], "repo");
        assert_eq!(event["repo"], "knispo/rhizome");
        assert_eq!(event["depth"], "deep");
    }

    /// Finding 6: `from` was hardcoded to "inline" on every record by the old
    /// distill writer and read by nobody — `targetFor` in
    /// src/utils/menuBarActivity.ts consults title/artifact_path/path/
    /// project/source. It must not come back.
    #[test]
    fn does_not_write_the_dead_from_field() {
        let dir = tempfile::tempdir().unwrap();
        append(dir.path(), &VaultEvent::new("distill", "manual")).unwrap();
        assert!(!read_events(dir.path())[0]
            .as_object()
            .unwrap()
            .contains_key("from"));
    }
}
