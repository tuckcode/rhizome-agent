# Prime Agent surface — executable spec (#5)

**Status:** structured from existing talk. Not a new architecture.  
**Blocks:** GitHub **#5**. Composition still discuss/decide: [`harness-composition.md`](harness-composition.md).  
**Filter:** [ADR-0168](../adr/0168-selective-harness-doctrine.md) / [`harness-doctrine.md`](harness-doctrine.md).  
**Pickup:** [`BOARD.md`](../BOARD.md) Prime Agent card.

---

## Done / now / next

- **Done:** Rhizome is a daemon **client**. Chat talks to Prime 0.9.3. Packages install via CLI. Adapter snapshot exists.
- **Now:** treat this file as the #5 index. Do not fork Prime. Do not add a second loop.
- **Next:** wire **user jobs** that already have a Prime mechanism and no Rhizome UI, after the God plan names the slice. Probe the live daemon before shipping.

**Done when:** an agent can name (1) what Prime owns, (2) what Rhizome may render, (3) the next slice, without inventing a new engine.

---

## What it is

Rhizome Agent is the **desktop shell**. Prime Agent is the **only engine**.

| Layer | Owner | Source |
|---|---|---|
| Execution (loop, providers, credentials, RLM, queues, logs, compaction, goals, schedules) | Prime | ADR-0168, `IDENTITY.md` |
| Desktop UX (sessions list, composer, transcript, vault chrome) | Rhizome | ADR-0166 / ADR-0170 |
| Durable memory | Vault markdown | `IDENTITY.md`, `CONTEXT.md` |
| Transport | Client of Prime’s daemon | [ADR-0163](../adr/0163-connect-to-the-prime-daemon.md) |
| Session posture | `client_owned` by default; background only by explicit grant | [ADR-0167](../adr/0167-client-owned-prime-sessions-by-default.md) |

Prime is a distribution of **Pi** (Earendil): `@earendil-works/pi-agent-core`. Packages: `prime-agent package install`. Registry: `pi.dev/packages`. Search that registry before authoring a composition slice.

**“Desktop version of Prime Agent” is a fidelity standard, not an ownership rule.** Coverage is by **user job**, not percent of daemon command names.

---

## What it is not

- Not a Rhizome-owned runtime, second provider path, or cloned Prime TUI.
- Not Hermes, OpenCode, or CC Switch inside this product.
- Not “implement Prime” by cloning `PrimeIntellect-ai/prime-agent`.
- Not Cursor `continual-learning` (that plugin is a coding-tool helper).

Working composition intent (**option 2**, unratified): Rhizome stays the product harness; Prime stays the only engine; foreign pieces live as Rhizome UX/vault/policy or as Prime skills / MCP / extensions. Detail: `harness-composition.md`.

---

## Trust order (when a claim matters)

1. Live daemon (`prime-agent` / `pnpm test:live-prime`)
2. Prime’s own docs at `~/.local/lib/node_modules/prime-agent/docs/`
3. This repo’s notes

`docs/prime-adapter-surface.json` answers “does this command **name** exist.” It never answers what the command **does**. `pnpm prime:surface` / `pnpm prime:surface:github`. Do not clone upstream.

This machine: **Prime 0.9.3**, 106 public daemon commands (HANDOFF 2026-09-12).

---

## Two modules (classic mistake)

| | `prime_session_host.rs` | `prime_sessions.rs` |
|---|---|---|
| Is | daemon **client** | disk **reader** |
| Answers | what is running | which conversations exist on disk |
| Cannot | history | what is running |

Join key: roster `sessionFile` ↔ summary `path`. Detail: `ARCHITECTURE.md` → *Prime Agent*.

---

## Wired enough for daily drive

User jobs already in the packaged app (`476756c` and later origin):

- Connect / attach / first-prompt `ensure_session`
- Prompt stream, stop, steer/queue
- Model picker + thinking levels the **model can run**
- Sessions list, switch, rename, fork/tree, archive
- Goal / heartbeat / schedule chrome
- Packages hub (`prime-agent package install` then reload)
- Vault skill seed (`prime_vault_skill.rs`)
- Preflight + failure banners (#47 confirm still open)

Architecture map: `ARCHITECTURE.md` → *Prime Agent — a daemon client*.

---

## Named, not wired (0.9.3 snapshot)

Full buckets: [`prime-spoken-surface.md`](prime-spoken-surface.md) (spoken 39 / unspoken 60 / never-call 7).  
`import_jsonl` list rows: [`import-jsonl-routes.md`](import-jsonl-routes.md) — **do not code** until Atticus picks a route.

HANDOFF 2026-09-12: snapshot gained names only. Still unspoken (no user job yet):

- `get_direct_worker_transport`
- `list_agent_peers`
- `roster_subscribe` / `roster_unsubscribe`

`resume_queue` is **spoken** (in the snapshot + host). Do not list it as unwired.

**Do not wire a name because it is new.** Ask which **user job** it serves. Worker stays an internal word (`CONTEXT.md`).

---

## Next slices (existing talk only)

Claim one. Do not start a plugin kernel.

| Slice | Job | Source | Blocker |
|---|---|---|---|
| Prime **session-list import** | Claude/Cursor/GPT/Hermes threads become left-Sessions rows | [`../plans/2026-09-01-session-import-plan.md`](../plans/2026-09-01-session-import-plan.md) | Atticus on `import_jsonl` route |
| Native `extension_ui` | select / confirm / input that Rhizome auto-cancels today | composition first slice if option 2 ratified | option 2 + first slice |
| Hide helpers | stop Rhizome-spawned Prime/MCP/Mindwalk leftovers after hide | [`../plans/hide-on-close-helpers.md`](../plans/hide-on-close-helpers.md) | tension with ADR-0163 daemon lifetime |
| Vault skill home | skills live as vault files; Prime reads/links | [`vault-skill-home.md`](vault-skill-home.md) | parked; Chat ↔ Prime first |
| #56 honesty | second provider path `ai_models.rs` vs doctrine | HANDOFF / NEXT §1 | do not cite doctrine as settled for grafts |

---

## Hard no (already decided)

- Do not replace Chat.
- Do not vendor TokenJuice or Switchyard in this tree ([`token-routing-and-compression.md`](token-routing-and-compression.md)).
- Do not add Hermes `kanban.db`.
- Do not treat closing #40 as “composition done.”
- Do not store C66 agent instructions as Prime `USER.md` / Hermes `SOUL.md`.

---

## Agent steps (when the God plan names a Prime slice)

1. Read this file + `IDENTITY.md` + the ADR named on the card.
2. `pnpm prime:surface` (and GitHub if the slice depends on a new command).
3. Read Prime’s own doc for that command. Probe the daemon.
4. Implement the **user job**. Completion: the job is visible in Chat or Settings, with a test, and HANDOFF/BOARD updated. A new daemon name in the snapshot is not done.
