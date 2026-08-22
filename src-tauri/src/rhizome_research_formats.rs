//! User-authored research formats, stored per vault.
//!
//! A built-in format like "Architecture Map" is, to the research pipeline,
//! exactly one imperative sentence — `mode_instruction` maps an id to it and
//! falls back to `architecture` for anything unrecognised. A *custom* format
//! is therefore the same thing with the sentence supplied by the user: a
//! title and an instruction, nothing more.
//!
//! They live in the vault (`.rhizome/research-formats.json`) rather than in
//! app settings so they travel with the vault, sync through git, and are
//! readable by agents — the same reasoning that puts events and the repo
//! cache there.
//!
//! Resolution is custom-first: a saved format shadows a built-in of the same
//! id on purpose, so a user who dislikes the stock "Architecture Map"
//! instruction can replace it without inventing a new name.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFormat {
    pub id: String,
    pub title: String,
    /// One imperative sentence, the same shape as `mode_instruction`'s arms.
    pub instruction: String,
}

fn formats_path(vault_path: &Path) -> PathBuf {
    vault_path.join(".rhizome").join("research-formats.json")
}

/// Slug an id from a title so the caller never has to invent one. Ids are
/// what the rest of the pipeline passes around as `mode`.
pub fn slug_for(title: &str) -> String {
    let slug: String = title
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let slug = slug.trim_matches('-').to_string();
    let mut out = String::with_capacity(slug.len());
    let mut last_dash = false;
    for c in slug.chars() {
        if c == '-' {
            if !last_dash {
                out.push(c);
            }
            last_dash = true;
        } else {
            out.push(c);
            last_dash = false;
        }
    }
    out
}

/// Saved formats, newest write last. A missing or unreadable file is an
/// empty list, never an error — a vault with no custom formats is the
/// normal case, and a corrupt file must not block research entirely.
pub fn load(vault_path: &Path) -> Vec<CustomFormat> {
    let raw = match std::fs::read_to_string(formats_path(vault_path)) {
        Ok(raw) => raw,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_all(vault_path: &Path, formats: &[CustomFormat]) -> Result<(), String> {
    let path = formats_path(vault_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create {}: {e}", parent.display()))?;
    }
    let json = serde_json::to_string_pretty(formats)
        .map_err(|e| format!("Failed to serialize research formats: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write {}: {e}", path.display()))
}

/// Upsert by id. Saving over an existing id replaces it rather than
/// appending a duplicate the picker would render twice.
pub fn save(vault_path: &Path, format: &CustomFormat) -> Result<Vec<CustomFormat>, String> {
    if format.id.trim().is_empty() {
        return Err("A format needs an id".to_string());
    }
    if format.title.trim().is_empty() {
        return Err("A format needs a title".to_string());
    }
    if format.instruction.trim().is_empty() {
        return Err("A format needs an instruction".to_string());
    }

    let mut formats = load(vault_path);
    match formats.iter_mut().find(|f| f.id == format.id) {
        Some(existing) => *existing = format.clone(),
        None => formats.push(format.clone()),
    }
    write_all(vault_path, &formats)?;
    Ok(formats)
}

/// Remove by id. Deleting an id that is not there is a no-op, not an error
/// — two windows deleting the same format should not surface a failure.
pub fn delete(vault_path: &Path, id: &str) -> Result<Vec<CustomFormat>, String> {
    let mut formats = load(vault_path);
    formats.retain(|f| f.id != id);
    write_all(vault_path, &formats)?;
    Ok(formats)
}

/// The instruction the research pipeline should use for `mode`: a saved
/// custom format's, or the built-in one.
pub fn resolve_instruction(vault_path: &Path, mode: &str) -> String {
    load(vault_path)
        .into_iter()
        .find(|f| f.id == mode)
        .map(|f| f.instruction)
        .unwrap_or_else(|| crate::rhizome_repo_research::mode_instruction(mode).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn format(id: &str, instruction: &str) -> CustomFormat {
        CustomFormat {
            id: id.to_string(),
            title: id.to_string(),
            instruction: instruction.to_string(),
        }
    }

    #[test]
    fn a_vault_with_no_formats_file_loads_an_empty_list() {
        let dir = TempDir::new().unwrap();
        assert!(load(dir.path()).is_empty());
    }

    #[test]
    fn a_corrupt_formats_file_loads_empty_rather_than_failing() {
        let dir = TempDir::new().unwrap();
        std::fs::create_dir_all(dir.path().join(".rhizome")).unwrap();
        std::fs::write(
            dir.path().join(".rhizome").join("research-formats.json"),
            "{ not json",
        )
        .unwrap();

        assert!(load(dir.path()).is_empty());
    }

    #[test]
    fn saving_creates_the_rhizome_directory_and_round_trips() {
        let dir = TempDir::new().unwrap();

        save(dir.path(), &format("my-lens", "Look at it sideways.")).unwrap();

        assert_eq!(
            load(dir.path()),
            vec![format("my-lens", "Look at it sideways.")]
        );
    }

    #[test]
    fn saving_the_same_id_replaces_rather_than_duplicates() {
        let dir = TempDir::new().unwrap();

        save(dir.path(), &format("my-lens", "First take.")).unwrap();
        let after = save(dir.path(), &format("my-lens", "Second take.")).unwrap();

        assert_eq!(after.len(), 1);
        assert_eq!(after[0].instruction, "Second take.");
    }

    #[test]
    fn saving_rejects_an_empty_title_id_or_instruction() {
        let dir = TempDir::new().unwrap();

        assert!(save(dir.path(), &format("", "x")).is_err());
        assert!(save(dir.path(), &format("id", "   ")).is_err());
        assert!(save(
            dir.path(),
            &CustomFormat {
                id: "id".to_string(),
                title: " ".to_string(),
                instruction: "x".to_string(),
            }
        )
        .is_err());
    }

    #[test]
    fn deleting_an_absent_id_is_not_an_error() {
        let dir = TempDir::new().unwrap();
        save(dir.path(), &format("keep", "Keep this.")).unwrap();

        let after = delete(dir.path(), "never-existed").unwrap();

        assert_eq!(after.len(), 1);
        assert_eq!(delete(dir.path(), "keep").unwrap().len(), 0);
    }

    #[test]
    fn resolve_instruction_falls_back_to_the_built_in_for_an_unsaved_mode() {
        let dir = TempDir::new().unwrap();

        assert_eq!(
            resolve_instruction(dir.path(), "eli5"),
            crate::rhizome_repo_research::mode_instruction("eli5")
        );
    }

    #[test]
    fn a_saved_format_shadows_a_built_in_with_the_same_id() {
        let dir = TempDir::new().unwrap();
        save(dir.path(), &format("eli5", "Explain it to a cat.")).unwrap();

        assert_eq!(
            resolve_instruction(dir.path(), "eli5"),
            "Explain it to a cat."
        );
    }

    #[test]
    fn a_custom_format_reaches_the_synthesis_prompt() {
        let dir = TempDir::new().unwrap();
        save(
            dir.path(),
            &format("q3-lens", "Read it as a Q3 planning doc."),
        )
        .unwrap();

        let prompt = crate::rhizome_repo_research::build_synthesis_prompt(
            "owner/repo",
            &resolve_instruction(dir.path(), "q3-lens"),
            "- finding one",
        );

        assert!(
            prompt.contains("Read it as a Q3 planning doc."),
            "got: {prompt}"
        );
    }

    #[test]
    fn slug_for_makes_one_id_out_of_a_typed_title() {
        assert_eq!(slug_for("  My Weird  Lens!! "), "my-weird-lens");
        assert_eq!(slug_for("Q3 Planning"), "q3-planning");
    }
}
