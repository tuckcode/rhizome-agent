---
session: 2026-10-09T22:22Z
model: Grok 4.6 (Cursor)
description: >-
  #80: stop_spawned_daemon_kills_the_process_group no longer flakes.
  kill(2) retries TERM then KILL; the test polls a live group.
commits: this PR
---

# #80 — spawned-daemon process-group flake

**Origin:** Cursor Grok 4.6 · 2026-10-09 · issue #80

## Why

CI job Rust Tests & Quality Checks (macos-15) failed the unit test
unrelated to the PR diff. Separate from the #77 transcript-path flake.

## Root cause

`kill_process_group` shelled out to `kill -TERM -<pid> <pid>`, slept
50ms, then `kill -KILL` once, and ignored every status. The test then
did one `wait()` on `sleep 30` and asserted `!success()`.

On macOS, a signal sent in the same instant as spawn can return 0 and
never be delivered (rust-lang/rust#14232 / XNU). Rust's own
`process_group` tests are ignored on macOS and aarch64 for that reason.
When both shots are dropped, `sleep` exits 0 after 30s and the assert
fails.

The `kill` executable's `-<pgid>` parsing is also runner-specific.
`libc::kill(-pid, SIGTERM)` is the API rustc uses.

## What changed

- Unix stop uses `kill(2)` and retries TERM, then KILL, until the
  leader is gone or a 200ms bound elapses.
- The test waits until the leader is a live group and a member has
  joined, then polls for a signaled exit on both.

## Loops

- After: 80/80 on the fixed test.
- Old one-shot `kill(2)` path (Linux): 80/80. The macOS drop-signal
  race is not present here. The old `kill` CLI path is not runnable in
  this environment (negative-PGID `kill` takes down the job).
