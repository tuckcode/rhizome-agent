# Phase 3 — Memory tickets (from reality after Phase 1)

Published after Phase 1 Prime chat path implementation. Tracker: GitHub Issues on `tuckcode/rhizome-agent`.

| # | Issue | Blocked by |
|---|--------|------------|
| 1 | https://github.com/tuckcode/rhizome-agent/issues/1 | None (after Phase 1) |
| 2 | https://github.com/tuckcode/rhizome-agent/issues/2 | #1 |
| 3 | https://github.com/tuckcode/rhizome-agent/issues/3 | #1, #2 |
| 4 | https://github.com/tuckcode/rhizome-agent/issues/4 | #3 |

Work the frontier: start with MCP injection once Phase 1 is merged/dogfooded.


## Implementation notes (2026-08-09)

### #1 Inject Rhizome MCP — landed as skill + CLI bridge

Prime's host MCP path is HTTP-first; stdio servers are not fully wired through
the kernel integration layer. Landed approach:

1. `mcp-server/cli-call.mjs` — one-shot MCP client → local stdio server
2. `prime_vault_skill` seeds `<vault>/.prime/agent/skills/rhizome-vault/SKILL.md`
   on host spawn/ensure when cwd looks like a vault
3. Optional `mcpServers.rhizome` stdio entry in vault `.prime/agent/settings.json`
   for when Prime kernel stdio support matures

Verified: `VAULT_PATH=... node cli-call.mjs search_notes '{"query":"..."}'` returns hits.
