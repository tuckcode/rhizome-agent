---
type: ADR
id: "0039"
title: "Use git history for note creation and modification dates"
status: active
date: 2026-04-02
---

## Context

Filesystem metadata (`ctime`/`mtime`) is unreliable for a git-backed vault. After `git clone`, `git pull`, or iCloud sync, files appear "newly created" even when they have years of history. This causes incorrect sort ordering in the note list and wrong dates in the inspector panel.

## Decision

**Use `git log` to determine the true creation and modification dates for notes.** A single batch `git log --format="COMMIT %aI" --name-only` command walks the full commit history and extracts:

- **modified_at** = author date of the most recent commit that touched the file
- **created_at** = author date of the oldest commit that touched the file

The batch approach runs once per vault scan (not per-file), parsing the log output in a single linear pass. Results are stored in a `HashMap<String, GitDates>` keyed by vault-relative path and threaded through the existing `parse_md_file` / `scan_vault` / `scan_vault_cached` pipeline.

### Fallback to filesystem dates

- **Non-git vaults** (no `.git` directory): all notes use filesystem `mtime`/`ctime`.
- **Uncommitted new files**: not in git log output, so filesystem dates are used automatically.
- **Single-file reloads** (`reload_entry`): use filesystem dates since the file was just saved and the most accurate timestamp is the filesystem one.

## Options considered

- **Per-file `git log`**: Correct but O(n) subprocesses. Too slow for vaults with 500+ notes.
- **Frontmatter dates** (e.g., `created: 2025-01-15`): Requires user discipline. Not automatic. Breaks when users forget to set them.
- **Filesystem metadata** (current): Unreliable across clones, pulls, and cloud sync.
- **Single batch `git log`** (chosen): One subprocess, O(n) parsing, correct dates for all committed files.

## Consequences

- Note sort-by-created and sort-by-modified now reflect true git history, stable across clones and machines.
- First vault scan runs one `git log` over the full history. For a vault with 1000 files and 500 commits, output is ~100KB and parses in <100ms.
- Renamed files get `created_at` set to the rename commit date (not the original creation). Acceptable trade-off vs. the complexity of rename tracking.
- `CACHE_VERSION` bumped from 9 to 10 to force a full rescan with git dates on upgrade.
