---
session: 2026-09-14T14:46-05:00
model: Grok 4.6 (Cursor)
description: >-
  Sessions list still loads with no vault. Does not call
  ensure_prime_session_host. Do not close #46.
commits: uncommitted
---

# Sessions list without ensure

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:46 · leftover test.

Opening Sessions reads `list_prime_session_summaries` only. An empty
vault does **not** start Prime.

```bash
npx vitest run src/components/PrimeSessionList.test.tsx -t "lists sessions without starting Prime"
```

**1/1 PASS** (43 skipped). No product edit. Do not close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
