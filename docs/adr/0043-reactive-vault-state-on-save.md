---
type: ADR
id: "0043"
title: "Reactive vault state: editor changes propagate immediately to all UI"
status: active
date: 2026-04-05
---
## Context

When a user edits frontmatter in the raw editor (or BlockNote preserves it), changes to metadata fields like `title`, `type`, `_favorite`, `_archived`, and `sidebar_label` must be reflected immediately across all UI components — sidebar sections, note list, breadcrumb bar, inspector, and tabs.

Previously, after `save_note_content`, only derived fields (`outgoingLinks`, `snippet`, `wordCount`) were updated in `vault.entries`. Frontmatter-derived fields were stale until a full vault reload.

## Decision

**All frontmatter changes are parsed in real-time and applied to `vault.entries` via `updateEntry()` during content editing, not after save.**

### How it works

1. **On every content change** (keystroke in raw editor, or BlockNote onChange), `useEditorSaveWithLinks.handleContentChange` is called.
2. It invokes `contentToEntryPatch(content)` which parses frontmatter and maps known keys to `VaultEntry` fields.
3. If the parsed patch differs from the previous one, `updateEntry(path, patch)` merges it into `vault.entries`.
4. All UI components derive from `vault.entries` via React reactivity — they re-render automatically.

### Mapped fields

`contentToEntryPatch` maps these frontmatter keys to `VaultEntry` fields:

| Frontmatter key | VaultEntry field | Notes |
|---|---|---|
| `title` | `title` | |
| `type` / `is_a` | `isA` | |
| `status` | `status` | |
| `_favorite` | `favorite` | |
| `_favorite_index` | `favoriteIndex` | |
| `_archived` / `archived` | `archived` | |
| `_trashed` / `trashed` | `trashed` | |
| `_organized` | `organized` | |
| `color` | `color` | Type entries |
| `icon` | `icon` | Type entries |
| `order` | `order` | Type entries |
| `sidebar_label` | `sidebarLabel` | Type entries |
| `visible` | `visible` | Type entries |
| `template` | `template` | Type entries |
| `sort` | `sort` | Type entries |
| `view` | `view` | Type entries |
| `aliases` | `aliases` | |
| `belongs_to` | `belongsTo` | |
| `related_to` | `relatedTo` | |

### Inspector operations use a separate, more direct path

When the user edits frontmatter via the Inspector panel, `runFrontmatterAndApply` calls the Tauri command and immediately applies the result via `updateEntry()`. This path was already reactive before this ADR.

### View files (.yml)

View files are not markdown notes — they have no frontmatter delimiters. When a `.yml` file is saved, `onNotePersisted` triggers `reloadViews()` to refresh the sidebar view list.

## Consequences

- Any new frontmatter key that should affect the UI must be added to `frontmatterToEntryPatch` and its delete counterpart.
- Components must read note metadata from `vault.entries` (via props), never from local state that could diverge.
- The `reload_vault_entry` Tauri command exists for full re-parsing from disk but is not needed in the normal editing flow — `contentToEntryPatch` handles it client-side.
