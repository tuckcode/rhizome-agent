---
session: 2026-09-14T14:35-05:00
model: Grok 4.6 (Cursor)
description: >-
  Settings API default stays on the Prime harness. Inbox shows in the
  Notes list only when folder mode is on.
commits: uncommitted
---

# Prime keep + Inbox folder

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:35 · leftover chrome lock.

A global Settings API model must not strip Prime chrome or route Chat
off Prime. Inbox is a folder inside Notes, not a rail destination.

## Tests

`src/components/ChatHome.test.tsx` **16/16** (added 1): `api_model`
remaps to the Prime agent target.

`src/App.layout-edges.test.ts` **14/14** (added 2):
`showInbox: explicitOrganizationEnabled`. Inbox list has no Graph /
Mycelium chrome.

Render lock for the remap was already in ChatHome (`agent-target-kind`
is `agent`). This locks the remap itself.

## Not this window

- C66 store still docked
- Packaged app `476756c` still old
- D6 commits wait ~15:45
