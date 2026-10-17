//! Temp-file + rename writes. A failed write leaves the destination
//! unchanged. Existing files keep their permissions.

use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty());
    if let Some(parent) = parent {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create directory: {error}"))?;
        } else if !parent.is_dir() {
            return Err(format!(
                "Cannot create parent directory: {}",
                parent.display()
            ));
        }
    }

    let dest_permissions = match fs::metadata(path) {
        Ok(meta) if meta.is_dir() => {
            return Err(format!("Not a file: {}", path.display()));
        }
        Ok(meta) => Some(meta.permissions()),
        Err(_) => None,
    };

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
            .open(&tmp)
            .map_err(|error| format!("Failed to open temporary file: {error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("Failed to write temporary file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Failed to sync temporary file: {error}"))?;
        drop(file);
        if let Some(permissions) = dest_permissions {
            fs::set_permissions(&tmp, permissions)
                .map_err(|error| format!("Failed to keep file permissions: {error}"))?;
        }
        fs::rename(&tmp, path).map_err(|error| format!("Failed to replace file: {error}"))?;
        Ok(())
    };

    write_tmp().inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn overwrites_without_leaving_a_tmp_file() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("note.md");
        fs::write(&dest, "first\n").unwrap();
        write_atomic(&dest, b"second\n").unwrap();
        assert_eq!(fs::read_to_string(&dest).unwrap(), "second\n");
        let leftovers: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_name().to_string_lossy().contains(".tmp-"))
            .collect();
        assert!(leftovers.is_empty(), "tmp leftovers: {leftovers:?}");
    }

    #[test]
    fn creates_missing_parent_directories() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("nested").join("deep").join("note.md");
        write_atomic(&dest, b"ok\n").unwrap();
        assert_eq!(fs::read_to_string(&dest).unwrap(), "ok\n");
    }

    #[cfg(unix)]
    #[test]
    fn keeps_the_existing_file_mode() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("kept.md");
        fs::write(&dest, "old\n").unwrap();
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o640)).unwrap();
        write_atomic(&dest, b"new\n").unwrap();
        let mode = fs::metadata(&dest).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o640);
        assert_eq!(fs::read_to_string(&dest).unwrap(), "new\n");
    }

    #[test]
    fn refuses_a_directory_destination() {
        let dir = tempfile::tempdir().unwrap();
        let error = write_atomic(dir.path(), b"no\n").unwrap_err();
        assert!(error.contains("Not a file"), "{error}");
    }
}
