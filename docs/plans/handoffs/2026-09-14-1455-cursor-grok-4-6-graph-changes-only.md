---
session: 2026-09-14T14:22-05:00
model: Grok 4.6 (Cursor)
description: >-
  Graph/Mycelium mounts only on Changes. Inbox stays a Notes filter.
  ChatHome Escape leave-Chat is onExit, not Stop.
commits: uncommitted
---

# Graph only on Changes

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:22 · leftover chrome lock.

Inbox keeps the note list. Graph/Mycelium is a cell under Notes on
**Changes** only (ADR-0171). Do not remount `ConnectionsPanel` on Inbox
to “make Graph findable.”

## Tests

`src/App.layout-edges.test.ts` **9/9** (added 2):

- `chatCentered && isChangesSelection` hosts `<ConnectionsPanel`
- Inbox rail is `kind: 'filter'` (`inbox` / `all`), not Graph

`src/components/ChatHome.test.tsx` **13/13** (added 1):

- `onClose={onExit}` — Escape leaves Chat. Stop stays click-only.
  AiPanel Escape behavior was already locked.

## Not this window

- Native Graph/Mycelium on packaged `476756c`
- #39 graph-as-agent-tool
- D6 commits wait ~15:45
