# CONTEXT.md — Rhizome Agent

Single-context glossary for agents working in this repo. Product decisions live in
`docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md`. Architecture detail
still lives in `docs/ARCHITECTURE.md` / `docs/ABSTRACTIONS.md` (Desktop inheritance).

## Product

| Term | Meaning |
|------|---------|
| **Rhizome Agent** | Desktop app (`ai.rhizome.agent`, `tuckcode/rhizome-agent`): research & **memory** product whose **harness** is Prime Agent. Not Rhizome Desktop. |
| **Rhizome Desktop** | Separate product (`ai.rhizome.desktop`, `knispo/rhizome`): full vault/wiki shell. Do not push Agent work to Desktop origin. |
| **v0** | Circle-ready bar: daily multi-turn Prime chat, vault tools when attached, auth via `~/.prime`, skills+status smooth; BYO `prime-agent` OK. Not full harness-desktop parity. |
| **Trusted circle** | v0 audience: Atticus + small trusted users — not strangers-first launch. |

## Harness

| Term | Meaning |
|------|---------|
| **Prime / Prime Agent** | The **only** agent runtime in Agent product UI. Long-lived session engine, skills, extensions, providers/models, compaction, continual harness. **Built on Pi** — session JSONL under `~/.prime/agent/sessions/` is Pi-shaped (Mindwalk already labels it `harness: pi`). |
| **Harness** | Prime’s tooling and infrastructure embedded in the chat desktop shell (Hermes-Desktop-class ambition over time; v0 = core loop + skills/status). |
| **Prime daemon** | Prime’s own background service. Runs independently of any client and outlives them; hosts workers. Rhizome connects to it, does not own it (ADR-0163). |
| **Session host** | Rhizome’s Rust client of the [[Prime daemon]] (`prime_session_host`). A *connection*, not a parent — closing Rhizome detaches it and leaves sessions running. Superseded the RPC-child owner it was until 2026-08-15. |
| **Session** | The user-facing unit of work: one conversation with Prime, listed, named, switched and resumed. **The only word the UI uses** for a running thing. Follows Hermes Agent, which meets the same product-name collision and resolves it the same way. |
| **Worker** | The daemon-side process holding one or more sessions. **Internal to the transport layer** — never surfaced in UI or product copy. |
| **Subagent** | A session Prime spawned from another session (Prime’s RLM recursion). Subordinate by name, so it does not compete with [[Session]]. |
| **Agent** | Reserved for the product, **Rhizome Agent**. Never a running thing — that is a [[Session]]. |
| **Model** | An LLM selected **through Prime** (e.g. xAI/OpenAI/Anthropic as configured in `~/.prime`). Not a separate in-app “agent backend.” |
| **Agent backend** (legacy) | Desktop-era CLI targets (Claude Code, Codex, Hermes, …). **Hidden** in Agent UI. Retains the old third sense of “agent”; rename on contact so [[Agent]] means only the product. |
| **Goal** | A persistent objective a [[Session]] works toward, with a token budget. Readable from Prime’s state; **set by invoking Prime’s own `goal` skill**, not by a protocol call — the one harness control without a direct mechanism. |
| **Heartbeat** | A recurring prompt a [[Session]] scheduled for *itself* — Prime re-entering its own work on a timer. |
| **Schedule** | A one-off or recurring job on the [[Prime daemon]]. Distinct from [[Heartbeat]]: a heartbeat is the session waking itself, a schedule is work booked on the daemon. |
| **Harness controls** | The interactive surface for [[Goal]], [[Heartbeat]], [[Schedule]], model and thinking level. State you *read and set* — as opposed to the [[Command menu]], which is actions you *run*. |
| **Command menu** | The `/`-triggered list in the composer. Carries Prime’s own commands and Rhizome-installed skills only — **never the user’s own `~/.agents/skills`**, which are a personal coding toolkit and not part of this product. |

## Memory

| Term | Meaning |
|------|---------|
| **Vault** | User’s Rhizome/Obsidian-style note tree on disk. **Source of truth for durable human knowledge.** |
| **Durable knowledge** | Facts/notes meant to outlive a chat turn — always land in the **vault**, not only in Prime session files. |
| **Prime session memory** | Transcript/tree under `~/.prime/agent/sessions/` plus compaction. Operational continuity for the agent, not the user’s wiki. |
| **Continual harness** | Prime’s persisted ledger (`rlm.harness`: prompt notes, memories, skill specs, subagents, refine). Agent self-improvement layer — **not** a substitute for the vault. |
| **Promote / save-to-vault** | Explicit path (tool and/or UI) that turns chat or harness material into vault notes. v0 requires at least one first-class path. Prefer promote over silent dual-write or auto-wiki. |
| **Memory loop** | Chat → agent works → **promote durable bits into the vault** → search/open next time. |

## Access & packaging

| Term | Meaning |
|------|---------|
| **Default toolkit** | Curated vault tools via `rhizome-vault` skill (search/read/create/open). Prefer these over raw FS/IPython vault crawls. **No Safe/Power product mode** for circle v0 — power users install more Prime skills naturally. |
| **BYO Prime** | User installs/logs in `prime-agent` themselves; acceptable for circle v0. |
| **Bundled runtime** | App ships Node/Prime (or equivalent) so non-CLI friends get a smooth install — packaging phase exit, not the first circle v0 gate. |

## UX posture

| Term | Meaning |
|------|---------|
| **Chat-first** | Primary surface is conversation with Prime, not the full Desktop wiki chrome. |
| **Vault-aware** | With a vault attached: MCP tools, open-note from results, save/promote. Without vault: chat still works; memory depth locked. |
| **Open-note** | Enough note UI to open/edit a vault file from a tool hit or promote result — not full graph/onboarding parity. |
| **Mycelium** | The **run footprint** lens: where a [[Session]] searched, read and edited. Complements Graph (wiki links) and Changes (git). Rendered **inside Rhizome** and carrying Rhizome’s own visual language — not a launcher for another app, which is what it was until 2026-08-15. Engine remains [Mindwalk](https://github.com/cosmtrek/mindwalk), run as a local sidecar and credited per its licence; forking it is a later call, not a prerequisite. Two entry points: rail = across all sessions, in-session button = this session only. |

## Related docs

- Identity: `docs/IDENTITY.md`
- Spike (session host): `docs/plans/2026-08-09-prime-harness-chat-spike.md`
- v0 brief + roadmap: `docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md`
- Issue tracker / triage: `docs/agents/`
- ADRs: `docs/adr/` (read when touching that area; many are Desktop-era)
