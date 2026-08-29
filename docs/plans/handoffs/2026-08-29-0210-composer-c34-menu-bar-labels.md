---
session: 2026-08-29T02:10-05:00
model: Composer 2.5 (Cursor)
description: >-
  C34 finish: menu-bar roster activity labels read the user's locale from
  get_settings; regression test for translated status copy.
---

# C34 menu-bar roster labels — 2026-08-29

**Origin:** Composer 2.5 (Cursor) · 2026-08-29

Copy-only refactor landed in `1509f9f` (eight `menuBarCompanion.activity.*`
keys, `RosterActivity` union, `taskState: needs_input` → "Waiting for you").
This session closed the remaining display gap: the companion window hardcoded
`createTranslator(DEFAULT_APP_LOCALE)`.

## Shipped

- `MenuBarCompanionApp` loads settings and resolves locale the same way as the
  main app (`resolveEffectiveLocale` + `getBrowserLanguagePreferences`).
- Test: roster row renders `"Replying"` from `en.json` for `isStreaming` status.
- HANDOFF C34 marked **RESOLVED**; non-English strings still depend on C18
  (`pnpm l10n:translate` never run for the eight keys).

## Not in scope

- Prime roster state logic — already correct in `primeRunningSessions.ts`.
- Running `pnpm l10n:translate` — blocked on LARA credentials (C18).
