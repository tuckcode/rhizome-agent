---
type: ADR
id: "0022"
title: "BlockNote as the rich text editor"
status: active
date: 2026-02-15
---

## Context

Laputa needs a rich text editor that can render markdown with YAML frontmatter, support custom inline content types (wikilinks), and provide a modern editing experience. The editor must handle the markdown-to-blocks-to-markdown round-trip without data loss.

## Decision

**Use BlockNote as the primary rich text editor, with CodeMirror 6 as an alternative raw editing mode. Custom wikilink inline content is defined via `createReactInlineContentSpec`. Markdown round-tripping uses a pre/post-processing pipeline with placeholder tokens for wikilinks.**

## Options considered

- **Option A** (chosen): BlockNote + CodeMirror 6 raw mode — BlockNote provides modern block-based editing, CodeMirror gives power users direct markdown access. Downside: wikilink round-tripping requires custom preprocessing pipeline.
- **Option B**: ProseMirror directly — maximum control. Downside: much more boilerplate, no block-level abstractions, harder to maintain.
- **Option C**: CodeMirror only (no rich text) — simplest, no round-trip issues. Downside: poor UX for non-technical users, no inline previews.
- **Option D**: Monaco Editor — rich features, VS Code-like. Downside: heavy, designed for code not prose, no block-level structure.

## Consequences

- Custom wikilink type defined in `editorSchema.tsx` via `createReactInlineContentSpec`.
- Markdown-to-BlockNote pipeline: `splitFrontmatter()` → `preProcessWikilinks()` → `tryParseMarkdownToBlocks()` → `injectWikilinks()`.
- BlockNote-to-Markdown pipeline: `blocksToMarkdownLossy()` → `postProcessWikilinks()` → prepend frontmatter.
- Placeholder tokens use `‹` and `›` (U+2039/U+203A) to avoid colliding with markdown syntax.
- Raw editor (CodeMirror 6) toggled via Cmd+K → "Raw Editor" or breadcrumb bar button.
- The H1 block is hidden via CSS in favor of a dedicated `TitleField` component.
- Re-evaluation trigger: if BlockNote's markdown round-tripping degrades or a better block editor emerges.
