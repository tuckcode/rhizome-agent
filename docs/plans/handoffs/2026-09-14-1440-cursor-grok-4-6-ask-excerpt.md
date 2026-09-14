---
session: 2026-09-14T14:00-05:00
model: Grok 4.6 (Cursor)
description: >-
  Ask Chat about a highlight prefills this thread. No new chat. No queued
  send. No commit.
commits: none
---

# Ask excerpt App wiring — 2026-09-14 14:00

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Menu and `prefillAiComposer` were already locked. The leftover was App:
highlight → Ask Chat stays in this thread.

Added one case in `App.layout-edges.test.ts`.

```bash
npx vitest run src/App.layout-edges.test.ts
```

**4/4 PASS.** No product edit. Did not start a new chat path.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
