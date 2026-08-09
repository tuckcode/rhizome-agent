---
type: ADR
id: "0152"
title: "MCP research verbs via Rust rhizome-tool sidecar"
status: active
date: 2026-07-10
---

## Context

One Brain steps 1–5 moved the Research panel (search, distill, import, repo
research) onto the Rust core. External agents still reach those capabilities
through `mcp-server/index.js`, which shells the public Python `rhizome-*`
CLIs. That process is a separate Node stdio child with no live connection to
the Tauri app's warm index.

Two bridges were considered:

1. **Compiled Rust sidecar** the Node MCP process `execFile`s.
2. **Two-way RPC** into the running Tauri app (upgrade the WebSocket stack).

Port 9710 is already request/response, but only for JS vault tools — it does
not call Rust research/search. Port 9711 is one-way UI broadcast. External MCP
registration is vault-neutral stdio and often runs **with the desktop app
closed**.

Separately, `RhizomeSearchIndex::open_or_create` always acquires tantivy's
exclusive writer lock, and the GUI holds a warm writer for the session after
first search. A second process that also opens a writer fails lock-busy.

## Decision

**What was decided.**

1. **Ship a Rust CLI sidecar (`rhizome-tool`)**, bundled later via Tauri
   `externalBin`, invoked from the Node MCP server with argv arrays
   (`execFile` / `execFileSync` only — never shell strings).
2. **Reject app-RPC for v1** for research verbs so external agents do not
   require Rhizome Desktop to be open.
3. **Research panel stays in-process** — same library, no sidecar hop for UI.
4. **Search multi-process rules:** the GUI may hold a writer; the sidecar
   (and any non-GUI caller) must open the on-disk index **reader-only** for
   query. If the index is missing/empty, the sidecar may open a short-lived
   writer to build; if the writer lock is held by the app, return a clear
   structured error (retry after the app has indexed once).
5. **Cut over all six research MCP verbs** to the sidecar once ready:
   search, distill, import_source, repo_research, generate_wiki (alias of
   research), grok_import (**ported in v1**, no permanent Python island).
6. **Packaging order:** macOS first; Windows/Linux follow. This app has no
   `externalBin` pipeline yet.
7. **lint / graph** remain Python until a later absorption; not part of the
   “one door” research cutover.

## Options considered

- **Option A — Rust sidecar (chosen):** works app-closed; matches existing
  process boundary; packaging cost real but one-time. Requires reader-only
  search open for concurrent GUI+sidecar.
- **Option B — App RPC:** reuses warm state; forces “open Rhizome first”; new
  trust/protocol surface. Rejected for v1.
- **Option C — Hybrid:** prefer app when up, sidecar when not. Doubled
  failure modes; deferred.

## Consequences

Easier: one Rust implementation path for research verbs; external agents
stop depending on the public Python toolkit install; injection-prone shell
joins are out of the design (argv only).

Harder: first `externalBin` packaging/signing work; must maintain
reader-only vs writer open paths and multi-process tests; sidecar cold start
and optional short-lived index build under lock contention.

Re-evaluate if reader-only latency or packaging cost becomes painful — then
consider a long-lived sidecar daemon or limited app RPC for search only.

## Advice

Peer review of the draft plan (2026-07-10) confirmed Option A, the writer-lock
gap, and the four product defaults (name, grok in v1, macOS-first, app
in-process). Scope: `docs/plans/2026-07-10-mcp-bridge-scope.md`.
