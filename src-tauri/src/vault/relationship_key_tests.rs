use super::*;
use std::fs;
use std::io::Write;
use tempfile::TempDir;

fn create_test_file(dir: &Path, name: &str, content: &str) {
    let file_path = dir.join(name);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(file_path).unwrap();
    file.write_all(content.as_bytes()).unwrap();
}

fn parse_test_entry(content: &str) -> VaultEntry {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "relationship-note.md", content);
    parse_md_file(&dir.path().join("relationship-note.md"), None).unwrap()
}

#[test]
fn prefers_snake_case_relationship_keys_for_convenience_fields() {
    let entry = parse_test_entry(
        "---\n\
belongs_to:\n\
  - \"[[canonical-parent]]\"\n\
\"Belongs to\":\n\
  - \"[[legacy-parent]]\"\n\
related_to:\n\
  - \"[[canonical-related]]\"\n\
\"Related to\":\n\
  - \"[[legacy-related]]\"\n\
---\n\
# Relationship Note\n",
    );

    assert_eq!(entry.belongs_to, vec!["[[canonical-parent]]"]);
    assert_eq!(entry.related_to, vec!["[[canonical-related]]"]);
    assert_eq!(
        entry.relationships.get("belongs_to"),
        Some(&vec!["[[canonical-parent]]".to_string()])
    );
    assert_eq!(
        entry.relationships.get("Belongs to"),
        Some(&vec!["[[legacy-parent]]".to_string()])
    );
}

#[test]
fn falls_back_to_legacy_relationship_keys_when_snake_case_is_absent() {
    let entry = parse_test_entry(
        "---\n\
Belongs to:\n\
  - \"[[legacy-parent]]\"\n\
Related to:\n\
  - \"[[legacy-related]]\"\n\
---\n\
# Relationship Note\n",
    );

    assert_eq!(entry.belongs_to, vec!["[[legacy-parent]]"]);
    assert_eq!(entry.related_to, vec!["[[legacy-related]]"]);
}
