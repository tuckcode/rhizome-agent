---
session: 2026-10-16T05:05Z
model: Grok 4.6 (Cursor)
description: >-
  onToolStart copies the slice of response text since the last tool into
  beforeText for fork order and leaves the live response buffer intact, so
  the panel still shows pre-tool text on every engine.
commits: this slice
---

# beforeText is a fork copy, not a park (#174 hold)

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

`createStreamCallbacks` is shared. Parking the accumulator into
`action.beforeText` and clearing it hid pre-tool text: `AiMessage`
renders `response`, not `beforeText`. A pre-tool-only turn then sealed
with no reply.

`onToolStart` now copies `responseAccRef.slice(mark)` onto the tool and
leaves the buffer alone. `conversationToNativeEvents` still emits that
copy in front of the ToolCall, then leftover `response` after stripping
those prefixes so a live full accumulator does not duplicate.

Did not edit `docs/HANDOFF.md`. Did not merge.
