---
session: 2026-09-14T14:33-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat center hides for Graph / Mycelium / Research (not an overlay).
  Chat stays mounted when Notes is open.
commits: uncommitted
---

# Chat center hide + Notes stay

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:33 · leftover chrome lock.

Research / Graph / Mycelium take the center. Chat is `display: none`
there, not a second conversation overlay. Opening Notes does not
unmount Chat.

## Tests

`src/App.layout-edges.test.ts` **12/12** (added 2).

`App.test.tsx` already has the Research click path.

## Not this window

- Native Graph/Mycelium/Research on packaged `476756c`
- #39 graph-as-agent-tool
- D6 commits wait ~15:45
