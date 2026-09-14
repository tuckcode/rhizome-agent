---
session: 2026-09-14T12:15-05:00
model: Grok 4.6 (Cursor)
description: >-
  C72 View-label quality review. Working-tree English labels are
  Notes, Browse closed (⌘2) and Notes, Browse open (⌘3). Inbox
  folder name unchanged. Catalog keeps Chat + Notes / Chat + Inbox
  as search aliases only. C72 vitest 8/8. Clean — no product fix.
commits: none
---

# C72 View-label review — 2026-09-14 12:15

**Origin:** Cursor Grok 4.6 · 2026-09-14 · quality review only

**Verdict: clean.** No product bug. No code change. No extra tests.

Did not commit. Did not push. Did not rebuild. Did not touch
`import_jsonl`, PR #66, `/Applications`, issue #46, `normalize_cwd`,
or the C66 store. Did not edit non-English locale files (C18).

## Label sites (working tree vs last commit)

Four user-visible English sites match. Command ids are the same as
before (`view-editor-list` / `viewEditorList` → `editor-list` / ⌘2;
`view-all` / `viewAll` → `all` / ⌘3).

- `src/hooks/commands/viewCommands.ts` — palette labels
  `Notes, Browse closed` and `Notes, Browse open`. Keywords still
  include `inbox` for search. Ids unchanged.
- `src/lib/locales/en.json` — `command.view.editorNoteList` and
  `command.view.fullLayout` plus the View-menu twin
  `menu.view.allPanels` (same ⌘3 English string). No other `en.json`
  keys in this rename.
- `src/shared/appCommandManifest.json` — View menu item labels only.
  Command keys and accelerators unchanged.
- `src/hooks/appCommandCatalog.ts` — new names added to
  `MENU_LABEL_KEYS`. Old `Chat + Inbox` and `Chat + Notes` stay as
  catalog aliases (lookup keys, not menu copy).

## Leftover grep (`src/`)

User-visible `Chat + Notes` / `Chat + Inbox` leftovers: **none**.

Hits are only:

- catalog aliases in `appCommandCatalog.ts` (intentional)
- assertions in `appCommandCatalog.test.ts` and
  `viewCommands.c72.test.ts` (tests, not UI)

No matches under `src/components/`. No matches in `src-tauri/`.

Inbox is still the folder: `menu.go.inbox` = `Inbox`,
`command.navigation.goInbox` / `go-inbox` = `Go to Inbox`,
`sidebar.nav.inbox` = `Inbox`. Rail label stays `Notes`.

## Tests

```text
npx vitest run src/hooks/commands/viewCommands.c72.test.ts \
  src/hooks/commands/navigationCommands.c72.test.ts \
  src/hooks/appCommandCatalog.test.ts
```

3 files, 8 tests, all pass (~550ms). No extra tests added.

## Not a bug this morning

Other locale files still have older translations for the same keys
(C18: leave them). Packaged `/Applications` at `476756c` still shows
the old View names until a later rebuild — out of scope.

Localization: none — English only (C18).
PostHog: no event needed because review-only, no product change.
