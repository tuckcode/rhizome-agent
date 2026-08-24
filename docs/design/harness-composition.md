# Harness composition — option 2

**Status:** working notes, 2026-08-24. **Not an ADR.** Discuss and decide
before grafting. The ratified *filter* is still
[ADR-0168](../adr/0168-selective-harness-doctrine.md) /
[`harness-doctrine.md`](./harness-doctrine.md). This file is the composition
plan those docs said they were not: what we intend to take, where it lives,
and which pairs must not ship together.

**Audience:** anyone about to add a Prime, Hermes, DeepSeek, or OpenCode idea
to Rhizome Agent.

Pickup index: [`docs/NEXT.md`](../NEXT.md) §1.

---

## Working conclusion (discuss / decide)

Intended product shape is **option 2**:

> Rhizome is the product harness. Prime Agent stays the only execution core.
> Other harnesses donate contracts, UX patterns, and evaluation methods.
> Those pieces live in Rhizome (desktop, vault, policy) or as Prime
> skills / MCP / extensions. They are never forked into Prime and never
> run as a second loop.

Prime keeps receiving upstream updates through a **thin, versioned adapter**
(protocol + capabilities). Add-ons on our side of that adapter survive a
Prime release. Add-ons *inside* Prime (fork, patch, Cordis kernel, a second
daemon) will not.

This is joint-call intent, not a shipped bill of materials. Ratify it, or
say what is still wrong, before building grafts. Native extension UI is the
proposed first slice if this stands — see [Plugin extensibility](#plugin-extensibility-the-idea-not-the-kernel).

---

## Three versions of “make it the Rhizome harness”

| # | Meaning | Cost | Verdict |
|---|---|---|---|
| **1** | Name and skin. Users see Rhizome; Prime is still the engine. | Cheap. Already the fidelity standard. | Necessary, not sufficient. |
| **2** | Product ownership, engine still Prime. Rhizome decides composition, lifecycle, vault memory, native UX. Prime executes. | Product work. Adapter discipline. | **Intended.** |
| **3** | Own the runtime: fork/vendor Prime, stop speaking a foreign protocol, graft other organs into that tree. | Maintain an agent engine. Merge tax or freeze. | Company bet. Would supersede ADR-0163 and ADR-0168. Not this plan. |

“What makes Prime Prime” is the daemon, workers, agent loop (Pi-shaped
sessions), IPython/tools, RLM/subagents, provider/auth catalog, session
trees and logs, compaction, schedules/heartbeats, and refine — under
`~/.prime`. Option 2 keeps that. Option 3 takes it.

---

## Filter vs composition

| | Filter (settled) | Composition (this file, unratified) |
|---|---|---|
| Doc | ADR-0168, `harness-doctrine.md` | This file |
| Rule | Metabolites, not organs. One loop. One vault. One credential path. | Which metabolites, in what form, in what slice, and which pairs collide |
| #40 | Answered: Rhizome is a client of Prime, not a second harness | Closing #40 does not finish this |

The Frankenstein test stays: if we deleted Prime tomorrow and the piece
still tried to run, it is an organ. Do not transplant it.

Pair test: **does piece A from harness X break piece B from harness Y?**
If both claim the loop, the memory file, the credential store, or the
session lifetime, ADR-0168 already forbids the pair.

---

## How a Prime update must keep working

Safe split:

| Lives in Prime (they update it) | Lives in Rhizome (we own it) |
|---|---|
| Loop, tools, providers, sessions, schedules, RLM | Chat/desktop UX, vault memory, promote/approve |
| Auth, compaction, refine ledger | Foreground/background policy, native confirm |
| Protocol + capabilities | How we surface foreign *ideas* on that protocol |

Rule for a new take: if deleting Prime would make that feature keep
running, it is in the wrong layer.

The remaining risk is product, not git: Prime ships something that overlaps
a Hermes or DeepSeek contract we already built. Then we choose — use Prime’s
version or keep ours — we do not get a silent merge conflict. Name that
choice in the matrix before the slice ships.

---

## Layers (a harness is more than tools)

| Layer | Take the good part | Collision to refuse |
|---|---|---|
| **Agent loop / runtime** | Prime stays the only loop | A second loop, subprocess harness, or “just this one other engine” |
| **Tools and skills** | Prime tools + Rhizome vault tools; foreign *ideas* for surfacing them | Tool A from X owning the sandbox, cwd, or approval path that tool B from Y also claims |
| **Session lifecycle** | Foreground-owned by default (ADR-0167); residency is an explicit grant | Close/hide/crash inferring always-on work; two ownership stories |
| **Memory** | Vault is durable SoT; promote/recall are Rhizome’s | A second `MEMORY.md`, silent dual-write, or Hermes/DSH store next to the vault |
| **UX / desktop** | Rhizome visual language over Prime state | Cloning Prime’s TUI, Hermes desktop, or a DSH console as a second shell |
| **Permissions / credentials** | One confirmation and one secret path | Two credential stores or two approval authorities |
| **Context, routing, providers** | Ideas (progressive disclosure, model routing) adapted onto Prime’s catalog | OpenCode / Claude Code / Switchyard as a second backend or provider registry |
| **Scheduling / background** | Prime schedules/heartbeats, visible and cancellable | A second scheduler, or residency implied by “the daemon is up” |
| **Extensibility** | Prime extensions, skills, MCP — see below | Cordis / `dsh` plugin kernel, or a Rhizome plugin that replaces Prime’s loop |

---

## Per source

Full take/leave tables live in the reviews. This section is the composition
read: what we believe, what we will not do, and where the evidence is.

### Prime Agent — TAKE the engine, WRAP the policy

Prime owns daemon supervision, workers, the agent loop, providers,
credentials, model catalog and session model state, tools/IPython,
RLM/subagents, queues, session trees and logs, compaction, goals,
schedules, heartbeats, refine, and coordinated updates.

Rhizome is a daemon client and policy shell (ADR-0163, ADR-0167). “Desktop
version of Prime” is a **fidelity standard**, not an ownership rule.
Coverage is by user job, not command-count parity.

C47 is implemented locally: new sessions are `client_owned`; idle close
detaches; active close asks Stop vs Keep working; quit follows ownership.

**Review:** [`2026-08-24-prime-harness-take-leave-audit.md`](../plans/2026-08-24-prime-harness-take-leave-audit.md)

### Hermes Agent — TAKE contracts, REJECT the stack

Hermes is its **own** Python runtime (`AIAgent` in `run_agent.py`). It is
**not** built on OpenCode. OpenCode appears only as a bundled skill that
spawns `opencode run` — delegation to a peer harness, the pattern ADR-0168
rejects as a Rhizome default.

Hermes Desktop is option 2 over *their* engine (`hermes serve`). Company-
level option 3 because they own both sides.

Take: observable interruptible work; named lifecycle + `unknown`; children
narrow never widen; fail-closed unattended approval; progressive skill
disclosure with provenance; schedule preflight before spend.

Adapt onto Prime + vault: desktop observability, memory *approval* as
promote-to-vault (not `MEMORY.md` / `USER.md`), skill catalog UX, schedule
creation as an explicit background grant.

Reject: Hermes as a second runtime; default-on memory/skill writes; YOLO as
a product affordance; parallel durable-memory stack; bot-roster / messaging
gateway scope.

**Review:** [`2026-08-24-hermes-harness-source-review.md`](../plans/2026-08-24-hermes-harness-source-review.md)

Easy mix-up: Hermes vs **OpenClaw**. Still not a fork. Separate TypeScript
gateway (Pi). Hermes only has `hermes claw migrate`.

### DeepSeek Harness (`dsh`) — TAKE event/replay contracts, REJECT the runtime

Official repo: [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
(developer preview; breaking changes expected). Keep three names separate:
the `dsh` runtime, the DeepSeek API, and V3.2 training machinery.

The whole `dsh` product is plugins on **Cordis**: loop, tool pipeline,
persistence, permissions, UI. That *is* their engine. Porting it into
Rhizome is a second kernel. See [Plugin extensibility](#plugin-extensibility-the-idea-not-the-kernel).

Take: durable events ≠ live coordination; model-visible means logged; typed
tool identity and tool-owned render intent; fail-closed monotonic denials;
subagent lineage; replay + external-state assertions; operational session
memory ≠ durable human knowledge.

Adapt: Cordis *seams* as guidance for small Prime-facing modules; inbox /
steer / follow-up mapped to Prime admission (C43/C44 already aligned);
compaction as visualize-Prime, never compact independently.

Reject: running `dsh` behind Rhizome; a second provider/tool/approval stack;
transcripts or hidden reasoning as vault notes; requiring a vault before
chat.

**Review:** [`2026-08-24-deepseek-harness-source-review.md`](../plans/2026-08-24-deepseek-harness-source-review.md)

### OpenCode and other CLIs — REJECT as product backends

Hidden Desktop DNA. Prime is the only runtime in the Agent product UI.
OpenCode remains a strong *coding CLI*, weak at lasting knowledge — same
bucket as Claude Code / Codex. Do not run it as Rhizome’s engine or as a
default delegated second loop.

Weekend NotebookLM (2026-08-22) assigned OpenCode “context / provider
routing / LSP.” That mix is more aggressive than the doctrine. The
composition choice: take routing/LSP *ideas* onto Prime’s catalog if a
user job needs them; do not take OpenCode as the context layer.

Vision draft: [`rhizome-prime-harness-vision.md`](./rhizome-prime-harness-vision.md)

### Switchyard — DEFER behind Prime

NVIDIA NeMo Switchyard is an experimental model router, not a harness.
Trial path only: `Rhizome → Prime → Switchyard → providers`. Rhizome does
not grow a router.

### OpenHuman — DEFER a source review

Named in divergence frames. No first-party review in this repo yet.
Metabolite-only until someone writes one.

### Claude Code

Not a source review target. Progressive disclosure / MCP *ideas* may adapt
onto Prime skills. Reject as a backend. Same “hidden Desktop DNA” bucket as
OpenCode.

---

## Plugin extensibility (the idea, not the kernel)

DeepSeek’s plugin system is popular because a plugin can add a tool, hook a
turn, and block a call **without forking the loop**. That idea is not unique
to `dsh` (Prime, Hermes, OpenCode, and Claude Code all have
plugins / extensions / skills). What `dsh` did further is make the *entire*
harness a plugin tree on Cordis, including loop intercepts.

**Closed door:** ship Cordis, load `dsh` plugins as-is, or let a Rhizome
plugin replace Prime’s loop, prompt assembler, or session store.

**Open door — and this is the explore-implement path:** offer the same kind
of extensibility on seams Prime already has.

Prime extensions already hook:

- `turn_start` / `turn_end`
- `before_provider_request` / `after_provider_response`
- `tool_call` (can `{ block: true, reason }`)
- `tool_execution_*`
- session start / compact / refine / shutdown
- `registerTool`, `registerCommand`, `ctx.ui` (select, confirm, input)

Skills and generic MCP are the other two seams.

Rhizome’s gap is the **product layer**, not a missing kernel:

| Slice | What | Why first / later |
|---|---|---|
| **1. Native extension UI** | Claim `extension_ui`; render Prime’s `select` / `confirm` / `input` / `editor`. Today Rhizome auto-cancels those requests so the turn can finish. | Doctrine already: required before any “supports Prime extensions” claim. First slice if option 2 stands. |
| **2. Catalog** | Show loaded skills/extensions from Prime, not a static “rhizome-vault” chip. | Discovery/consent. Hermes provenance idea, Prime as loader. |
| **3. Profiles** | Prime tool allow-lists as Rhizome presets. | Compose capability without a second plugin tree. |

If a hook does not exist on Prime (`pre-step` as `dsh` names it), that is a
Prime feature request, not a reason to embed `dsh`.

---

## Weekend NotebookLM vs this plan

Saturday 2026-08-22 exports (Downloads, not in repo):

- `Rhizome_Agent_Evolution_Design_Strategy.png` — “Pruning the Engine, Grafting the Best”
- `NotebookLM Mind Map.png`
- `The_harness_is_the_actual_AI_product.m4a`

That mix assigned: Prime = engine, DeepSeek = plugins / reversible seams,
Hermes = UX, OpenCode = context / routing / LSP, Claude Code = MCP +
progressive disclosure.

This file keeps Prime as engine and Hermes as UX *contracts*. It takes
DeepSeek’s **plugin idea** onto Prime extensions, not their plugin kernel.
It rejects OpenCode as a backend. That is the stricter Sunday doctrine, plus
the Monday option-2 clarification.

---

## Sandbox

Prime has **no security sandbox**. Workers and the IPython kernel are
process-isolated for crashes; they still run as the user. Prime’s docs say
to use an **external** sandbox when the workspace or generated code is
untrusted. Confirm dialogs and vault path policy are not a sandbox.

Do not build a second tool-approval/sandbox pipeline in Rhizome. If bash
and the kernel still run on the host, that is theater. Two shapes that
fit option 2:

1. **Sandbox the Prime worker** — loop and tools run inside a box. Prime
   owns this, or we start the worker in a container. Already sketched
   (unadopted) in
   [`2026-08-20-containerized-workers-proposal.md`](../plans/2026-08-20-containerized-workers-proposal.md).
2. **Sandboxed code-runner tool** — a skill/MCP for “run this snippet in
   a box.” Additive. Does not make Prime’s bash safe.

**[Kern](https://github.com/getkern/kern)** (getkern/kern, v0.7.0): honest
Linux sandbox — daemonless, rootless, ~3 ms OCI boxes, agent-shaped
`fault` results, MCP. Same class as bubblewrap, not Firecracker. **Linux
/ WSL2 only; macOS is a non-goal** except a possible Linux VM later.
Watch as a Linux Prime-side candidate. Not a Rhizome v0 sandbox (this
desktop is macOS-first).

For the trusted circle, do not build a sandbox this week. Later: wrap the
Prime worker, platform by platform.

---

## Still discuss / decide

Before treating this as build law:

1. Ratify **option 2** as the composition rule (or name the alternative).
2. Ratify **native extension UI** as the first extensibility slice — or
   pick another first slice.
3. Confirm OpenCode stays reject-as-backend (NotebookLM still disagrees).
4. Name remaining incompatibilities the reviews left implicit (e.g. Hermes
   memory approval vs vault promote vs Prime refine ledger — one write
   authority).
5. Close **#40** against the filter once (1) is yes; do not call that
   “composition done.”
6. Finish **#5** (Prime harness surface spec) only after this matrix is
   yes enough to build against.

---

## Source index

| Doc | Role |
|---|---|
| [ADR-0168](../adr/0168-selective-harness-doctrine.md) | Ratified filter |
| [`harness-doctrine.md`](./harness-doctrine.md) | Readable Take / Adapt / Reject / Defer ledger |
| [`rhizome-prime-harness-vision.md`](./rhizome-prime-harness-vision.md) | Product shape: desk + memory, Prime engine |
| [`2026-08-24-prime-harness-take-leave-audit.md`](../plans/2026-08-24-prime-harness-take-leave-audit.md) | Prime 0.8.0 boundary |
| [`2026-08-24-hermes-harness-source-review.md`](../plans/2026-08-24-hermes-harness-source-review.md) | Hermes contracts vs stack |
| [`2026-08-24-deepseek-harness-source-review.md`](../plans/2026-08-24-deepseek-harness-source-review.md) | `dsh` / Cordis vs events |
| [`2026-08-24-harness-doctrine-divergence.md`](../plans/2026-08-24-harness-doctrine-divergence.md) | Five-frame scoring |
| [ADR-0163](../adr/0163-prime-daemon-client-not-owned-process.md) | Transport: client, never own/stop the daemon |
| [ADR-0167](../adr/0167-client-owned-prime-sessions-by-default.md) | Lifecycle: foreground-owned; residency is a grant |
| [`docs/NEXT.md`](../NEXT.md) | Unclaimed work; §1 points here |
| Prime `extensions.md` (installed package) | Event list the first slice sits on |
