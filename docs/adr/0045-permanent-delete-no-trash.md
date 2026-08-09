---
type: ADR
id: "0045"
title: "Permanent delete with confirm modal — no Trash system"
status: active
date: 2026-04-07
supersedes: "0042"
---

## Context

ADR-0042 designed a Trash auto-purge safety model (soft-delete with 30-day retention, OS trash via `trash` crate, audit log). This was built on top of a Trash system that treated deletion as a two-phase operation: move to trash → auto-purge after 30 days.

The Trash system was subsequently identified as unnecessary complexity: it required `trashed`/`trashedAt` frontmatter fields, sidebar filtering, editor banners, inspector components, dedicated smoke tests, and a `trash` crate dependency. The safety guarantee users actually need is a **confirmation prompt before irreversible action**, not a soft-delete buffer — especially given notes live in a git repo (vault git history is already a recovery mechanism per ADR-0034 and ADR-0014).

Commit `e581ad36` on 2026-04-06 removed the entire Trash system (123 files changed, ~3164 lines deleted).

## Decision

**Delete is permanent and immediate, gated only by a confirmation modal (`useDeleteActions`). Notes with `trashed: true` in existing vault frontmatter are treated as normal notes (the flag is ignored by the parser). The `trash` crate dependency is removed.**

The confirmation modal is the sole safety gate. No soft-delete, no Trash view, no auto-purge scheduler, no `.laputa/purge.log`.

## Options considered

- **Option A — Permanent delete + confirm modal** (chosen): simple, honest, no hidden state. Git history provides recovery. Removes ~3000 lines of code and a platform-specific dependency. Downside: no in-app recovery path for users who don't know about git.
- **Option B — OS Trash via `trash` crate** (ADR-0042, now superseded): soft-delete to OS Trash, user can recover from macOS Trash app. Downside: additional dependency, complex auto-purge scheduler, misleading "auto-purge" promise that was never actually implemented.
- **Option C — `.laputa/deleted/` archive folder**: custom recovery mechanism inside vault. Downside: clutters vault, users wouldn't know to look there, still requires manual cleanup.

## Consequences

- Users who accidentally delete a note must recover from git history (`git checkout HEAD -- path/to/note.md`) — this is a power-user action
- `trashed`/`trashedAt` frontmatter fields in existing vaults are silently ignored — no migration needed, no data loss
- The `trash` crate is removed from `Cargo.toml` — build times improve marginally
- Smoke tests for trash flows are deleted; delete-related test coverage is now purely the confirm modal behavior
- The Trash view, sidebar filter, note banners, and bulk-trash actions are all gone — simpler UI surface
- Re-evaluate if user feedback shows significant accidental deletion incidents, or if git-based recovery proves too inaccessible for non-technical users
