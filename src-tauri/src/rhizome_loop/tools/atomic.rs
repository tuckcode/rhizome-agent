//! Temp-file + rename writes. A failed write leaves the destination
//! unchanged. Existing files keep their permissions. Read-only files
//! and hard links are refused. The temp name is short so a long
//! destination name still fits.

use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn preflight(path: &Path) -> Result<(), String> {
    dest_permissions(path).map(|_| ())
}

fn dest_permissions(path: &Path) -> Result<Option<std::fs::Permissions>, String> {
    match fs::metadata(path) {
        Ok(meta) if meta.is_dir() => Err(format!("Not a file: {}", path.display())),
        Ok(meta) => {
            if meta.permissions().readonly() {
                return Err(format!("File is read-only: {}", path.display()));
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::MetadataExt;
                if meta.nlink() > 1 {
                    return Err(format!(
                        "Refusing to write through a hard link (nlink={}): {}",
                        meta.nlink(),
                        path.display()
                    ));
                }
            }
            Ok(Some(meta.permissions()))
        }
        Err(_) => Ok(None),
    }
}

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

    let kept_permissions = dest_permissions(path)?;

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let tmp = parent.join(format!(
        ".rhz{:x}{:x}.tmp",
        std::process::id() & 0xffff,
        (stamp as u32) & 0xffff
    ));

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
        if let Some(permissions) = kept_permissions {
            fs::set_permissions(&tmp, permissions)
                .map_err(|error| format!("Failed to keep file permissions: {error}"))?;
        }
        fs::rename(&tmp, path).map_err(|error| format!("Failed to replace file: {error}"))?;
        #[cfg(unix)]
        {
            let dir = File::open(parent)
                .map_err(|error| format!("Failed to open parent directory: {error}"))?;
            dir.sync_all()
                .map_err(|error| format!("Failed to sync parent directory: {error}"))?;
        }
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
            .filter(|entry| entry.file_name().to_string_lossy().contains(".tmp"))
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

    #[cfg(unix)]
    #[test]
    fn refuses_a_read_only_file() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("locked.md");
        fs::write(&dest, "keep\n").unwrap();
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o444)).unwrap();
        let error = write_atomic(&dest, b"no\n").unwrap_err();
        let _ = fs::set_permissions(&dest, fs::Permissions::from_mode(0o644));
        assert!(error.contains("read-only"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "keep\n");
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_hard_link() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("note.md");
        let alias = dir.path().join("alias.md");
        fs::write(&dest, "keep\n").unwrap();
        fs::hard_link(&dest, &alias).unwrap();
        let error = write_atomic(&dest, b"no\n").unwrap_err();
        assert!(error.contains("hard link"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "keep\n");
        assert_eq!(fs::read_to_string(&alias).unwrap(), "keep\n");
    }

    #[test]
    fn short_temp_name_fits_beside_a_long_filename() {
        let dir = tempfile::tempdir().unwrap();
        let long = "n".repeat(240) + ".md";
        let dest = dir.path().join(&long);
        fs::write(&dest, "old\n").unwrap();
        write_atomic(&dest, b"new\n").unwrap();
        assert_eq!(fs::read_to_string(&dest).unwrap(), "new\n");
    }
}
