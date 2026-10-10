---
session: 2026-10-10T18:10Z
model: Grok 4.6
description: >-
  Step 2a: wider Engine trait, live sink, vault on start,
  approval options, non-blocking provider reports. Chat stays on Prime.
commits: cursor/native-engine-2a-81d3
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 18:10 UTC

## What landed

Plan step 2a on top of #112 and #113. Did not edit `HANDOFF.md`.
Did not start 2b, 2c, or the Settings toggle.

- `EngineEvent` now has TextDelta, tools, approval, Provider, TurnEnd,
  Cancelled, Error. `start` takes a sink. steer / cancel /
  reply_approval / settle_on_quit are on the trait.
- `NativeEngine::set_vault` is applied when start runs.
- Limited-tools `create_note` prompts are Allow once and Deny only.
- Provider reports use `try_send`. A trailing `Trying` with no later
  Provider event means the attempt was stopped.
- #113 `/tmp/x.md` helper test now uses a second temp folder.

## Tests

Engines 17, loop 44. Clippy `-D warnings` clean.
