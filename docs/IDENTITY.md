# Rhizome — identity

**This repository is not Rhizome Desktop.**

The user-facing product name is **Rhizome** (knispo, 2026-10). The GitHub
repo, bundle id, config directory, and Cargo binary stay as they were so
existing keys and settings keep working.

GitHub: `tuckcode/rhizome-agent`. Bundle id: `ai.rhizome.agent`.
Do not push this repo to the Desktop remote. Do not rename the product back to Desktop.

| | Rhizome Desktop | Rhizome (this repo) |
|---|---|---|
| Purpose | Personal knowledge / vault / wiki app | Chat UI plus Rhizome's own harness; Rhizome's own engine is the only chat engine (ADR-0187); Prime and Hermes are no longer chat engines ([ADR-0189](adr/0189-no-ties-to-outside-harnesses.md)); leftover code is still in the repo until the follow-up PRs |
| GitHub | `knispo/rhizome` (public AGPL desktop) | `tuckcode/rhizome-agent` |
| Folder (local) | e.g. Grok worktree `code-lens` | `~/code/projects/rhizome-agent` |
| Bundle id | `ai.rhizome.desktop` | `ai.rhizome.agent` |
| Product name (menus, window) | Rhizome | Rhizome |
| Binary (Cargo) | `Rhizome` | `RhizomeAgent` (kept; Desktop already uses `Rhizome` on PATH) |
| Binary (installed app) | `Rhizome` | `Rhizome` (`mainBinaryName`) |

## Origin

Hybrid bootstrap (Option C):

1. Snapshot of Rhizome desktop **source** (no `node_modules`, no `target`, no `.git`).
2. Day-1 renames so OS/Git never treat this as Desktop.
3. Evolve toward Rhizome's native chat engine and harness UX; prune unused desktop surfaces in later commits.

Do **not** add `knispo/rhizome` as `origin`. Desktop and Agent stay separate remotes forever unless we deliberately vendor a crate later.

## Prime first, when Prime already does it

**Superseded by [ADR-0189](adr/0189-no-ties-to-outside-harnesses.md):** Rhizome has no tie to outside harnesses; this section is kept for history.

**Amended 2026-10-09 (ADR-0180):** Rhizome owns the agent loop. "Use
Prime's" still applies when Prime is the attached engine, and as a
design source for vault-side work.

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
- Harness: Rhizome owns the agent loop (ADR-0180). Native is the only chat engine (ADR-0187). Prime and Hermes are no longer chat engines (ADR-0189); the chat engine picker went in #218, and leftover code is still in the repo until the follow-up PRs.
- Vault: Rhizome MCP tools when a vault is attached — not a second full wiki product on day one.

Session-host spike (slice 1): `docs/plans/2026-08-09-prime-harness-chat-spike.md`.
v0 brief + roadmap: `docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md` (glossary: root `CONTEXT.md`).
Frontend/IA roadmap: `docs/plans/2026-08-09-rhizome-agent-frontend-design-roadmap.md`.
