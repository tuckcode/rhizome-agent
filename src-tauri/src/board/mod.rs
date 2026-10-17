//! Board over vault notes (ADR-0188, phase 1).
//!
//! A board is a saved view whose `presentation.type` is `board`. Its
//! cards are the Markdown notes the view matches, grouped by `Status`
//! into the view's columns (see `Presentation::as_board`). A move rewrites the `Status`
//! line of one note and nothing else.
//!
//! No Tauri command calls this module yet. A live move needs the
//! conflict-checked save first, or the editor's autosave would write
//! the old status back over it.
#![cfg_attr(not(test), allow(dead_code))]

mod status;
#[cfg(test)]
mod tests;

use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::commands::validate_view_filename;
use crate::rhizome_loop::{
    allowed_roots, preflight, relative_to_root, resolve_file_for_write, write_atomic,
};
use crate::vault::{evaluate_view, scan_vault_cached, scan_views, VaultEntry, ViewFile};

pub use status::set_status;

/// Columns when a board view has no usable `presentation.columns`.
/// Same list, same order, as `SUGGESTED_STATUSES` in
/// `src/utils/statusStyles.ts`.
pub const SUGGESTED_STATUSES: [&str; 8] = [
    "Not started",
    "In progress",
    "Active",
    "Done",
    "Blocked",
    "Paused",
    "Draft",
    "Archived",
];
/// Column for notes with no `Status` value.
pub const NO_STATUS_COLUMN: &str = "No status";
/// Default number of cards returned per column.
pub const DEFAULT_COLUMN_LIMIT: usize = 50;

/// A saved view that shows as a board.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BoardSummary {
    pub filename: String,
    pub name: String,
}

/// One card: a note the board view matches. `path` is vault-relative.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub path: String,
    pub title: String,
    pub status: Option<String>,
    pub modified_at: Option<u64>,
}

/// One column. `total` counts every matching card, `cards` holds at
/// most the column limit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Column {
    pub name: String,
    pub cards: Vec<Card>,
    pub total: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Board {
    pub filename: String,
    pub name: String,
    pub columns: Vec<Column>,
}

/// Result of one card move.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CardMove {
    pub path: String,
    pub from: Option<String>,
    pub to: String,
}

/// What a caller expects on disk before a move. The conflict-checked
/// save (PR C) passes this. `None` skips the check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Precondition {
    /// SHA-256 of the note's bytes, lowercase hex.
    ContentHash(String),
}

/// Board settings for one view.
#[derive(Debug, Clone, PartialEq, Eq)]
struct BoardConfig {
    columns: Vec<String>,
}

/// Saved views in `views/` that show as a board, in sidebar order.
pub fn list_boards(vault: &Path) -> Vec<BoardSummary> {
    scan_views(vault)
        .into_iter()
        .filter(|view| validate_view_filename(&view.filename).is_ok())
        .filter(|view| board_config(view).is_some())
        .map(|view| BoardSummary {
            filename: view.filename,
            name: view.definition.name,
        })
        .collect()
}

/// Cards of one board, grouped into columns. `limit` caps each column.
pub fn load_board(vault: &Path, filename: &str, limit: Option<usize>) -> Result<Board, String> {
    validate_view_filename(filename)?;
    let (view, config) = find_board_view(vault, filename)?;
    let roots = allowed_roots(Some(vault_str(vault)?), &[])?;
    let entries = scan_vault_cached(vault)?;
    let mut cards: Vec<&VaultEntry> = evaluate_view(&view.definition, &entries)
        .into_iter()
        .map(|index| &entries[index])
        .filter(|entry| is_markdown_note(entry))
        .collect();
    let sort = SortSpec::parse(view.definition.sort.as_deref());
    cards.sort_by(|left, right| sort.compare(left, right));
    let card_path = |entry: &VaultEntry| {
        let path = Path::new(&entry.path);
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        relative_to_root(&canonical, &roots)
    };
    Ok(Board {
        filename: view.filename,
        name: view.definition.name,
        columns: group_cards(
            &cards,
            &config.columns,
            limit.unwrap_or(DEFAULT_COLUMN_LIMIT),
            &card_path,
        ),
    })
}

/// Set one note's `Status`. The note must be an existing `.md` file
/// inside the vault. Secret paths and `.git` are refused. A move to
/// the status the note already has writes nothing.
pub fn move_card(
    vault: &Path,
    requested: &str,
    to: &str,
    expected: Option<&Precondition>,
) -> Result<CardMove, String> {
    let vault_str = vault_str(vault)?;
    let path = resolve_file_for_write(requested, Some(vault_str), &[])?;
    if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
        return Err(format!("Only .md notes can be moved: {requested}"));
    }
    preflight(&path)?;
    let before = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read {requested}: {error}"))?;
    check_precondition(expected, &before, requested)?;
    let edit = set_status(&before, to)?;
    if edit.content != before {
        write_atomic(&path, edit.content.as_bytes())?;
    }
    let roots = allowed_roots(Some(vault_str), &[])?;
    Ok(CardMove {
        path: relative_to_root(&path, &roots),
        from: edit.from,
        to: to.trim().to_string(),
    })
}

fn vault_str(vault: &Path) -> Result<&str, String> {
    vault
        .to_str()
        .ok_or_else(|| "Vault path is not valid UTF-8.".to_string())
}

fn check_precondition(
    expected: Option<&Precondition>,
    before: &str,
    requested: &str,
) -> Result<(), String> {
    match expected {
        None => Ok(()),
        Some(Precondition::ContentHash(hash)) => {
            let actual = format!("{:x}", Sha256::digest(before.as_bytes()));
            if actual.eq_ignore_ascii_case(hash.trim()) {
                Ok(())
            } else {
                Err(format!(
                    "Note changed on disk since it was read: {requested}"
                ))
            }
        }
    }
}

fn find_board_view(vault: &Path, filename: &str) -> Result<(ViewFile, BoardConfig), String> {
    let view = scan_views(vault)
        .into_iter()
        .find(|view| view.filename == filename)
        .ok_or_else(|| format!("Board view not found: {filename}"))?;
    let config = board_config(&view).ok_or_else(|| format!("View is not a board: {filename}"))?;
    Ok((view, config))
}

/// Board settings from the view's typed `presentation` field.
fn board_config(view: &ViewFile) -> Option<BoardConfig> {
    let board = view.definition.presentation.as_ref()?.as_board()?;
    Some(BoardConfig {
        columns: board.columns,
    })
}

fn is_markdown_note(entry: &VaultEntry) -> bool {
    entry.file_kind == "markdown" && entry.path.ends_with(".md")
}

fn card_status(entry: &VaultEntry) -> Option<&str> {
    entry
        .status
        .as_deref()
        .map(str::trim)
        .filter(|status| !status.is_empty())
}

/// Configured columns first, then unknown statuses A to Z, then
/// "No status". Cards keep the sorted order inside each column.
fn group_cards(
    cards: &[&VaultEntry],
    names: &[String],
    limit: usize,
    card_path: &dyn Fn(&VaultEntry) -> String,
) -> Vec<Column> {
    let mut known: Vec<Vec<&VaultEntry>> = vec![Vec::new(); names.len()];
    let mut unknown: HashMap<String, (String, Vec<&VaultEntry>)> = HashMap::new();
    let mut no_status = Vec::new();
    for entry in cards {
        let Some(status) = card_status(entry) else {
            no_status.push(*entry);
            continue;
        };
        match names
            .iter()
            .position(|column| column.eq_ignore_ascii_case(status))
        {
            Some(index) => known[index].push(*entry),
            None => unknown
                .entry(status.to_lowercase())
                .or_insert_with(|| (status.to_string(), Vec::new()))
                .1
                .push(*entry),
        }
    }

    let mut columns: Vec<Column> = names
        .iter()
        .zip(known)
        .map(|(name, entries)| column(name, &entries, limit, card_path))
        .collect();
    let mut extra: Vec<(String, (String, Vec<&VaultEntry>))> = unknown.into_iter().collect();
    extra.sort_by(|left, right| left.0.cmp(&right.0).then(left.1 .0.cmp(&right.1 .0)));
    columns.extend(
        extra
            .into_iter()
            .map(|(_, (name, entries))| column(&name, &entries, limit, card_path)),
    );
    if !no_status.is_empty() {
        columns.push(column(NO_STATUS_COLUMN, &no_status, limit, card_path));
    }
    columns
}

fn column(
    name: &str,
    entries: &[&VaultEntry],
    limit: usize,
    card_path: &dyn Fn(&VaultEntry) -> String,
) -> Column {
    Column {
        name: name.to_string(),
        total: entries.len(),
        cards: entries
            .iter()
            .take(limit)
            .map(|entry| Card {
                path: card_path(entry),
                title: entry.title.clone(),
                status: card_status(entry).map(str::to_string),
                modified_at: entry.modified_at,
            })
            .collect(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum SortKey {
    Modified,
    Created,
    Title,
    Status,
    Property(String),
}

/// View sort, stored as `option:direction` (for example `modified:desc`
/// or `property:Priority:asc`). Same parse as the frontend's
/// `parseSortConfig`. Default: modified, newest first.
#[derive(Debug, Clone, PartialEq, Eq)]
struct SortSpec {
    key: SortKey,
    descending: bool,
}

impl SortSpec {
    const DEFAULT: SortSpec = SortSpec {
        key: SortKey::Modified,
        descending: true,
    };

    fn parse(raw: Option<&str>) -> SortSpec {
        let Some(raw) = raw.map(str::trim).filter(|raw| !raw.is_empty()) else {
            return Self::DEFAULT;
        };
        let Some((option, direction)) = raw.rsplit_once(':') else {
            return Self::DEFAULT;
        };
        let descending = match direction {
            "asc" => false,
            "desc" => true,
            _ => return Self::DEFAULT,
        };
        let key = match option {
            "" | "property:" => return Self::DEFAULT,
            "modified" => SortKey::Modified,
            "created" => SortKey::Created,
            "title" => SortKey::Title,
            "status" => SortKey::Status,
            other => SortKey::Property(other.strip_prefix("property:").unwrap_or(other).into()),
        };
        SortSpec { key, descending }
    }

    /// Missing values sort last in both directions. Ties fall back to path.
    fn compare(&self, left: &VaultEntry, right: &VaultEntry) -> Ordering {
        let ordering = match &self.key {
            SortKey::Modified => self.option_order(left.modified_at, right.modified_at),
            SortKey::Created => self.option_order(left.created_at, right.created_at),
            SortKey::Title => {
                self.direct(left.title.to_lowercase().cmp(&right.title.to_lowercase()))
            }
            SortKey::Status => self.option_order(
                card_status(left).map(str::to_lowercase),
                card_status(right).map(str::to_lowercase),
            ),
            SortKey::Property(name) => {
                self.option_order(property_key(left, name), property_key(right, name))
            }
        };
        ordering.then_with(|| left.path.cmp(&right.path))
    }

    fn direct(&self, ordering: Ordering) -> Ordering {
        if self.descending {
            ordering.reverse()
        } else {
            ordering
        }
    }

    fn option_order<T: Ord>(&self, left: Option<T>, right: Option<T>) -> Ordering {
        match (left, right) {
            (Some(left), Some(right)) => self.direct(left.cmp(&right)),
            (Some(_), None) => Ordering::Less,
            (None, Some(_)) => Ordering::Greater,
            (None, None) => Ordering::Equal,
        }
    }
}

/// Sort key for a custom property. Numbers sort before text.
#[derive(Debug, Clone)]
enum PropertyKey {
    Number(f64),
    Text(String),
}

impl PartialEq for PropertyKey {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}

impl Eq for PropertyKey {}

impl PartialOrd for PropertyKey {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PropertyKey {
    fn cmp(&self, other: &Self) -> Ordering {
        match (self, other) {
            (PropertyKey::Number(left), PropertyKey::Number(right)) => left.total_cmp(right),
            (PropertyKey::Number(_), PropertyKey::Text(_)) => Ordering::Less,
            (PropertyKey::Text(_), PropertyKey::Number(_)) => Ordering::Greater,
            (PropertyKey::Text(left), PropertyKey::Text(right)) => left.cmp(right),
        }
    }
}

fn property_key(entry: &VaultEntry, name: &str) -> Option<PropertyKey> {
    let value = entry
        .properties
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(name))
        .map(|(_, value)| value)?;
    match value {
        serde_json::Value::Number(number) => number.as_f64().map(PropertyKey::Number),
        serde_json::Value::String(text) if !text.trim().is_empty() => {
            Some(PropertyKey::Text(text.trim().to_lowercase()))
        }
        serde_json::Value::Bool(flag) => Some(PropertyKey::Text(flag.to_string())),
        _ => None,
    }
}
