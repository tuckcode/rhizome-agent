//! On-disk cache for Rhizome's session-transcript search index.
//!
//! This is vault/memory work (ADR-0177), not a harness organ. The file stores
//! extracted searchable turns keyed by source path and list stamp. Prime's
//! `~/.prime/agent/sessions` logs stay Prime's; Rhizome never writes there.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[cfg(test)]
use std::cell::RefCell;

#[cfg(test)]
thread_local! {
    /// Per-test cache root. `RHIZOME_CACHE_DIR` is process-global and is also
    /// mutated by `vault::cache` tests under a different lock, so the worker
    /// that writes this index must not trust the env at TurnEnd time.
    static TEST_CACHE_DIR: RefCell<Option<PathBuf>> = const { RefCell::new(None) };
}

const INDEX_VERSION: u32 = 1;
/// Bump this when the scrubber changes, so an index written by an older
/// scrubber is rewritten on the next load.
const SCRUB_VERSION: u32 = 1;
const INDEX_FILE_NAME: &str = "v1.json";

/// One writer at a time. Append is read-modify-write, and two of those
/// on the same file used to drop a turn.
static INDEX_LOCK: Mutex<()> = Mutex::new(());

fn with_index_lock<T>(body: impl FnOnce() -> T) -> T {
    let _guard = INDEX_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    body()
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTranscriptIndexDocument {
    pub version: u32,
    /// Scrubber generation stored in the file. Missing reads as 0, so an
    /// index written before this field (including one marked only with
    /// `secretsScrubbed`) is scrubbed again.
    #[serde(default)]
    pub scrub_version: u32,
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
            scrub_version: SCRUB_VERSION,
            sessions: Vec::new(),
        }
    }
}

/// Load the persisted index. A missing file is an empty index, not an error.
/// An index left by the old writer (mode 0644, or a `v1.json.tmp` copy) is
/// locked down. A file whose `scrubVersion` is below the current scrubber
/// is rewritten, including a file that is already mode 0600.
pub fn load() -> Result<SessionTranscriptIndexDocument, String> {
    with_index_lock(load_locked)
}

fn load_locked() -> Result<SessionTranscriptIndexDocument, String> {
    let path = index_path()?;
    secure_existing_index(&path)?;
    load_from(path)
}

/// Append user and assistant turns for a native session path.
pub fn append_native_turns(
    path: &str,
    id: &str,
    title: &str,
    new_turns: Vec<IndexedTranscriptTurn>,
) -> Result<(), String> {
    append_native_turns_to(&index_path()?, path, id, title, new_turns)
}

/// Same write as `append_native_turns`, using a path resolved on the starting thread.
pub(crate) fn append_native_turns_to(
    index_file: &Path,
    path: &str,
    id: &str,
    title: &str,
    new_turns: Vec<IndexedTranscriptTurn>,
) -> Result<(), String> {
    with_index_lock(|| append_native_turns_locked(index_file, path, id, title, new_turns))
}

fn append_native_turns_locked(
    index_file: &Path,
    path: &str,
    id: &str,
    title: &str,
    new_turns: Vec<IndexedTranscriptTurn>,
) -> Result<(), String> {
    secure_existing_index(index_file)?;
    let mut document = load_from(index_file.to_path_buf())?;
    let scrub = crate::engines::native_log::SecretScrub::capture();
    let title = scrub.apply(title);
    let new_turns: Vec<IndexedTranscriptTurn> = new_turns
        .into_iter()
        .map(|mut turn| {
            turn.text = scrub.apply(&turn.text);
            turn
        })
        .collect();
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
    save_to(index_file.to_path_buf(), &document)
}

/// Remove a native session from the index. Missing is success.
pub fn remove_session(path: &str) -> Result<(), String> {
    with_index_lock(|| {
        let index = index_path()?;
        secure_existing_index(&index)?;
        let mut document = load_from(index.clone())?;
        document.sessions.retain(|session| session.path != path);
        save_to(index, &document)
    })
}

/// Replace the persisted index with an atomic write.
pub fn save(document: &SessionTranscriptIndexDocument) -> Result<(), String> {
    if document.version != INDEX_VERSION {
        return Err(format!(
            "unsupported session transcript index version {}",
            document.version
        ));
    }
    with_index_lock(|| {
        let index = index_path()?;
        secure_existing_index(&index)?;
        let mut document = scrub_document_once(document);
        document.scrub_version = SCRUB_VERSION;
        save_to(index, &document)
    })
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
    if document.scrub_version >= SCRUB_VERSION {
        return Ok(document);
    }
    let mut document = scrub_document_once(&document);
    document.scrub_version = SCRUB_VERSION;
    if let Err(error) = save_to(path, &document) {
        log::warn!("session transcript index rewrite failed: {error}");
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
        set_owner_only_dir(parent)?;
    }
    let data = serde_json::to_vec(document)
        .map_err(|error| format!("serialize session transcript index: {error}"))?;
    crate::rhizome_loop::write_atomic(&path, &data)
        .map_err(|error| format!("write session transcript index {}: {error}", path.display()))?;
    set_owner_only_file(&path)?;
    Ok(())
}

fn scrub_document_once(
    document: &SessionTranscriptIndexDocument,
) -> SessionTranscriptIndexDocument {
    let scrub = crate::engines::native_log::SecretScrub::capture();
    let mut document = document.clone();
    for session in &mut document.sessions {
        session.title = scrub.apply(&session.title);
        for turn in &mut session.turns {
            turn.text = scrub.apply(&turn.text);
        }
    }
    document
}

/// Lock down an index written before the owner-only format. A leftover
/// `v1.json.tmp` is deleted. Scrubbing is decided by `scrubVersion`, not by
/// the file mode.
fn secure_existing_index(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if parent.exists() {
            set_owner_only_dir(parent)?;
        }
    }
    let stale_tmp = path.with_extension("json.tmp");
    if stale_tmp.exists() {
        fs::remove_file(&stale_tmp).map_err(|error| {
            format!(
                "remove stale session transcript index {}: {error}",
                stale_tmp.display()
            )
        })?;
    }
    Ok(())
}

fn set_owner_only_dir(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700)).map_err(|error| {
            format!(
                "restrict session transcript index dir {}: {error}",
                path.display()
            )
        })?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

fn set_owner_only_file(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(|error| {
            format!(
                "restrict session transcript index {}: {error}",
                path.display()
            )
        })?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

pub(crate) fn index_path() -> Result<PathBuf, String> {
    Ok(index_dir()?.join(INDEX_FILE_NAME))
}

fn index_dir() -> Result<PathBuf, String> {
    #[cfg(test)]
    if let Some(dir) = TEST_CACHE_DIR.with(|slot| slot.borrow().clone()) {
        return Ok(dir.join("session-transcript-index"));
    }
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
    use tempfile::TempDir;

    pub fn with_temp_cache<T>(body: impl FnOnce() -> T) -> T {
        with_cache_dir(|_| body())
    }

    fn with_cache_dir<T>(body: impl FnOnce(&TempDir) -> T) -> T {
        let _guard = crate::app_config::lock_test_cache_dir();
        let dir = TempDir::new().expect("temp cache dir");
        TEST_CACHE_DIR.with(|slot| *slot.borrow_mut() = Some(dir.path().to_path_buf()));
        std::env::set_var("RHIZOME_CACHE_DIR", dir.path());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| body(&dir)));
        std::env::remove_var("RHIZOME_CACHE_DIR");
        TEST_CACHE_DIR.with(|slot| *slot.borrow_mut() = None);
        match result {
            Ok(value) => value,
            Err(panic) => std::panic::resume_unwind(panic),
        }
    }

    #[cfg(not(unix))]
    #[allow(clippy::permissions_set_readonly_false)]
    fn clear_readonly(path: &Path) {
        if let Ok(meta) = fs::metadata(path) {
            let mut perms = meta.permissions();
            perms.set_readonly(false);
            let _ = fs::set_permissions(path, perms);
        }
    }

    fn sample_document() -> SessionTranscriptIndexDocument {
        SessionTranscriptIndexDocument {
            version: INDEX_VERSION,
            scrub_version: SCRUB_VERSION,
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
    fn load_uses_the_thread_cache_even_when_env_points_elsewhere() {
        with_cache_dir(|_| {
            let document = sample_document();
            save(&document).expect("save index");
            let decoy = TempDir::new().expect("decoy cache");
            std::env::set_var("RHIZOME_CACHE_DIR", decoy.path());
            let loaded = load().expect("load index");
            assert_eq!(loaded, document);
        });
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

    #[test]
    fn a_pasted_key_is_scrubbed_from_the_index() {
        with_cache_dir(|_| {
            let key = "sk-proj-abcdefghijklmnopqrstuvwxyz";
            append_native_turns(
                "rhizome-native:pasted",
                "pasted",
                &format!("title {key}"),
                vec![
                    IndexedTranscriptTurn {
                        message_index: 0,
                        role: "user".into(),
                        text: format!("please look at {key}"),
                    },
                    IndexedTranscriptTurn {
                        message_index: 1,
                        role: "assistant".into(),
                        text: format!("I saw {key}"),
                    },
                ],
            )
            .expect("append");
            let path = index_path().expect("index path");
            let raw = fs::read_to_string(&path).expect("read index");
            assert!(!raw.contains(key), "{raw}");
            let loaded = load().expect("load");
            let session = loaded.sessions.first().expect("session");
            assert!(!session.title.contains(key), "{}", session.title);
            assert!(session.title.contains("[redacted]"), "{}", session.title);
            assert_eq!(session.turns.len(), 2);
            for turn in &session.turns {
                assert!(!turn.text.contains(key), "{}", turn.text);
                assert!(turn.text.contains("[redacted]"), "{}", turn.text);
            }
        });
    }

    #[cfg(unix)]
    #[test]
    fn the_index_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;

        with_cache_dir(|_| {
            save(&sample_document()).expect("save index");
            let path = index_path().expect("index path");
            let file_mode = fs::metadata(&path)
                .expect("file metadata")
                .permissions()
                .mode()
                & 0o777;
            let dir_mode = fs::metadata(path.parent().expect("index dir"))
                .expect("dir metadata")
                .permissions()
                .mode()
                & 0o777;
            assert_eq!(file_mode, 0o600);
            assert_eq!(dir_mode, 0o700);
        });
    }

    #[cfg(unix)]
    #[test]
    fn load_locks_down_a_world_readable_index_and_drops_the_stale_tmp() {
        use std::os::unix::fs::PermissionsExt;

        with_cache_dir(|_| {
            let key = "sk-proj-abcdefghijklmnopqrstuvwxyz";
            let path = index_path().expect("index path");
            let dir = path.parent().expect("index dir");
            fs::create_dir_all(dir).expect("create dir");
            fs::set_permissions(dir, fs::Permissions::from_mode(0o755)).expect("dir mode");
            let body = format!(
                r#"{{"version":1,"sessions":[{{"path":"rhizome-native:old","stamp":"1","id":"old","title":"title {key}","turns":[{{"messageIndex":0,"role":"assistant","text":"saw {key}"}}]}}]}}"#
            );
            fs::write(&path, body).expect("write old index");
            fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).expect("file mode");
            let tmp = path.with_extension("json.tmp");
            fs::write(&tmp, format!("stale copy {key}")).expect("write stale tmp");

            let loaded = load().expect("load old index");

            assert!(!tmp.exists(), "stale v1.json.tmp must be deleted");
            let file_mode = fs::metadata(&path).expect("file").permissions().mode() & 0o777;
            let dir_mode = fs::metadata(dir).expect("dir").permissions().mode() & 0o777;
            assert_eq!(file_mode, 0o600);
            assert_eq!(dir_mode, 0o700);
            let raw = fs::read_to_string(&path).expect("read secured index");
            assert!(!raw.contains(key), "{raw}");
            assert!(!raw.contains("stale copy"), "{raw}");
            let session = loaded.sessions.first().expect("session");
            assert!(!session.title.contains(key), "{}", session.title);
            assert!(
                !session.turns[0].text.contains(key),
                "{}",
                session.turns[0].text
            );
        });
    }

    #[test]
    fn load_rescrubs_when_scrub_version_is_behind() {
        with_cache_dir(|_| {
            let key = "sk-proj-abcdefghijklmnopqrstuvwxyz";
            let path = index_path().expect("index path");
            let dir = path.parent().expect("index dir");
            fs::create_dir_all(dir).expect("create dir");
            let session = format!(
                r#"{{"path":"rhizome-native:old","stamp":"1","id":"old","title":"kept","turns":[{{"messageIndex":0,"role":"assistant","text":"saw {key}"}}]}}"#
            );
            fs::write(
                &path,
                format!(r#"{{"version":1,"secretsScrubbed":true,"sessions":[{session}]}}"#),
            )
            .expect("write leaky index");

            let loaded = load().expect("load leaky index");
            let raw = fs::read_to_string(&path).expect("read scrubbed index");
            assert!(!raw.contains(key), "{raw}");
            assert!(
                raw.contains(&format!("\"scrubVersion\":{SCRUB_VERSION}")),
                "{raw}"
            );
            assert!(
                !loaded.sessions[0].turns[0].text.contains(key),
                "{}",
                loaded.sessions[0].turns[0].text
            );

            fs::write(
                &path,
                format!(r#"{{"version":1,"scrubVersion":{SCRUB_VERSION},"sessions":[{session}]}}"#),
            )
            .expect("write current index");
            let again = load().expect("load current index");
            assert!(
                again.sessions[0].turns[0].text.contains(key),
                "the current scrub version is left alone"
            );
        });
    }

    #[test]
    fn load_returns_scrubbed_text_when_the_rewrite_cannot_be_saved() {
        with_cache_dir(|_| {
            let key = "sk-proj-abcdefghijklmnopqrstuvwxyz";
            let path = index_path().expect("index path");
            let dir = path.parent().expect("index dir");
            fs::create_dir_all(dir).expect("create dir");
            fs::write(
                &path,
                format!(
                    r#"{{"version":1,"sessions":[{{"path":"rhizome-native:old","stamp":"1","id":"old","title":"kept","turns":[{{"messageIndex":0,"role":"assistant","text":"saw {key}"}}]}}]}}"#
                ),
            )
            .expect("write old index");
            let mut perms = fs::metadata(&path).expect("metadata").permissions();
            perms.set_readonly(true);
            fs::set_permissions(&path, perms).expect("readonly");
            struct MakeWritable(PathBuf);
            impl Drop for MakeWritable {
                fn drop(&mut self) {
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let _ = fs::set_permissions(&self.0, fs::Permissions::from_mode(0o644));
                    }
                    #[cfg(not(unix))]
                    clear_readonly(&self.0);
                }
            }
            let _restore = MakeWritable(path.clone());

            let loaded = load().expect("load returns the scrubbed copy");
            assert!(
                !loaded.sessions[0].turns[0].text.contains(key),
                "{}",
                loaded.sessions[0].turns[0].text
            );
            let raw = fs::read_to_string(&path).expect("read unchanged index");
            assert!(raw.contains(key), "{raw}");
        });
    }

    #[test]
    fn concurrent_appends_keep_both_updates() {
        use std::sync::{Arc, Barrier};
        use std::thread;

        with_cache_dir(|_| {
            for round in 0..8 {
                let barrier = Arc::new(Barrier::new(2));
                let left_path = format!("rhizome-native:left-{round}");
                let right_path = format!("rhizome-native:right-{round}");
                let left_marker = format!("alpha-marker-{round}");
                let right_marker = format!("beta-marker-{round}");
                let spawn = |path: String, marker: String, barrier: Arc<Barrier>| {
                    thread::spawn(move || {
                        barrier.wait();
                        append_native_turns(
                            &path,
                            &path,
                            &marker,
                            vec![IndexedTranscriptTurn {
                                message_index: 0,
                                role: "user".into(),
                                text: marker.clone(),
                            }],
                        )
                        .expect("append");
                    })
                };
                let left = spawn(left_path, left_marker.clone(), Arc::clone(&barrier));
                let right = spawn(right_path, right_marker.clone(), barrier);
                left.join().expect("left thread");
                right.join().expect("right thread");
                let index = index_path().expect("index path");
                let raw = fs::read_to_string(&index).expect("read index");
                assert!(raw.contains(&left_marker), "round {round}: {raw}");
                assert!(raw.contains(&right_marker), "round {round}: {raw}");
                let stale_tmp = index.with_extension("json.tmp");
                assert!(
                    !stale_tmp.exists(),
                    "round {round} left {}",
                    stale_tmp.display()
                );
            }
        });
    }
}
