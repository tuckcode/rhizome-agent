---
session: 2026-09-14T14:44-05:00
model: Grok 4.6 (Cursor)
description: >-
  ChatHome still calls usePrimeHostStatus with vaultPath, including
  empty. D6 orphans: W4 2235 rides group 5. .cursor stays ship-skill.
commits: uncommitted
---

# ChatHome host wire + D6 orphans

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:44 · leftover.

Hook poll without a vault is [1466]. The leftover was ChatHome wiring:
`usePrimeHostStatus(isPrimeTarget, vaultPath)` — not gated on a path.

```bash
npx vitest run src/components/ChatHome.test.tsx -t "polls Prime host status"
```

**1/1 PASS** (16 skipped). No product edit. Do not close #46.

## D6 orphans (14:44)

Dirty **222**. Named-group miss was only:

- `docs/plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md` — now group 5
- `.cursor/` directory — **not** a group. Stage ship-skill only

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
