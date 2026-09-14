---
session: 2026-09-14T14:49-05:00
model: Grok 4.6 (Cursor)
description: >-
  Thinking pill still loads levels with no vault. Does not call
  ensure_prime_session_host. Do not close #46.
commits: uncommitted
---

# Thinking pill without a vault

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:49 · leftover test.

Opening the thinking menu with no `vaultPath` still reads
`get_prime_thinking_levels`. It does not start Prime.

```bash
npx vitest run src/components/PrimeThinkingToggle.test.tsx -t "empty vault"
```

**1/1 PASS.** No product edit. Do not close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
