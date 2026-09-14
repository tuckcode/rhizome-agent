---
session: 2026-09-14T14:00-05:00
model: Grok 4.6 (Cursor)
description: >-
  Status bar keeps Switch vault when the command rail owns Research
  and Settings. NEXT #46 names 4416411 + live leftover. No commit.
commits: none
---

# Vault stays on the bar — 2026-09-14 14:00

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Composer already has no vault pill. The leftover was the bar: hiding
Research / Settings must not take the vault switcher with them.

One assertion in `StatusBar.test.tsx`: `Switch vault` stays when
`commandRailActive`.

```bash
npx vitest run src/components/StatusBar.test.tsx -t "hides the duplicate Research"
```

**1/1 PASS** (68 skipped in that file). No product edit.

`NEXT.md` #46 now names local `4416411` and the live Chat-without-vault
leftover. Do not close from units.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
