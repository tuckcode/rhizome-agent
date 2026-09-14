---
session: 2026-09-14T14:24-05:00
model: Grok 4.6 (Cursor)
description: >-
  Settings import writes vault notes only. No session-list rows. No
  import_jsonl UI. No commit.
commits: none
---

# Import vault-only lock — 2026-09-14 14:24

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Settings already imports Claude Code into `Imports/`. List-rows stay
blocked until Atticus types **`1`**. The leftover was no lock that the
button is **Import to vault** and that `import_jsonl` is not on the page.

Added one case in `SessionImportSettingsSection.test.tsx`.

```bash
npx vitest run src/components/SessionImportSettingsSection.test.tsx
```

**3/3 PASS.** No product edit. Did not speak `import_jsonl` in code.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
