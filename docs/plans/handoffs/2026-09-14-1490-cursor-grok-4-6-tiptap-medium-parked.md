---
session: 2026-09-14T15:26-05:00
model: Grok 4.6 (Cursor)
description: >-
  Leftover lock: Tiptap stays 3.22.5 / 3.19.0 patch. Medium hono/qs
  stay pinned. No commit yet.
commits: uncommitted
---

# Tiptap / Medium leftover parked

**Origin:** Cursor Grok 4.6 · 2026-09-14 15:26 · leftover.

`parked-organs.test.ts` now locks:

- `@tiptap/pm` **3.22.5**
- `@tiptap/extension-link@3.19.0` patch still listed
- no `@tiptap/core` 3.30 bump
- `hono` **4.12.34**
- `qs` **6.15.2**

Do not bump these this window. `js-yaml` / `fast-uri` pins stay in
group 8.

## Not this window

- C64 / W4 / hide / last-idle still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45. No push. No rebuild.
