---
type: ADR
id: "0038"
title: "Frontmatter-backed favorites with _favorite and _favorite_index"
status: active
date: 2026-04-02
---

## Context

Users want to pin frequently-accessed notes to a dedicated FAVORITES section in the sidebar for quick navigation. The app needs a persistence mechanism for which notes are favorited and their display order.

## Decision

**Favorites are stored as two system properties in each note's YAML frontmatter: `_favorite: true` and `_favorite_index: <integer>`.**

- `_favorite`: boolean. Present and `true` = favorited. Absent = not favorited. Toggling off deletes the key entirely (no `_favorite: false`).
- `_favorite_index`: integer. Controls display order in the FAVORITES sidebar section (lower = higher). Assigned automatically on favorite, updated on drag-to-reorder.
- Both use the `_` prefix convention (ADR 0008) — they are system-owned and hidden from the Properties panel.

## Options considered

- **Frontmatter per-note (chosen)**: Each note carries its own favorite state. Portable across devices (synced via git). No separate metadata file. Cons: two extra frontmatter writes on reorder.
- **Separate `.laputa/favorites.json` file**: Central list of favorite paths. Simpler reorder (one file write). Cons: not portable if `.laputa/` is gitignored; path references break on rename.
- **SQLite/app-level metadata**: Fast queries. Cons: not synced via git; diverges from frontmatter-first data model established in ADR 0008.

## Consequences

- Favorites survive vault sync via git — any client that reads frontmatter sees them.
- Reorder writes `_favorite_index` to N files (one per affected note). Acceptable for typical favorites lists (< 20 items).
- If `_favorite: true` exists but `_favorite_index` is absent, the note is appended to the end of the list.
- Re-evaluate if favorites list exceeds ~50 items and reorder writes become a performance concern.
