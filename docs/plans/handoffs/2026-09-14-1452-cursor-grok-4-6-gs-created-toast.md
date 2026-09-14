---
session: 2026-09-14T14:18-05:00
model: Grok 4.6 (Cursor)
description: >-
  Getting Started toast is created and opened, not cloned. Playwright
  leftovers updated. ChatHome forwards compact Sessions. No commit.
commits: none
---

# Getting Started created toast — 2026-09-14 14:18

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

App already toasts `Getting Started vault created and opened at …`.
Smoke files still expected `cloned`. That would fail the @smoke Getting
Started retry path on D6 push.

Also locked: ChatHome forwards `sessionsAutoCollapsed`.

```bash
npx vitest run src/App.layout-edges.test.ts src/components/ChatHome.test.tsx
```

**19/19 PASS.** Did not run Playwright. Did not commit. App still `476756c`.
