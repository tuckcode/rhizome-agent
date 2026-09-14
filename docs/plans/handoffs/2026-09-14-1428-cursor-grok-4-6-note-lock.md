---
session: 2026-09-14T13:51-05:00
model: Grok 4.6 (Cursor)
description: >-
  Locked notes make the editor read-only. Not vault editor_mode. No
  commit.
commits: none
---

# Note lock read-only — 2026-09-14 13:51

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

C68 already shipped: ephemeral per-note lock, breadcrumb + Cmd+K. The
leftover was no layout lock that BlockNote/raw go read-only.

Added three cases in `EditorContentLayout.test.tsx`.

```bash
npx vitest run src/components/editor-content/EditorContentLayout.test.tsx
```

**10/10 PASS.** No product edit. Did not change `editor_mode`.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
