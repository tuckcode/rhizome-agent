use super::*;
use std::collections::HashMap;

#[test]
fn test_scan_vault_preserves_explicit_journal_type_definition() {
    let dir = TempDir::new().unwrap();
    create_test_file(
        dir.path(),
        "journal.md",
        "---\ntype: Type\nvisible: true\n---\n# Journal\n",
    );
    create_test_file(
        dir.path(),
        "2026-03-11.md",
        "---\ntitle: March 11\ntype: Journal\n---\n# March 11\n",
    );

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(entries.len(), 2);

    let journal_type = entries
        .iter()
        .find(|entry| entry.filename == "journal.md")
        .expect("expected the explicit Journal type file to be scanned");
    assert_eq!(journal_type.title, "Journal");
    assert_eq!(journal_type.is_a.as_deref(), Some("Type"));
    assert_eq!(journal_type.visible, Some(true));

    let journal_note = entries
        .iter()
        .find(|entry| entry.filename == "2026-03-11.md")
        .expect("expected the Journal note to be scanned");
    assert_eq!(journal_note.is_a.as_deref(), Some("Journal"));
    assert_eq!(
        journal_note.relationships.get("Type"),
        Some(&vec!["[[journal]]".to_string()]),
    );
}
