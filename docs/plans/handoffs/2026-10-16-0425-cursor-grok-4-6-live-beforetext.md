---
session: 2026-10-16T04:25Z
model: Grok 4.6 (Cursor)
description: >-
  Live native/tool streams park assistant text on action.beforeText as
  each tool round starts, so forking an open chat keeps that text in
  front of the call. Reopen keeps assistant text when ModelFailed follows.
commits: this slice
---

# Live beforeText and ModelFailed (#174 hold)

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

`onToolStart` copies the current response accumulator onto the new
tool's `beforeText` and clears the accumulator, so a later `onDone`
only holds text after that round. Forking the live panel messages
writes that text in front of the ToolCall.

`nativeEventsToConversation` appends a ModelFailed message onto the
pending assistant text instead of replacing it.

Did not edit `docs/HANDOFF.md`. Did not merge.
