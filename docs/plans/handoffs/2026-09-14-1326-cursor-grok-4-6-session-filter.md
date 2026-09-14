---
session: 2026-09-14T13:26-05:00
model: Grok 4.6 (Cursor)
description: >-
  Sessions filter list tests lock folder and git-branch hits, including
  archived expand. NEXT import row blocked until 1. No commit.
commits: none
---

# Sessions filter + import stamp — 2026-09-14 13:26

**Origin:** Cursor Grok 4.6 · leftover chrome tests · no commit

`primeSessionMatchesQuery` already matched cwd and `gitBranch`. The list
UI tests only locked title. Two new cases:

- Live row found by folder name or branch, not title
- Archived row found by branch opens that section

`npx vitest run src/components/PrimeSessionList.test.tsx` — **42/42**.

`docs/NEXT.md` §0 item 5: list rows stay blocked until Atticus types **`1`**.

D6 group 3 now names `PrimeSessionList.test.tsx`.
