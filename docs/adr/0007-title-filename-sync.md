---
type: ADR
id: "0007"
title: "Title equals filename (slug sync)"
status: superseded
date: 2026-03-15
superseded_by: "0044"
---

## Context

With the move to a flat vault structure (ADR-0006), filenames became the primary identifier for notes. Previously, titles were extracted from the first H1 heading, which was fragile (users could delete or change the H1 without realizing it affected the note's identity). A clear, deterministic mapping between title and filename was needed.

## Decision

**Every note's filename is `slugify(title).md`. The `title` frontmatter field is the source of truth for the human-readable title. On note open, the system syncs the title field to match the filename if they've diverged (filename wins). On rename, both title and filename are updated atomically.**

## Options considered

- **Option A** (chosen): `title = slugify(filename)` with bidirectional sync — deterministic, predictable, wikilinks resolve by title/filename stem. Downside: titles with special characters get simplified in filenames.
- **Option B**: UUID-based filenames with title only in frontmatter — filenames never change. Downside: vault is unreadable in Finder/terminal, breaks the "plain markdown files" principle.
- **Option C**: H1-based title extraction — no explicit title field. Downside: fragile, H1 can be accidentally deleted or changed, decoupled from filename.

## Consequences

- `extract_title` reads from frontmatter `title:` field, never from H1. Falls back to `slug_to_title()` (hyphens → spaces, title-case).
- `sync_title_on_open` auto-corrects desynced frontmatter on note open.
- `rename_note` updates both `title:` frontmatter and filename atomically, plus cross-vault wikilink updates.
- The H1 block inside BlockNote is hidden via CSS; a dedicated `TitleField` component above the editor is the primary title editing surface.
- Slug collision detection prevents duplicate filenames.
- Re-evaluation trigger: if users need filenames that don't match titles (e.g., short slugs for long titles).
