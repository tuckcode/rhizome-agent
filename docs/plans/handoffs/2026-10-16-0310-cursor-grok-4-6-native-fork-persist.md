---
session: 2026-10-16T03:10Z
model: Grok 4.6 (Cursor)
description: >-
  Native Chat fork now persists a real session with kept turns, continues
  that log on the next send, lists the fork, and reloads it. Unknown
  message ids fail. Incomplete tools stay pending. Restore handles error
  and read-only. Archived chats fork into a new unarchived session.
commits: this slice
---

# Native fork persistence (#170 hold)

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Native Fork was a UI copy: `replaceMessages` of kept turns, no log, no
session id, `native_chat_start` of the next prompt only. Fork now writes
kept turns through `native_chat_fork`, opens that session, and the next
send uses `native_chat_send` so `AgentLoop::from_log` already holds the
history. The new row shows in the native list (reload on active path)
and survives reopen.

Unknown message ids throw instead of copying the whole transcript. A
`ToolCall` without `ToolResult` stays `pending`. Native restore surfaces
`opened.error` and remembers `readOnly` so send is refused. Forking an
archived chat creates a new unarchived session.

Did not edit `docs/HANDOFF.md`. Did not merge.
