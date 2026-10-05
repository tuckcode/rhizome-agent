use crate::commands::expand_tilde;
use crate::{git, vault};
use std::path::Path;

#[tauri::command]
pub fn create_empty_vault(target_path: String) -> Result<String, String> {
    let path = expand_tilde(&target_path).into_owned();
    let vault_dir = Path::new(&path);
    initialize_empty_vault(vault_dir, &path)?;
    Ok(canonical_vault_path_string(vault_dir))
}

fn initialize_empty_vault(vault_dir: &Path, vault_path: &str) -> Result<(), String> {
    ensure_directory_is_missing_or_empty(vault_dir)?;
    std::fs::create_dir_all(vault_dir)
        .map_err(|e| format!("Failed to create vault directory: {}", e))?;

    git::init_repo(vault_path)?;
    // Note + Portent work types (Project, Operation, …) come from seed_config_files.
    vault::seed_config_files(vault_path);
    Ok(())
}

fn ensure_directory_is_missing_or_empty(vault_dir: &Path) -> Result<(), String> {
    if !vault_dir.exists() {
        return Ok(());
    }

    let metadata = std::fs::metadata(vault_dir)
        .map_err(|e| format!("Failed to inspect target folder: {e}"))?;
    if !metadata.is_dir() {
        return Err("Choose a folder path for the new vault".to_string());
    }

    let has_entries = std::fs::read_dir(vault_dir)
        .map_err(|e| format!("Failed to inspect target folder: {e}"))?
        .next()
        .is_some();
    if has_entries {
        return Err("Choose an empty folder to create a new vault".to_string());
    }

    Ok(())
}

fn canonical_vault_path_string(vault_dir: &Path) -> String {
    vault_dir
        .canonicalize()
        .unwrap_or_else(|_| vault_dir.to_path_buf())
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub async fn create_getting_started_vault(target_path: Option<String>) -> Result<String, String> {
    let path = resolve_getting_started_target(target_path.as_deref())?;
    tokio::task::spawn_blocking(move || vault::create_getting_started_vault(&path))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}

fn resolve_getting_started_target(target_path: Option<&str>) -> Result<String, String> {
    match target_path {
        Some(path) if !path.is_empty() => Ok(expand_tilde(path).into_owned()),
        _ => vault::default_vault_path().map(|path| path.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub fn check_vault_exists(path: String) -> bool {
    let path = expand_tilde(&path);
    vault::vault_exists(&path)
}

/// Is this vault a dedicated Rhizome wiki vault (`RHIZOME_VAULT.md` or
/// `.rhizome/` present) rather than a personal notes vault? Drives the
/// sidebar's Projects-vs-Types/Folders nav mode (Alpha-2).
#[tauri::command]
pub fn is_wiki_vault(path: String) -> bool {
    let path = expand_tilde(&path);
    crate::rhizome_write_location::is_wiki_vault(Path::new(path.as_ref()))
}

#[tauri::command]
pub fn get_default_vault_path() -> Result<String, String> {
    vault::default_vault_path().map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn repair_vault(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::migrate_is_a_to_type(Path::new(vault_path.as_ref()))?;
    vault::repair_config_files(&vault_path)?;
    git::ensure_gitignore(std::path::Path::new(vault_path.as_ref()))?;
    Ok("Vault repaired".to_string())
}

/// Opt-in seed of Portent's 7 default type definitions into a vault.
/// Skips files that already exist. Does not run on vault open — call when
/// the user explicitly asks to adopt the Portent type model.
#[tauri::command]
pub fn seed_portent_type_definitions(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::seed_portent_type_definitions(vault_path.as_ref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn empty_vault_target_validation_allows_missing_or_empty_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let missing = dir.path().join("new-vault");
        let empty = dir.path().join("empty-vault");
        fs::create_dir(&empty).unwrap();

        assert_eq!(ensure_directory_is_missing_or_empty(&missing), Ok(()));
        assert_eq!(ensure_directory_is_missing_or_empty(&empty), Ok(()));
    }

    #[test]
    fn empty_vault_target_validation_rejects_files_and_nonempty_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let file = dir.path().join("vault.md");
        let nonempty = dir.path().join("vault");
        fs::write(&file, "# Not a folder").unwrap();
        fs::create_dir(&nonempty).unwrap();
        fs::write(nonempty.join("note.md"), "# Existing note").unwrap();

        assert_eq!(
            ensure_directory_is_missing_or_empty(&file),
            Err("Choose a folder path for the new vault".to_string())
        );
        assert_eq!(
            ensure_directory_is_missing_or_empty(&nonempty),
            Err("Choose an empty folder to create a new vault".to_string())
        );
    }

    #[test]
    fn canonical_vault_path_uses_existing_canonical_path_or_original_path() {
        let dir = tempfile::TempDir::new().unwrap();
        let existing = dir.path().join("existing");
        let missing = dir.path().join("missing");
        fs::create_dir(&existing).unwrap();

        assert_eq!(
            canonical_vault_path_string(&existing),
            existing.canonicalize().unwrap().to_string_lossy()
        );
        assert_eq!(
            canonical_vault_path_string(&missing),
            missing.to_string_lossy()
        );
    }

    #[test]
    fn getting_started_target_uses_explicit_path_when_provided() {
        let dir = tempfile::TempDir::new().unwrap();
        let explicit = dir.path().join("starter");

        assert_eq!(
            resolve_getting_started_target(explicit.to_str()),
            Ok(explicit.to_string_lossy().to_string())
        );
    }

    #[test]
    fn create_empty_vault_seeds_portent_types_by_default() {
        let dir = tempfile::TempDir::new().unwrap();
        let target = dir.path().join("new-vault");

        create_empty_vault(target.to_string_lossy().to_string()).unwrap();

        for file_name in [
            "responsibility.md",
            "operation.md",
            "project.md",
            "task.md",
            "event.md",
            "topic.md",
            "person.md",
        ] {
            assert!(
                target.join(file_name).exists(),
                "expected Portent type file {file_name} to be seeded by default"
            );
        }
        assert!(target.join("AGENTS.md").exists());
    }
}
