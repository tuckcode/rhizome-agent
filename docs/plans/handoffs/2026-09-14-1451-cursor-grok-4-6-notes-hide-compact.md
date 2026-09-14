---
session: 2026-09-14T14:16-05:00
model: Grok 4.6 (Cursor)
description: >-
  App hides Notes only for Graph, Mycelium, and Research. Narrow
  windows fold Sessions via sessionsAutoCollapsed. No commit.
commits: none
---

# Notes hide + compact Sessions — 2026-09-14 14:16

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

`shellLayout` already hides Notes when `hideNotesForCanvas` is true.
The leftover was App's assignment: Graph / Mycelium / Research only,
not Settings. Width-fold still passes `compactSessions` into Chat.

```bash
npx vitest run src/App.layout-edges.test.ts
```

**6/6 PASS.** Did not commit. Did not push. Did not rebuild.
App still `476756c`.
