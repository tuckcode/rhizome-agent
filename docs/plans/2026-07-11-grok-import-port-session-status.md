# Session: Port rhizome_grok_import to Rust (Phase 1b completion) — 2026-07-11

## What happened this session

1. **Ported `rhizome_grok_import`** — new `src-tauri/src/rhizome_grok_import.rs` mirrors `rhizome/grok_import.py` 1:1: `strip_details` (details/summary → callout, tag stripping, entity decoding), `convert_grok_page`, `build_frontmatter` (wikiStyle → Rhizome mode map), `import_wiki` (writes `index.md` + per-page `.md` + `events.jsonl`), `find_grok_wiki_files`, `format_wiki_listing`.
2. **Correctness fix over the Python original**: Python always wrote to `<vault>/sources/repos/<slug>/`, flat, regardless of vault layout. Routed placement through `rhizome_write_location::artifact_dir(vault_path, ArtifactKind::RepoWiki)` instead, so imports land in `wiki/sources/repos/...` for nested-layout vaults and `sources/repos/...` for flat-layout vaults — matching what search/Library already expect. Added a regression test (`import_wiki_uses_flat_layout_for_flat_layout_vaults`) proving both paths.
3. **Façade**: `rhizome_api::grok_import(vault_path, GrokImportMode::{List,One,Auto}, on_line)` — AppHandle-free, same shape as `distill`/`import_source`/`repo_research`.
4. **Wired `rhizome_commands.rs`**: `rhizome_grok_import` match arm now calls `rhizome_api::grok_import` directly instead of shelling `rhizome-grok-import` via `run_cli`. **Zero Python dependency left in `rhizome_commands.rs`.**
5. Registered `pub mod rhizome_grok_import;` in `lib.rs`.

## Verification

- `cargo build --lib` — clean.
- `cargo test --lib` — **1167 passed, 0 failed** (15 new tests in `rhizome_grok_import`, all green).
- `cargo clippy --lib --all-targets` — clean for touched files (one pre-existing unrelated warning in `rhizome_jobs.rs`, not touched).
- `cargo llvm-cov --fail-under-lines 85` — **86.07% total, gate passes**. New module itself: 90.42% line coverage.
- No frontend changes — `pnpm` checks not applicable this session.

## Scope notes

- Did **not** touch `mcp-server/index.js` — external MCP agents still shell Python for all 6 verbs until Phase 2 wires `RHIZOME_TOOL_PATH`. This session only moved the in-app/Tauri-command path off Python.
- Did **not** start Phase 2 (`rhizome-tool` sidecar CLI binary).

## What's next

**Phase 2** — build `rhizome-tool` sidecar binary (`search`, `distill`, `import-source`, `grok-import`, `repo-research` subcommands) and wire `mcp-server/index.js`'s `runRhizoCli` to prefer it via `RHIZOME_TOOL_PATH` when set, falling back to Python otherwise. Fully scoped in `docs/adr/0152-mcp-rust-sidecar.md` and `docs/plans/2026-07-10-mcp-bridge-scope.md`.
