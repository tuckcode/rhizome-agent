---
session: 2026-10-09T22:25Z
model: Grok 4.6 (Cursor)
description: >-
  Merged main into PR #88 (ADR-0179). Conflicts were additive in
  HANDOFF and NEXT. Hermes ACP is per-turn; quit does not shut it down.
  Native red-X live-check still not run.
commits: 8bc7e91
---

# PR #88 merge with main

**Origin:** Cursor Grok 4.6 · 2026-10-09 · finish draft #88

Merged `origin/main` (`0ba5e82`) into `cursor/red-close-quits-6570`.
Conflicts only in `docs/HANDOFF.md` and `docs/NEXT.md`. Both sides kept
(ADR-0179 close row plus #86/#87 inventory and session index).

No product behavior change after the merge. Close path still matches
ADR-0179: default red X exits and `release_helpers_on_quit` stops
ws-bridge, Mindwalk, and a Prime daemon this process spawned; Keep in
taskbar hides; Keep working leaves that spawned daemon; never Prime
`shutdown`; do not destroy `main` while the process lives.

Hermes ACP (#85 / ADR-0178) is a per-turn stdio spawn. After the turn,
stdin is dropped and the child is waited. Rhizome does not start a
shared Hermes daemon, so quit does not send Hermes a shutdown. A
user-installed Hermes is left alone.

## QA

Local: `pnpm lint`, `pnpm typecheck`, vitest (6974 passed),
`cargo fmt --check`, `cargo clippy --lib -D warnings`,
`cargo test --lib` (1964 passed; `stop_spawned_daemon_kills_the_process_group`
flaked — #80, not chased).

GitHub CI on `8bc7e91`: all required checks green. Codacy 0 new issues.

**A native red-X / Dock live-check on a packaged macOS app was NOT run.**
