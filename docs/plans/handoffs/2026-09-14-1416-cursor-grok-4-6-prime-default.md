---
session: 2026-09-14T14:16-05:00
model: Grok 4.6 (Cursor)
description: >-
  Settings default Chat copy keeps Prime. C72 leftovers are packaged
  476756c plus shortcuts (already labeled). No commit.
commits: none
---

# Settings Prime default — 2026-09-14 14:16

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Settings already says keep daily Chat on Prime. The leftover was no lock.

Added one case in `SettingsPanel.test.tsx`:

- Copy includes **Keep this on Prime for Chat with vault tools**
- Does not say Prime is an optional local agent
- Does not show the API-skip warning while Prime is selected

```bash
npx vitest run src/components/SettingsPanel.test.tsx -t "stay on Prime"
```

**1/1 PASS.** No product edit.

C72 thread restamped: leftover is packaged `476756c`. Tree + shortcuts sheet
already say Notes, Browse closed / open.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
