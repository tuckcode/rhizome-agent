use crate::frontmatter;
use crate::frontmatter::FrontmatterValue;

use super::boundary::{with_validated_path, ValidatedPathMode};

#[tauri::command]
pub fn update_frontmatter(
    path: String,
    key: String,
    value: FrontmatterValue,
    vault_path: Option<String>,
) -> Result<String, String> {
    with_validated_path(
        &path,
        vault_path.as_deref(),
        ValidatedPathMode::Existing,
        |validated_path| frontmatter::update_frontmatter(validated_path, &key, value),
    )
}

#[tauri::command]
pub fn delete_frontmatter_property(
    path: String,
    key: String,
    vault_path: Option<String>,
) -> Result<String, String> {
    with_validated_path(
        &path,
        vault_path.as_deref(),
        ValidatedPathMode::Existing,
        |validated_path| frontmatter::delete_frontmatter_property(validated_path, &key),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note_path(dir: &tempfile::TempDir, name: &str) -> String {
        dir.path().join(name).to_string_lossy().into_owned()
    }

    fn write_note(path: &str, content: &str) {
        std::fs::write(path, content).unwrap();
    }

    #[test]
    fn update_frontmatter_command_validates_and_updates_note() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = note_path(&dir, "note.md");
        write_note(&path, "---\nStatus: Draft\n---\n# Note\n");

        let updated = update_frontmatter(
            path.clone(),
            "Status".to_string(),
            FrontmatterValue::String("Done".to_string()),
            Some(dir.path().to_string_lossy().into_owned()),
        )
        .unwrap();

        assert!(updated.contains("Status: Done"));
        assert_eq!(std::fs::read_to_string(path).unwrap(), updated);
    }

    #[test]
    fn delete_frontmatter_property_command_removes_existing_key() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = note_path(&dir, "note.md");
        write_note(&path, "---\nStatus: Draft\nOwner: Ada\n---\n# Note\n");

        let updated = delete_frontmatter_property(
            path,
            "Owner".to_string(),
            Some(dir.path().to_string_lossy().into_owned()),
        )
        .unwrap();

        assert!(!updated.contains("Owner:"));
        assert!(updated.contains("Status: Draft"));
    }
}
