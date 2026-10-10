---
session: 2026-10-10T00:45Z
model: Grok 4.7
description: >-
  Phase 1 Rhizome loop: one inbox, a fake model, and four behavior tests.
  Chat still talks to Prime. The loop is compiled for tests only.
commits: 9b88beb5..9fe83345
---

**Origin:** Cursor Grok 4.7 · 2026-10-10 00:45 UTC (19:45 America/Chicago)

## What landed

A bare agent loop in `src-tauri/src/rhizome_loop/`. `lib.rs` compiles it
only under `#[cfg(test)]`. Chat and Prime do not call it.

One inbox. A turn admits one user message, calls the fake model, appends
assistant text, and logs `TurnEnd`. Cancel between chunks logs
`Cancelled { cause }` and does not keep the next chunk. A message sent
during a turn waits in the inbox until that turn ends. `when_idle` is
false while a step is running and true after the inbox drains.

Durable events stay in a `Vec`. Nothing is written to disk.

## Tests

`cargo test --manifest-path src-tauri/Cargo.toml rhizome_loop`

Red on `9b88beb5` (empty driver): 4 failed. Green on `9fe83345`: 4 passed.

## Not in this change

No tools, plugins, model HTTP, engine trait, or Chat toggle. Prime and
Hermes stay. Close / quit code and ADR-0179 / PR #88 were not touched.
No new ADR. No vendored code. Installed app unchanged.
