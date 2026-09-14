---
session: 2026-09-14T14:14-05:00
model: Grok 4.6 (Cursor)
description: >-
  AiPanel gives Sessions a traffic-light gutter only when Prime chrome is
  not above it. Prime rail portal list has no second gutter. No commit.
commits: none
---

# Sessions gutter vs Prime subhead — 2026-09-14 14:14

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

The list already knows how to inset and drag when `titleBarGutter` is
on ([1446](2026-09-14-1446-cursor-grok-4-6-sessions-drag.md)). The
leftover was who turns that flag on.

Inline list: `titleBarGutter={!isPrimeTarget}` — Prime keeps the
subhead as the top band. Portal list (Prime + rail) does not pass the
flag.

Native drag still **NOT RUN**.

```bash
npx vitest run src/components/AiPanel.test.tsx -t "sessions title-bar gutter"
```

**2/2 PASS** (47 skipped). Did not commit. Did not push. Did not rebuild.
C64 still **NOT RUN**. App still `476756c`.
