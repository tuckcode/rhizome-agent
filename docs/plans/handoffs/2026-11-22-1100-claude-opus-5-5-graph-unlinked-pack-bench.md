---
session: 2026-11-22T11:00-06:00
model: Claude Opus 5.5
description: Graph hides unlinked notes with a review list, rhizome_graph_pack tool, read-only real-vault Graph in browser dev, vault benchmarks (efficiency test and LongMemEval stage 1).
---

# Graph unlinked notes, graph pack, vault benchmarks

Graph hides notes with no links in or out by default. A chip ("N unlinked
notes · Review") opens a review list. Picking a row selects the note, which
keeps it visible. Guards: the open note and the selected note stay visible,
and a search shows matching unlinked notes. The legend now uses 13 px text.
Each bottom corner panel takes at most half the Graph width, so the legend and
the controls do not overlap at the 480 px minimum window.

`rhizome_graph_pack` returns one note's body plus each direct link with a
snippet, direction, and edge kinds, in one call. It works through MCP, the
native `rhizome_graph_*` arm, and `rhizome-tool graph-query <vault> pack`.

Browser dev: set `RHIZOME_DEV_GRAPH_VAULT` and Graph reads that vault through
`GET /api/dev-graph` (read-only). Without it, Graph uses the sample data.

Benchmarks: `docs/plans/2026-11-22-vault-benchmarks.md`. Scripts in
`scripts/bench/`. LongMemEval stage 1: Rhizome search ties BM25; the
`search_notes` phrase rule finds almost nothing; multi-session questions are
the gap. Stage 2 (model in the loop) is approved as a 30-question pilot.

Found: Rhizome search keeps one 129 MB embedding model copy per vault path
(`<OS cache>/com.tolaria.app/search/<vault-key>/model`). Not fixed yet.

QA: Onlook frames at 1512, 900, 700 and 480 px, checked by reading the DOM.
Screenshots of the WebGL Graph timed out in Onlook. Frontend coverage 88.98%
lines. Rust coverage not rerun (graph_queries, rhizome_api, and rhizome-tool
unit tests pass). Localization: none — English only (C18).
