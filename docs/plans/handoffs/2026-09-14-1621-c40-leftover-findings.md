---
session: 2026-09-14T16:21-05:00
model: Grok 4.6 (Cursor)
description: >-
  C40 leftover findings: rhizome_graph_summary still shells out to external
  rhizome-graph CLI on Rust call_rhizome_tool and ws-bridge paths; MCP stdio
  fixed in a61374e; align or retire on remaining paths.
commits: none
---

# C40 — `rhizome_graph_summary` leftover findings

**Origin:** Cursor Grok 4.6 · 2026-09-14 16:21 · findings only. No commit.

Parent context: [issue #39 findings](2026-09-14-1613-issue-39-findings.md) ·
**C40-OPEN** in `docs/HANDOFF.md`.

---

## Problem (measured, not theoretical)

`rhizome_graph_summary` on the **external Python `rhizome-graph` CLI** builds a
different graph than in-repo `vault::graph::build_graph` (what the app draws and
what the five #39 tools use). On Rhizome Vault (2026-08-22):

| | `rhizome-graph` CLI | in-repo `build_graph` |
|---|---|---|
| pages / notes | 144 | 155 |
| edges | 84 (`summary`) / 64 (`export`) | 174 |
| uncreated targets | dropped | 37 |
| dead links | underivable | 51 |

Additional CLI defects: slug collapse (`entities/rhizome` vs other `rhizome`
slugs merge); `communities` mostly singletons with a cluster label. Orphans and
dead links **cannot** be derived from the CLI output.

---

## What is already fixed

**MCP stdio path** — commit **`a61374e`**: `mcp-server/index.js`
`handleRhizomeGraphSummary` delegates to `handleRhizomeGraphHealth` →
`rhizome-tool graph-query health` via `runGraphQuery`. Regression tests in
`mcp-server/test.js` pin same argv as health and sidecar-required error when
`RHIZOME_TOOL_PATH` is unset.

Prime agents on the normal stdio MCP server get the in-repo graph for
`rhizome_graph_summary`.

---

## Leftover — still on external CLI

### 1. Tauri `call_rhizome_tool`

**File:** `src-tauri/src/rhizome_commands.rs` lines 104–107

```rust
"rhizome_graph_summary" => {
    let vault = args.get("vaultPath").ok_or("Missing vaultPath")?;
    run_cli(&["rhizome-graph", "summary", vault])
}
```

Every other `rhizome_graph_*` name (except summary) hits the shared arm at
108–111: `graph_query_from_tool` + `rhizome_api::graph_query` on
`build_graph`. Summary alone is special-cased to the Python CLI.

**Who hits this:** in-app callers of `invoke('call_rhizome_tool', …)` — Research
panel, menu-bar companion (`useMenuBarCompanionVault.ts`), mock-tauri tests.
Not the stdio MCP path.

### 2. WS bridge executor

**File:** `mcp-server/ws-bridge.js` lines 179–192

```javascript
['rhizome_graph_summary', async (args) => {
  // …vault resolution…
  const out = execFileSync('rhizome-graph', ['summary', vaultPath], {
    encoding: 'utf-8',
    timeout: 30000,
  })
  return { result: out }
}],
```

`rhizome_graph_summary` is the **only** graph tool in `TOOL_EXECUTORS`. No
`rhizome_graph_health` / orphans / neighbors / path on the bridge. Uses bare
`rhizome-graph` on `$PATH`, not `RHIZOME_TOOL_PATH` + `graph-query`.

**Who hits this:** WebSocket bridge clients (browser extension / UI bridge)
spawned from Tauri (`mcp::spawn_ws_bridge_with_paths`). Distinct from stdio MCP.

---

## Stale docs (secondary)

| Doc | Stale bit |
|---|---|
| `docs/HANDOFF.md` C40 | Still says summary wired to CLI in **`mcp-server/index.js`** — false since `a61374e`; Rust + ws-bridge claim still true |
| `docs/ARCHITECTURE.md` § scoped graph queries | Correct that summary shells out; does not note MCP stdio is fixed |

---

## Fix direction (findings only — do not implement here)

**Do not invent a new MCP tool.** Surface is the five #39 tools plus
`rhizome_graph_health`; C40 is align or retire `rhizome_graph_summary` on the
two remaining paths:

| Path | Obvious alignment |
|---|---|
| `rhizome_commands.rs` | Drop the special case; route summary to `GraphQuery::Health` like siblings, or remove the arm and document `rhizome_graph_health` as the name |
| `ws-bridge.js` | Mirror MCP: `execFileSync(RHIZOME_TOOL_PATH, ['graph-query', vaultPath, 'health'], …)` with same sidecar-missing error as `rhizome_save_capture` |

Retiring the tool name (breaking change for agents/scripts that still call
`rhizome_graph_summary`) is a separate product decision; alignment preserves
the alias.

**Tests to extend when fixing:** Rust unit/integration for
`call_rhizome_tool("rhizome_graph_summary", …)`; ws-bridge executor test if one
exists (today graph summary on bridge is untested for C40).

---

## Verdict

**C40 partially closed.** MCP stdio fixed; **Rust dispatch and ws-bridge still
return C40-wrong numbers** for `rhizome_graph_summary`. Finishing C40 is a
small, localized change on two files — not a new tool or #39 scope expansion.

---

## Not this session

- No implementation, commit, push, or rebuild from this findings file alone.
- Do not git add or commit unless Atticus asks.
