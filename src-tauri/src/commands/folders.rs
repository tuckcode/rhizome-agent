use crate::vault::{self, FolderRenameResult};

use super::vault::with_registered_boundary;

#[tauri::command]
pub fn rename_vault_folder(
    vault_path: String,
    folder_path: String,
    new_name: String,
) -> Result<FolderRenameResult, String> {
    with_registered_boundary(&vault_path, |boundary| {
        boundary.validate_writable_path(&folder_path)?;
        vault::rename_folder(boundary.requested_root(), &folder_path, &new_name)
    })
}

#[tauri::command]
pub fn delete_vault_folder(vault_path: String, folder_path: String) -> Result<String, String> {
    with_registered_boundary(&vault_path, |boundary| {
        boundary.validate_writable_path(&folder_path)?;
        vault::delete_folder(boundary.requested_root(), &folder_path)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_commands_reject_an_unregistered_vault_root() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_string_lossy().to_string();
        let folder = dir.path().join("Inbox");
        std::fs::create_dir(&folder).unwrap();
        std::fs::write(folder.join("note.md"), "# Note\n").unwrap();

        let rename_error = rename_vault_folder(
            vault_path.clone(),
            "Inbox".to_string(),
            "Organized".to_string(),
        )
        .expect_err("an arbitrary root must not be accepted as a vault");
        assert_eq!(rename_error, "Vault path must be registered");
        assert!(dir.path().join("Inbox/note.md").exists());

        let delete_error = delete_vault_folder(vault_path, "Inbox".to_string())
            .expect_err("an arbitrary root must not be accepted as a vault");
        assert_eq!(delete_error, "Vault path must be registered");
        assert!(dir.path().join("Inbox/note.md").exists());
    }
}
