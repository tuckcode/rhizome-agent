# Items Needing Review by Capable Model

Items that may benefit from a more thorough model's judgment before finalizing.

## 1. Research Panel Tauri IPC Wiring

Research Panel calls `invoke('call_rhizome_tool', ...)` but needs the Tauri Rust command to exist.

Files: `src/components/ResearchPanel.tsx`, `src-tauri/src/rhizome_commands.rs`

## 2. Format Selector Modal Icons

Verify all `@phosphor-icons/react` icons are available in the project's version.

File: `src/components/RhizomeFormatModal.tsx`

## 3. Distill Parser Accuracy

`parse_cards_from_text()` uses heuristic parsing (JSON blocks, YAML frontmatter, headings). May produce false positives. Better approach: LLM with structured output.

File: `rhizome/rhizome/distill.py`

## 4. Grok-Wiki Importer HTML Quality

`strip_details()` regex may not handle edge cases in Grok-Wiki HTML output (nested details, inline formatting, code blocks). Test against all 49 local pages.

File: `rhizome/rhizome/grok_import.py`

## 5. Source Import Error Handling

URL extraction with httpx needs timeouts, size limits, retry logic. Test with real URLs.

File: `rhizome/rhizome/import_source.py`

## 6. Rust Backend Hardening

`rhizome_commands.rs` needs: CLI timeouts, max output size limits, vaultPath validation, stdin piping for large text args, better error messages.

File: `src-tauri/src/rhizome_commands.rs`

## 7. Library Tab Data

`scan_vault_library` only scans `sources/repos/`. Should also scan documents, entities, concepts. Frontend `loadLibrary` needs to call it.

File: `src-tauri/src/rhizome_commands.rs`, `src/components/ResearchPanel.tsx`
