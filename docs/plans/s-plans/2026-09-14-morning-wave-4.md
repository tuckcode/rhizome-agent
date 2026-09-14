---
session: 2026-09-14T11:39-05:00
model: Grok 4.6 (Cursor)
description: >-
  Wave 4. Neighbor unit tests for shipped chrome only. No product
  features. No list-import, no #66 merge, no Applications rebuild.
---

# Morning wave 4

**Origin:** Cursor Grok 4.6 · 2026-09-14 · five-hour burn.

Tests only. TDD against behavior already in the tree. No new exports.
No new test file — neighbors were the right place.

## Added

1. **Hide-on-close helper names** — extra asserts on
   `hidden_window_helper_stops` in `src-tauri/src/lib.rs`.
   Hide stops `spawned_prime_daemon`, `ws_bridge`, `mindwalk`.
   Keep-working drops only `spawned_prime_daemon`.

2. **Session-switch clear-on-click** — extra assert that the transcript
   read has not started while the row is already highlighted.
   New neighbor test: stale messages clear on the same click as the
   highlight, before the host returns.
   File: `src/components/usePrimeSessionSwitcher.test.tsx`.

3. **Packages lazy catalog** — inactive Packages does not call
   `searchPrimePackageCatalog` or `trackPrimePackageCatalogOpened`.
   Opening Packages from Settings does fetch the npm catalog
   (`keywords:pi-package`).
   Files: `PrimeExtensionsSection.test.tsx`, `SettingsPanel.test.tsx`.

4. **C72 catalog alias** — `MENU_LABEL_KEYS` is still unexported.
   Read-only source check: `Chat + Inbox` and `Notes, Browse closed`
   both map to `command.view.editorNoteList`. English View menu shows
   the new name only. Palette keywords still include `inbox`.
   Files: `appCommandCatalog.test.ts`, `viewCommands.c72.test.ts`.

## Ran

```bash
npx vitest run \
  src/hooks/appCommandCatalog.test.ts \
  src/hooks/commands/viewCommands.c72.test.ts \
  src/components/usePrimeSessionSwitcher.test.tsx \
  src/components/PrimeExtensionsSection.test.tsx \
  src/components/SettingsPanel.test.tsx

cargo test --manifest-path src-tauri/Cargo.toml \
  hide_stops_owned_helpers_except_keep_working_prime
```

**Frontend:** 5 files, 84 tests, pass.
**Rust:** `hide_stops_owned_helpers_except_keep_working_prime` pass.

## Not this wave

- list-import / `import_jsonl`
- merge PR 66
- `/Applications` rebuild
- close #46
- `normalize_cwd`
- C66 store
- #51 Case 2
- other locales (C18)
- git commit
