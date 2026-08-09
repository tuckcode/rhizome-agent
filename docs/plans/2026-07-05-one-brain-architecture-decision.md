# One Brain: the Shell-Out vs Absorb Decision

Answers the open question in `2026-07-05-architecture-rethink-handoff.md`.
Status: **proposed** — becomes an ADR when the user ratifies and implementation
starts. Written 2026-07-05 with full session context (bugs, reference repos,
live testing) still warm.

## Verdict

**Absorb, by strangler-fig — with exactly one Python survivor.**
rhizome-desktop stops treating the public `rhizome` CLI as its backend and
becomes the single brain: Rust core owns the vault contract, search index, and
library scanning; the app's *existing* agent layer (7 CLI adapters, streaming,
cancellation, permission modes) powers research/distill/import; the bundled
MCP server becomes the one door agents use. The only Python that survives is
`markitdown` document conversion, behind a one-verb contract. The public
`rhizome` repo lives on unchanged for CLI-only users, but the desktop no
longer depends on it. This matches the stated end state — "rhizome-desktop
replaces rhizome when it's ready" — the question was only ever sequencing.

## Why: the evidence is unusually one-sided

Every functional bug found in this session lives at the subprocess boundary,
zero live in the logic on either side:

| Bug | Layer |
|---|---|
| `rhizome-search` JSON shape had to be guessed | stdout parsing |
| Library scanner wrong about `sources/repos/<slug>/` nesting | disk-contract drift between repos |
| `research.py` regex silently drops every dash-containing path | CLI's own stdout-reparse of its agent's output |
| MCP tools visible but blocked in both permission modes | permission flags not threaded through the spawn |
| Dead uv shims / frozen tool install went stale | Python runtime + install lifecycle |

And the duplication inventory is damning — the desktop already independently
implements most of what it shells out for:

| Capability | Python CLI | Already in rhizome-desktop? |
|---|---|---|
| Vault watching | `rhizome-watch` (watchdog) | ✅ `vault_watcher.rs` (notify crate) |
| Agent orchestration | `research.py` spawns hermes/claude, reparses stdout with a buggy regex | ✅ 7 adapters, streaming events, cancellation, ADR-0148 |
| MCP server | `rhizome-mcp` | ✅ bundled Node tolaria server + ws-bridge |
| Full-text search | DuckDB FTS | ⚠️ partial (`search.rs`, no vectors) |
| File conversion | markitdown fork | ❌ |
| Hybrid embeddings | fastembed | ❌ (fastembed-rs exists, same ONNX models) |
| Graph analysis | networkx/louvain | ❌ (petgraph exists; low priority) |
| Bi-temporal memory | `rhizome-memory` | ❌ but **dormant — 0 facts in the real vault**, free to redesign |

Today an external agent's search goes: agent → Node MCP → **spawn Python** →
DuckDB → stdout → parse. Three runtimes for one query, for a single-user app.

## Destination architecture

```
                    ┌─ Rhizome Desktop ────────────────────────────┐
external agents ──► │ MCP server (bundled) ─┐                      │
(Claude/Hermes/...) │                       ├─► Rust core          │
in-app AI chat  ──► │ agent layer (exists) ─┘   • vault contract   │
Research panel  ──► │                           • write resolver   │
                    │                           • search index     │
                    │                           • library scan     │
                    │                           • events/graph     │
                    │        markitdown sidecar ◄─ (convert only)  │
                    └───────────────┬──────────────────────────────┘
                                    ▼
                         markdown vault(s) on disk
                         (source of truth, one contract)
```

Two contracts replace the sprawling CLI treaty:

1. **The vault contract** — one doc (`VAULT_CONTRACT.md`) + one Rust module
   (a `write_location` resolver: artifact type + destination vault → path +
   frontmatter). The Library scanner and every writer share this resolver, so
   scanner-vs-writer drift becomes impossible *by construction*, not by
   discipline. This is the real API of Rhizome; the CLI never was.
2. **The agent contract** — agents touch the vault through the MCP server,
   period. No more agents shelling `rhizome-*` directly on this machine
   (that's exactly how the flat-vs-`wiki/` drift crept in). The `llm-wiki-*`
   skills eventually retarget MCP verbs or retire.

## Disposition of each Python piece

| Piece | Fate |
|---|---|
| `rhizome-search` (DuckDB + fastembed) | **Absorb** → tantivy (or extend `search.rs`) + fastembed-rs, resident index in `~/.laputa/cache`, incrementally updated by the existing vault watcher |
| `rhizome-research` | **Replace, don't port** — rebuild on the desktop's agent layer; the regex bug dies with the code path |
| `rhizome-distill`, `import-source`, `grok-import` | **Replace** — thin prompt+write wrappers over the agent layer + write resolver |
| `rhizome-watch` | **Delete dependency** — already redundant |
| `rhizome-mcp` | **Delete dependency** — desktop's MCP server is the door |
| `rhizome-memory` | **Redesign later**, not port — it's empty; borrow resonant-lattice's tier/decay and ctx's session-transcript indexing when the time comes |
| `rhizome-graph` | **Defer** — absorb with petgraph only when a feature needs it |
| **markitdown fork** | **Keep** — the one justified subprocess. Document conversion is a deep ecosystem problem Python genuinely wins. Contract is narrow and stable: file in → markdown out. Optional dependency of the Import tab |

### DuckDB, resolved precisely

Earlier session note said "don't relitigate DuckDB — it's worth keeping."
Refinement: the **search verb** is sacred; the **engine** is an implementation
detail. DuckDB earned its keep as the fastest way to stand up hybrid search in
Python. Once search moves in-process to Rust, a resident tantivy/fastembed-rs
index is strictly better for the app's needs (the CLI rebuilds/loads the index
*per query* — fine for agents, wrong for search-as-you-type UX). DuckDB stays
in the public CLI for CLI users; it just doesn't come along on the absorption.

## Strangler-fig sequence — each step ships value alone

1. **Vault contract first** (cheap, kills the biggest bug class regardless of
   everything else): decide layout (see decision gate below), write
   `VAULT_CONTRACT.md`, build the shared write/read resolver, fix the Library
   scanner against it. The scanner bug and all future drift die here.
2. **Wire the MCP permission gate** (`claude_invocation.rs`: Power User mode
   must pass `--allowedTools mcp__tolaria__*` or equivalent; Vault Safe must
   *surface* blocks instead of failing silent). The desktop becomes a working
   agent-memory hub **while still shelling out** — immediate value, no
   absorption needed yet.
3. **Absorb search** — the single highest-leverage move: biggest boundary-bug
   surface, clearest contract, and unlocks resident-index UX (instant Ask
   results). Ask tab + MCP search verb switch to the Rust index; Python search
   path retired.
4. **Rebuild research/distill/import** on the agent layer + write resolver.
   Research panel's tabs stop spawning Python entirely.
5. **Demote the CLI dependency** — `rhizome_check_availability` and the
   "toolkit not installed" banner disappear; markitdown sidecar becomes the
   only external check, and only for Import.
6. **Memory, properly** — design the fact store on top of the absorbed index
   (tiers/decay/session-transcripts). New ADR at that point.

Steps 1–2 are small and could land in one session each. Step 3 is the one
real engineering lift. 4–6 are incremental after that.

## Decision gate for the user (the only one)

**Vault layout: adopt the nested `wiki/` convention or codify the current
flat one?** Recommendation: **adopt `wiki/`** — the CLI already writes it,
`WRITE_LOCATION.md` documents it, cachezero independently converged on it,
and it gives search clean exclusion boundaries (`raw/`, `governance/` stay
out of the index). Requires a one-time migration of the real Rhizome Vault
(scriptable; the vault is ~100 notes). But it's the user's data — his call,
made at step 1.

## The rejected alternative, honestly

"Keep shelling out, just harden the treaty" (`--format json` on every verb,
documented schemas, versioned CLI): rejected because it costs the *same
contract-specification work* as absorbing (schemas must be written either
way) while permanently keeping: two repos to sync (this session opened with a
force-push reconciliation mess between them), a Python runtime + install
lifecycle (dead shims already bit us once), no shared types across the
boundary, double MCP servers, per-query subprocess+index-load latency, and
the frozen-tool-install staleness trap. For a solo developer, one codebase
beats two codebases plus a treaty — the treaty *is* the maintenance burden.

## Risks

- **Rust velocity** for ML-adjacent work — mitigated by scope: only search is
  a real port (tantivy/fastembed-rs are high-level), everything else reuses
  existing desktop code.
- **fastembed-rs model parity** — same ONNX models as Python fastembed; verify
  BGE-small ranking parity against ~10 known-good queries from this session
  (e.g. "memory" against the real vault) before cutting over.
- **Losing agent access without the app running** — the MCP server currently
  rides in the app process. Acceptable for a personal tool; if it ever hurts,
  the Rust core can grow a headless mode. Public CLI also still exists.
- **Migration churn on the real vault** — gated, scripted, reversible via git.

## Verification per step

- Step 1: scanner test fixtures cover every artifact type in the contract;
  `rhizome_scan_library` returns repo wikis (fails today).
- Step 2: in-app AI chat successfully executes `mcp__tolaria__rhizome_search`
  in Power User mode (fails today, screenshot-verified).
- Step 3: side-by-side ranking parity harness (Rust index vs `rhizome-search`)
  on the real vault; Ask-tab latency < 100ms warm.
- Step 4: Generate/Import/Distill produce contract-conformant files with zero
  Python processes spawned (assert via process table during smoke test).
