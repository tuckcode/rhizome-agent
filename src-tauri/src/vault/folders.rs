use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

use super::filename_rules::validate_folder_name;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FolderRenameResult {
    pub old_path: String,
    pub new_path: String,
}

fn normalize_folder_name(next_name: &str) -> Result<String, String> {
    let trimmed = next_name.trim();
    if trimmed.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }
    validate_folder_name(trimmed)?;
    Ok(trimmed.to_string())
}

fn ensure_relative_folder_path(folder_path: &str) -> Result<PathBuf, String> {
    let trimmed = folder_path.trim();
    if trimmed.is_empty() {
        return Err("Folder path cannot be empty".to_string());
    }

    let relative = Path::new(trimmed);
    if relative.is_absolute() {
        return Err("Folder path must be relative to the vault root".to_string());
    }
    if relative
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("Folder path cannot escape the vault root".to_string());
    }

    // `.` and `./` carry no `..`, so the guard above lets them through while
    // they still resolve to the vault root. `remove_dir_all` empties a
    // directory before removing it, so the root's contents were being deleted
    // even where the final rmdir failed.
    let normalized: PathBuf = relative
        .components()
        .filter(|component| !matches!(component, Component::CurDir))
        .collect();
    if normalized.as_os_str().is_empty() {
        return Err("Folder path cannot target the vault root".to_string());
    }

    Ok(normalized)
}

fn display_relative_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub fn rename_folder(
    vault_path: &Path,
    folder_path: &str,
    next_name: &str,
) -> Result<FolderRenameResult, String> {
    let relative_path = ensure_relative_folder_path(folder_path)?;
    let normalized_name = normalize_folder_name(next_name)?;
    let source_path = vault_path.join(&relative_path);

    if !source_path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }
    if !source_path.is_dir() {
        return Err(format!("Not a folder: {}", folder_path));
    }

    let current_name = source_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "Folder path cannot target the vault root".to_string())?;

    if current_name == normalized_name {
        return Ok(FolderRenameResult {
            old_path: display_relative_path(&relative_path),
            new_path: display_relative_path(&relative_path),
        });
    }

    let parent_relative = relative_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    let destination_relative = parent_relative.join(&normalized_name);
    let destination_path = vault_path.join(&destination_relative);

    if destination_path.exists() {
        return Err(format!(
            "Folder '{}' already exists",
            display_relative_path(&destination_relative)
        ));
    }

    fs::rename(&source_path, &destination_path)
        .map_err(|error| format!("Failed to rename folder: {}", error))?;

    Ok(FolderRenameResult {
        old_path: display_relative_path(&relative_path),
        new_path: display_relative_path(&destination_relative),
    })
}

pub fn delete_folder(vault_path: &Path, folder_path: &str) -> Result<String, String> {
    let relative_path = ensure_relative_folder_path(folder_path)?;
    let target_path = vault_path.join(&relative_path);

    if !target_path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }
    if !target_path.is_dir() {
        return Err(format!("Not a folder: {}", folder_path));
    }

    fs::remove_dir_all(&target_path)
        .map_err(|error| format!("Failed to delete folder: {}", error))?;
    Ok(display_relative_path(&relative_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_folder(dir: &TempDir, relative: &str) -> PathBuf {
        let path = dir.path().join(relative);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn rename_folder_updates_relative_destination() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects/laputa");

        let result = rename_folder(dir.path(), "projects", "work").unwrap();

        assert_eq!(
            result,
            FolderRenameResult {
                old_path: "projects".to_string(),
                new_path: "work".to_string(),
            }
        );
        assert!(dir.path().join("work/laputa").is_dir());
        assert!(!dir.path().join("projects").exists());
    }

    #[test]
    fn rename_folder_rejects_duplicate_sibling() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects");
        make_folder(&dir, "areas");

        let error = rename_folder(dir.path(), "projects", "areas").unwrap_err();

        assert_eq!(error, "Folder 'areas' already exists");
    }

    #[test]
    fn rename_folder_rejects_invalid_names() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects");

        let error = rename_folder(dir.path(), "projects", "../areas").unwrap_err();

        assert_eq!(error, "Invalid folder name");
    }

    #[test]
    fn rename_folder_rejects_windows_invalid_names() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects");

        let error = rename_folder(dir.path(), "projects", "LPT1").unwrap_err();

        assert_eq!(error, "Invalid folder name");
    }

    #[test]
    fn delete_folder_removes_nested_contents() {
        let dir = TempDir::new().unwrap();
        let nested = make_folder(&dir, "projects/laputa");
        fs::write(nested.join("note.md"), "# Note\n").unwrap();

        let deleted_path = delete_folder(dir.path(), "projects").unwrap();

        assert_eq!(deleted_path, "projects");
        assert!(!dir.path().join("projects").exists());
    }

    #[test]
    fn delete_folder_rejects_missing_folder() {
        let dir = TempDir::new().unwrap();

        let error = delete_folder(dir.path(), "projects").unwrap_err();

        assert_eq!(error, "Folder does not exist: projects");
    }

    /// `.` resolved to the vault root itself, so a recursive delete would have
    /// taken the whole vault. The traversal guard only looked for `..`.
    #[test]
    fn folder_operations_refuse_to_target_the_vault_root() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects");

        for folder_path in [".", "./", "./."] {
            let delete_error = delete_folder(dir.path(), folder_path).unwrap_err();
            assert_eq!(
                delete_error, "Folder path cannot target the vault root",
                "delete accepted {folder_path}"
            );

            let rename_error = rename_folder(dir.path(), folder_path, "renamed").unwrap_err();
            assert_eq!(
                rename_error, "Folder path cannot target the vault root",
                "rename accepted {folder_path}"
            );
        }

        assert!(dir.path().join("projects").is_dir());
    }
}
