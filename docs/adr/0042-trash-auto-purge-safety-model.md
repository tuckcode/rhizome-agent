---
type: ADR
id: "0042"
title: "Trash auto-purge safety model"
status: superseded
date: 2026-04-05
superseded_by: "0045"
---

## Context

The Trash view already shows a "Notes trashed more than 30 days ago will be permanently deleted" warning, but the app never actually enforces this. Users expect trashed notes to be cleaned up automatically after 30 days — if we advertise it, we must implement it.

This is one of the most dangerous operations in the app: a bug could cause irreversible data loss. The safety model must be explicit and conservative.

## Decision

**Auto-purge trashed notes older than 30 days on app launch and window focus (max once per hour), using OS trash (`trash::delete`) for soft-deletion, with mandatory 5-point safety validation per file and an audit log at `.laputa/purge.log`.**

### Safety checks (all must pass before deleting any file)

1. `_trashed: true` (or legacy aliases `Trashed`, `trashed`) is present in frontmatter and set to a truthy value
2. `_trashed_at` (or legacy aliases `Trashed at`, `trashed_at`) is present and parseable as a date
3. The parsed date is **strictly more than 30 days ago** (exactly 30 days = skip)
4. The file exists on disk at the expected path
5. The file's canonical path is inside the vault root (prevents path traversal)

If any check fails, the file is skipped with a warning log. The purge never aborts early — it processes all candidates independently.

### Deletion method

Use the `trash` crate (`trash::delete`) to move files to the OS trash (macOS Trash, Windows Recycle Bin) instead of `fs::remove_file`. This gives users a last-resort recovery path. If OS trash fails, fall back to `fs::remove_file` and log a warning.

### Trigger conditions

- On app launch (in `run_startup_tasks`)
- On window focus (`WindowEvent::Focused(true)`) — throttled to max once per hour using a `Mutex<Instant>` timestamp

### Audit log

Every purge run appends to `.laputa/purge.log` with timestamp, files checked count, files purged count, and each purged file path. Users can inspect this file to audit what was deleted and when.

## Options considered

- **Option A — OS trash via `trash` crate** (chosen): moves to OS trash, user can recover from Trash app. Adds a ~small dependency. Safe default.
- **Option B — `fs::remove_file` (permanent)**: simpler, no dependency, but no recovery path. Too risky for an automatic background operation.
- **Option C — Move to `.laputa/purged/` archive folder**: custom recovery mechanism, but clutters vault directory and users wouldn't know to look there.

## Consequences

- Users get the auto-cleanup behavior already advertised in the UI
- Accidentally trashed notes have a second chance via OS Trash
- The `trash` crate adds a platform-specific dependency (macOS: `NSFileManager`, Windows: `IFileOperation`, Linux: freedesktop spec)
- The hourly throttle prevents excessive disk I/O on rapid focus/unfocus cycles
- The purge log provides auditability but will grow over time (acceptable for a text log)
- Re-evaluate if users report OS Trash filling up with vault files
