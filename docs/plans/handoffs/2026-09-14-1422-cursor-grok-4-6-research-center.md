---
session: 2026-09-14T14:22-05:00
model: Grok 4.6 (Cursor)
description: >-
  Research is a center pane. Chat hides; it is not an overlay inside
  Research. No commit.
commits: none
---

# Research center pane — 2026-09-14 14:22

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Graph/Mycelium stay a Changes cell under Notes. Research is still a
center pane. Chat is hidden (`display: none`), not a second conversation
inside Research.

Added one case in `App.test.tsx` (ResearchPanel stubbed).

```bash
npx vitest run src/App.test.tsx -t "Research as the center"
```

**1/1 PASS.** No product edit.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
