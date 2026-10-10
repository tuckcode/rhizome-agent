---
session: 2026-10-10T05:48Z
model: Grok 4.6
description: >-
  Phase 3 Rhizome loop: Model trait consumes model_events, cancel
  stops reading, tool-call ids stay in history, step order is
  assistant-then-results. Chat stays on Prime. Test-only.
commits: 7b178b7..HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 05:48 UTC

## What landed

Loop-side work after #96 (`model_events`) merged. File boundary held:
`rhizome_loop/*` only. Did not edit `model_events.rs` or Claude's
provider files.

- `Model` trait: the loop drives `complete(&ModelView, emit)`. Any
  implementor works; `FakeModel` is one. `OnceModel` in tests proves
  the loop is not FakeModel-only.
- Cancel stops reading. The model has no `Cancelled` event. Unread
  events stay on `FakeModel.unread`. Already-accepted text is kept.
- Tool-call `id` is on `DurableEvent` / `HistoryItem` for the call,
  the result, and the denial. Interleaved deltas keep their ids.
  Malformed JSON args are a tool error the model can see.
- Step order: the next model round sees `Assistant { tool_calls }`
  before `ToolResult` with the same ids. A step is one request plus
  the tools it called.
- `run_until_idle_async` plus a blocking wrapper. Yield between
  rounds so a concurrent cancel can land.

## Not in this change

Plan Phase 3 (plugin seam) is still skipped: only one hook (policy).
`engines/native.rs` stays Phase 5. Chat still talks to Prime.

## Decisions flagged, not worked around

None of §5 looked wrong. Native Keep working stays later (Decision 2).
