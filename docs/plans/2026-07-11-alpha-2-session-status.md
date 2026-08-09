# Alpha-2 (project-first navigation) — session status

Picks up `2026-07-10-rhizome-desktop-alpha-roadmap.md`'s Alpha-2 phase,
right after Alpha-1 (write hygiene) shipped. Plan file: implemented per
its own written plan (four tasks, TDD, one commit each), corrected
against two Hermes-draft assumptions that didn't hold up in the real
codebase (see plan's "Two corrections" section).

## Pushed this session (local; push pending final verification)

```
08b88418 feat: wire isWikiVault into Sidebar branch (Alpha-2 task 4)
c6495701 feat: project tree UI components + disclosure hook (Alpha-2 task 3)
dfe158af feat: project tree data model + builder (Alpha-2 task 2)
25b1f9c5 feat: is_wiki_vault detection (Alpha-2 task 1)
```

## Corrections found this session (not in either Hermes draft)

- **No "Category" concept exists anywhere.** The draft's Category→Project
  nesting assumed a project-hub note carrying a `category:`/`area:`
  field — no such mechanism exists in this codebase, no writer has ever
  emitted a category-like field. Shipped as Project → pages only (single
  implicit list), true categories deferred to a project-hub design.
- **`SettingsPanel.tsx` has zero per-vault toggles today** — relevant for
  Alpha-3, not Alpha-2, but discovered during the same fact-check pass.

## Done

- **Task 1 — `is_wiki_vault` detection**: `rhizome_write_location::is_wiki_vault`
  (same markers as `vault_uses_flat_layout`, separate fn — stays true
  even after a vault migrates to nested `wiki/` layout, unlike the flat-
  layout check). Exposed as a Tauri command alongside `check_vault_exists`.
- **Task 2 — `projectTreeData.ts`**: pure `entryProject` normalizer
  (scalar/array `project:` frontmatter) + `buildProjectTree` grouping
  (single project list + archive/inbox/unassigned buckets, priority
  archive > inbox > project-or-unassigned, excludes non-markdown and
  Type-definition entries).
- **Task 3 — UI components**: `src/components/project-tree/` — leaf row,
  project row, bucket section, one-level disclosure hook (not a fork of
  `useFolderTreeDisclosure`'s arbitrary-depth/rename machinery — Project
  → pages doesn't need it). `SidebarProjectsNavigation` composes them.
- **Task 4 — wired into the real Sidebar**: new `useIsWikiVault` hook
  (decoupled from `useVaultLoader`'s state machine), threaded
  `App.tsx` → `Sidebar` → `SidebarNavigation`'s branch point. New
  `'projects'` `SidebarGroupKey` for section collapse. Regression-verified
  in the browser: default/false `isWikiVault` renders Types/Folders
  exactly as before.
- Full suite green: 1139 Rust tests (85.55% line coverage), 4856
  frontend tests across 455 files (84.93% line coverage), lint/tsc
  clean, demo-vault clean.

## Known gaps / notes for next session

- **Expand-state persistence intentionally skipped** — no existing
  sidebar section persists expand state per-vault either (all use
  in-memory `useState` or the global, non-vault-scoped
  `sidebarCollapsed` localStorage key). Matches existing pattern; add a
  `VaultConfig` field later only if this actually bothers someone.
- **Alpha-3 (inbox automation) not started** — scoped in
  `~/.hermes/plans/2026-07-10_225519-wiki-saves-and-triggers-alpha.md`
  and this session's own approved plan file. First prerequisite: thread
  a real `trigger` parameter through `run_distill_via_agent`/
  `run_import_via_agent`/`rhizome_api::distill`/`import_source` — they
  currently hardcode `"manual"` internally despite `trigger` existing as
  a field on all 4 event functions since Alpha-1.
- **No project-hub-note design yet** — needed before true Category
  grouping, or before a physical `wiki/projects/<slug>/` layout migration
  (both explicitly out of scope, deferred per an earlier session's
  explicit user decision to keep the current physical layout).
- **`SettingsPanel.tsx` has no per-vault toggle precedent** — relevant
  for Alpha-3's inbox-automation switch, which will need a new small
  "Vault" settings section rather than reusing an existing pattern.
