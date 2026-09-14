---
session: 2026-09-14T14:43-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat without a vault still polls Prime host status. Does not call
  ensure with an empty path. Do not close #46.
commits: uncommitted
---

# Host poll without a vault

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:43 · leftover test.

Chat still mounts with no vault ([1456]). The leftover was the model
chip poll: empty `vaultPath` still reads `get_prime_session_host_status`
and does **not** call `ensure_prime_session_host`.

```bash
npx vitest run src/hooks/usePrimeHostStatus.test.ts
```

**7/7 PASS.** No product edit. Do **not** close #46 from this.

## Not this window

- C64 still **NOT RUN**. App still `476756c`. Do not launch.
- Live Chat-without-vault still **NOT RUN**.
- D6 commits wait ~15:45.
