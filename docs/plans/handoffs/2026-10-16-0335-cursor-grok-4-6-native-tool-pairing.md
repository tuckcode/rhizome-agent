---
session: 2026-10-16T03:35Z
model: Grok 4.6 (Cursor)
description: >-
  Native fork events pair every ToolCall with a result, from_log drops or
  closes unpaired entries, and the live native session is scoped per panel.
commits: this slice
---

# Native tool pairing and per-panel live session (#170 hold)

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

`conversationToNativeEvents` now writes User, then each ToolCall next to
its ToolResult or ToolDenied, then the final assistant text. A pending
tool gets a cancelled denial; an errored tool keeps its error. `from_log`
closes leftover calls with `UNANSWERED_TOOL_OUTPUT` and drops orphan
results so OpenAI-style providers see a matching `role: "tool"` for every
id.

The live native session is a map keyed by panel instance or workspace
session id. Two Chat panels no longer share one window-wide session.
`useCliAiAgent` exposes `setNativeSession` / `getNativeSession`; the
session switcher uses those instead of the old global.

Did not edit `docs/HANDOFF.md`. Did not merge.
