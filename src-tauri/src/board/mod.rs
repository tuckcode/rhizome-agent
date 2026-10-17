//! Board over vault notes (ADR-0188, phase 1).
//!
//! A board is a saved view whose `presentation.type` is `board`. Its
//! cards are the Markdown notes the view matches, grouped by `Status`.
//! A move rewrites the `Status` line of one note and nothing else.
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

use crate::commands::vault::boundary::validate_view_filename;
use crate::rhizome_loop::tools::{atomic, sandbox};
use crate::vault::{evaluate_view, scan_vault_cached, scan_views, VaultEntry, ViewFile};

pub use status::set_status;

/// Board columns, in order. Saved board views use the same list.
pub const BOARD_COLUMNS: [&str; 4] = ["Not started", "In progress", "Blocked", "Done"];
/// Column for notes with no `Status` value.
pub const NO_STATUS_COLUMN: &str = "No status";
/// Default number of cards returned per column.
pub const DEFAULT_COLUMN_LIMIT: usize = 50;

const BOARD_PRESENTATION: &str = "board";

/// A saved view that shows as a board.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BoardSummary {
    pub filename: String,
    pub name: String,
}

/// One card: a note the board view matches.
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

/// Saved views in `views/` that show as a board, in sidebar order.
pub fn list_boards(vault: &Path) -> Vec<BoardSummary> {
    scan_views(vault)
        .into_iter()
        .filter(|view| validate_view_filename(&view.filename).is_ok())
        .filter(|view| is_board_view(vault, &view.filename))
        .map(|view| BoardSummary {
            filename: view.filename,
            name: view.definition.name,
        })
        .collect()
}

/// Cards of one board, grouped into columns. `limit` caps each column.
pub fn load_board(vault: &Path, filename: &str, limit: Option<usize>) -> Result<Board, String> {
    validate_view_filename(filename)?;
    let view = find_board_view(vault, filename)?;
    let entries = scan_vault_cached(vault)?;
    let mut cards: Vec<&VaultEntry> = evaluate_view(&view.definition, &entries)
        .into_iter()
        .map(|index| &entries[index])
        .filter(|entry| is_markdown_note(entry))
        .collect();
    let sort = SortSpec::parse(view.definition.sort.as_deref());
    cards.sort_by(|left, right| sort.compare(left, right));
    Ok(Board {
        filename: view.filename,
        name: view.definition.name,
        columns: group_cards(&cards, limit.unwrap_or(DEFAULT_COLUMN_LIMIT)),
    })
}

/// Set one note's `Status`. The note must be an existing `.md` file
/// inside the vault. Secret paths and `.git` are refused.
pub fn move_card(vault: &Path, requested: &str, to: &str) -> Result<CardMove, String> {
    let vault_str = vault
        .to_str()
        .ok_or_else(|| "Vault path is not valid UTF-8.".to_string())?;
    let path = sandbox::resolve_file_for_write(requested, Some(vault_str), &[])?;
    if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
        return Err(format!("Only .md notes can be moved: {requested}"));
    }
    atomic::preflight(&path)?;
    let before = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read {requested}: {error}"))?;
    let edit = set_status(&before, to)?;
    if edit.content != before {
        atomic::write_atomic(&path, edit.content.as_bytes())?;
    }
    let roots = sandbox::allowed_roots(Some(vault_str), &[])?;
    Ok(CardMove {
        path: sandbox::relative_to_root(&path, &roots),
        from: edit.from,
        to: to.trim().to_string(),
    })
}

fn find_board_view(vault: &Path, filename: &str) -> Result<ViewFile, String> {
    let view = scan_views(vault)
        .into_iter()
        .find(|view| view.filename == filename)
        .ok_or_else(|| format!("Board view not found: {filename}"))?;
    if !is_board_view(vault, filename) {
        return Err(format!("View is not a board: {filename}"));
    }
    Ok(view)
}

/// Reads `presentation.type` from the raw view YAML. `ViewDefinition`
/// has no presentation field yet, so this read stays lenient: any
/// parse failure means "not a board".
fn is_board_view(vault: &Path, filename: &str) -> bool {
    let Ok(raw) = fs::read_to_string(vault.join("views").join(filename)) else {
        return false;
    };
    let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(&raw) else {
        return false;
    };
    value
        .get("presentation")
        .and_then(|presentation| presentation.get("type"))
        .and_then(serde_yaml::Value::as_str)
        .is_some_and(|kind| kind.trim().eq_ignore_ascii_case(BOARD_PRESENTATION))
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

/// Known columns first, then unknown statuses A to Z, then "No status".
/// Cards keep the sorted order inside each column.
fn group_cards(cards: &[&VaultEntry], limit: usize) -> Vec<Column> {
    let mut known: Vec<Vec<&VaultEntry>> = vec![Vec::new(); BOARD_COLUMNS.len()];
    let mut unknown: HashMap<String, (String, Vec<&VaultEntry>)> = HashMap::new();
    let mut no_status = Vec::new();
    for entry in cards {
        let Some(status) = card_status(entry) else {
            no_status.push(*entry);
            continue;
        };
        match BOARD_COLUMNS
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

    let mut columns: Vec<Column> = BOARD_COLUMNS
        .iter()
        .zip(known)
        .map(|(name, entries)| column(name, &entries, limit))
        .collect();
    let mut extra: Vec<(String, (String, Vec<&VaultEntry>))> = unknown.into_iter().collect();
    extra.sort_by(|left, right| left.0.cmp(&right.0).then(left.1 .0.cmp(&right.1 .0)));
    columns.extend(
        extra
            .into_iter()
            .map(|(_, (name, entries))| column(&name, &entries, limit)),
    );
    if !no_status.is_empty() {
        columns.push(column(NO_STATUS_COLUMN, &no_status, limit));
    }
    columns
}

fn column(name: &str, entries: &[&VaultEntry], limit: usize) -> Column {
    Column {
        name: name.to_string(),
        total: entries.len(),
        cards: entries
            .iter()
            .take(limit)
            .map(|entry| Card {
                path: entry.path.clone(),
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
