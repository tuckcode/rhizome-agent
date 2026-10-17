---
session: 2026-10-17T12:05Z
model: Grok 4.7 (Cursor)
description: >-
  Windows bash spawn tests, job-handle close on a failed
  kill-on-close, and the CRLF preview fixture compare.
commits: local
---

# Windows bash spawn tests

**Origin:** Cursor Grok 4.7 · 2026-10-17 · follow-up to #202.

## What changed

`src-tauri/src/rhizome_loop/tools/shell.rs`

- `make_job` wraps the job in `OwnedHandle` before
  `set_kill_on_close`. A failure there used to leak the handle.
- `#[cfg(windows)]` tests spawn for real: `echo hi`, a script that
  starts `ping -n 30 127.0.0.1` and must die on a short timeout, and
  a cancel that records cmd, powershell, and ping and checks all
  three are gone. `cargo test --lib` is the Rust Tests (Windows) job,
  so these run there.
- Removed the unused `AsRawHandle` import in `poll_pipe_windows` and
  the unused `Error` import in `windows_job`. The test module's
  `AtomicBool` / `Arc` imports stay because the cancel test uses them.

`src-tauri/src/rhizome_loop/tools/preview.rs`

- `review_shot_fixtures_match_unified` compares fixtures after
  turning CRLF into LF. Windows checkout was the only failure in
  the Rust Tests (Windows) job on #202.

Output caps, the hidden-line marker, timeouts, and approval are
unchanged.
