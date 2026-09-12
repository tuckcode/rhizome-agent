---
session: 2026-09-12T22:25Z
model: Cursor Composer
description: >-
  Three more daily-drive fixes from the explore pass: Chat note no longer
  hover-collapses, latest-reply marker is green, note highlight menu has Copy.
commits: TBD
---

# Daily-drive follow-ups (hover / green / Copy) — 2026-09-12

**Origin:** Cursor Composer · follow-up to
[Find daily-drive quick fixes](141902ef-4fcc-4595-b39c-51663e1cc6d1).

## Done

1. **Chat note beside Chat** — removed hover collapse / "Inbox" strip. The note
   stays open until Close or Back to notes (`ChatHome`).
2. **Latest reply marker** — `--accent-green` (was blue).
3. **Note highlight menu** — Copy + `data-allow-native-context-menu` when
   nothing is selected (`AskChatExcerptMenu`).

Smoke `ai-chat-history` updated for the new pane region test id.

## Not done

Push still held. C64 / #47 / #51 unchanged.
