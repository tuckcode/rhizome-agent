---
session: 2026-09-06T22:36Z
model: Cursor Grok 4.6
description: >-
  Area F subtraction: unadvertise Grok-wiki / wiki-generation MCP verbs,
  delete rhizome_grok_import, and drop parked smoke junk.
commits: pending
---

# Area F — MCP wiki tools + parked smoke

**Origin:** Cursor Grok 4.6 · 2026-09-06

## MCP

Removed from the advertised tool list and handlers:

- `rhizome_grok_import`
- `rhizome_generate_wiki`
- `rhizome_repo_research` (book-to-skill included; in-app Generate / `call_rhizome_tool` still has `rhizome_repo_research`)

`mcp-server/test.js` asserts those three names are absent from `listTools`.

## Rust

`rhizome_grok_import.rs` served only Grok-Wiki import. Deleted the module, `rhizome_api::grok_import` / `GrokImportMode`, the `call_rhizome_tool` arm, and the `rhizome-tool grok-import` subcommand. `rhizome-tool` now treats `grok-import` as an unknown subcommand.

Left `rhizome_repo_research` in Rust — Research panel still uses it.

## Smoke

Deleted `ai-notes-visibility-fix.spec.ts` (`test.fixme` + hardcoded `/Users/luca/Laputa/…`).
Deleted `improve-note-open-latency.spec.ts` (conditional skip / latency wish).
Removed the skipped TODO test from `create-open-relationship-note.spec.ts`; live tests stay.
Removed unused `verifyFocusable` from `tests/smoke/helpers.ts`.
