use super::*;
use std::fs;
use std::io::Write;
use std::path::Path;
use tempfile::TempDir;

pub(super) fn create_test_file(dir: &Path, name: &str, content: &str) {
    let file_path = dir.join(name);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(file_path).unwrap();
    file.write_all(content.as_bytes()).unwrap();
}

pub(super) fn parse_test_entry(dir: &TempDir, name: &str, content: &str) -> VaultEntry {
    create_test_file(dir.path(), name, content);
    parse_md_file(&dir.path().join(name), None).unwrap()
}

#[path = "mod_tests/archival_metadata.rs"]
mod archival_metadata;
#[path = "mod_tests/basics.rs"]
mod basics;
#[path = "mod_tests/complex_frontmatter.rs"]
mod complex_frontmatter;
#[path = "mod_tests/display_metadata.rs"]
mod display_metadata;
#[path = "mod_tests/folder_and_file_kind.rs"]
mod folder_and_file_kind;
#[path = "mod_tests/journal_type_visibility.rs"]
mod journal_type_visibility;
#[path = "mod_tests/real_vault_consistency.rs"]
mod real_vault_consistency;
#[path = "mod_tests/relationships.rs"]
mod relationships;
#[path = "mod_tests/scan_and_file_access.rs"]
mod scan_and_file_access;
#[path = "mod_tests/type_and_links.rs"]
mod type_and_links;

// Frontmatter update/delete tests are in frontmatter.rs
// save_image tests are in vault/image.rs
// purge_trash tests are in vault/trash.rs
// rename_note tests are in vault/rename.rs
