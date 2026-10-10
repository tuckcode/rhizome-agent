---
session: 2026-10-10T09:45Z
model: Grok 4.6
description: >-
  #104 Phase 5: cancelled approval no longer holds the next wait;
  native / Prime / Hermes engines; loop compiles in normal builds.
  Chat stays on Prime.
commits: 491497c..HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 09:45 UTC

## What landed

Closes #104 in one PR. Based on `main` (includes #101 / #102).
Did not edit `stream_model_events`, `rhizome_provider_model.rs`,
or Phase 4b. #105 was still open; its files were left alone.

- Cancel during wait dismisses the live prompt and does not mutex
  the waiter for the whole wait. A late AllowOnce is ignored.
- `engines/{mod,native,prime,hermes}.rs`: one trait. Native quit
  cancels. Prime drop detaches, never shutdown. Hermes uses ACP.
- `rhizome_loop` compiles in normal builds. Chat still does not call it.
- `ModelView.turn_start` marks where this turn's history items begin.
- `offered_tools` still names only. Schemas stay with the #105 adapter.

## Tests

Red `3c0dfd9`, green `31d0eea` for the lock. Engine tests on this
commit. Loop 35, engines 5.
