---
type: ADR
id: "0006"
title: "Flat vault structure (no type-based folders)"
status: active
date: 2026-03-15
---

## Context

Originally, notes were organized into type-based subfolders (`project/`, `person/`, `topic/`, etc.). Changing a note's type required moving it between folders, which broke wikilinks, complicated wikilink resolution (paths vs titles), and created friction for users who wanted to reorganize their knowledge. It also made vault scanning more complex and introduced edge cases around folder creation/deletion.

## Decision

**All user notes live as flat `.md` files at the vault root. Type is determined solely from the `type:` frontmatter field — never inferred from folder location.** Only a small set of protected folders exist: `type/` (type definition documents), `config/` (meta-configuration), and `attachments/`.

## Options considered

- **Option A** (chosen): Flat vault with frontmatter-only type — simple wikilink resolution (title/filename only), no file moves on type change, vault scanning restricted to root + protected folders. Downside: large vaults may look cluttered in Finder.
- **Option B**: Keep type-based folders — familiar Obsidian-like structure. Downside: type changes require file moves, wikilink resolution needs path awareness, scanning is recursive and slower.
- **Option C**: Hybrid (folders optional, type still from frontmatter) — maximum flexibility. Downside: two ways to do the same thing, confusing for AI agents and automation.

## Consequences

- Wikilink resolution is simplified to multi-pass title/filename matching — no path-based matching needed.
- Changing a note's type is a frontmatter edit, not a file move.
- A `flatten_vault` migration command and wizard were added for existing vaults with type folders.
- `vault_health_check` detects stray files in non-protected subfolders.
- `scan_vault` only indexes root-level `.md` files plus protected folders — non-protected subdirectories are ignored.
- Re-evaluation trigger: if users need nested folder hierarchies for non-type organization (e.g., project-specific subdirectories).
