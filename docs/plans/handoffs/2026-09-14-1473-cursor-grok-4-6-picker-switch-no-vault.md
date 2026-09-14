---
session: 2026-09-14T14:50-05:00
model: Grok 4.6 (Cursor)
description: >-
  Model picker lists and changes models with no vault. Session switch
  still works. Neither starts Prime. Do not close #46.
commits: uncommitted
---

# Model picker and session switch without a vault

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:50 · leftover tests.

Opening the model menu with no vault still lists models. Picking one
still calls `set_prime_model`. Clicking a past session still switches.
None of those call `ensure_prime_session_host`.

```bash
npx vitest run src/components/PrimeModelPicker.test.tsx src/components/usePrimeSessionSwitcher.test.tsx -t "no vault"
```

**3/3 PASS.** No product edit. `PrimeModelPicker.test.tsx` added to D6
group 3. Do not close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
