use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::{Duration, UNIX_EPOCH};

use tempfile::TempDir;

use super::status::{read_status, StatusEdit, MAX_STATUS_CHARS};
use super::*;
use crate::rhizome_loop::BLOCKED_SECRET;

const BOARD_VIEW: &str = "name: Work\npresentation:\n  type: board\nfilters:\n  all: []\n";

fn write(dir: &Path, relative: &str, content: &str) -> PathBuf {
    let path = dir.join(relative);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(&path, content).unwrap();
    path
}

fn set_mtime(path: &Path, secs: u64) {
    File::options()
        .write(true)
        .open(path)
        .unwrap()
        .set_modified(UNIX_EPOCH + Duration::from_secs(secs))
        .unwrap();
}

fn card_note(dir: &Path, name: &str, status: Option<&str>, mtime: u64) -> PathBuf {
    let front = match status {
        Some(status) => format!("---\nStatus: {status}\n---\n"),
        None => String::new(),
    };
    let path = write(dir, &format!("{name}.md"), &format!("{front}# {name}\n"));
    set_mtime(&path, mtime);
    path
}

fn column_names(board: &Board) -> Vec<&str> {
    board.columns.iter().map(|c| c.name.as_str()).collect()
}

fn titles(column: &Column) -> Vec<&str> {
    column.cards.iter().map(|c| c.title.as_str()).collect()
}

fn edit(input: &str, status: &str) -> StatusEdit {
    set_status(input, status).unwrap()
}

// ---- Status write: byte-exact cases ----

#[test]
fn replaces_capitalized_status_in_place() {
    let out = edit(
        "---\ntitle: A\nStatus: Not started\ntags: [x]\n---\nbody\n",
        "Done",
    );
    assert_eq!(
        out.content,
        "---\ntitle: A\nStatus: Done\ntags: [x]\n---\nbody\n"
    );
    assert_eq!(out.from.as_deref(), Some("Not started"));
}

#[test]
fn replaces_lowercase_status_and_keeps_its_case() {
    let out = edit("---\nstatus: Blocked\n---\n", "In progress");
    assert_eq!(out.content, "---\nstatus: In progress\n---\n");
    assert_eq!(out.from.as_deref(), Some("Blocked"));
}

#[test]
fn adds_a_block_when_the_note_has_no_frontmatter() {
    let out = edit("# Title\nbody\n", "Done");
    assert_eq!(out.content, "---\nStatus: Done\n---\n# Title\nbody\n");
    assert_eq!(out.from, None);
}

#[test]
fn adds_a_block_to_an_empty_note() {
    assert_eq!(edit("", "Done").content, "---\nStatus: Done\n---\n");
}

#[test]
fn inserts_status_before_the_close_when_the_key_is_missing() {
    let out = edit("---\ntitle: A\n---\nbody\n", "Blocked");
    assert_eq!(out.content, "---\ntitle: A\nStatus: Blocked\n---\nbody\n");
    assert_eq!(out.from, None);
}

#[test]
fn keeps_crlf_line_endings() {
    let out = edit(
        "---\r\ntitle: A\r\nStatus: Done\r\n---\r\nbody\r\n",
        "Blocked",
    );
    assert_eq!(
        out.content,
        "---\r\ntitle: A\r\nStatus: Blocked\r\n---\r\nbody\r\n"
    );
    let out = edit("---\r\ntitle: A\r\n---\r\nbody\r\n", "Done");
    assert_eq!(
        out.content,
        "---\r\ntitle: A\r\nStatus: Done\r\n---\r\nbody\r\n"
    );
    let out = edit("body\r\nmore\r\n", "Done");
    assert_eq!(
        out.content,
        "---\r\nStatus: Done\r\n---\r\nbody\r\nmore\r\n"
    );
}

#[test]
fn keeps_a_bom() {
    let out = edit("\u{FEFF}---\nStatus: Done\n---\n", "Blocked");
    assert_eq!(out.content, "\u{FEFF}---\nStatus: Blocked\n---\n");
    let out = edit("\u{FEFF}body\n", "Done");
    assert_eq!(out.content, "\u{FEFF}---\nStatus: Done\n---\nbody\n");
}

#[test]
fn keeps_the_quote_style_of_a_quoted_value() {
    let out = edit("---\nStatus: \"Not started\"\n---\n", "In progress");
    assert_eq!(out.content, "---\nStatus: \"In progress\"\n---\n");
    assert_eq!(out.from.as_deref(), Some("Not started"));
    let out = edit("---\nStatus: 'It''s blocked'\n---\n", "Done");
    assert_eq!(out.content, "---\nStatus: 'Done'\n---\n");
    assert_eq!(out.from.as_deref(), Some("It's blocked"));
}

#[test]
fn quotes_a_value_that_is_not_plain_yaml() {
    assert_eq!(
        edit("---\nStatus: a\n---\n", "Done: soon").content,
        "---\nStatus: \"Done: soon\"\n---\n"
    );
    assert_eq!(
        edit("---\nStatus: a\n---\n", "true").content,
        "---\nStatus: \"true\"\n---\n"
    );
    assert_eq!(
        edit("---\nStatus: a\n---\n", "#1").content,
        "---\nStatus: \"#1\"\n---\n"
    );
}

#[test]
fn keeps_a_trailing_comment() {
    let out = edit("---\nStatus: Done # set by hand\n---\n", "Blocked");
    assert_eq!(out.content, "---\nStatus: Blocked # set by hand\n---\n");
    assert_eq!(out.from.as_deref(), Some("Done"));
}

#[test]
fn ignores_status_inside_a_block_scalar() {
    let input = "---\nnotes: |\n  Status: fake\n  more\nStatus: Done\n---\n";
    let out = edit(input, "Blocked");
    assert_eq!(
        out.content,
        "---\nnotes: |\n  Status: fake\n  more\nStatus: Blocked\n---\n"
    );
    let only_block = "---\nnotes: |\n  Status: fake\n---\n";
    assert_eq!(
        edit(only_block, "Done").content,
        "---\nnotes: |\n  Status: fake\nStatus: Done\n---\n"
    );
}

#[test]
fn ignores_status_inside_a_multiline_quoted_value() {
    let input = "---\nsummary: \"first line\nStatus: fake\nend\"\ntitle: A\n---\n";
    let out = edit(input, "Done");
    assert_eq!(
        out.content,
        "---\nsummary: \"first line\nStatus: fake\nend\"\ntitle: A\nStatus: Done\n---\n"
    );
    assert_eq!(out.from, None);
}

#[test]
fn replaces_a_multiline_status_value_with_one_line() {
    let out = edit(
        "---\nStatus:\n  - Done\n  - Blocked\ntitle: A\n---\n",
        "In progress",
    );
    assert_eq!(out.content, "---\nStatus: In progress\ntitle: A\n---\n");
    let out = edit("---\nStatus:\n- Done\ntitle: A\n---\n", "Blocked");
    assert_eq!(out.content, "---\nStatus: Blocked\ntitle: A\n---\n");
}

#[test]
fn never_adds_a_duplicate_key() {
    for input in [
        "---\nStatus: Done\n---\n",
        "---\nstatus: Done\n---\n",
        "---\ntitle: A\n---\n",
        "plain\n",
    ] {
        let out = edit(input, "Blocked");
        let keys = out
            .content
            .lines()
            .filter(|line| line.to_lowercase().starts_with("status:"))
            .count();
        assert_eq!(keys, 1, "input: {input:?}");
        let again = edit(&out.content, "Done");
        assert_eq!(again.content.matches("Done").count(), 1, "input: {input:?}");
    }
}

#[test]
fn leaves_keys_that_only_start_with_status_alone() {
    let out = edit("---\nStatusNote: x\nstatus_old: y\n---\n", "Done");
    assert_eq!(
        out.content,
        "---\nStatusNote: x\nstatus_old: y\nStatus: Done\n---\n"
    );
}

#[test]
fn refuses_unclosed_frontmatter_and_bad_values() {
    assert!(set_status("---\nStatus: Done\nbody\n", "Blocked").is_err());
    assert!(set_status("---\n---\n", "").is_err());
    assert!(set_status("---\n---\n", "a\nb").is_err());
}

#[test]
fn same_status_writes_the_same_bytes() {
    let input = "---\r\nStatus: Done\r\n---\r\n";
    assert_eq!(edit(input, "Done").content, input);
}

#[test]
fn matches_only_status_and_lowercase_status() {
    let out = edit("---\nSTATUS: Done\n---\n", "Blocked");
    assert_eq!(out.content, "---\nSTATUS: Done\nStatus: Blocked\n---\n");
    assert_eq!(out.from, None);
    let out = edit("---\nstatus: Done\n---\n", "Blocked");
    assert_eq!(out.content, "---\nstatus: Blocked\n---\n");
}

#[test]
fn keeps_blank_lines_inside_a_block_scalar_status() {
    let out = edit(
        "---\nStatus: |\n  Done\n\n  more\ntitle: A\n---\n",
        "Blocked",
    );
    assert_eq!(out.content, "---\nStatus: Blocked\ntitle: A\n---\n");
    let out = edit("---\nStatus: Done\n\ntitle: A\n---\n", "Blocked");
    assert_eq!(out.content, "---\nStatus: Blocked\n\ntitle: A\n---\n");
}

#[test]
fn a_dot_fence_closes_the_frontmatter() {
    let out = set_status("---\nStatus: Done\n...\nbody\n", "Blocked").unwrap();
    assert_eq!(out.content, "---\nStatus: Blocked\n...\nbody\n");
}

#[test]
fn caps_the_status_length() {
    let longest = "x".repeat(MAX_STATUS_CHARS);
    assert!(set_status("---\n---\n", &longest).is_ok());
    assert!(set_status("---\n---\n", &format!("{longest}x")).is_err());
}

// ---- move_card: path safety ----

fn no_tmp_left(dir: &Path) {
    let leftovers: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with(".rhz") && name.ends_with(".tmp"))
        .collect();
    assert!(leftovers.is_empty(), "leftover temp files: {leftovers:?}");
}

#[test]
fn move_card_writes_only_the_status_line() {
    let dir = TempDir::new().unwrap();
    let path = write(dir.path(), "a.md", "---\nStatus: Not started\n---\n# A\n");
    let moved = move_card(dir.path(), "a.md", "Done", None).unwrap();
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "---\nStatus: Done\n---\n# A\n"
    );
    assert_eq!(moved.path, "a.md");
    assert_eq!(moved.from.as_deref(), Some("Not started"));
    assert_eq!(moved.to, "Done");
    no_tmp_left(dir.path());
}

#[test]
fn move_card_to_the_same_status_does_not_touch_the_file() {
    let dir = TempDir::new().unwrap();
    let path = write(dir.path(), "a.md", "---\nStatus: Done\n---\n");
    set_mtime(&path, 1_000);
    let moved = move_card(dir.path(), "a.md", "Done", None).unwrap();
    assert_eq!(moved.from.as_deref(), Some("Done"));
    let mtime = fs::metadata(&path).unwrap().modified().unwrap();
    assert_eq!(mtime, UNIX_EPOCH + Duration::from_secs(1_000));
}

#[test]
fn move_card_checks_the_precondition() {
    let dir = TempDir::new().unwrap();
    let content = "---\nStatus: Done\n---\n";
    let path = write(dir.path(), "a.md", content);
    let stale = Precondition::ContentHash("0".repeat(64));
    assert!(move_card(dir.path(), "a.md", "Blocked", Some(&stale)).is_err());
    assert_eq!(fs::read_to_string(&path).unwrap(), content);
    let hash = format!("{:x}", Sha256::digest(content.as_bytes()));
    let fresh = Precondition::ContentHash(hash);
    move_card(dir.path(), "a.md", "Blocked", Some(&fresh)).unwrap();
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "---\nStatus: Blocked\n---\n"
    );
}

#[test]
fn move_card_refuses_parent_paths() {
    let root = TempDir::new().unwrap();
    let vault = root.path().join("vault");
    fs::create_dir(&vault).unwrap();
    let outside = write(root.path(), "outside.md", "---\nStatus: Done\n---\n");
    assert!(move_card(&vault, "../outside.md", "Blocked", None).is_err());
    assert!(move_card(&vault, "..\\outside.md", "Blocked", None).is_err());
    assert_eq!(
        fs::read_to_string(outside).unwrap(),
        "---\nStatus: Done\n---\n"
    );
}

#[test]
fn move_card_refuses_absolute_paths_outside_the_vault() {
    let vault = TempDir::new().unwrap();
    let other = TempDir::new().unwrap();
    let outside = write(other.path(), "note.md", "x\n");
    assert!(move_card(vault.path(), outside.to_str().unwrap(), "Done", None).is_err());
    assert_eq!(fs::read_to_string(outside).unwrap(), "x\n");
}

#[test]
fn move_card_accepts_an_absolute_path_inside_the_vault() {
    let dir = TempDir::new().unwrap();
    let path = write(dir.path(), "sub/a.md", "---\nStatus: Done\n---\n");
    let moved = move_card(dir.path(), path.to_str().unwrap(), "Blocked", None).unwrap();
    assert_eq!(moved.path, "sub/a.md");
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "---\nStatus: Blocked\n---\n"
    );
}

#[cfg(windows)]
#[test]
fn move_card_handles_windows_paths() {
    let root = TempDir::new().unwrap();
    let vault = root.path().join("vault");
    let inside = write(&vault, "sub\\a.md", "---\nStatus: Done\n---\n");
    let outside = write(root.path(), "outside.md", "x\n");
    let moved = move_card(&vault, "sub\\a.md", "Blocked", None).unwrap();
    assert_eq!(moved.path, "sub/a.md");
    assert_eq!(
        fs::read_to_string(&inside).unwrap(),
        "---\nStatus: Blocked\n---\n"
    );
    let drive_path = outside.to_str().unwrap().replace('/', "\\");
    assert!(move_card(&vault, &drive_path, "Done", None).is_err());
    assert!(move_card(&vault, "..\\outside.md", "Done", None).is_err());
    assert_eq!(fs::read_to_string(outside).unwrap(), "x\n");
}

#[cfg(unix)]
#[test]
fn move_card_refuses_a_symlink_that_leaves_the_vault() {
    let vault = TempDir::new().unwrap();
    let other = TempDir::new().unwrap();
    let outside = write(other.path(), "note.md", "x\n");
    std::os::unix::fs::symlink(&outside, vault.path().join("link.md")).unwrap();
    assert!(move_card(vault.path(), "link.md", "Done", None).is_err());
    assert_eq!(fs::read_to_string(outside).unwrap(), "x\n");
}

#[cfg(unix)]
#[test]
fn move_card_follows_a_symlink_that_stays_in_the_vault() {
    let dir = TempDir::new().unwrap();
    let target = write(dir.path(), "notes/a.md", "---\nStatus: Done\n---\n");
    let link = dir.path().join("link.md");
    std::os::unix::fs::symlink(&target, &link).unwrap();
    let moved = move_card(dir.path(), "link.md", "Blocked", None).unwrap();
    assert_eq!(moved.path, "notes/a.md");
    assert_eq!(
        fs::read_to_string(&target).unwrap(),
        "---\nStatus: Blocked\n---\n"
    );
    assert!(fs::symlink_metadata(&link)
        .unwrap()
        .file_type()
        .is_symlink());
}

#[test]
fn move_card_refuses_secret_and_git_paths() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), ".env", "KEY=1\n");
    write(dir.path(), ".env.md", "---\nStatus: Done\n---\n");
    write(dir.path(), ".git/config", "[core]\n");
    write(dir.path(), ".git/notes.md", "x\n");
    for requested in [".env", ".git/config", ".git/notes.md"] {
        assert!(
            move_card(dir.path(), requested, "Done", None).is_err(),
            "{requested}"
        );
    }
    let error = move_card(dir.path(), ".env.md", "Blocked", None).unwrap_err();
    assert!(error.contains(BLOCKED_SECRET), "{error}");
    assert_eq!(
        fs::read_to_string(dir.path().join(".env")).unwrap(),
        "KEY=1\n"
    );
    assert_eq!(
        fs::read_to_string(dir.path().join(".env.md")).unwrap(),
        "---\nStatus: Done\n---\n"
    );
}

#[test]
fn move_card_refuses_non_markdown_files() {
    let dir = TempDir::new().unwrap();
    for name in ["notes.txt", "notes.markdown", "board.yml", "notes"] {
        write(dir.path(), name, "Status: Done\n");
        assert!(
            move_card(dir.path(), name, "Blocked", None).is_err(),
            "{name}"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join(name)).unwrap(),
            "Status: Done\n"
        );
    }
}

#[test]
fn move_card_refuses_a_missing_note() {
    let dir = TempDir::new().unwrap();
    assert!(move_card(dir.path(), "missing.md", "Done", None).is_err());
    assert!(!dir.path().join("missing.md").exists());
}

#[cfg(unix)]
#[test]
fn move_card_refuses_a_read_only_note() {
    use std::os::unix::fs::PermissionsExt;
    let dir = TempDir::new().unwrap();
    let path = write(dir.path(), "a.md", "---\nStatus: Done\n---\n");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o444)).unwrap();
    let result = move_card(dir.path(), "a.md", "Blocked", None);
    fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "---\nStatus: Done\n---\n"
    );
    no_tmp_left(dir.path());
}

#[cfg(unix)]
#[test]
fn move_card_refuses_a_read_only_vault_folder() {
    use std::os::unix::fs::PermissionsExt;
    let dir = TempDir::new().unwrap();
    let folder = dir.path().join("locked");
    let path = write(dir.path(), "locked/a.md", "---\nStatus: Done\n---\n");
    fs::set_permissions(&folder, fs::Permissions::from_mode(0o555)).unwrap();
    let result = move_card(dir.path(), "locked/a.md", "Blocked", None);
    fs::set_permissions(&folder, fs::Permissions::from_mode(0o755)).unwrap();
    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "---\nStatus: Done\n---\n"
    );
    no_tmp_left(&folder);
}

// ---- Boards ----

fn column_named<'a>(board: &'a Board, name: &str) -> &'a Column {
    board
        .columns
        .iter()
        .find(|column| column.name == name)
        .unwrap_or_else(|| panic!("no column {name}"))
}

fn board_view_with(presentation_extra: &str) -> String {
    format!("name: Work\npresentation:\n  type: board\n{presentation_extra}filters:\n  all: []\n")
}

#[test]
fn list_boards_keeps_only_board_views() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    write(
        dir.path(),
        "views/list.yml",
        "name: List\nfilters:\n  all: []\n",
    );
    write(dir.path(), "views/broken.yml", "name: [unclosed\n");
    write(
        dir.path(),
        "views/odd.yml",
        "name: Odd\npresentation: board\nfilters:\n  all: []\n",
    );
    write(
        dir.path(),
        "views/owner.yml",
        &board_view_with("  groupBy: Owner\n"),
    );
    let boards = list_boards(dir.path());
    assert_eq!(
        boards,
        vec![BoardSummary {
            filename: "work.yml".into(),
            name: "Work".into()
        }]
    );
}

#[test]
fn group_by_must_be_status() {
    let dir = TempDir::new().unwrap();
    write(
        dir.path(),
        "views/a.yml",
        &board_view_with("  groupBy: Status\n"),
    );
    write(
        dir.path(),
        "views/b.yml",
        &board_view_with("  groupBy: status\n"),
    );
    write(
        dir.path(),
        "views/c.yml",
        &board_view_with("  groupBy: STATUS\n"),
    );
    write(
        dir.path(),
        "views/d.yml",
        &board_view_with("  groupBy: Owner\n"),
    );
    write(
        dir.path(),
        "views/e.yml",
        &board_view_with("  groupBy: [Status]\n"),
    );
    let names: Vec<String> = list_boards(dir.path())
        .into_iter()
        .map(|b| b.filename)
        .collect();
    assert_eq!(names, vec!["a.yml", "b.yml"]);
    assert!(load_board(dir.path(), "d.yml", None).is_err());
}

#[test]
fn load_board_refuses_bad_names_and_non_boards() {
    let dir = TempDir::new().unwrap();
    write(
        dir.path(),
        "views/list.yml",
        "name: List\nfilters:\n  all: []\n",
    );
    assert!(load_board(dir.path(), "../views/list.yml", None).is_err());
    assert!(load_board(dir.path(), "list.yaml", None).is_err());
    assert!(load_board(dir.path(), "missing.yml", None).is_err());
    assert!(load_board(dir.path(), "list.yml", None).is_err());
}

#[test]
fn columns_default_to_the_suggested_statuses() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    write(
        dir.path(),
        "views/text.yml",
        &board_view_with("  columns: Done\n"),
    );
    write(
        dir.path(),
        "views/empty.yml",
        &board_view_with("  columns: [' ', '']\n"),
    );
    card_note(dir.path(), "a", Some("Done"), 1_000);
    for view in ["work.yml", "text.yml", "empty.yml"] {
        let board = load_board(dir.path(), view, None).unwrap();
        assert_eq!(column_names(&board), SUGGESTED_STATUSES.to_vec(), "{view}");
    }
}

#[test]
fn columns_follow_the_view_order() {
    let dir = TempDir::new().unwrap();
    write(
        dir.path(),
        "views/work.yml",
        &board_view_with("  columns: [' Done ', Review, done, Backlog]\n"),
    );
    card_note(dir.path(), "a", Some("Backlog"), 1_000);
    card_note(dir.path(), "b", Some("done"), 1_000);
    card_note(dir.path(), "c", Some("Not started"), 1_000);
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(
        column_names(&board),
        vec!["Done", "Review", "Backlog", "Not started"]
    );
    assert_eq!(titles(column_named(&board, "Done")), vec!["b"]);
    assert_eq!(column_named(&board, "Review").total, 0);
    assert!(column_named(&board, "Review").cards.is_empty());
}

#[test]
fn load_board_groups_cards_into_columns() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    card_note(dir.path(), "a", Some("Done"), 1_000);
    card_note(dir.path(), "b", Some("done"), 3_000);
    card_note(dir.path(), "c", Some("In progress"), 2_000);
    card_note(dir.path(), "d", Some("Waiting"), 2_000);
    card_note(dir.path(), "e", Some("Later"), 2_000);
    card_note(dir.path(), "f", None, 2_000);
    write(dir.path(), "notes.txt", "Status: Done\n");

    let board = load_board(dir.path(), "work.yml", None).unwrap();
    let mut expected = SUGGESTED_STATUSES.to_vec();
    expected.extend(["Later", "Waiting", "No status"]);
    assert_eq!(column_names(&board), expected);
    assert_eq!(titles(column_named(&board, "Done")), vec!["b", "a"]);
    assert_eq!(column_named(&board, "Not started").total, 0);
    assert_eq!(titles(column_named(&board, "No status")), vec!["f"]);
}

#[test]
fn card_paths_are_vault_relative() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    write(
        dir.path(),
        "notes/deep/a.md",
        "---\nStatus: Done\n---\n# a\n",
    );
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    let paths: Vec<&str> = column_named(&board, "Done")
        .cards
        .iter()
        .map(|card| card.path.as_str())
        .collect();
    assert_eq!(paths, vec!["notes/deep/a.md"]);
}

#[test]
fn load_board_omits_the_no_status_column_when_empty() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    card_note(dir.path(), "a", Some("Done"), 1_000);
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert!(!column_names(&board).contains(&NO_STATUS_COLUMN));
}

#[test]
fn load_board_follows_the_view_sort() {
    let dir = TempDir::new().unwrap();
    write(
        dir.path(),
        "views/work.yml",
        "name: Work\nsort: title:asc\npresentation:\n  type: board\nfilters:\n  all: []\n",
    );
    card_note(dir.path(), "Charlie", Some("Done"), 3_000);
    card_note(dir.path(), "alpha", Some("Done"), 1_000);
    card_note(dir.path(), "Bravo", Some("Done"), 2_000);
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(
        titles(column_named(&board, "Done")),
        vec!["alpha", "Bravo", "Charlie"]
    );
}

#[test]
fn load_board_applies_the_view_filters() {
    let dir = TempDir::new().unwrap();
    write(
        dir.path(),
        "views/work.yml",
        "name: Work\npresentation:\n  type: board\nfilters:\n  all:\n    - field: status\n      op: not_equals\n      value: Done\n",
    );
    card_note(dir.path(), "a", Some("Done"), 1_000);
    card_note(dir.path(), "b", Some("Blocked"), 1_000);
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(titles(column_named(&board, "Blocked")), vec!["b"]);
    assert_eq!(column_named(&board, "Done").total, 0);
}

#[test]
fn load_board_caps_each_column() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    for index in 0..60 {
        card_note(
            dir.path(),
            &format!("n{index:02}"),
            Some("Done"),
            1_000 + index,
        );
    }
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    let done = column_named(&board, "Done");
    assert_eq!(done.cards.len(), DEFAULT_COLUMN_LIMIT);
    assert_eq!(done.total, 60);
    assert_eq!(done.cards[0].title, "n59");
    let small = load_board(dir.path(), "work.yml", Some(5)).unwrap();
    assert_eq!(column_named(&small, "Done").cards.len(), 5);
}

#[test]
fn moved_card_shows_in_its_new_column() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    card_note(dir.path(), "a", Some("Not started"), 1_000);
    move_card(dir.path(), "a.md", "Blocked", None).unwrap();
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(titles(column_named(&board, "Blocked")), vec!["a"]);
    assert_eq!(column_named(&board, "Not started").total, 0);
}

#[test]
fn sort_spec_parses_like_the_frontend() {
    let parse = |raw| SortSpec::parse(Some(raw));
    assert_eq!(SortSpec::parse(None), SortSpec::DEFAULT);
    assert_eq!(parse("garbage"), SortSpec::DEFAULT);
    assert_eq!(parse("title:sideways"), SortSpec::DEFAULT);
    assert_eq!(parse("property::asc"), SortSpec::DEFAULT);
    assert_eq!(
        parse("created:asc"),
        SortSpec {
            key: SortKey::Created,
            descending: false
        }
    );
    assert_eq!(
        parse("property:Priority:desc").key,
        SortKey::Property("Priority".into())
    );
    assert_eq!(
        parse("Priority:asc").key,
        SortKey::Property("Priority".into())
    );
}

#[test]
fn property_sort_puts_missing_values_last() {
    let dir = TempDir::new().unwrap();
    write(
        dir.path(),
        "views/work.yml",
        "name: Work\nsort: property:Priority:asc\npresentation:\n  type: board\nfilters:\n  all: []\n",
    );
    for (name, priority) in [("a", Some("3")), ("b", None), ("c", Some("1"))] {
        let front = match priority {
            Some(p) => format!("---\nStatus: Done\nPriority: {p}\n---\n"),
            None => "---\nStatus: Done\n---\n".to_string(),
        };
        write(
            dir.path(),
            &format!("{name}.md"),
            &format!("{front}# {name}\n"),
        );
    }
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(titles(column_named(&board, "Done")), vec!["c", "a", "b"]);
}

#[test]
fn board_with_5000_notes_caps_output() {
    let dir = TempDir::new().unwrap();
    write(
        dir.path(),
        "views/work.yml",
        &board_view_with("  columns: [Not started, In progress, Blocked, Done]\n"),
    );
    let statuses = ["Not started", "In progress", "Blocked", "Done", "Later"];
    for index in 0..5_000 {
        let status = statuses[index % statuses.len()];
        write(
            dir.path(),
            &format!("notes/n{index:04}.md"),
            &format!("---\nStatus: {status}\n---\n# n{index}\n"),
        );
    }
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(column_names(&board), statuses.to_vec());
    for column in &board.columns {
        assert_eq!(column.total, 1_000);
        assert_eq!(column.cards.len(), DEFAULT_COLUMN_LIMIT);
    }
}

// ---- Status splice for the checked save ----

#[test]
fn read_status_returns_the_top_level_value() {
    assert_eq!(
        read_status("---\nStatus: 'Done'\n---\n").as_deref(),
        Some("Done")
    );
    assert_eq!(
        read_status("---\nstatus: Blocked\n---\n").as_deref(),
        Some("Blocked")
    );
    assert_eq!(read_status("---\nnotes: |\n  Status: x\n---\n"), None);
    assert_eq!(read_status("Status: Done\n"), None);
}

#[test]
fn splice_needs_the_status_to_be_the_only_change() {
    let opened = "---\nStatus: Not started\n---\nbody\n";
    let disk = set_status(opened, "Done").unwrap().content;
    let buffer = "---\nStatus: Not started\n---\nbody edited\n";
    assert_eq!(
        splice_disk_status(&disk, buffer, opened).as_deref(),
        Some("---\nStatus: Done\n---\nbody edited\n")
    );
    let other = disk.replace("body", "changed elsewhere");
    assert_eq!(splice_disk_status(&other, buffer, opened), None);
    assert_eq!(splice_disk_status(&disk, buffer, "stale"), None);
    // No change on disk: the replay matches and the buffer is unchanged.
    assert_eq!(
        splice_disk_status(opened, buffer, opened).as_deref(),
        Some(buffer)
    );
}

/// A board move on any of these shapes replays exactly, so the save
/// splices it and does not report a false conflict.
#[test]
fn splice_replays_every_status_shape_a_move_writes() {
    for opened in [
        "---\ntitle: A\n---\nbody\n",
        "body\n",
        "",
        "\u{FEFF}body\r\n",
        "---\nStatus:\n---\nbody\n",
        "---\nStatus:\n  - Draft\n  - Review\n---\nbody\n",
        "---\nStatus: Draft\nstatus: Draft\n---\nbody\n",
        "---\nStatus: 'Draft' # was todo\n--- \nbody\n",
    ] {
        let disk = set_status(opened, "Done").unwrap().content;
        let buffer = format!("{opened}typed\n");
        let spliced = splice_disk_status(&disk, &buffer, opened)
            .unwrap_or_else(|| panic!("false conflict for {opened:?}"));
        assert_eq!(read_status(&spliced).as_deref(), Some("Done"), "{opened:?}");
        assert!(spliced.ends_with("typed\n"), "{opened:?} -> {spliced:?}");
    }
}

/// The editor and the board each wrote a different Status. Splicing would
/// drop the editor's value, so the save is a conflict.
#[test]
fn splice_conflicts_when_both_sides_edit_status() {
    let opened = "---\nStatus: Draft\n---\nbody\n";
    let disk = set_status(opened, "Done").unwrap().content;
    let buffer = "---\nStatus: Blocked\n---\nbody edited\n";
    assert_eq!(splice_disk_status(&disk, buffer, opened), None);
}

/// Both sides set the same status and the buffer has other edits too.
#[test]
fn splice_accepts_the_same_status_on_both_sides() {
    let opened = "---\nStatus: Draft\n---\nbody\n";
    let disk = set_status(opened, "Done").unwrap().content;
    let buffer = "---\nStatus: Done\n---\nbody edited\n";
    assert_eq!(
        splice_disk_status(&disk, buffer, opened).as_deref(),
        Some(buffer)
    );
}

/// The editor typed during a spliced save. Its next save sends the text
/// from before the splice as the baseline, and the splice runs again on
/// the newer buffer. PROBE4 to PROBE6 from the #242 hold review.
#[test]
fn splice_keeps_edits_typed_during_a_spliced_save() {
    let bom = "\u{FEFF}";
    for (before_splice, newer, want) in [
        (
            format!("{bom}---\nStatus: In progress\n---\nbody 1\n"),
            format!("{bom}---\nStatus: In progress\n---\nbody 12\n"),
            format!("{bom}---\nStatus: Done\n---\nbody 12\n"),
        ),
        (
            "---\nStatus: In progress\ntitle: A\n---\nbody 1\n".to_string(),
            "---\nStatus: In progress\ntitle: Renamed\n---\nbody 1\n".to_string(),
            "---\nStatus: Done\ntitle: Renamed\n---\nbody 1\n".to_string(),
        ),
        (
            "---\nStatus: In progress\n--- \nbody 1\n".to_string(),
            "---\nStatus: In progress\n--- \nbody 12\n".to_string(),
            "---\nStatus: Done\n--- \nbody 12\n".to_string(),
        ),
    ] {
        let disk = set_status(&before_splice, "Done").unwrap().content;
        assert_eq!(
            splice_disk_status(&disk, &newer, &before_splice).as_deref(),
            Some(want.as_str())
        );
    }
}

#[test]
fn move_board_card_precondition_uses_the_same_hash() {
    let dir = TempDir::new().unwrap();
    let content = "---\nStatus: Done\n---\n";
    write(dir.path(), "a.md", content);
    let fresh = Precondition::ContentHash(content_hash(content));
    move_card(dir.path(), "a.md", "Blocked", Some(&fresh)).unwrap();
    assert!(move_card(dir.path(), "a.md", "Done", Some(&fresh)).is_err());
}
