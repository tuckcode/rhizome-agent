use std::fs;
use std::path::Path;

/// Write `content` so the destination is replaced atomically on the same
/// volume. On Unix the new file is owner-only (`0o600`). A symlink at
/// `path` is replaced, not followed.
pub(crate) fn write_owner_only_atomic(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create directory: {error}"))?;
    }

    #[cfg(unix)]
    {
        write_unix_owner_only(path, content)
    }

    #[cfg(not(unix))]
    {
        fs::write(path, content).map_err(|error| format!("Failed to write file: {error}"))
    }
}

#[cfg(unix)]
fn write_unix_owner_only(path: &Path, content: &str) -> Result<(), String> {
    use std::io::Write;
    use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
    use std::time::{SystemTime, UNIX_EPOCH};

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let tmp = parent.join(format!(".{name}.tmp-{}-{stamp}", std::process::id()));

    let write_tmp = || -> Result<(), String> {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .mode(0o600)
            .open(&tmp)
            .map_err(|error| format!("Failed to open temporary file: {error}"))?;
        file.write_all(content.as_bytes())
            .map_err(|error| format!("Failed to write temporary file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Failed to sync temporary file: {error}"))?;
        drop(file);
        fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Failed to secure temporary file: {error}"))?;
        fs::rename(&tmp, path).map_err(|error| format!("Failed to replace file: {error}"))?;
        Ok(())
    };

    write_tmp().inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

#[cfg(test)]
mod tests {
    // Every test here is `#[cfg(unix)]`; the glob import is dead elsewhere.
    #[cfg(unix)]
    use super::*;

    #[cfg(unix)]
    #[test]
    fn replaces_a_symlink_without_writing_the_target() {
        use std::os::unix::fs::{symlink, PermissionsExt};

        let dir = tempfile::TempDir::new().unwrap();
        let outside = dir.path().join("outside.txt");
        let dest = dir.path().join("dest.txt");
        fs::write(&outside, "outside-marker\n").unwrap();
        symlink(&outside, &dest).unwrap();

        write_owner_only_atomic(&dest, "inside-only\n").unwrap();

        assert_eq!(fs::read_to_string(&outside).unwrap(), "outside-marker\n");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "inside-only\n");
        assert!(!dest.symlink_metadata().unwrap().file_type().is_symlink());
        let mode = fs::metadata(&dest).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
    }

    #[cfg(unix)]
    #[test]
    fn leaves_no_tmp_file_after_a_successful_replace() {
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("settings.json");
        write_owner_only_atomic(&dest, "first\n").unwrap();
        write_owner_only_atomic(&dest, "second\n").unwrap();

        let leftovers: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_name().to_string_lossy().contains(".tmp-"))
            .collect();
        assert!(leftovers.is_empty(), "tmp leftovers: {leftovers:?}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "second\n");
    }

    #[cfg(unix)]
    #[test]
    fn creates_missing_parent_directories() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir
            .path()
            .join("nested")
            .join("owner")
            .join("settings.json");
        write_owner_only_atomic(&dest, "nested\n").unwrap();
        assert_eq!(fs::read_to_string(&dest).unwrap(), "nested\n");
        let mode = fs::metadata(&dest).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
    }
}
