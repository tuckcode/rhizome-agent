//! Temp-file + rename writes. A failed write leaves the destination
//! unchanged. Existing files keep their permissions. Read-only files
//! and hard links are refused. The temp name is short so a long
//! destination name still fits. Unix xattrs are copied onto the temp
//! file before rename (Finder tags, quarantine). Creation date is
//! not an xattr and may still reset.

use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const TMP_TRIES: usize = 8;

pub fn is_rhz_tmp(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with(".rhz") && name.ends_with(".tmp"))
}

pub fn preflight(path: &Path) -> Result<(), String> {
    dest_permissions(path).map(|_| ())
}

fn dest_permissions(path: &Path) -> Result<Option<std::fs::Permissions>, String> {
    match fs::metadata(path) {
        Ok(meta) if meta.is_dir() => Err(format!("Not a file: {}", path.display())),
        Ok(meta) => {
            if is_not_writable(path, &meta) {
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
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Failed to read file metadata for {}: {error}",
            path.display()
        )),
    }
}

fn is_not_writable(path: &Path, meta: &std::fs::Metadata) -> bool {
    // Open for write without truncating. Catches 0464, where
    // Permissions::readonly is false because the group can write.
    match OpenOptions::new().write(true).open(path) {
        Ok(_) => false,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => true,
        Err(_) => meta.permissions().readonly(),
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
    let names = (0..TMP_TRIES).map(|_| generate_tmp_name());
    let (tmp, mut file) = open_exclusive_tmp(parent, names)?;

    let write_tmp = || -> Result<(), String> {
        file.write_all(bytes)
            .map_err(|error| format!("Failed to write temporary file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Failed to sync temporary file: {error}"))?;
        drop(file);
        if let Some(permissions) = kept_permissions {
            fs::set_permissions(&tmp, permissions)
                .map_err(|error| format!("Failed to keep file permissions: {error}"))?;
        }
        copy_xattrs(path, &tmp);
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

fn generate_tmp_name() -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let random = u32::from_le_bytes(uuid::Uuid::new_v4().as_bytes()[0..4].try_into().unwrap());
    format!(
        ".rhz{:x}{:x}{random:08x}.tmp",
        std::process::id() & 0xffff,
        (stamp as u32) & 0xffff
    )
}

fn open_exclusive_tmp(
    parent: &Path,
    names: impl IntoIterator<Item = String>,
) -> Result<(PathBuf, File), String> {
    let mut last_exists = false;
    for name in names {
        let tmp = parent.join(name);
        match OpenOptions::new().create_new(true).write(true).open(&tmp) {
            Ok(file) => return Ok((tmp, file)),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                last_exists = true;
                continue;
            }
            Err(error) => return Err(format!("Failed to open temporary file: {error}")),
        }
    }
    if last_exists {
        Err("Failed to open temporary file: name collision".into())
    } else {
        Err("Failed to open temporary file".into())
    }
}

/// Copies one attribute. A failure is logged and returned so Finder tags
/// and the quarantine flag are not dropped silently.
#[cfg(unix)]
fn copy_xattr_or_warn(to: &Path, name: &std::ffi::OsStr, value: &[u8]) -> Result<(), String> {
    xattr::set(to, name, value).map_err(|error| {
        let message = format!(
            "Could not copy file attribute {}: {error}",
            name.to_string_lossy()
        );
        log::warn!("{message}");
        message
    })
}

fn copy_xattrs(from: &Path, to: &Path) {
    #[cfg(unix)]
    {
        if !from.exists() {
            return;
        }
        let Ok(attrs) = xattr::list(from) else {
            return;
        };
        for name in attrs {
            if let Ok(Some(value)) = xattr::get(from, &name) {
                let _ = copy_xattr_or_warn(to, &name, &value);
            }
        }
    }
    #[cfg(not(unix))]
    {
        let _ = (from, to);
    }
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
    fn refuses_a_0464_file_for_the_owner() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("group-write.md");
        fs::write(&dest, "keep\n").unwrap();
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o464)).unwrap();
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

    #[test]
    fn temp_name_retries_when_the_first_candidate_exists() {
        let dir = tempfile::tempdir().unwrap();
        let taken = dir.path().join(".rhzdeadbeef.tmp");
        fs::write(&taken, "hold\n").unwrap();
        let names = [
            ".rhzdeadbeef.tmp".to_string(),
            ".rhzcafebabe.tmp".to_string(),
        ];
        let (path, file) = open_exclusive_tmp(dir.path(), names).unwrap();
        drop(file);
        assert_eq!(path.file_name().unwrap(), ".rhzcafebabe.tmp");
        assert!(taken.exists());
    }

    #[test]
    fn is_rhz_tmp_matches_leftover_names() {
        assert!(is_rhz_tmp(Path::new(".rhz1a2bcafebabe.tmp")));
        assert!(!is_rhz_tmp(Path::new("note.md")));
        assert!(!is_rhz_tmp(Path::new(".rhznote.md")));
    }

    #[cfg(unix)]
    #[test]
    fn copies_xattrs_onto_the_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("note.md");
        fs::write(&dest, "old\n").unwrap();
        let name = "user.rhizome-test";
        if xattr::set(&dest, name, b"tag").is_err() {
            return;
        }
        write_atomic(&dest, b"new\n").unwrap();
        assert_eq!(
            xattr::get(&dest, name).unwrap().as_deref(),
            Some(&b"tag"[..])
        );
        assert_eq!(fs::read_to_string(&dest).unwrap(), "new\n");
    }

    #[cfg(unix)]
    #[test]
    fn a_failed_attribute_copy_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("gone");
        let error = copy_xattr_or_warn(&missing, std::ffi::OsStr::new("user.rhizome-test"), b"tag")
            .expect_err("a missing file cannot take an attribute");
        assert!(error.contains("Could not copy file attribute"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn a_metadata_error_other_than_not_found_is_returned() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().join("locked");
        fs::create_dir(&parent).unwrap();
        let dest = parent.join("note.md");
        fs::write(&dest, "keep\n").unwrap();
        fs::set_permissions(&parent, fs::Permissions::from_mode(0o000)).unwrap();
        let error = write_atomic(&dest, b"no\n");
        fs::set_permissions(&parent, fs::Permissions::from_mode(0o755)).unwrap();
        let error = error.expect_err("metadata must fail closed");
        assert!(error.contains("Failed to read file metadata"), "{error}");
        assert!(
            error.contains("Permission denied") || error.contains("permission"),
            "{error}"
        );
        assert_eq!(fs::read_to_string(&dest).unwrap(), "keep\n");
    }
}
