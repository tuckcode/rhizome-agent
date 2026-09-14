---
session: 2026-09-14T14:18-05:00
model: Grok 4.6 (Cursor)
description: >-
  AiPanel wires last-conversation restore only for Prime. Native
  relaunch still NOT RUN. No commit.
commits: none
---

# Last-conversation restore wiring — 2026-09-14 14:18

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

`decidePrimeSessionRestore` already skips the browser mock and prefers
a live rejoin. The leftover was Chat actually calling the hook, and
only on Prime.

Native packaged relaunch still **NOT RUN**. Vite/`mock-tauri` is not
that path.

```bash
npx vitest run src/components/AiPanel.test.tsx -t "last-conversation restore"
```

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
