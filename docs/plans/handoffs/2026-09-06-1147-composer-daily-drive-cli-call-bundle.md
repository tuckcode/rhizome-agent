---
session: 2026-09-06T11:47:00-05:00
model: Composer
description: >-
  Daily-drive goal: packaged mcp-server was missing cli-call.mjs so vault skill
  seeding failed; bundle now includes it; Documents vault skill reseeded with
  graph + RHIZOME_TOOL_PATH.
---

# Daily-drive: cli-call in the package

**Origin:** Composer · 2026-09-06 · daily-drive goal

## Finding

Atticus’s Documents vault skill was still dated **2026-08-21** (no graph
tools, no `RHIZOME_TOOL_PATH`) even though `/Applications/Rhizome Agent.app`
from 2026-09-05 ships `rhizome-tool` and the Sep-05 skill rewrite.

Cause: `src-tauri/resources/mcp-server/` (what Tauri packs) only had
`index.js`, `ws-bridge.js`, and `package.json`. `seed_vault_skill` requires
`cli-call` **next to** that `index.js`. Resolution failed → connect logged
at **debug** → skill never rewritten.

CLI proof on the real vault:

- With `RHIZOME_TOOL_PATH` → graph health returns counts.
- Without → `Graph queries need the Rhizome sidecar`.

## Fix (in tree)

- `scripts/bundle-mcp-server.mjs` now builds a self-contained
  `cli-call.mjs` (ESM + `createRequire` banner so bundled deps can still
  `require()` Node builtins).
- `resolve_cli_call_path` still prefers `cli-call.mjs`, accepts `cli-call.js`.
- Seed miss is `log::warn` in `prime_session_host::connect`.
- Documents vault skill reseeded manually for today’s dogfood (points at repo
  `cli-call` + Applications `rhizome-tool` until the next install).

## Still open for the goal

- **/Applications** patched with `cli-call.mjs` the same day; Documents vault
  skill points at packaged CLI + `rhizome-tool`.
- Live Chat ask that needs the graph — **done 2026-09-06.** Atticus (Big Pickle)
  on Obsidian Vault: agent ran `rhizome_graph_health` via `rhizome-vault` and
  returned 69 notes / 11 wikilinks / 60 orphans / 7 dead links.
- #41 steer/queue: code path exists (C43/C44); awaiting native dogfood confirmation.
- C57 answers; session-import UI; mid-turn leftovers.
- Rebuild so `pick_mcp_server_dir` (prefer `.app` Resources over repo) lands in
  `/Applications`.
