use std::path::Path;

use globset::{GlobBuilder, GlobSet, GlobSetBuilder};
use ignore::{DirEntry, Walk, WalkBuilder};

use super::sandbox;

/// Stop walking after this many directory entries, even if the
/// result cap has not been hit (gitignore skips still cost).
pub const WALK_BUDGET: usize = 10_000;

/// Walk `root` with `.gitignore` honoured and without following
/// symlinks. Parent gitignores outside the root are ignored.
pub fn gitignore_walk(root: &Path) -> Walk {
    gitignore_walker(root, None)
}

pub fn gitignore_walk_depth(root: &Path, depth: usize) -> Walk {
    gitignore_walker(root, Some(depth))
}

fn gitignore_walker(root: &Path, max_depth: Option<usize>) -> Walk {
    let mut builder = WalkBuilder::new(root);
    builder
        .standard_filters(false)
        .hidden(false)
        .require_git(false)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(false)
        .parents(false)
        .follow_links(false)
        .filter_entry(keep_entry);
    if let Some(depth) = max_depth {
        builder.max_depth(Some(depth));
    }
    builder.build()
}

fn keep_entry(entry: &DirEntry) -> bool {
    entry.depth() == 0 || !sandbox::is_secret(entry.path())
}

/// Compile a glob. A pattern with no `/` also matches at any depth
/// (`*.md` matches `dir/a.md`), like ripgrep `--glob`.
pub fn compile_globs(pattern: &str) -> Result<GlobSet, String> {
    let trimmed = pattern.trim();
    if trimmed.is_empty() {
        return Err("glob pattern is required.".into());
    }
    let mut builder = GlobSetBuilder::new();
    builder.add(parse_glob(trimmed)?);
    if !trimmed.contains('/') && !trimmed.starts_with("**") {
        builder.add(parse_glob(&format!("**/{trimmed}"))?);
    }
    builder
        .build()
        .map_err(|error| format!("Invalid glob pattern: {error}"))
}

fn parse_glob(pattern: &str) -> Result<globset::Glob, String> {
    GlobBuilder::new(pattern)
        .literal_separator(true)
        .build()
        .map_err(|error| format!("Invalid glob pattern: {error}"))
}

pub fn is_file_entry(entry: &DirEntry) -> bool {
    entry.file_type().is_some_and(|kind| kind.is_file())
}

pub fn is_dir_entry(entry: &DirEntry) -> bool {
    entry.file_type().is_some_and(|kind| kind.is_dir())
}
