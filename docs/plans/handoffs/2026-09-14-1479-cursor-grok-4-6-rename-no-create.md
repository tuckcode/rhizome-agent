---
session: 2026-09-14T14:57-05:00
model: Grok 4.6 (Cursor)
description: >-
  List rename still names a session. It does not create one or start
  Prime when Chat has no vault.
commits: uncommitted
---

# Rename does not create a session

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:57 · leftover test.

Renaming from the Sessions list still calls `rename_prime_session`
with the log path and the new name. With no vault it does not
`ensure_prime_session_host`, `prime_session_new_session`, or
`set_prime_session_name`.

```bash
npx vitest run src/components/PrimeSessionList.test.tsx -t "does not create a session when renaming"
```

**1/1 PASS.** No product edit. `rhizome-ship` still three verbs. Do
not rebuild `/Applications`. Do not close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
