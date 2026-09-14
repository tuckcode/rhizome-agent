---
session: 2026-09-14T14:58-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat working pulse still runs when Notes is open. Packages still
  install through Prime, not a second kernel. C72 leftover restamped.
commits: uncommitted
---

# Chat pulse + Prime packages hub

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:58 · leftover tests.

Opening Notes does not turn off the green Chat working strip. Settings
→ Packages still installs with `prime-agent package install`. C72
labels in the tree stay `Notes, Browse closed` / `Notes, Browse open`.
Packaged leftover still **`476756c`**. Tiptap High still parked.

```bash
npx vitest run src/App.layout-edges.test.ts src/components/PrimeExtensionsSection.test.tsx -t "working pulse|plugin kernel"
```

**2/2 PASS.** No product edit. MCP bundle is still generated
(`src-tauri/.gitignore`). Packaged app will not pick S1/S2 until
rebuild. Do not rebuild. Do not close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
