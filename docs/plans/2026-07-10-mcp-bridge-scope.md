# MCP ↔ Rust bridge — scope (locked)

Picks up `2026-07-10-one-brain-post-step4-roadmap.md` item 2 and the
peer-reviewed Hermes plan. **No packaging code until Phases 0–1a are green.**

Companion ADR: `docs/adr/0152-mcp-rust-sidecar.md`.

## Goal

External agents (MCP stdio) and the in-app Research panel use the **same Rust
core** for the six research verbs. Zero Python for those verbs after cutover
(markitdown remains optional per ADR-0150).

## Locked decisions

| Decision | Choice |
|----------|--------|
| Architecture | **Rust sidecar CLI** (`rhizome-tool` via Tauri `externalBin`) |
| App RPC into live Tauri | Rejected for v1 (“open app first” regresses external MCP) |
| Binary name | `rhizome-tool` |
| `rhizome_grok_import` | Port in v1 (no permanent Python island) |
| Packaging | macOS first |
| Research panel path | Stay **in-process** (no sidecar hop) |
| Concurrent search | Sidecar uses **reader-only** tantivy open (Phase 1a) |

## Why not app RPC

External MCP clients register vault-neutral stdio and often run with the
desktop app **closed**. Port 9710 is two-way but **JS↔JS only** (tool-service /
vault.js) — not a channel into Rust search/agent code. Port 9711 is one-way UI
broadcast.

## Critical gap: tantivy writer lock (Phase 1a)

`RhizomeSearchIndex::open_or_create` always takes an exclusive
`.tantivy-writer.lock`. The GUI keeps that writer for the app lifetime after
first Ask search. A sidecar that also opens a writer → **lock-busy**, not
“slower cold start.”

**Gate:** reader-only open succeeds while a writer holds the lock on the same
index dir. Hard requirement before search cutover.

**Not true today:** vault watcher does **not** feed the search index (no
watcher→reindex wiring). Do not depend on it.

## Verb cutover (MCP)

| Tool | Target |
|------|--------|
| `rhizome_search` | Rust reader-only search (sidecar) |
| `rhizome_distill` | existing agent-layer Rust |
| `rhizome_import_source` | existing agent-layer Rust |
| `rhizome_repo_research` | existing agent-layer Rust |
| `rhizome_generate_wiki` | **alias** → research (4c already writes the page) |
| `rhizome_grok_import` | port to Rust in this project |
| lint / graph | out of scope; keep Python via argv-safe `execFile` |

## Phases

0. **This doc + ADR-0152** (locked). Done.
1a. **Reader-only tantivy open + lock tests** (blocks search cutover). Done.
1b. Extract `rhizome_api` (AppHandle-free façade + grok port). Done.
2. **Dev `rhizome-tool` binary + `RHIZOME_TOOL_PATH` MCP wire. Done (2026-07-12).**
   `src-tauri/src/bin/rhizome_tool.rs` — new `[[bin]]` target, subcommands
   `search|distill|import-source|repo-research|grok-import` wrapping
   `rhizome_api` 1:1 (`generate_wiki` has no subcommand of its own — the MCP
   handler routes it onto `repo-research`, per the alias row above).
   `mcp-server/index.js` branches all six handlers on `RHIZOME_TOOL_PATH`
   via a shared `resolveRhizoTarget()` helper; unset (default) keeps the
   exact pre-existing Python `execFileSync` argv byte-for-byte. When set,
   `distill`/`import_source`/`repo_research`/`grok_import`(auto) skip the
   JS-side `appendRhizomeEvent` call — `rhizome_api` already writes its own
   `.rhizome/events.jsonl` entry with `trigger: "agent"`, so the JS event
   would just double-log. `--list-kinds` (distill) has no Rust equivalent
   yet and stays Python-only regardless — it's static enum introspection,
   not one of the six write verbs. Not done: packaging/wiring the app to
   actually set `RHIZOME_TOOL_PATH` — that's Phase 3.
3. Packaging (`externalBin`, macOS first, codesign).
4. Full MCP cutover + ARCHITECTURE update + grep gate.
5. Verification matrix (app open/closed, no Python PATH, coverage).

## Already done (not bridge)

Shell injection: `mcp-server/index.js` / `ws-bridge.js` use `execFileSync` +
argv (no shell join). Commit separately.

## Empty index policy (sidecar)

Prefer: try reader-only; if missing/empty, attempt short-lived writer
`open_or_create` + reindex; if writer lock busy, return a clear error naming
that Rhizome Desktop holds the index (retry after Ask has built once).

## Non-goals

Backlog #1 (flaky test / CodeScene / l10n), step 6 Memory, watcher→index,
lint/graph absorb, hybrid app RPC.
