---
session: 2026-08-22T16:00Z
model: Claude Opus 5
description: >-
  #39's five graph query tools built on the vault's own graph and pushed;
  the external rhizome-graph CLI measured as answering with a different
  graph (C40); pnpm test:mcp found never to have run mcp-server/test.js,
  49 tests ungated (C41); #35 settled as reasoning-depth and specced;
  #40 opened for the harness-identity question.
commits: 38f2c55
---

# 2026-08-22 — The graph answers questions now

**State:** `main` at `38f2c55`, pushed, tree clean, all gates green
(2m 26s, Chunk sidecar unavailable so the lanes ran locally).

### #39 — the parts, not the composition

Five scoped queries in `src-tauri/src/vault/graph_queries.rs`, pure
transforms over the `GraphDto` `build_graph` already produces: `health`,
`orphans`, `dead_links`, `neighbors`, `shortest_path`. Exposed the
standard three ways — `rhizome_api::graph_query`, a `rhizome_graph_*` arm
in `call_rhizome_tool`, and `rhizome-tool graph-query` — plus five MCP
tools.

Two judgement calls worth keeping:

- **Hubs are ranked on links between notes that exist.** Counting ghost
  targets would crown a note linking to five pages nobody wrote. The
  fixture test `most_connected_ignores_links_to_notes_that_do_not_exist`
  pins it.
- **Dead links group by the note that was never written**, sorted by how
  many notes want it, because the unit of work is writing that note. On
  the real vault the top entry is `wikilinks`, wanted by 9 notes.

`resolve_note` takes a path, a path minus `.md`, a title, or a filename
stem. An agent says "Alpha" and "notes/alpha.md" meaning one note;
failing on the wrong one reads as a broken tool.

**Not built:** the `rhizome_search` + traversal composition, and the UI
half (graph view renders the subgraph an answer names). `neighbors`
already returns the edges among its nodes so the data contract for the UI
half is ready. Both recorded on the issue.

### The external graph CLI answers with a different graph — C40

Measured on `~/Documents/Rhizome Vault`, same day, side by side:

| | `rhizome-graph` | in-repo `build_graph` |
|---|---|---|
| pages / notes | 144 | 155 |
| edges | 84 (`summary`) / 64 (`export`) | 174 |
| uncreated targets | not emitted | 37 |
| dead links | underivable | 51 |

`summary` and `export` disagree with **each other** by 20 edges: the
export collapses distinct slugs, so `entities/rhizome` and any other
`rhizome` become one node. Uncreated targets are dropped entirely, so
orphans and dead links — two of the five tools — cannot be built on it at
all. `communities` returns 112 groups for 144 pages, which is 107
singletons wearing a cluster label.

So the new tools have **no fallback** to it, and `runGraphQuery` fails
naming `RHIZOME_TOOL_PATH` instead. An agent quoting 144 notes at someone
looking at 155 in the graph view is worse than a tool that says what it
needs. `rhizome_graph_summary` itself is still wired to the CLI in both
`mcp-server/index.js` and `rhizome_commands.rs` — retiring it in favour of
`rhizome_graph_health` is the obvious move and its own change.

**The issue's framing was wrong and the numbers found it.** #39 described
the gap as scope/format/one-question — "a graph is computed and the agent
can reach it". It is computed, but not the same graph the user is looking
at. Measuring before building is what surfaced that; the issue text would
have led straight to building on the wrong source.

### `pnpm test:mcp` never ran `mcp-server/test.js` — C41

The script globbed `mcp-server/*.test.js`. That matches
`tool-service.test.js` and `vault-events.test.js` and **not** `test.js` —
so the stdio-lifecycle, vault, `vault-path`, `agent-instructions` and
`ws-bridge` suites, 49 tests, ran on no gate. Found by adding a test to
`test.js` and noticing the run stayed at 16.

This is the mirror image of the July finding that `tool-service.test.js`
was ungated because vitest's `include` never reached `mcp-server/`. Both
times a glob was the whole bug, both times everything was green while
unreachable. Fixed by naming `test.js` explicitly; 16 tests → 67. Do not
widen to `mcp-server/*.js` — that imports `index.js` and hangs.

### #35 settled, #40 opened

**#35 "verbose"** — Atticus asked for a recommendation and took it:
meaning **(1) reasoning depth**, sticky, one-click on the composer.
Relabelled `ready-for-agent` with the spec on the issue. (3) fails the
issue's own "obvious the next turn will differ" criterion; (1) is the only
one with real backing and merges with #38's live control strip. Sticky
because `set_prime_thinking_level` is daemon session state — per-turn
would be two extra round trips and a lie about what the daemon holds.

**#40** — the harness-identity question, filed rather than left in prose.
Atticus raised `deepseek-harness` mid-session as a third harness worth
pulling from. That is not another row in a table: "pull from several
harnesses to create our own" is a **third option** alongside
client-of-harnesses and own-the-loop, and it is the one that makes
licensing load-bearing. deepseek-harness is recorded as **unevaluated** —
noted on his recommendation, not verified.

### Open

- **#37** "Save as custom" — he said build it; not started.
- **#40** awaiting his decision; #39's composition and UI halves.
- C40 (`rhizome_graph_summary` still on the CLI), C39, C37, C33.
- `~/CLAUDE.md` step 1 names `agents/claude/vault-context.md`, which does
  not exist. Only `core-context.md` is there. Not fixed — it is his file.

---
