use std::borrow::Cow;
use std::fs;
use std::io::{Error, ErrorKind, Write};
use std::path::Path;
use std::thread;
use std::time::{Duration, UNIX_EPOCH};

const SAVE_RETRY_DELAYS_MS: [u64; 4] = [25, 50, 100, 200];
/// Start of the error a checked save returns on a real conflict.
pub const SAVE_CONFLICT: &str = "Save conflict:";

/// Result of a checked save.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOutcome {
    /// SHA-256 of the bytes now on disk, lowercase hex.
    pub content_hash: String,
    /// Set when the on-disk `Status` was spliced into the buffer. The
    /// editor must take this text as its new buffer.
    pub spliced_content: Option<String>,
}

/// Read file metadata (modified_at timestamp, created_at timestamp, file size).
/// Creation time is sourced from filesystem metadata (birthtime on macOS).
pub(crate) fn read_file_metadata(path: &Path) -> Result<(Option<u64>, Option<u64>, u64), String> {
    let metadata =
        fs::metadata(path).map_err(|e| format!("Failed to stat {}: {}", path.display(), e))?;
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    let created_at = metadata
        .created()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    Ok((modified_at, created_at, metadata.len()))
}

fn invalid_utf8_text_error(path: &Path) -> String {
    format!("File is not valid UTF-8 text: {}", path.display())
}

fn is_invalid_platform_path_error(error: &Error) -> bool {
    error.kind() == ErrorKind::InvalidInput || error.raw_os_error() == Some(123)
}

fn is_retryable_save_error(error: &Error) -> bool {
    error.kind() == ErrorKind::PermissionDenied
        || (cfg!(windows) && error.raw_os_error() == Some(5))
}

fn write_with_retry(
    mut write_once: impl FnMut() -> Result<(), Error>,
    mut wait_before_retry: impl FnMut(u64),
) -> Result<(), Error> {
    for delay in SAVE_RETRY_DELAYS_MS {
        match write_once() {
            Ok(()) => return Ok(()),
            Err(error) if is_retryable_save_error(&error) => wait_before_retry(delay),
            Err(error) => return Err(error),
        }
    }
    write_once()
}

fn read_existing_note_bytes(path: &Path) -> Result<Vec<u8>, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }
    fs::read(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

struct RawNotePath<'a>(&'a str);

impl<'a> RawNotePath<'a> {
    fn is_windows_verbatim(&self) -> bool {
        self.0.starts_with(r"\\?\") || self.0.starts_with(r"\??\")
    }

    fn normalized_for_file_io(&self) -> Cow<'a, str> {
        if !self.is_windows_verbatim() {
            return Cow::Borrowed(self.0);
        }
        if !self.0.contains('/') {
            return Cow::Borrowed(self.0);
        }
        Cow::Owned(self.0.replace('/', r"\"))
    }
}

#[derive(Clone, Copy)]
enum NoteIoOperation {
    Save,
    Create,
}

#[derive(Clone, Copy)]
struct NotePathDisplay<'a> {
    value: &'a str,
}

impl<'a> NotePathDisplay<'a> {
    fn new(value: &'a str) -> Self {
        Self { value }
    }
}

impl NoteIoOperation {
    fn verb(self) -> &'static str {
        match self {
            Self::Save => "save",
            Self::Create => "create",
        }
    }
}

fn note_io_error(operation: NoteIoOperation, path: NotePathDisplay<'_>, error: &Error) -> String {
    let verb = operation.verb();
    if is_invalid_platform_path_error(error) {
        let path = path.value;
        format!(
            "Failed to {verb} note: the path is invalid on this platform. Rename the note or move it to a valid folder, then try again. Path: {path}"
        )
    } else {
        let path = path.value;
        format!("Failed to {verb} {path}: {error}")
    }
}

/// Read the content of a single note file.
pub fn get_note_content(path: &Path) -> Result<String, String> {
    let bytes = read_existing_note_bytes(path)?;
    String::from_utf8(bytes).map_err(|_| invalid_utf8_text_error(path))
}

/// Check whether a note still has the exact content the renderer cached.
pub fn note_content_matches(path: &Path, expected_content: &str) -> Result<bool, String> {
    let bytes = read_existing_note_bytes(path)?;
    Ok(bytes == expected_content.as_bytes())
}

fn validate_save_path(file_path: &Path, display_path: &str) -> Result<(), String> {
    let parent_missing = file_path.parent().is_some_and(|p| !p.exists());
    if parent_missing {
        return Err(format!(
            "Parent directory does not exist: {}",
            file_path.parent().unwrap().display()
        ));
    }
    let is_readonly = file_path.exists()
        && file_path
            .metadata()
            .map(|m| m.permissions().readonly())
            .unwrap_or(false);
    if is_readonly {
        return Err(format!("File is read-only: {}", display_path));
    }
    Ok(())
}

/// Write content to a note file. Creates parent directory if needed, validates path,
/// then writes content to disk.
pub fn save_note_content(path: &str, content: &str) -> Result<(), String> {
    let normalized_path = RawNotePath(path).normalized_for_file_io();
    let file_path = Path::new(normalized_path.as_ref());
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e)
            })?;
        }
    }
    validate_save_path(file_path, path)?;
    write_with_retry(
        || fs::write(file_path, content),
        |delay| thread::sleep(Duration::from_millis(delay)),
    )
    .map_err(|e| note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e))
}

/// Save with a conflict check. `expected` is the note as the editor last
/// read or wrote it. With no text, this is [`save_note_content`] and
/// nothing else.
///
/// The disk bytes decide. When disk still matches, the buffer is
/// written. When the only change on disk is the `Status` value (a board
/// move), that status is spliced into the buffer and the result is
/// written. Any other change is a conflict: nothing is written and the
/// error starts with [`SAVE_CONFLICT`].
pub fn save_note_content_expecting(
    path: &str,
    content: &str,
    expected: Option<&str>,
) -> Result<SaveOutcome, String> {
    let Some(expected) = expected else {
        save_note_content(path, content)?;
        return Ok(saved(content));
    };
    let normalized_path = RawNotePath(path).normalized_for_file_io();
    let disk = match fs::read(Path::new(normalized_path.as_ref())) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Err(conflict(path, "was deleted or moved"));
        }
        Err(error) => {
            return Err(note_io_error(
                NoteIoOperation::Save,
                NotePathDisplay::new(path),
                &error,
            ))
        }
    };
    let disk_matches = disk == expected.as_bytes();
    let disk = String::from_utf8(disk).map_err(|_| conflict(path, "is no longer UTF-8 text"))?;
    if disk_matches {
        save_note_content(path, content)?;
        return Ok(saved(content));
    }
    if disk == content {
        return Ok(saved(content));
    }
    match crate::board::splice_disk_status(&disk, content, expected) {
        Some(spliced) => {
            save_note_content(path, &spliced)?;
            Ok(SaveOutcome {
                content_hash: crate::board::content_hash(&spliced),
                spliced_content: Some(spliced),
            })
        }
        None => Err(conflict(path, "changed on disk since the editor read it")),
    }
}

fn saved(content: &str) -> SaveOutcome {
    SaveOutcome {
        content_hash: crate::board::content_hash(content),
        spliced_content: None,
    }
}

fn conflict(path: &str, what: &str) -> String {
    format!(
        "{SAVE_CONFLICT} {path} {what}. Your changes are still in the editor and were not saved."
    )
}

/// Create a new note file without overwriting any existing file.
pub fn create_note_content(path: &str, content: &str) -> Result<(), String> {
    let normalized_path = RawNotePath(path).normalized_for_file_io();
    let file_path = Path::new(normalized_path.as_ref());
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                note_io_error(NoteIoOperation::Create, NotePathDisplay::new(path), &e)
            })?;
        }
    }
    validate_save_path(file_path, path)?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(file_path)
        .map_err(|e| match e.kind() {
            ErrorKind::AlreadyExists => format!("File already exists: {}", path),
            _ => note_io_error(NoteIoOperation::Create, NotePathDisplay::new(path), &e),
        })?;
    file.write_all(content.as_bytes())
        .map_err(|e| note_io_error(NoteIoOperation::Save, NotePathDisplay::new(path), &e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_windows_invalid_path_syntax_as_recoverable_save_error() {
        let path = r"C:\Users\@raflymln\notes\untitled-note-1777236475.md";
        let message = note_io_error(
            NoteIoOperation::Save,
            NotePathDisplay::new(path),
            &Error::from_raw_os_error(123),
        );

        assert!(message.contains("path is invalid on this platform"));
        assert!(message.contains("Rename the note or move it to a valid folder"));
        assert!(!message.contains("os error 123"));
    }

    #[test]
    fn normalizes_extended_windows_paths_before_file_io() {
        let path = r"\\?\C:\Users\alex\Documents\Tolaria/Getting Started/untitled-project.md";

        assert_eq!(
            RawNotePath(path).normalized_for_file_io(),
            r"\\?\C:\Users\alex\Documents\Tolaria\Getting Started\untitled-project.md"
        );
    }

    #[test]
    fn retries_transient_access_denied_save_errors() {
        let mut attempts = 0;
        let mut delays = Vec::new();

        write_with_retry(
            || {
                attempts += 1;
                if attempts == 1 {
                    Err(Error::new(ErrorKind::PermissionDenied, "Access is denied"))
                } else {
                    Ok(())
                }
            },
            |delay| delays.push(delay),
        )
        .unwrap();

        assert_eq!(attempts, 2);
        assert_eq!(delays, vec![25]);
    }

    #[test]
    fn note_content_matches_detects_external_edits() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "# Fresh\n").unwrap();

        assert!(note_content_matches(&path, "# Fresh\n").unwrap());
        assert!(!note_content_matches(&path, "# Stale\n").unwrap());
    }

    mod checked_save {
        use super::*;
        use crate::board::{content_hash, move_card};
        use tempfile::TempDir;

        const OPENED: &str = "---\nStatus: In progress\ntitle: Plan\n---\n# Plan\nfirst draft\n";

        fn note(dir: &TempDir, content: &str) -> String {
            let path = dir.path().join("plan.md");
            fs::write(&path, content).unwrap();
            path.to_string_lossy().into_owned()
        }

        fn disk(path: &str) -> String {
            fs::read_to_string(path).unwrap()
        }

        #[test]
        fn no_hash_saves_as_before() {
            let dir = TempDir::new().unwrap();
            let path = note(&dir, OPENED);
            let outcome = save_note_content_expecting(&path, "changed\n", None).unwrap();
            assert_eq!(disk(&path), "changed\n");
            assert_eq!(outcome.content_hash, content_hash("changed\n"));
            assert_eq!(outcome.spliced_content, None);
        }

        #[test]
        fn matching_hash_saves_the_buffer() {
            let dir = TempDir::new().unwrap();
            let path = note(&dir, OPENED);
            let buffer = OPENED.replace("first draft", "second draft");
            let outcome = save_note_content_expecting(&path, &buffer, Some(OPENED)).unwrap();
            assert_eq!(disk(&path), buffer);
            assert_eq!(outcome.spliced_content, None);
        }

        /// The board moves a card while the editor has unsaved edits.
        /// The autosave keeps the edits and the board's status.
        #[test]
        fn board_move_during_dirty_edit_keeps_done() {
            let dir = TempDir::new().unwrap();
            let path = note(&dir, OPENED);
            let expected = OPENED;
            let buffer = OPENED.replace("first draft", "typed while the card moved");

            move_card(dir.path(), "plan.md", "Done", None).unwrap();
            let outcome = save_note_content_expecting(&path, &buffer, Some(expected)).unwrap();

            let want = buffer.replace("Status: In progress", "Status: Done");
            assert_eq!(disk(&path), want);
            assert_eq!(outcome.spliced_content.as_deref(), Some(want.as_str()));
            assert_eq!(outcome.content_hash, content_hash(&want));

            // The next autosave sends the spliced text and its hash.
            let next = want.replace("typed while", "kept typing while");
            save_note_content_expecting(&path, &next, Some(&want)).unwrap();
            assert!(disk(&path).contains("Status: Done"));
            assert!(disk(&path).contains("kept typing while"));
        }

        #[test]
        fn board_move_that_added_status_or_frontmatter_is_spliced() {
            let dir = TempDir::new().unwrap();
            let opened = "---\ntitle: Plan\n---\nbody\n";
            let path = note(&dir, opened);
            move_card(dir.path(), "plan.md", "Blocked", None).unwrap();
            let buffer = opened.replace("body", "body edited");
            let outcome = save_note_content_expecting(&path, &buffer, Some(opened)).unwrap();
            assert_eq!(
                disk(&path),
                "---\ntitle: Plan\nStatus: Blocked\n---\nbody edited\n"
            );
            assert!(outcome.spliced_content.is_some());

            let plain = "no frontmatter\n";
            let path = note(&dir, plain);
            move_card(dir.path(), "plan.md", "Done", None).unwrap();
            let outcome =
                save_note_content_expecting(&path, "no frontmatter, edited\n", Some(plain))
                    .unwrap();
            assert_eq!(
                disk(&path),
                "---\nStatus: Done\n---\nno frontmatter, edited\n"
            );
            assert!(outcome.spliced_content.is_some());
        }

        #[test]
        fn any_other_change_on_disk_is_a_conflict() {
            let dir = TempDir::new().unwrap();
            let path = note(&dir, OPENED);
            let external = OPENED.replace("first draft", "edited elsewhere");
            fs::write(&path, &external).unwrap();
            let buffer = OPENED.replace("first draft", "edited here");
            let error = save_note_content_expecting(&path, &buffer, Some(OPENED)).unwrap_err();
            assert!(error.starts_with(SAVE_CONFLICT), "{error}");
            assert_eq!(disk(&path), external);

            // Status and another key changed together: still a conflict.
            let both = OPENED
                .replace("In progress", "Done")
                .replace("title: Plan", "title: Other");
            fs::write(&path, &both).unwrap();
            assert!(save_note_content_expecting(&path, &buffer, Some(OPENED)).is_err());
            assert_eq!(disk(&path), both);
        }

        #[test]
        fn same_status_on_both_sides_with_other_changes_is_a_conflict() {
            let dir = TempDir::new().unwrap();
            let path = note(&dir, OPENED);
            let external = OPENED
                .replace("In progress", "Done")
                .replace("first draft", "x");
            fs::write(&path, &external).unwrap();
            let buffer = OPENED.replace("In progress", "Done");
            assert!(save_note_content_expecting(&path, &buffer, Some(OPENED)).is_err());
            assert_eq!(disk(&path), external);
        }

        #[test]
        fn a_deleted_note_is_a_conflict_and_is_not_recreated() {
            let dir = TempDir::new().unwrap();
            let path = note(&dir, OPENED);
            fs::remove_file(&path).unwrap();
            let error = save_note_content_expecting(&path, OPENED, Some(OPENED)).unwrap_err();
            assert!(error.starts_with(SAVE_CONFLICT), "{error}");
            assert!(!Path::new(&path).exists());
        }

        #[test]
        fn disk_already_equal_to_the_buffer_is_not_a_conflict() {
            let dir = TempDir::new().unwrap();
            let buffer = OPENED.replace("first draft", "same text");
            let path = note(&dir, &buffer);
            let outcome = save_note_content_expecting(&path, &buffer, Some(OPENED)).unwrap();
            assert_eq!(outcome.spliced_content, None);
            assert_eq!(disk(&path), buffer);
        }

        #[test]
        fn crlf_and_bom_survive_a_splice() {
            let dir = TempDir::new().unwrap();
            let opened = "\u{FEFF}---\r\nStatus: Blocked\r\n---\r\nbody\r\n";
            let path = note(&dir, opened);
            move_card(dir.path(), "plan.md", "Done", None).unwrap();
            let buffer = opened.replace("body", "body edited");
            save_note_content_expecting(&path, &buffer, Some(opened)).unwrap();
            assert_eq!(
                disk(&path),
                "\u{FEFF}---\r\nStatus: Done\r\n---\r\nbody edited\r\n"
            );
        }
    }
}
