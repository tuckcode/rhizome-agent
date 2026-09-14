---
session: 2026-09-14T14:18-05:00
model: Grok 4.6 (Cursor)
description: >-
  Settings API default warns it skips Prime. GETTING-STARTED stamped.
  C66 store still docked. No commit.
commits: none
---

# Settings API default warn — 2026-09-14 14:18

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Prime-keep copy was locked at 14:16. The leftover was the other branch:
a direct API default must say it skips Prime sessions and vault tools.

Added one case in `SettingsPanel.test.tsx` with a fixture provider only.

```bash
npx vitest run src/components/SettingsPanel.test.tsx -t "Prime"
```

**4/4 PASS** (includes the earlier Prime-keep case). No product edit.

`GETTING-STARTED.md` now names that Chat default stays Prime.
C66 store still docked. Did not encode a profile store.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
