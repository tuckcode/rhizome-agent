---
session: 2026-09-14T14:12-05:00
model: Grok 4.6 (Cursor)
description: >-
  Sessions top-band header is a useDragRegion window-drag surface. No
  data-tauri-drag-region. Native drag still NOT RUN. No commit.
commits: none
---

# Sessions top-band drag — 2026-09-14 14:12

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

The gutter case already locked traffic-light inset when
`titleBarGutter` is on. The leftover was the drag contract: that header
uses `useDragRegion` on pointer move, not `data-tauri-drag-region` and
not a same-click `startDragging()`.

Native window-drag is still **NOT RUN**. Playwright cannot see it.

```bash
npx vitest run src/components/PrimeSessionList.test.tsx
```

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
