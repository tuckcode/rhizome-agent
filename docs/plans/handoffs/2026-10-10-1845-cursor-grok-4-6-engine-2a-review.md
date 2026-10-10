---
session: 2026-10-10T18:45Z
model: Grok 4.6
description: >-
  #114 review fix-up: live sink during the turn, current-turn
  events only, ignore stale approval ids, keep every provider report.
commits: cursor/native-engine-2a-81d3
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 18:45 UTC

## What landed

Review fix-up for draft #114. Did not edit `HANDOFF.md`.
Did not start 2b, 2c, or the Settings toggle.

- The loop fires `on_durable` as each log event is recorded.
  `NativeEngine::start` maps those to the sink while the turn runs.
  Provider reports drain on a side thread from an unbounded channel.
- A second `start` emits only that turn. History is not replayed.
- Approval replies whose id does not match the live prompt are ignored.
- A 200-report failover keeps every `Trying` plus the final `Answered`.

## Tests

Engines 20, loop 44. Clippy `-D warnings` clean.
