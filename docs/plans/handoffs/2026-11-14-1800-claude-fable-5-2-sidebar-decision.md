---
session: 2026-11-14T18:00-06:00
model: Claude Fable 5.2 (Claude Code desktop)
description: >-
  Design decision for the right sidebar and the note list (plan item 11),
  a review of PR 298, and C105 for the session lock probe.
---

# Sidebar decision and PR 298 review

**Origin:** Claude Fable 5.2 · 2026-11-14 · front-end run, second session

## Decision

[`docs/design/2026-11-14-right-sidebar-model.md`](../../design/2026-11-14-right-sidebar-model.md)
is the decision for plan item 11. It gives the right side two states
(closed and docked), removes the Auto and Rail modes, sets new widths,
and sets the type of a note row and a session row. It splits the work
into three PRs: 11a, 11b and 11c.

Two points wait for Atticus. The Auto and Rail modes go. The
recent-note icons leave the right rail.

## Review of PR 298 (reopened chat worker lock race)

The change is correct for the race that it reproduces. `open_with_engine`
now reads the saved target before it starts the worker, so that lookup
does not hold the session lock when the worker asks for it.

**C105, the session lock probe can still stop a new worker.**
`open_session_log` calls `write_lock_is_held`
(`src-tauri/src/engines/native_log.rs`). That function takes the
exclusive session lock and drops it at once. The worker uses a
non-blocking lock and stops if the lock is busy. So each caller of
`open_session_log` on another thread can stop a worker that starts at
the same moment. Two paths remain after PR 298:

- `target_for` calls `remember_logged_target` when the cached target is
  empty. A session whose saved header has an empty target keeps an empty
  cache, so the lookup runs again while the worker starts.
- Each other command that reads a session log during the start window.

I did not reproduce C105. It comes from a read of the code. Two possible
repairs: the worker tries the lock again for a short time, or the probe
reads the lock state and does not take the lock.

One small point: `open_with_engine` opens the log, and then
`remember_logged_target` opens it a second time. The first result
already has `header.target`.

## State of the open front-end PRs

PRs 291 to 295 each show a failed Rust check from a revision older than
PR 297. Each one needs `main` merged in before its checks can pass. I
did not change them.

## Codex

No `codex` command is on PATH in the Claude shell. Delegated work goes
to Atticus as a brief to paste.
