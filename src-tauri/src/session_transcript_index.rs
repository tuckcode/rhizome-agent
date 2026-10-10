//! On-disk cache for Rhizome's session-transcript search index.
//!
//! This is vault/memory work (ADR-0177), not a harness organ. The file stores
//! extracted searchable turns keyed by source path and list stamp. Prime's
//! `~/.prime/agent/sessions` logs stay Prime's; Rhizome never writes there.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const INDEX_VERSION: u32 = 1;
const INDEX_FILE_NAME: &str = "v1.json";

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTranscriptIndexDocument {
    pub version: u32,
    pub sessions: Vec<PersistedSessionRecord>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSessionRecord {
    pub path: String,
    pub stamp: String,
    pub id: String,
    pub title: String,
    pub turns: Vec<IndexedTranscriptTurn>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedTranscriptTurn {
    pub message_index: u32,
    pub role: String,
    pub text: String,
}

impl SessionTranscriptIndexDocument {
    fn empty() -> Self {
        Self {
            version: INDEX_VERSION,
            sessions: Vec::new(),
        }
    }
}

/// Load the persisted index. A missing file is an empty index, not an error.
pub fn load() -> Result<SessionTranscriptIndexDocument, String> {
    load_from(index_path()?)
}

/// Append user and assistant turns for a native session path.
pub fn append_native_turns(
    path: &str,
    id: &str,
    title: &str,
    new_turns: Vec<IndexedTranscriptTurn>,
) -> Result<(), String> {
    let mut document = load()?;
    if let Some(session) = document
        .sessions
        .iter_mut()
        .find(|session| session.path == path)
    {
        let next = session
            .turns
            .last()
            .map(|turn| turn.message_index + 1)
            .unwrap_or(0);
        for (offset, mut turn) in new_turns.into_iter().enumerate() {
            turn.message_index = next + offset as u32;
            session.turns.push(turn);
        }
        session.stamp = session.turns.len().to_string();
    } else {
        let turns = new_turns
            .into_iter()
            .enumerate()
            .map(|(index, mut turn)| {
                turn.message_index = index as u32;
                turn
            })
            .collect();
        document.sessions.push(PersistedSessionRecord {
            path: path.to_string(),
            stamp: "1".into(),
            id: id.to_string(),
            title: title.to_string(),
            turns,
        });
    }
    save(&document)
}

/// Remove a native session from the index. Missing is success.
pub fn remove_session(path: &str) -> Result<(), String> {
    let mut document = load()?;
    document.sessions.retain(|session| session.path != path);
    save(&document)
}

/// Replace the persisted index with an atomic write.
pub fn save(document: &SessionTranscriptIndexDocument) -> Result<(), String> {
    if document.version != INDEX_VERSION {
        return Err(format!(
            "unsupported session transcript index version {}",
            document.version
        ));
    }
    save_to(index_path()?, document)
}

fn load_from(path: PathBuf) -> Result<SessionTranscriptIndexDocument, String> {
    if !path.exists() {
        return Ok(SessionTranscriptIndexDocument::empty());
    }
    let data = fs::read(&path)
        .map_err(|error| format!("read session transcript index {}: {error}", path.display()))?;
    let document: SessionTranscriptIndexDocument = serde_json::from_slice(&data)
        .map_err(|error| format!("parse session transcript index {}: {error}", path.display()))?;
    if document.version != INDEX_VERSION {
        return Ok(SessionTranscriptIndexDocument::empty());
    }
    Ok(document)
}

fn save_to(path: PathBuf, document: &SessionTranscriptIndexDocument) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create session transcript index dir {}: {error}",
                parent.display()
            )
        })?;
    }
    let data = serde_json::to_vec(document)
        .map_err(|error| format!("serialize session transcript index: {error}"))?;
    let temp_path = path.with_extension("json.tmp");
    fs::write(&temp_path, data).map_err(|error| {
        format!(
            "write session transcript index {}: {error}",
            temp_path.display()
        )
    })?;
    fs::rename(&temp_path, &path).map_err(|error| {
        format!(
            "replace session transcript index {}: {error}",
            path.display()
        )
    })?;
    Ok(())
}

fn index_path() -> Result<PathBuf, String> {
    Ok(index_dir()?.join(INDEX_FILE_NAME))
}

fn index_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("RHIZOME_CACHE_DIR") {
        if !dir.trim().is_empty() {
            return Ok(PathBuf::from(dir).join("session-transcript-index"));
        }
    }
    let cache_dir = dirs::cache_dir().ok_or("Could not resolve OS cache directory")?;
    Ok(cache_dir
        .join("ai.rhizome.agent")
        .join("session-transcript-index"))
}

#[cfg(test)]
pub fn with_temp_cache<T>(body: impl FnOnce() -> T) -> T {
    tests::with_temp_cache(body)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use tempfile::TempDir;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    pub fn with_temp_cache<T>(body: impl FnOnce() -> T) -> T {
        with_cache_dir(|_| body())
    }

    fn with_cache_dir<T>(body: impl FnOnce(&TempDir) -> T) -> T {
        let _guard = ENV_LOCK.lock().expect("cache dir lock");
        let dir = TempDir::new().expect("temp cache dir");
        std::env::set_var("RHIZOME_CACHE_DIR", dir.path());
        let result = body(&dir);
        std::env::remove_var("RHIZOME_CACHE_DIR");
        result
    }

    fn sample_document() -> SessionTranscriptIndexDocument {
        SessionTranscriptIndexDocument {
            version: INDEX_VERSION,
            sessions: vec![PersistedSessionRecord {
                path: "/Users/mock/.prime/agent/sessions/daemon.jsonl".into(),
                stamp: "10".into(),
                id: "daemon".into(),
                title: "Daemon notes".into(),
                turns: vec![IndexedTranscriptTurn {
                    message_index: 4,
                    role: "assistant".into(),
                    text: "The daemon transport uses a named socket.".into(),
                }],
            }],
        }
    }

    #[test]
    fn a_missing_file_loads_as_an_empty_index() {
        with_cache_dir(|_| {
            let loaded = load().expect("load missing index");
            assert_eq!(loaded, SessionTranscriptIndexDocument::empty());
        });
    }

    #[test]
    fn save_then_load_round_trips_extracted_turns() {
        with_cache_dir(|_| {
            let document = sample_document();
            save(&document).expect("save index");
            let loaded = load().expect("load index");
            assert_eq!(loaded, document);
        });
    }

    #[test]
    fn the_on_disk_json_uses_camel_case_keys() {
        with_cache_dir(|dir| {
            save(&sample_document()).expect("save index");
            let path = dir
                .path()
                .join("session-transcript-index")
                .join(INDEX_FILE_NAME);
            let raw = fs::read_to_string(path).expect("read index json");
            assert!(raw.contains("\"messageIndex\""));
            assert!(raw.contains("\"sessions\""));
            assert!(!raw.contains("message_index"));
        });
    }

    #[test]
    fn an_unknown_version_is_an_empty_index() {
        with_cache_dir(|_| {
            let mut document = sample_document();
            document.version = 9;
            assert!(save(&document).is_err());

            let path = index_path().expect("index path");
            fs::create_dir_all(path.parent().expect("parent")).expect("create dir");
            fs::write(&path, r#"{"version":9,"sessions":[]}"#).expect("write stale index");
            let loaded = load().expect("load stale index");
            assert_eq!(loaded, SessionTranscriptIndexDocument::empty());
        });
    }
}
