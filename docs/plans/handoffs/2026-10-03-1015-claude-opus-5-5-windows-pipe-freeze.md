---
session: 2026-10-03T09:55-05:00
model: Claude Opus 5.5
description: >-
  Windows: fixed the permanent window freeze (synchronous pipe handle
  serialized the reader's ReadFile with every command WriteFile); the Rust
  test target now compiles on Windows; File > Exit added to the custom menu.
  Opened C83 (24 Windows test failures), C84 (Prime console flashes), C85
  (xAI is not OAuth; one-click Sign in wanted). ~5s stalls remain.
---

# 2026-10-03 · Windows pipe freeze, test target, File > Exit

Surface: Claude Code desktop app, Windows 11. Picked up the
[Hermes handoff](2026-10-03-0945-hermes-glm53flash-windows-first-boot-hang.md).

## Root cause of the freeze

`connect_stream` opened `\\.\pipe\prime-agent-daemon` with plain
`OpenOptions`, a synchronous handle. Windows serializes every I/O on a
synchronous file object, and `try_clone` (DuplicateHandle) shares it. The
reader thread lives in `ReadFile`, so the first command `WriteFile` after the
hello waited for daemon output that only the write could produce. Hermes saw
it as `write_raw` blocked forever. Node probes never wedged because Node uses
overlapped I/O.

Fix: `src-tauri/src/prime_daemon_pipe.rs` opens with `FILE_FLAG_OVERLAPPED`;
each read/write uses its own event and `GetOverlappedResult(wait)`. Broken
pipe reads as EOF, as std does.

Evidence: `a_parked_reader_does_not_block_writes_on_the_pipe` failed
(`Err(Timeout)`) on the old handle and passes now. Native run against Prime
0.8.0: connected and stayed up; before, 3/3 hangs.

## Still open

- ~5s `Responding=False` about once a minute, then recovers. Not a deadlock.
  Suspect sync Tauri commands on the main thread; Hermes handoff, next move 3.
- C83: 24 `cargo test --lib` failures on Windows, plus 13 test-only clippy
  items. Rust push lane cannot pass from Windows.
- C84: console flashes on launch come from Prime's daemon/worker children
  (`detached: true`, no `windowsHide`). Upstream.
- C85: xAI card says OAuth; Prime has none for xAI. Atticus wants Sign in to
  open the browser without a terminal. Prime's `pi-ai` exposes
  `loginAnthropic({ onAuth, onPrompt })` with a local callback server, which a
  Node helper could drive; that writes Prime's `auth.json` through Prime's own
  code. Not started: needs Atticus's call against ADR-0168.
- `auth.json` on this machine is empty, so Chat shows only local llama.cpp
  models.

## Notes for the next Windows session

- Do not set `CARGO_TARGET_DIR` inside the repo while `pnpm tauri dev` runs:
  Vite's watcher hit `EBUSY` on a build-script `.exe` and died.
- Windows has no native menu; `LinuxMenuButton.tsx` is the menu bar there.
- At launch the app runs `git pull --no-rebase` in the repo itself, because
  `demo-vault-v2` sits inside it. It was a no-op today.
- Not pushed: the push gate's Rust lane fails on Windows (C83).
