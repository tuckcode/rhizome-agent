# Rhizome Agent — identity

**This repository is not Rhizome Desktop.**

**Stamped 16:20:** still `tuckcode/rhizome-agent` / `ai.rhizome.agent`. Leftover wrap `7c7da1d`. Not Desktop.
Do not push to Desktop. Do not “fix branding back to Desktop.”

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

## Prime first, when Prime already does it

**If Prime has a mechanism that works, use Prime's — do not build a Rhizome
equivalent beside it.** Two reasons: a second implementation is a second thing
to keep correct, and anything that duplicates or contends with Prime's own
behaviour risks breaking the harness we are building on.

One distinction this does *not* erase: Prime's mechanisms operate on Prime's
harness state (`~/.prime/agent`), not on the vault. So "use Prime's" means
adopt its **design** for vault-side work — `/refine`'s two-stage judge, its
per-entry versioning and rollback — rather than letting harness state become
the memory store. Durable knowledge still lands in the vault as markdown; that
is the product.

Where Prime has nothing, Rhizome builds it. Where Prime has something worse,
say so explicitly and record why before diverging.

## Near-term direction

- UI: chat-like experience (existing AI panel as starting point).
- Brain: long-lived **Prime Agent** session (`--mode rpc` / harness), not “spawn CLI once per message.”
- Vault: Rhizome MCP tools when a vault is attached — Agent is not a second full wiki product on day one.

Session-host spike (slice 1): `docs/plans/2026-08-09-prime-harness-chat-spike.md`.
v0 brief + roadmap: `docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md` (glossary: root `CONTEXT.md`).
Frontend/IA roadmap: `docs/plans/2026-08-09-rhizome-agent-frontend-design-roadmap.md`.
