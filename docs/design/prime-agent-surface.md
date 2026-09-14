# Prime Agent surface — executable spec (#5)

**Status:** outline. Structured from existing talk. **Not complete.** Not a new architecture.  
**Origin:** W5 paper pass · Cursor Grok 4.6 · 2026-09-14 · starting `4416411`  
**Blocks:** GitHub **#5** stays **OPEN**. Composition still discuss/decide: [`harness-composition.md`](harness-composition.md).  
**Filter (agent-authored, not Atticus-settled):** [ADR-0168](../adr/0168-selective-harness-doctrine.md) / [`harness-doctrine.md`](harness-doctrine.md). See [#56](#56-contradiction-second-provider-path) before citing that filter as law.  
**Pickup:** [`BOARD.md`](../BOARD.md) Prime Agent card.  
**Siblings:** W4 remainder [`../plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md`](../plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md). W6 import [`../plans/import-jsonl-decision.md`](../plans/import-jsonl-decision.md) — blocked until Atticus says **`1`**.

---

## Done / now / next

- **Done:** Rhizome is a daemon **client**. Chat talks to Prime 0.9.3. Packages install via CLI. Adapter snapshot exists. This file names intended vs implemented vs unresolved.
- **Now:** treat this file as the #5 **index**, not a finished spec. Do not fork Prime. Do not add a second loop. Do not remove `ai_models.rs`.
- **Next:** wire **user jobs** that already have a Prime mechanism and no Rhizome UI, after the God plan names the slice **and** any Atticus gate on that job is open. Probe the live daemon before shipping.

**Done when:** an agent can name (1) what Prime is *intended* to own, (2) what Rhizome already renders, (3) the next slice, without inventing a new engine. **#5 is not that done state.** Composition option 2 and #56 keep-vs-remove are still open.

---

## Three layers (do not collapse)

**Origin:** W5 · 2026-09-14 · God plan “Prime boundary and decision gates.”

| Layer | Meaning | Use for |
|---|---|---|
| **Intended ownership** | Product split agents wrote down: Rhizome is the desk; Prime is the only engine; vault markdown is durable memory | Planning grafts. Not proof the tree matches. |
| **Implemented behavior** | What this repo actually sends, renders, or bypasses | Daily-drive jobs, tests, W4 evidence |
| **Unresolved decisions** | Calls Atticus has not made, or native checks nobody ran | Blockers. Silence is not approval. |

### Intended ownership

Rhizome Agent is the **desktop shell**. Prime Agent is the **only engine**. Vault markdown is durable memory. Transport is a **client** of Prime’s daemon ([ADR-0163](../adr/0163-connect-to-the-prime-daemon.md)). New sessions are `client_owned`; background only by explicit grant ([ADR-0167](../adr/0167-client-owned-prime-sessions-by-default.md)).

That split is **design intent** from ADR-0168 / `IDENTITY.md` / `CONTEXT.md`. ADR-0168 was ratified 2026-08-23/24 by two agents (GPT-5.6 Sol and Grok, via Cursor), **not by Atticus**. HANDOFF still labels this **C50-DECIDED**; that name overstates Atticus ratification. Do not treat the ADR as a keep-or-remove order.

Prime is a distribution of **Pi** (Earendil): `@earendil-works/pi-agent-core`. Packages: `prime-agent package install`. Registry: `pi.dev/packages`. Search that registry before authoring a composition slice.

**“Desktop version of Prime Agent” is a fidelity standard, not an ownership rule.** Coverage is by **user job**, not percent of daemon command names.

### Implemented behavior

Rhizome already speaks 39 daemon command **names** (snapshot 2026-09-12). Daily-drive Chat on Prime uses `prime_session_host.rs`. The Sessions list joins that host to `prime_sessions.rs` (disk reader). Hide-on-close already stops Rhizome-spawned helpers on main (`release_helpers_for_hidden_window`, `43059e3e`). Vault import of Claude Code threads already writes `Imports/` notes.

The same tree also streams **directly to a model provider** when Settings picks `api_model` — see [#56](#56-contradiction-second-provider-path). That path does not use the Prime daemon.

### Unresolved decisions

- Ratify composition **option 2** and its first slice (native `extension_ui`). Working notes only: `harness-composition.md`. Closing **#40** is not “composition done.”
- **#56:** keep the inherited provider path, or remove it, or amend the doctrine so the exception is written down. This paper does neither.
- Prime **session-list import:** blocked until Atticus says **`1`** (W6). Vault half is not list rows.
- W4 native remainder: five God-plan cases **NOT RUN**. Installed app still **`476756c`**. Not daily-driver ready.
- Gray-zone helper ownership (Rhizome-spawned daemon vs user-started daemon). Do not invent a new lifetime model.

---

## What it is not

- Not a Rhizome-owned runtime, second control loop, or cloned Prime TUI.
- Not a license to delete Settings providers tonight.
- Not Hermes, OpenCode, or CC Switch inside this product.
- Not “implement Prime” by cloning `PrimeIntellect-ai/prime-agent`.
- Not Cursor `continual-learning` (that plugin is a coding-tool helper).
- Not a finished #5 spec. GitHub **#5** (2026-08-15) is the parent outline. Large parts of that body later shipped (goals, schedules, Mycelium-in-app, branches, session switch). Other parts are stale (RPC-only transport, “kills Prime on exit,” en.json localization). This file is the current index. The issue stays open.

Working composition intent (**option 2**, unratified): Rhizome stays the product harness; Prime stays the only engine; foreign pieces live as Rhizome UX/vault/policy or as Prime skills / MCP / extensions. Detail: `harness-composition.md`.

---

## #56 contradiction (second provider path)

**Issue:** [GitHub #56](https://github.com/tuckcode/rhizome-agent/issues/56) — **OPEN**. Filed 2026-08-29. Not an implementation ticket.

**What the doctrine says.** ADR-0168 / `harness-doctrine.md` lineage lock: execution owner is Prime; it **may not become** “a Rhizome-owned runtime or second provider path.” Frankenstein test: if we deleted Prime tomorrow, would this piece still try to run?

**What the tree does (re-checked 2026-09-14, HEAD `4416411`).**

- `src-tauri/src/ai_models.rs` is still **788** lines: provider catalog, `api_key_storage` / env / local file, base URLs, `run_ai_model_stream`.
- `src-tauri/src/commands/ai.rs` still exposes `stream_ai_model` (registered from `lib.rs`).
- `src/lib/aiTargets.ts` `resolveAiTarget` can return `{ kind: 'api_model' }`.
- `src/lib/aiAgentSession.ts` routes that kind to `streamAiModel` instead of Prime.
- Settings still summarizes the key store for that target. `AiWorkspace` still shows a chat chip.

For `api_model`, the Frankenstein answer is **yes**. It is a provider registry, a credential store, and an execution path that survives Prime’s removal.

This is inheritance from Rhizome Desktop, not a later Atticus call. The doctrine was written about future borrowing without auditing what was already here. ADR-0168 consequences even hedge: the inherited path “may remain for non-Prime Desktop leftovers” but is “rejected as an architectural path for Prime chat.” **That hedge is not a keep-or-remove decision.**

**#56’s real question (still unanswered):** keep the bypass, or remove it and send raw models through Prime, or amend the doctrine so the exception is bounded.

Both keep and remove are defensible. What is not defensible is citing ADR-0168 as settled constitutional law to accept or reject a graft while the code disagrees.

**W5 stop:** do not delete providers. Do not ratify ADR-0168 as Atticus-settled. Do not use this contradiction to start a router, TokenJuice, or a second loop.

Related: #40 (harness vs client), #45 (model settings), #48 (OmniRoute). Router notes: [`2026-08-29-model-routing-decision.md`](2026-08-29-model-routing-decision.md).

---

## W4 reliability remainder

**Paper only here.** Native cases belong to W4, not a new engine.

Pointer: [`../plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md`](../plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md). Stub: [`../plans/s-plans/2026-09-13-astra/W4-chat-reliability.md`](../plans/s-plans/2026-09-13-astra/W4-chat-reliability.md).

Five God-plan cases, all **NOT RUN** natively (2026-09-13):

1. **C64 startup** — first 2 seconds ×3 on `/Applications` `476756c`. Sheet: `src/hooks/C64.md`.
2. **Send and recover** — live Prime turn, reconnect, useful failure chrome.
3. **Steer / queue** — #41 original scope. Source is wired; GitHub title is stale. Do not close #41 from unit tests. Unspoken remainder: `mutate_queued_message`.
4. **Hide / reopen** — helper `ps` before/after. Name-list test is not a process-lifecycle pass.
5. **Memory path** — isolated test vault + live read/search + promoted recall.

Source/unit send-policy tests in that file passed (jsdom). They are not `/Applications`. Daily-driver **not** declared.

---

## W6 import — blocked on `1`

**Do not code list-import from this file.**

Vault half shipped (Settings → Import chat history → `Imports/claude-code/`). Left Sessions rows are **not** wired.

Decision page: [`../plans/import-jsonl-decision.md`](../plans/import-jsonl-decision.md). Short copy: [`import-jsonl-routes.md`](import-jsonl-routes.md). Plan: [`../plans/2026-09-01-session-import-plan.md`](../plans/2026-09-01-session-import-plan.md). W6 stub: [`../plans/s-plans/2026-09-13-astra/W6-import-decision.md`](../plans/s-plans/2026-09-13-astra/W6-import-decision.md).

Overnight recommendation on paper is **route 1** (`new_session` + `import_jsonl` per thread, then restore). Coding stays blocked until Atticus says **`1`**. “Wait” or **`3`** means vault-only. Silence is not approval.

Prime meaning used for that paper (installed 0.9.3, **not live-probed this session**):

- `docs/daemon.md`: new / switch / fork / **import** replace the worker’s root runtime; the public active-session id stays.
- Installed source comment on `importFromJsonl`: “Import a session JSONL file and **switch runtime state** to the imported session.” Envelope includes `activeSessionId`, `inputPath`, optional `cwdOverride`.
- `rpc.md` has **no** `import_jsonl` section. Live daemon behavior (overwrite, list-row mint, cancel) stays **unverified**.

No fourth route. Do not invent a private mint-session RPC.

---

## Trust order (when a claim matters)

1. Live daemon (`prime-agent` / `pnpm test:live-prime`)
2. Prime’s own docs at `~/.local/lib/node_modules/prime-agent/docs/`
3. This repo’s notes

`docs/prime-adapter-surface.json` answers “does this command **name** exist.” It never answers what the command **does**. `pnpm prime:surface` / `pnpm prime:surface:github`. Do not clone upstream.

This machine: **Prime 0.9.3**, 106 public daemon commands (HANDOFF 2026-09-12). Snapshot audited 2026-09-12; counts are a dated catalog, not coverage.

---

## Two modules (classic mistake)

| | `prime_session_host.rs` | `prime_sessions.rs` |
|---|---|---|
| Is | daemon **client** | disk **reader** |
| Answers | what is running | which conversations exist on disk |
| Cannot | history | what is running |

Join key: roster `sessionFile` ↔ summary `path`. Detail: `ARCHITECTURE.md` → *Prime Agent*. Never use the disk reader as evidence that a session is currently running.

---

## Job / evidence / blocker

User jobs already talked about. Not a command-count backlog. **Unprobed = unverified.**

| Job | Intended | Implemented | Evidence | Blocker |
|---|---|---|---|---|
| Connect / attach / first prompt | Prime host; Rhizome client | `ensure_session` / `attach` / `create` | Packaged daily drive `476756c`; W4 send/recover **NOT RUN** | W4 native send/recover |
| Prompt, stop, steer, queue | Prime `steer` / `follow_up` / queue cmds | Spoken; `AiPanel` `onSteer`; `primeTurnMessaging.ts` | W4 unit pass 2026-09-13; #41 comment already says body is stale | W4 live steer/queue; do not close #41; unspoken `mutate_queued_message` |
| Model + thinking the model can run | Prime catalog | `get_available_models` / `set_model` / `set_thinking_level` | Host + Settings | A Settings default of `api_model` must not strip Prime chrome (learned fact). That default *is* the #56 path. |
| Sessions list / switch / rename / fork | Prime files + host | List reader + spoken `list` / `switch_session` / `rename_saved_session` / `fork` / tree | Code + #17 closed | List-**import** is W6, not this job |
| Goal / heartbeat / schedule chrome | Prime | Spoken `cron_*` / `heartbeat_*` | #14 closed on main | None for W5 |
| Packages hub | Prime CLI | `prime-agent package install` then `reload` | Settings → Packages | `reload` is spoken; do not send it from Chat |
| Vault skill seed | Rhizome skill text; Prime runs tools | `prime_vault_skill.rs` | Packaged `cli-call.mjs` | W7 / #46 live Chat-without-vault leftover |
| Hide helpers after hide | Stop **Rhizome-spawned** Prime/MCP/Mindwalk | `release_helpers_for_hidden_window` (`43059e3e`) | W4: name test exists; process lifecycle **NOT RUN** | W4 hide/reopen native. Gray zone still Atticus. |
| C64 “Prime not installed” flash | Honest host status | `usePrimeHostStatus` withholds first `not_installed` | Unit pass; `C64.md` launch 1 unwatched | Three cold launches, first 2s |
| Session-list import | Prime `import_jsonl` after a new session (route 1 on paper) | Vault notes only | W6 decision page | Atticus says **`1`**. No list rows before that. |
| Native `extension_ui` | Rhizome renders select/confirm/input | `extension_ui_response` spoken; dialogs auto-cancel today | `rpc.md` dialog methods (docs) | Option 2 + first slice unratified |
| #56 honesty | One execution story | Second path live | This section + issue #56 | Atticus keep / remove / amend. Do not delete in this lane. |

Architecture map: `ARCHITECTURE.md` → *Prime Agent — a daemon client*.

Spoken vs unspoken names: [`prime-spoken-surface.md`](prime-spoken-surface.md).

---

## Named, not wired (0.9.3 snapshot)

Full buckets: [`prime-spoken-surface.md`](prime-spoken-surface.md) (spoken 39 / unspoken 60 / never-call 7).  
`import_jsonl` list rows: [`import-jsonl-routes.md`](import-jsonl-routes.md) — **do not code** until Atticus says **`1`**.

HANDOFF 2026-09-12: snapshot gained names only. Still unspoken (no user job yet):

- `get_direct_worker_transport` — name only; treat as worker-internal until probed. Not in `rpc.md`.
- `list_agent_peers`
- `roster_subscribe` / `roster_unsubscribe` — name only; not in `rpc.md`. Unprobed.

`resume_queue` is **spoken** (in the snapshot + host). Do not list it as unwired.

`set_scoped_models` is unspoken. Prime `usage.md`: `/scoped-models` means **enable/disable models for Ctrl+P cycling** — a picker filter, not a router. Do not cite repo notes that call it routing.

**Do not wire a name because it is new.** Ask which **user job** it serves. Worker stays an internal word (`CONTEXT.md`).

---

## Next slices (existing talk only)

Claim one. Do not start a plugin kernel.

| Slice | Job | Source | Blocker |
|---|---|---|---|
| Prime **session-list import** | Claude/Cursor/GPT/Hermes threads become left-Sessions rows | W6 [`../plans/import-jsonl-decision.md`](../plans/import-jsonl-decision.md) | Atticus says **`1`** |
| W4 native remainder | C64 / send / steer / hide / memory on `476756c` | [2235 evidence](../plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md) | Native slot + Atticus can spare the app |
| Native `extension_ui` | select / confirm / input that Rhizome auto-cancels today | composition first slice if option 2 ratified | option 2 + first slice |
| Hide helpers **live-check** | hide leaves no extra Rhizome-spawned helper | [`../plans/hide-on-close-helpers.md`](../plans/hide-on-close-helpers.md) | W4 process proof; tension with ADR-0163 for **user-started** daemons |
| Vault skill home | skills live as vault files; Prime reads/links | [`vault-skill-home.md`](vault-skill-home.md) | parked; Chat ↔ Prime first |
| #56 honesty | second provider path `ai_models.rs` vs doctrine | this file + HANDOFF / NEXT §1 | do not cite doctrine as Atticus-settled; do not remove providers here |

---

## Hard no (already decided)

- Do not replace Chat.
- Do not vendor TokenJuice or Switchyard in this tree ([`token-routing-and-compression.md`](token-routing-and-compression.md)).
- Do not add Hermes `kanban.db`.
- Do not treat closing #40 as “composition done.”
- Do not store C66 agent instructions as Prime `USER.md` / Hermes `SOUL.md`.
- Do not mark #5 complete from this outline.

---

## Agent steps (when the God plan names a Prime slice)

1. Read this file + `IDENTITY.md` + the ADR named on the card. Read #56 before citing ADR-0168.
2. `pnpm prime:surface` (and GitHub if the slice depends on a new command).
3. Read Prime’s own doc for that command. Probe the daemon. If there is no doc and no probe, write **unverified**.
4. Implement the **user job**. Completion: the job is visible in Chat or Settings, with a test, and HANDOFF/BOARD updated. A new daemon name in the snapshot is not done.
