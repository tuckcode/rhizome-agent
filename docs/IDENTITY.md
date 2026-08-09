# Rhizome Agent — identity

**This repository is not Rhizome Desktop.**

| | Rhizome Desktop | Rhizome Agent (this repo) |
|---|---|---|
| Purpose | Personal knowledge / vault / wiki app | Chat shell on the **Prime Agent** harness |
| GitHub | `knispo/rhizome` (public AGPL desktop) | `tuckcode/rhizome-agent` (private) |
| Folder (local) | e.g. Grok worktree `code-lens` | `~/code/projects/rhizome-agent` |
| Bundle id | `ai.rhizome.desktop` | `ai.rhizome.agent` |
| Product name | Rhizome | Rhizome Agent |
| Binary (Cargo) | `Rhizome` | `RhizomeAgent` |

## Origin

Hybrid bootstrap (Option C):

1. Snapshot of Rhizome desktop **source** (no `node_modules`, no `target`, no `.git`).
2. Day-1 renames so OS/Git never treat this as Desktop.
3. Evolve toward Prime RPC session host + chat UX; prune unused desktop surfaces in later commits.

Do **not** add `knispo/rhizome` as `origin`. Desktop and Agent stay separate remotes forever unless we deliberately vendor a crate later.

## Near-term direction

- UI: chat-like experience (existing AI panel as starting point).
- Brain: long-lived **Prime Agent** session (`--mode rpc` / harness), not “spawn CLI once per message.”
- Vault: Rhizome MCP tools when a vault is attached — Agent is not a second full wiki product on day one.

Session-host spike (slice 1): `docs/plans/2026-08-09-prime-harness-chat-spike.md`.
v0 brief + roadmap: `docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md` (glossary: root `CONTEXT.md`).
