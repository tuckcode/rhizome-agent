---
session: 2026-10-16T03:05Z
model: Grok 4.6
description: >-
  Fix flaky transcript_index_contains_native_turn. CI llvm-cov has
  no --test-threads=1; RHIZOME_CACHE_DIR races vault::cache. Did not
  edit HANDOFF.md.
commits: cursor/fix-transcript-index-flake-b607
---

**Origin:** Cursor Grok 4.6 · 2026-10-16 03:05 UTC

## Why

PR #163 failed Rust Tests & Quality Checks at `98b0bc8` with
`index never got the native session`. That PR did not touch
`src-tauri`. The same test passed locally and on #166 / #167.

## Root cause

GitHub `rust-quality` runs `cargo llvm-cov` **without**
`--test-threads=1`. Local pre-push and the Chunk sidecar pass that
flag, so the flake hides on the laptop.

`wait_for_indexed_session` and the worker both resolved the index
file from process-global `RHIZOME_CACHE_DIR`. `vault::cache` tests
set the same env under a **different** mutex. A parallel vault test
can move the env after start and before TurnEnd. The worker then
writes one directory and the waiter reads another.

An earlier 80ms sleep (then a 2s poll) could not fix that. The write
had already gone to the wrong path.

## What changed

- Test cache root is a thread-local. `load()` on the test thread
  keeps the temp dir even when env moves.
- `start_named` / `open_with_engine` capture `index_path()` on the
  starting thread and write that file at TurnEnd.
- The flaky test waits for `TurnEnd` (the write is synchronous in
  that handler) and then still asserts the native session is in the
  index.
- Panic text names only a session count. It must not interpolate the
  native path (CodeQL `rust/cleartext-logging` on `session_id`).

Product chat behaviour is unchanged: production never changes
`RHIZOME_CACHE_DIR` mid-process, so the captured path is the same
file `append_native_turns` already used.
