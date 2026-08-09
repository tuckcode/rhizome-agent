use super::{parse_md_file, parse_non_md_file, resolve_entry_dates};
use crate::git::GitDates;
use std::collections::HashMap;
use std::fs;
use std::thread;
use std::time::Duration;
use tempfile::TempDir;

#[test]
fn resolve_entry_dates_prefers_newer_filesystem_modified_time() {
    let resolved = resolve_entry_dates(Some(200), Some(50), Some((150, 25)));

    assert_eq!(resolved, (Some(200), Some(25)));
}

#[test]
fn resolve_entry_dates_keeps_newer_git_modified_time() {
    let resolved = resolve_entry_dates(Some(150), Some(50), Some((200, 25)));

    assert_eq!(resolved, (Some(200), Some(25)));
}

#[test]
fn parse_md_file_uses_newer_filesystem_modified_time_than_git() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("note.md");
    fs::write(&path, "# Note\n\nBody\n").unwrap();

    let (fs_modified, _, _) = super::file::read_file_metadata(&path).unwrap();
    let fs_modified = fs_modified.unwrap();
    let git_created = fs_modified.saturating_sub(600);
    let git_modified = fs_modified.saturating_sub(60);

    let entry = parse_md_file(&path, Some((git_modified, git_created))).unwrap();

    assert_eq!(entry.modified_at, Some(fs_modified));
    assert_eq!(entry.created_at, Some(git_created));
}

#[test]
fn parse_non_md_file_falls_back_to_git_modified_when_filesystem_missing_newer_date() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("assets/data.txt");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, "hello").unwrap();

    let (fs_modified, _, _) = super::file::read_file_metadata(&path).unwrap();
    let git_modified = fs_modified.unwrap().saturating_add(60);
    let git_created = git_modified.saturating_sub(600);

    let entry = parse_non_md_file(&path, Some((git_modified, git_created))).unwrap();

    assert_eq!(entry.modified_at, Some(git_modified));
    assert_eq!(entry.created_at, Some(git_created));
}

#[test]
fn scan_vault_sorts_by_newer_of_git_and_filesystem_modified_time() {
    let dir = TempDir::new().unwrap();
    let older_path = dir.path().join("older-git-newer-file.md");
    let newer_git_path = dir.path().join("newer-git-older-file.md");

    fs::write(&newer_git_path, "# Newer Git\n\nBody\n").unwrap();
    thread::sleep(Duration::from_secs(1));
    fs::write(&older_path, "# Newer File\n\nBody\n").unwrap();

    let (older_file_modified, _, _) = super::file::read_file_metadata(&older_path).unwrap();
    let older_file_modified = older_file_modified.unwrap();

    let git_dates = HashMap::from([
        (
            "older-git-newer-file.md".to_string(),
            GitDates {
                created_at: older_file_modified.saturating_sub(600),
                modified_at: older_file_modified.saturating_sub(120),
            },
        ),
        (
            "newer-git-older-file.md".to_string(),
            GitDates {
                created_at: older_file_modified.saturating_sub(700),
                modified_at: older_file_modified.saturating_sub(30),
            },
        ),
    ]);

    let entries = super::scan_vault(dir.path(), &git_dates).unwrap();
    let titles: Vec<_> = entries.iter().map(|entry| entry.title.as_str()).collect();

    assert_eq!(titles, vec!["Newer File", "Newer Git"]);
}
