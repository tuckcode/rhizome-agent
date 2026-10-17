use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::{Duration, UNIX_EPOCH};

use tempfile::TempDir;

use super::status::StatusEdit;
use super::*;

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
        "---\nSTATUS: Done\n---\n",
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

// ---- move_card: path safety ----

#[test]
fn move_card_writes_only_the_status_line() {
    let dir = TempDir::new().unwrap();
    let path = write(dir.path(), "a.md", "---\nStatus: Not started\n---\n# A\n");
    let moved = move_card(dir.path(), "a.md", "Done").unwrap();
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "---\nStatus: Done\n---\n# A\n"
    );
    assert_eq!(moved.path, "a.md");
    assert_eq!(moved.from.as_deref(), Some("Not started"));
    assert_eq!(moved.to, "Done");
}

#[test]
fn move_card_refuses_parent_paths() {
    let root = TempDir::new().unwrap();
    let vault = root.path().join("vault");
    fs::create_dir(&vault).unwrap();
    let outside = write(root.path(), "outside.md", "---\nStatus: Done\n---\n");
    assert!(move_card(&vault, "../outside.md", "Blocked").is_err());
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
    assert!(move_card(vault.path(), outside.to_str().unwrap(), "Done").is_err());
    assert_eq!(fs::read_to_string(outside).unwrap(), "x\n");
}

#[cfg(unix)]
#[test]
fn move_card_refuses_a_symlink_that_leaves_the_vault() {
    let vault = TempDir::new().unwrap();
    let other = TempDir::new().unwrap();
    let outside = write(other.path(), "note.md", "x\n");
    std::os::unix::fs::symlink(&outside, vault.path().join("link.md")).unwrap();
    assert!(move_card(vault.path(), "link.md", "Done").is_err());
    assert_eq!(fs::read_to_string(outside).unwrap(), "x\n");
}

#[test]
fn move_card_refuses_secret_and_git_paths() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), ".env", "KEY=1\n");
    write(dir.path(), ".git/config", "[core]\n");
    write(dir.path(), ".git/notes.md", "x\n");
    for requested in [".env", ".git/config", ".git/notes.md"] {
        assert!(
            move_card(dir.path(), requested, "Done").is_err(),
            "{requested}"
        );
    }
    assert_eq!(
        fs::read_to_string(dir.path().join(".env")).unwrap(),
        "KEY=1\n"
    );
}

#[test]
fn move_card_refuses_non_markdown_files() {
    let dir = TempDir::new().unwrap();
    for name in ["notes.txt", "notes.markdown", "board.yml", "notes"] {
        write(dir.path(), name, "Status: Done\n");
        assert!(move_card(dir.path(), name, "Blocked").is_err(), "{name}");
        assert_eq!(
            fs::read_to_string(dir.path().join(name)).unwrap(),
            "Status: Done\n"
        );
    }
}

#[test]
fn move_card_refuses_a_missing_note() {
    let dir = TempDir::new().unwrap();
    assert!(move_card(dir.path(), "missing.md", "Done").is_err());
    assert!(!dir.path().join("missing.md").exists());
}

#[cfg(unix)]
#[test]
fn move_card_refuses_a_read_only_note() {
    use std::os::unix::fs::PermissionsExt;
    let dir = TempDir::new().unwrap();
    let path = write(dir.path(), "a.md", "---\nStatus: Done\n---\n");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o444)).unwrap();
    let result = move_card(dir.path(), "a.md", "Blocked");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "---\nStatus: Done\n---\n"
    );
}

#[cfg(unix)]
#[test]
fn move_card_refuses_a_read_only_vault_folder() {
    use std::os::unix::fs::PermissionsExt;
    let dir = TempDir::new().unwrap();
    let folder = dir.path().join("locked");
    let path = write(dir.path(), "locked/a.md", "---\nStatus: Done\n---\n");
    fs::set_permissions(&folder, fs::Permissions::from_mode(0o555)).unwrap();
    let result = move_card(dir.path(), "locked/a.md", "Blocked");
    fs::set_permissions(&folder, fs::Permissions::from_mode(0o755)).unwrap();
    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "---\nStatus: Done\n---\n"
    );
}

// ---- Boards ----

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
fn load_board_groups_cards_into_columns() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    card_note(dir.path(), "a", Some("Done"), 1_000);
    card_note(dir.path(), "b", Some("done"), 3_000);
    card_note(dir.path(), "c", Some("In progress"), 2_000);
    card_note(dir.path(), "d", Some("Waiting"), 2_000);
    card_note(dir.path(), "e", Some("Archive"), 2_000);
    card_note(dir.path(), "f", None, 2_000);
    write(dir.path(), "notes.txt", "Status: Done\n");

    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(
        column_names(&board),
        vec![
            "Not started",
            "In progress",
            "Blocked",
            "Done",
            "Archive",
            "Waiting",
            "No status"
        ]
    );
    assert_eq!(titles(&board.columns[3]), vec!["b", "a"]);
    assert_eq!(board.columns[0].total, 0);
    assert_eq!(titles(&board.columns[6]), vec!["f"]);
}

#[test]
fn load_board_omits_the_no_status_column_when_empty() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    card_note(dir.path(), "a", Some("Done"), 1_000);
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(column_names(&board), BOARD_COLUMNS.to_vec());
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
    assert_eq!(titles(&board.columns[3]), vec!["alpha", "Bravo", "Charlie"]);
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
    assert_eq!(titles(&board.columns[2]), vec!["b"]);
    assert_eq!(board.columns[3].total, 0);
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
    assert_eq!(board.columns[3].cards.len(), DEFAULT_COLUMN_LIMIT);
    assert_eq!(board.columns[3].total, 60);
    assert_eq!(board.columns[3].cards[0].title, "n59");
    let small = load_board(dir.path(), "work.yml", Some(5)).unwrap();
    assert_eq!(small.columns[3].cards.len(), 5);
}

#[test]
fn moved_card_shows_in_its_new_column() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    card_note(dir.path(), "a", Some("Not started"), 1_000);
    move_card(dir.path(), "a.md", "Blocked").unwrap();
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    assert_eq!(titles(&board.columns[2]), vec!["a"]);
    assert_eq!(board.columns[0].total, 0);
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
    assert_eq!(titles(&board.columns[3]), vec!["c", "a", "b"]);
}

/// Run with `cargo test --release -- --ignored board_with_5000_notes`.
#[test]
#[ignore]
fn board_with_5000_notes_caps_output() {
    let dir = TempDir::new().unwrap();
    write(dir.path(), "views/work.yml", BOARD_VIEW);
    let statuses = ["Not started", "In progress", "Blocked", "Done", "Later"];
    for index in 0..5_000 {
        let status = statuses[index % statuses.len()];
        write(
            dir.path(),
            &format!("notes/n{index:04}.md"),
            &format!("---\nStatus: {status}\n---\n# n{index}\n"),
        );
    }
    let started = std::time::Instant::now();
    let board = load_board(dir.path(), "work.yml", None).unwrap();
    let elapsed = started.elapsed();
    assert_eq!(board.columns.len(), 5);
    for column in &board.columns {
        assert_eq!(column.total, 1_000);
        assert_eq!(column.cards.len(), DEFAULT_COLUMN_LIMIT);
    }
    eprintln!("5000-note board loaded in {elapsed:?}");
}
