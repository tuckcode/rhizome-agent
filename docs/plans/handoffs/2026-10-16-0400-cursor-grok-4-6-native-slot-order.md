---
session: 2026-10-16T04:00Z
model: Grok 4.6 (Cursor)
description: >-
  Live native session slots are released when a Chat panel or workspace
  session closes. Forked native events keep assistant text in front of the
  tool round it belonged to, while still pairing every call with a result.
commits: this slice
---

# Native slot cleanup and fork assistant order (#170 leftovers)

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

`useCliAiAgent` retains its live native slot for the mounted panel or
workspace session and releases it on close, so `liveNativeBySlot` does
not keep stale entries. Two viewers of the same workspace session still
share the slot until the last one closes.

`conversationToNativeEvents` writes `action.beforeText` as an Assistant
event immediately before that ToolCall, then the paired result, then the
final `response`. Folding a log back into the panel stashes between-round
assistant text on the next action instead of overwriting `response`.

Did not edit `docs/HANDOFF.md`. Did not merge.
