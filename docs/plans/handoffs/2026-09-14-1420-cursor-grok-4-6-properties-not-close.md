---
session: 2026-09-14T14:20-05:00
model: Grok 4.6 (Cursor)
description: >-
  Breadcrumb sidebar control is Properties, not Close. #52 TTL still
  not this window. No commit.
commits: none
---

# Properties is not Close — 2026-09-14 14:20

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Closing a note is the breadcrumb **X**. The sidebar-looking header
control opens Properties. That mix-up was not locked.

Added one case in `BreadcrumbBar.test.tsx`.

```bash
npx vitest run src/components/BreadcrumbBar.test.tsx -t "sidebar-looking"
```

**1/1 PASS.** No product edit.

#52 Done-row TTL still not this window. Do not recode the tray.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
