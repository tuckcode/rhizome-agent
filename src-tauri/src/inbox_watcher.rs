//! Alpha-3 inbox automation: watch `<vault>/raw/inbox/` and, when a file
//! lands, classify it and run it through the same agent-layer Distill/Import
//! the Research panel uses, tagging the event `trigger:"inbox"`, then move the
//! source to `raw/processed/`. See
//! `docs/plans/2026-07-10-rhizome-desktop-alpha-roadmap.md` (Alpha-3).
//!
//! This module holds the target-agnostic core (classify, stabilize, process,
//! move). The `notify` watcher + Tauri command layer live in the `desktop`
//! submodule.

use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::inbox_action::{declared_inbox_action_in_file, InboxAction};

/// Route a dropped file. A capture that declares `inbox_action:` in its own
/// frontmatter gets what it asked for (see `crate::inbox_action`); otherwise
/// fall back to the extension heuristic: `.md` (and plain-text `.txt`) is text
/// to distill; a `.txt` whose whole content is a bare URL, or any other
/// extension (PDFs, etc. that need markitdown conversion), is an import source.
pub fn classify_inbox_file(path: &Path) -> InboxAction {
    if let Some(declared) = declared_inbox_action_in_file(path) {
        return declared;
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    match ext.as_deref() {
        Some("md") => InboxAction::Distill,
        Some("txt") => {
            if bare_url_in_file(path).is_some() {
                InboxAction::Import
            } else {
                InboxAction::Distill
            }
        }
        _ => InboxAction::Import,
    }
}

/// The single URL a file consists of, if that's all it contains. Whole-file,
/// not first-line: any interior whitespace (a second line, a trailing note)
/// disqualifies it, so only a file that *is* a link matches. Surrounding
/// whitespace — the trailing newline every editor adds — is trimmed off.
fn bare_url_in_file(path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    let trimmed = content.trim();
    let is_bare_url = !trimmed.chars().any(char::is_whitespace)
        && (trimmed.starts_with("https://") || trimmed.starts_with("http://"));
    is_bare_url.then(|| trimmed.to_string())
}

/// What to hand `rhizome_api::import_source` for a dropped file. A `.txt`
/// holding nothing but a URL imports *the URL* — so it's fetched — while
/// every other source imports by path. Without this, `classify_inbox_file`'s
/// bare-URL routing detects the link and then throws it away, and the import
/// reads the file verbatim.
fn inbox_import_source(path: &Path) -> String {
    let is_txt = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("txt"));
    if is_txt {
        if let Some(url) = bare_url_in_file(path) {
            return url;
        }
    }
    path.to_string_lossy().to_string()
}

/// Poll `path`'s size up to `max_checks` times at `interval`, returning true
/// as soon as two consecutive reads match (the file finished being written).
/// Returns false if it never stabilizes in `max_checks` polls, or the file
/// vanishes. This size-stabilization loop *is* the debounce — a partial
/// download or in-progress copy keeps growing and isn't processed until it
/// settles.
pub fn wait_for_stable_size(path: &Path, max_checks: u32, interval: Duration) -> bool {
    let mut last: Option<u64> = None;
    for _ in 0..max_checks {
        let size = match std::fs::metadata(path) {
            Ok(meta) => meta.len(),
            Err(_) => return false,
        };
        if last == Some(size) {
            return true;
        }
        last = Some(size);
        std::thread::sleep(interval);
    }
    false
}

/// Classify `file_path`, hand it to `run` (the agent-verb boundary — kept
/// injectable so tests can avoid a live agent call), and on success move the
/// source into `raw/processed/`. On verb failure the file stays in
/// `raw/inbox/` (never silently deleted). Returns the processed path.
pub fn process_inbox_file_with<F>(
    vault_path: &Path,
    file_path: &Path,
    run: F,
) -> Result<PathBuf, String>
where
    F: FnOnce(InboxAction, &Path) -> Result<String, String>,
{
    if !file_path.is_file() {
        return Err(format!(
            "Inbox entry is not a file: {}",
            file_path.display()
        ));
    }
    let action = classify_inbox_file(file_path);
    run(action, file_path)?;
    move_to_processed(vault_path, file_path)
}

/// Real processing path: dispatch to `rhizome_api` with `trigger:"inbox"`.
/// `.md`/text distills the file's contents; everything else imports the
/// source `inbox_import_source` picks — the contained URL for a bare-URL
/// `.txt`, the path otherwise (import handles markitdown conversion / URL
/// fetch downstream). A capture that declared `inbox_action: save` is filed
/// straight into the vault without any agent call at all.
pub fn process_inbox_file(
    vault_path: &Path,
    file_path: &Path,
    on_line: &mut dyn FnMut(&str),
) -> Result<PathBuf, String> {
    process_inbox_file_with(vault_path, file_path, |action, path| match action {
        InboxAction::Save => crate::inbox_action::save_captured_file(vault_path, path, "inbox"),
        InboxAction::Distill => {
            let text = std::fs::read_to_string(path)
                .map_err(|e| format!("Failed to read inbox file {}: {e}", path.display()))?;
            crate::rhizome_api::distill(vault_path, &text, None, None, "inbox", None, on_line)
        }
        InboxAction::Import => {
            let source = inbox_import_source(path);
            crate::rhizome_api::import_source(vault_path, &source, None, "inbox", None, on_line)
        }
    })
}

/// Move a processed inbox file to `<vault>/raw/processed/`, adding a numeric
/// suffix on name collision rather than overwriting.
fn move_to_processed(vault_path: &Path, file_path: &Path) -> Result<PathBuf, String> {
    let processed_dir = vault_path.join("raw").join("processed");
    std::fs::create_dir_all(&processed_dir)
        .map_err(|e| format!("Failed to create raw/processed dir: {e}"))?;
    let file_name = file_path
        .file_name()
        .ok_or_else(|| "Inbox file has no name".to_string())?;
    let mut dest = processed_dir.join(file_name);
    let mut n = 2;
    while dest.exists() {
        let stem = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        let candidate = match file_path.extension().and_then(|s| s.to_str()) {
            Some(ext) => format!("{stem}-{n}.{ext}"),
            None => format!("{stem}-{n}"),
        };
        dest = processed_dir.join(candidate);
        n += 1;
    }
    std::fs::rename(file_path, &dest).map_err(|e| format!("Failed to move processed file: {e}"))?;
    Ok(dest)
}

/// Tauri event emitted when an inbox file is successfully turned into a wiki
/// page. The frontend toasts "Inbox: processed N" on it.
pub const INBOX_PROCESSED_EVENT: &str = "inbox-processed";
/// Tauri event emitted when inbox processing fails; the file stays in
/// `raw/inbox/` and the frontend can surface the error.
pub const INBOX_ERROR_EVENT: &str = "inbox-error";

#[cfg(desktop)]
mod desktop {
    use std::collections::HashSet;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use notify::{
        recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
    };
    use serde::Serialize;
    use tauri::Emitter;

    use super::{
        process_inbox_file, wait_for_stable_size, Path, PathBuf, INBOX_ERROR_EVENT,
        INBOX_PROCESSED_EVENT,
    };

    /// Up to `STABILIZE_CHECKS * STABILIZE_INTERVAL` (~6s) is spent waiting for
    /// a dropped file to finish being written before it's processed.
    const STABILIZE_CHECKS: u32 = 20;
    const STABILIZE_INTERVAL: Duration = Duration::from_millis(300);

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct InboxProcessedPayload {
        vault_path: String,
        artifact_path: String,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct InboxErrorPayload {
        vault_path: String,
        file: String,
        error: String,
    }

    struct ActiveInboxWatcher {
        inbox_dir: PathBuf,
        _watcher: RecommendedWatcher,
    }

    pub struct InboxWatcherState {
        active: Mutex<Vec<ActiveInboxWatcher>>,
        /// Files currently being processed — de-dupes the several filesystem
        /// events `notify` fires for one write. Not a work queue; distinct
        /// files each get their own thread (fine for v1's drop volume).
        in_flight: Arc<Mutex<HashSet<PathBuf>>>,
    }

    impl Default for InboxWatcherState {
        fn default() -> Self {
            Self::new()
        }
    }

    impl InboxWatcherState {
        pub fn new() -> Self {
            Self {
                active: Mutex::new(Vec::new()),
                in_flight: Arc::new(Mutex::new(HashSet::new())),
            }
        }
    }

    /// A regular file that isn't a dotfile or an in-progress-download temp
    /// file (`.tmp`/`.part`/`.crdownload`).
    fn is_processable(path: &Path) -> bool {
        path.is_file()
            && path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| {
                    !n.starts_with('.')
                        && !n.ends_with(".tmp")
                        && !n.ends_with(".part")
                        && !n.ends_with(".crdownload")
                })
                .unwrap_or(false)
    }

    fn spawn_processing(
        app: tauri::AppHandle,
        vault_path: PathBuf,
        file_path: PathBuf,
        in_flight: Arc<Mutex<HashSet<PathBuf>>>,
    ) {
        {
            let mut set = match in_flight.lock() {
                Ok(set) => set,
                Err(_) => return,
            };
            // Already being handled by an earlier event's thread — skip.
            if !set.insert(file_path.clone()) {
                return;
            }
        }

        std::thread::spawn(move || {
            let result = if wait_for_stable_size(&file_path, STABILIZE_CHECKS, STABILIZE_INTERVAL) {
                let mut sink = |_line: &str| {};
                Some(process_inbox_file(&vault_path, &file_path, &mut sink))
            } else {
                None
            };

            if let Ok(mut set) = in_flight.lock() {
                set.remove(&file_path);
            }

            match result {
                Some(Ok(dest)) => {
                    let _ = app.emit(
                        INBOX_PROCESSED_EVENT,
                        InboxProcessedPayload {
                            vault_path: vault_path.to_string_lossy().to_string(),
                            artifact_path: dest.to_string_lossy().to_string(),
                        },
                    );
                }
                Some(Err(error)) => {
                    let _ = app.emit(
                        INBOX_ERROR_EVENT,
                        InboxErrorPayload {
                            vault_path: vault_path.to_string_lossy().to_string(),
                            file: file_path.to_string_lossy().to_string(),
                            error,
                        },
                    );
                }
                // Never stabilized within the window — released; a later
                // filesystem event will re-trigger.
                None => {}
            }
        });
    }

    fn handle_event(
        app: &tauri::AppHandle,
        vault_path: &Path,
        in_flight: &Arc<Mutex<HashSet<PathBuf>>>,
        event: Event,
    ) {
        // Only react to content-bearing events; a Remove is our own
        // move-to-processed, and Access is noise.
        if matches!(event.kind, EventKind::Access(_) | EventKind::Remove(_)) {
            return;
        }
        for path in event.paths {
            if is_processable(&path) {
                spawn_processing(
                    app.clone(),
                    vault_path.to_path_buf(),
                    path,
                    Arc::clone(in_flight),
                );
            }
        }
    }

    pub fn start(
        app: tauri::AppHandle,
        state: tauri::State<'_, InboxWatcherState>,
        vault_path: PathBuf,
    ) -> Result<(), String> {
        if vault_path.as_os_str().is_empty() {
            return Err("Vault path is required".to_string());
        }
        let inbox_dir = vault_path.join("raw").join("inbox");
        std::fs::create_dir_all(&inbox_dir)
            .map_err(|e| format!("Failed to create raw/inbox dir: {e}"))?;

        let mut active = state
            .active
            .lock()
            .map_err(|_| "Failed to lock inbox watcher state".to_string())?;
        if active.iter().any(|w| w.inbox_dir == inbox_dir) {
            return Ok(());
        }

        let event_app = app.clone();
        let event_vault = vault_path.clone();
        let in_flight = Arc::clone(&state.in_flight);
        let mut watcher = recommended_watcher(move |event| match event {
            Ok(event) => handle_event(&event_app, &event_vault, &in_flight, event),
            Err(err) => log::warn!("Inbox watcher event failed: {}", err),
        })
        .map_err(|err| format!("Failed to create inbox watcher: {err}"))?;
        // Non-recursive: only the inbox dir itself, not the whole vault.
        watcher
            .watch(&inbox_dir, RecursiveMode::NonRecursive)
            .map_err(|err| format!("Failed to watch {}: {err}", inbox_dir.display()))?;

        active.push(ActiveInboxWatcher {
            inbox_dir,
            _watcher: watcher,
        });
        Ok(())
    }

    pub fn stop(state: tauri::State<'_, InboxWatcherState>) -> Result<(), String> {
        let mut active = state
            .active
            .lock()
            .map_err(|_| "Failed to lock inbox watcher state".to_string())?;
        // Dropping the watchers stops new events; already-spawned processing
        // threads finish their single file.
        active.clear();
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn is_processable_accepts_regular_files_only() {
            let dir = tempfile::tempdir().unwrap();
            let file = dir.path().join("drop.md");
            std::fs::write(&file, "x").unwrap();
            assert!(is_processable(&file));
            assert!(!is_processable(dir.path()));
            assert!(!is_processable(&dir.path().join("missing.md")));
        }

        #[test]
        fn is_processable_skips_dotfiles_and_partial_downloads() {
            let dir = tempfile::tempdir().unwrap();
            for name in [".DS_Store", "big.pdf.part", "dl.crdownload", "x.tmp"] {
                let file = dir.path().join(name);
                std::fs::write(&file, "x").unwrap();
                assert!(!is_processable(&file), "{name} should be skipped");
            }
        }
    }
}

#[cfg(not(desktop))]
mod mobile {
    use super::PathBuf;

    pub struct InboxWatcherState;

    impl Default for InboxWatcherState {
        fn default() -> Self {
            Self::new()
        }
    }

    impl InboxWatcherState {
        pub fn new() -> Self {
            Self
        }
    }

    pub fn start(_vault_path: PathBuf) -> Result<(), String> {
        Ok(())
    }

    pub fn stop() -> Result<(), String> {
        Ok(())
    }
}

#[cfg(desktop)]
pub use desktop::InboxWatcherState;
#[cfg(not(desktop))]
pub use mobile::InboxWatcherState;

#[cfg(desktop)]
#[tauri::command]
pub fn start_inbox_watcher(
    app: tauri::AppHandle,
    state: tauri::State<'_, InboxWatcherState>,
    vault_path: PathBuf,
) -> Result<(), String> {
    desktop::start(app, state, vault_path)
}

#[cfg(desktop)]
#[tauri::command]
pub fn stop_inbox_watcher(state: tauri::State<'_, InboxWatcherState>) -> Result<(), String> {
    desktop::stop(state)
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn start_inbox_watcher(vault_path: PathBuf) -> Result<(), String> {
    mobile::start(vault_path)
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn stop_inbox_watcher() -> Result<(), String> {
    mobile::stop()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(dir: &Path, name: &str, content: &str) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn classifies_markdown_and_plain_text_as_distill() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            classify_inbox_file(&write(dir.path(), "note.md", "# Idea")),
            InboxAction::Distill
        );
        assert_eq!(
            classify_inbox_file(&write(dir.path(), "note.txt", "some free text here")),
            InboxAction::Distill
        );
    }

    #[test]
    fn classifies_bare_url_txt_as_import() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            classify_inbox_file(&write(
                dir.path(),
                "link.txt",
                "https://example.com/article\n"
            )),
            InboxAction::Import
        );
    }

    #[test]
    fn import_source_is_the_url_for_a_bare_url_txt() {
        let dir = tempfile::tempdir().unwrap();
        let file = write(dir.path(), "link.txt", "https://example.com/article\n");
        assert_eq!(inbox_import_source(&file), "https://example.com/article");

        let plain = write(dir.path(), "plain.txt", "  http://example.org  ");
        assert_eq!(inbox_import_source(&plain), "http://example.org");
    }

    #[test]
    fn import_source_is_the_path_for_everything_else() {
        let dir = tempfile::tempdir().unwrap();
        for (name, content) in [
            // Prose, not a link.
            ("note.txt", "some free text here"),
            // Markdown never routes by URL.
            ("note.md", "https://example.com/article"),
            // Empty file.
            ("empty.txt", ""),
            // A URL on the first line, but more content after it: the
            // bare-URL rule is whole-file, not first-line.
            ("multi.txt", "https://example.com/article\nplus a note\n"),
            // Non-http scheme.
            ("scheme.txt", "ftp://example.com/file.zip"),
            // Whitespace inside the single line.
            ("spaced.txt", "https://example.com/a b"),
        ] {
            let file = write(dir.path(), name, content);
            assert_eq!(
                inbox_import_source(&file),
                file.to_string_lossy(),
                "{name} should import by path"
            );
        }

        // Binary/convertible sources import by path even though their bytes
        // are never inspected for a URL.
        let pdf = write(dir.path(), "paper.pdf", "https://example.com/article");
        assert_eq!(inbox_import_source(&pdf), pdf.to_string_lossy());
    }

    #[test]
    fn a_declared_inbox_action_beats_the_extension_heuristic() {
        let dir = tempfile::tempdir().unwrap();
        // Markdown would distill; the capture says save.
        assert_eq!(
            classify_inbox_file(&write(
                dir.path(),
                "page.md",
                "---\ninbox_action: save\nsource_url: https://example.com/a\n---\n\nBody.\n"
            )),
            InboxAction::Save
        );
        // Markdown would distill; the capture says fetch the link instead.
        assert_eq!(
            classify_inbox_file(&write(
                dir.path(),
                "link.md",
                "---\ninbox_action: import\nsource_url: https://example.com/a\n---\n"
            )),
            InboxAction::Import
        );
    }

    #[test]
    fn an_undeclared_or_unknown_action_leaves_the_heuristic_in_charge() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            classify_inbox_file(&write(
                dir.path(),
                "unknown.md",
                "---\ninbox_action: shred\n---\n\nBody.\n"
            )),
            InboxAction::Distill
        );
        assert_eq!(
            classify_inbox_file(&write(dir.path(), "plain.md", "# No frontmatter\n")),
            InboxAction::Distill
        );
    }

    #[test]
    fn save_routed_files_move_to_processed_like_every_other_action() {
        let dir = tempfile::tempdir().unwrap();
        let inbox = dir.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();
        let file = write(
            &inbox,
            "page.md",
            "---\ntitle: Saved Page\ninbox_action: save\n---\n\nBody.\n",
        );

        let mut seen = None;
        let dest = process_inbox_file_with(dir.path(), &file, |action, _path| {
            seen = Some(action);
            Ok(String::new())
        })
        .unwrap();

        assert_eq!(seen, Some(InboxAction::Save));
        assert_eq!(dest, dir.path().join("raw/processed/page.md"));
    }

    #[test]
    fn classifies_other_extensions_as_import() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            classify_inbox_file(&write(dir.path(), "paper.pdf", "%PDF")),
            InboxAction::Import
        );
    }

    #[test]
    fn wait_for_stable_size_true_when_already_stable() {
        let dir = tempfile::tempdir().unwrap();
        let path = write(dir.path(), "stable.md", "done");
        assert!(wait_for_stable_size(&path, 5, Duration::from_millis(5)));
    }

    #[test]
    fn wait_for_stable_size_false_for_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!wait_for_stable_size(
            &dir.path().join("nope.md"),
            3,
            Duration::from_millis(1)
        ));
    }

    #[test]
    fn wait_for_stable_size_detects_stabilization_after_writes_stop() {
        use std::io::Write;
        let dir = tempfile::tempdir().unwrap();
        let path = write(dir.path(), "growing.md", "start");
        let writer_path = path.clone();
        let handle = std::thread::spawn(move || {
            for _ in 0..3 {
                std::thread::sleep(Duration::from_millis(10));
                let mut f = std::fs::OpenOptions::new()
                    .append(true)
                    .open(&writer_path)
                    .unwrap();
                f.write_all(b"more").unwrap();
            }
            // Then writes stop; size stabilizes.
        });
        // Give generous headroom so the poll loop outlives the writer.
        let stable = wait_for_stable_size(&path, 50, Duration::from_millis(10));
        handle.join().unwrap();
        assert!(stable, "should detect the file settling after writes stop");
    }

    #[test]
    fn process_moves_file_to_processed_on_success() {
        let dir = tempfile::tempdir().unwrap();
        let inbox = dir.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();
        let file = write(&inbox, "drop.md", "# A dropped note");

        let mut seen_action = None;
        let dest = process_inbox_file_with(dir.path(), &file, |action, _path| {
            seen_action = Some(action);
            Ok("wrote a page".to_string())
        })
        .unwrap();

        assert_eq!(seen_action, Some(InboxAction::Distill));
        assert!(!file.exists(), "source should be moved out of inbox");
        assert_eq!(dest, dir.path().join("raw/processed/drop.md"));
        assert!(dest.is_file());
    }

    #[test]
    fn process_leaves_file_in_inbox_on_verb_failure() {
        let dir = tempfile::tempdir().unwrap();
        let inbox = dir.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();
        let file = write(&inbox, "drop.md", "# A dropped note");

        let result = process_inbox_file_with(dir.path(), &file, |_kind, _path| {
            Err("agent failed".to_string())
        });

        assert!(result.is_err());
        assert!(file.exists(), "failed input must stay in inbox, not vanish");
        assert!(!dir.path().join("raw/processed/drop.md").exists());
    }

    #[test]
    fn wait_for_stable_size_false_when_it_never_settles() {
        // One poll can never see two matching reads, so the file is treated
        // as still being written rather than optimistically processed.
        let dir = tempfile::tempdir().unwrap();
        let path = write(dir.path(), "growing.md", "start");
        assert!(!wait_for_stable_size(&path, 1, Duration::from_millis(1)));
    }

    #[test]
    fn process_rejects_entries_that_are_not_files() {
        let dir = tempfile::tempdir().unwrap();
        let mut ran = false;
        let err = process_inbox_file_with(dir.path(), dir.path(), |_k, _p| {
            ran = true;
            Ok(String::new())
        })
        .unwrap_err();
        assert!(err.contains("not a file"), "got: {err}");
        assert!(!ran, "the agent verb must not run for a non-file");

        assert!(
            process_inbox_file_with(dir.path(), &dir.path().join("gone.md"), |_k, _p| Ok(
                String::new()
            ))
            .is_err()
        );
    }

    #[test]
    fn move_dedupes_extensionless_files() {
        let dir = tempfile::tempdir().unwrap();
        let inbox = dir.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();

        let first = write(&inbox, "README", "one");
        process_inbox_file_with(dir.path(), &first, |_k, _p| Ok(String::new())).unwrap();
        let second = write(&inbox, "README", "two");
        let dest =
            process_inbox_file_with(dir.path(), &second, |_k, _p| Ok(String::new())).unwrap();

        assert_eq!(dest, dir.path().join("raw/processed/README-2"));
    }

    #[test]
    fn move_dedupes_on_name_collision() {
        let dir = tempfile::tempdir().unwrap();
        let inbox = dir.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();

        let first = write(&inbox, "note.md", "one");
        process_inbox_file_with(dir.path(), &first, |_k, _p| Ok(String::new())).unwrap();
        let second = write(&inbox, "note.md", "two");
        let dest =
            process_inbox_file_with(dir.path(), &second, |_k, _p| Ok(String::new())).unwrap();

        assert_eq!(dest, dir.path().join("raw/processed/note-2.md"));
        assert!(dir.path().join("raw/processed/note.md").is_file());
    }

    /// Exercises the full inbox pipeline against a real agent CLI: drops a
    /// markdown file into a temp vault's `raw/inbox/`, runs the real
    /// `process_inbox_file` (distill via the agent layer), and asserts a
    /// wiki page landed, the source moved to `raw/processed/`, and the
    /// event carries `trigger:"inbox"`. Costs tokens and needs `claude` on
    /// PATH, so it's `#[ignore]`d — run manually with `cargo test
    /// --manifest-path src-tauri/Cargo.toml
    /// inbox_watcher::tests::live_process_inbox_file_distills_a_dropped_note
    /// -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn live_process_inbox_file_distills_a_dropped_note() {
        let vault = tempfile::tempdir().unwrap();
        let inbox = vault.path().join("raw/inbox");
        std::fs::create_dir_all(&inbox).unwrap();
        let file = write(
            &inbox,
            "idempotency.md",
            "Idempotency means an operation can be applied many times without \
changing the result beyond the first application. HTTP PUT is idempotent; \
HTTP POST is not.",
        );

        let mut lines = Vec::new();
        let dest = process_inbox_file(vault.path(), &file, &mut |l| lines.push(l.to_string()))
            .expect("live inbox distill should succeed");

        // Source moved out of inbox, into processed.
        assert!(!file.exists());
        assert_eq!(dest, vault.path().join("raw/processed/idempotency.md"));
        assert!(dest.is_file());

        // A concept card was written (flat or nested layout — the tempdir
        // vault has no wiki/ marker, so nested wiki/concepts/).
        let concepts = vault.path().join("wiki/concepts");
        let written: Vec<_> = std::fs::read_dir(&concepts)
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        assert_eq!(written.len(), 1, "expected exactly one distilled card");

        let events = std::fs::read_to_string(vault.path().join(".rhizome/events.jsonl")).unwrap();
        assert!(events.contains("\"trigger\":\"inbox\""));
    }
}
