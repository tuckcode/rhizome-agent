# Selective harness doctrine

**Status:** ratified 2026-08-24 (ADR-0168); **amended 2026-10-09 (ADR-0180)**  
**Audience:** anyone deciding whether Rhizome should borrow a harness idea

ADR-0180 supersedes the Prime-only execution lock. Rhizome owns its
loop. Prime and Hermes are optional engines. Borrow-care below still
holds for foreign runtimes.

This is the Take / Adapt / Reject / Defer rule for Rhizome Agent. It is not an
implementation plan and not a parity checklist.

Source reviews:

- [Prime take/leave audit](../plans/2026-08-24-prime-harness-take-leave-audit.md)
- [Hermes source review](../plans/2026-08-24-hermes-harness-source-review.md)
- [DeepSeek Harness source review](../plans/2026-08-24-deepseek-harness-source-review.md)
- Switchyard evaluation (wiki note `projects/rhizome-agent/switchyard-model-routing`)
- [Token routing and compression](./token-routing-and-compression.md) — Switchyard + TinyHumans TokenJuice, 2026-08-26
- [Divergence scoring](../plans/2026-08-24-harness-doctrine-divergence.md)

The earlier vision draft, [`rhizome-prime-harness-vision.md`](./rhizome-prime-harness-vision.md),
still states the product shape. This file is the decision about what to take
from other harnesses and what to leave behind.

Composition working notes (older option-2 numbering; identity is ADR-0180):
[`harness-composition.md`](./harness-composition.md).

## One sentence

**Borrow with care; own the loop.** Rhizome is its own harness (ADR-0180).
Prime and Hermes are optional engines. Rhizome owns desktop presentation
and durable markdown memory. Background work is an explicit, revocable
grant, not the default. Foreign runtimes still donate contracts, not
competing organs.

## The Frankenstein test

A borrowed idea is welcome when it is a **contract, artifact, or signal**
that Rhizome can render or store, or when it is licensed code that
extends the Rhizome loop (ADR-0180).

A borrowed *foreign* idea is forbidden when it is an **organ** that would
compete with the Rhizome loop: a second planner, credential store, or
memory authority.

The old question ("If we deleted Prime tomorrow, would this piece still
try to run?") no longer forbids the Rhizome loop. That loop should run
without Prime. Ask instead:

> If we deleted this donor tomorrow, would Rhizome still have one loop,
> one vault memory, and one approval policy?

If the borrow would leave a second loop or a second memory file, do not
transplant it.

## Lineage locks

These three identities may evolve. They may not exchange ownership.

| Layer | Owner | May become | May not become |
|---|---|---|---|
| Execution | Rhizome loop (ADR-0180) | richer tools, plugins, routing; optional Prime / Hermes engines | a second competing loop or a second memory authority |
| Desktop UX | Rhizome | Rhizome visual language over Prime state | a cloned Prime TUI, Hermes desktop, or DSH console |
| Durable memory | Rhizome vault | better promote/search/provenance | silent dual-write or a second `MEMORY.md` authority |
| Background permission | the user | visible leases with stop/expiry | inferred persistence from close, hide, or crash |

Core chat depends on the Rhizome loop. An optional engine may be attached.
If a borrowed surface or optional engine fails, the product degrades to
the bare Rhizome loop. It does not take the app down with it.

## Source verdicts

### Prime Agent — optional engine; WRAP the policy

When attached, Prime owns daemon supervision, workers, its own loop, providers, credentials,
model catalog and session model state, tools/IPython, RLM/subagents, queues,
session trees and logs, compaction, goals, schedules, heartbeats, refine, and
coordinated updates.

Rhizome is a daemon client and policy shell. It renders Prime's user-relevant
state faithfully and applies product policy — foreground ownership, vault
access, native confirmation, promote-to-vault — around that state.

“Desktop version of Prime Agent” is a **fidelity standard**, not an ownership
rule. Every Prime capability Rhizome exposes must keep Prime's semantics.
Rhizome need not expose every Prime capability. Coverage is tracked by user
jobs, not by percent of daemon command names.

ADR-0163 remains the transport decision: Rhizome never owns or stops the
daemon. ADR-0167 is the lifecycle decision: new sessions are `client_owned`;
resident work requires an explicit grant.

### Hermes Agent — TAKE contracts, REJECT the stack

Hermes is the craft bar and the source of several product invariants:

- all work is observable and interruptible;
- sessions, children, and schedules have named states and terminal outcomes;
- children may narrow authority, never widen it;
- unattended approval fails closed;
- interrupted execution can be `unknown` instead of silently retried;
- skills disclose provenance and load on demand;
- scheduled work validates before it spends.

Adapt those contracts onto Prime's runtime and Rhizome's vault. Reject Hermes
as a second runtime, its default-on memory/skill writes, its YOLO bypass as a
product affordance, its parallel durable-memory stack, and its bot-roster /
messaging-gateway scope.

The memory pattern to steal is **proposal → diff → approve → vault write**, not
`MEMORY.md` / `USER.md`.

### DeepSeek Harness (`dsh`) — TAKE event/replay contracts, REJECT the runtime

“DeepSeek harness” now means the official
[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
developer-preview runtime, not the DeepSeek API and not the V3.2 training
pipeline. Keep those three names separate.

Take: durable events versus live coordination; model-visible means logged;
typed tool identity and tool-owned render intent; fail-closed monotonic
denials; subagent lineage in the UI; replay plus external-state assertions;
the split between operational session memory and durable human knowledge.

Reject: running `dsh` behind Rhizome; a second provider/tool/approval stack;
treating transcripts, plans, or hidden reasoning as vault notes; requiring a
vault before chat.

Defer: experimental agent teams, Ralph-style fresh-agent loops, and
task-based model routing inside Rhizome.

### Switchyard — DEFER behind Prime

NVIDIA NeMo Switchyard is an experimental model router, not a harness. If it
earns a trial, the path is `Rhizome → Prime → Switchyard → providers`. Rhizome
does not grow a router of its own.

### OpenHuman — DEFER a source review

OpenHuman appeared in the divergence frames as a possible stance, not as a
reviewed stack. One feature has been read: TinyHumans TokenJuice (content-kind
tool-output compression). That is recorded in
[`token-routing-and-compression.md`](./token-routing-and-compression.md). It is
not a full OpenHuman source review. Until one exists, treat the rest of
OpenHuman like any other external harness: metabolite-only, no organ
transplant. Do not compact Prime tool results in Rhizome.

### OpenCode and other CLIs — REJECT as product backends

They remain hidden Desktop DNA. Prime is the only runtime in the Agent product
UI.

## Ledger

### TAKE

| Item | Why |
|---|---|
| Rhizome loop as the execution substrate; Prime as an optional engine | Ownership lock (ADR-0180). Prime transport still ADR-0163. |
| Observable, interruptible work | Hermes product invariant. |
| Explicit lifecycle objects and `unknown` as a first-class outcome | Hermes + Prime 0.8.0. |
| Children may narrow, never widen | Hermes security seam. |
| Fail-closed unattended approval | Hermes and DeepSeek. |
| Durable event stream ≠ live coordination stream | DeepSeek; already matches Prime disk log vs roster. |
| Typed mid-turn admission (accepted / not-running / failed) | DeepSeek inbox semantics; already shipped as C43/C44. |
| Provider/model attribution per assistant message | DeepSeek; also the correct model-picker source of truth. |
| Tool-owned render intent | DeepSeek cards beat string heuristics. |
| External-state assertions and a live-daemon test lane | DeepSeek testing ladder. |
| Vault as the only durable human memory | Rhizome's differentiator. |
| Foreground-owned sessions by default | ADR-0167. |

### ADAPT

| Item | Onto |
|---|---|
| Hermes desktop observability | Prime status, tools, queue, subagent tree, failure cards — in Rhizome's visual language. |
| Hermes/Pi short-reply manners | `rhizome-vault` skill: answer in chat first, vault CLI not IPython, stop after one environment error. Not a second runtime. |
| Hermes memory approval queue | Vault promotion review with diff, source, and undo. |
| Hermes skill provenance | Prime skill catalog + Rhizome discovery/consent. |
| Hermes schedule state machine | Explicit background grant with cadence, scope, cost, stop. |
| DeepSeek inbox/steer/follow-up | Prime daemon commands and admission results. |
| DeepSeek compaction surfaces | Visualize Prime's model-visible projection; never compact independently. |
| DeepSeek trajectory view | Advanced diagnostics, not the default chat. |
| Capability negotiation | Store `daemon_hello` capabilities and schema revision; gate features on live contract, not package version. |
| Transplant half-life | Experiments (Switchyard, extra MCP, extra surfaces) expire unless a named user-value test renews them. |

### REJECT

| Item | Why |
|---|---|
| A second *competing* agent runtime beside the Rhizome loop | Organ transplant. The Rhizome loop itself is in scope (ADR-0180). Optional Prime / Hermes engines are allowed. |
| Command-count parity with Prime | Coverage is by user job. |
| Resident-by-default sessions and a global “survive quit” preference | Implicit autonomy. |
| App-stored provider keys or a Rhizome model router *for Prime chat* | Bypasses Prime auth when Prime is the attached engine. A Rhizome router for the Rhizome loop is in scope (ADR-0180). |
| Silent dual-write to vault + harness memory | Two sources of truth. |
| Treating `~/.prime` as the second brain | Operational continuity only. |
| Project-local Prime `mcpServers` as future wiring | Prime 0.8.0 ignores them by design. |
| Independent Prime update/release authority | Prime already has an updater. |
| Prominent YOLO / safety-off affordance | Grants must name the capability. |
| Reconstructing or persisting hidden chain-of-thought as knowledge | Operational, not durable. |
| Requiring a vault before chat | Decided product posture. |
| Claiming workers, kernels, or skills are sandboxes | Prime and Hermes both deny this. |

### DEFER

| Item | Until |
|---|---|
| Bundled Prime / Node | Lifecycle, capability negotiation, and extension UI are stable. |
| Native extension UI (`select` / `confirm` / `input` / `editor`) | After ADR-0167; required before claiming extension support. |
| Queue editing, RLM tree, schedule UI, refine history | User pull, in that order, each as Prime mechanics + Rhizome UX. |
| Switchyard production routing | Behind-Prime experiment with a half-life. See [`token-routing-and-compression.md`](./token-routing-and-compression.md). |
| TokenJuice-shaped tool compaction | Behind Prime (skill / daemon). Rhizome may render breadcrumbs; it must not compact independently. |
| OpenHuman source review | TokenJuice path read 2026-08-26. Full stack still unread. |
| Agent-team roster / mailbox / task DAG | Prime exposes a stable equivalent. |
| Worktree orchestration | Prime isolation + Rhizome review/merge UX are understood. |
| Voice, HUD, bot gateways, hosted fleets | Demonstrated Rhizome demand. |

## How to decide the next borrow

1. **Does Prime already own this?** If yes, render or wrap it. Do not reimplement it.
2. **Can it live as a contract or artifact?** If it needs its own loop, reject it.
3. **Does it outlive the window?** Then it is a background grant, not a default.
4. **Does it write durable knowledge?** Then it is a vault promotion, not a harness side effect.
5. **Can we delete it?** If there is no adapter boundary and no removal test, do not add it.
6. **What user job does it serve?** If the answer is “Prime has a command for it,” that is not a job.

## Immediate sequence

This doctrine does not replace the current bug list. It orders harness work
after the already-decided lifecycle slice:

1. Implement ADR-0167 completely (`client_owned_sessions`, promote/complete,
   close/quit UX, no global survive-quit preference).
2. Make protocol negotiation real (capabilities, schema revision, stable client
   identity).
3. Correct 0.8.0 drift: dead project MCP assumption, protocol export, Prime's
   own updater.
4. Native extension UI before any “supports Prime extensions” claim.
5. User-pulled surfaces: queue, subagent tree, schedules, refine, model/auth
   catalog — each as UX over Prime, never as a new runtime.

The model picker must display Prime's catalog, not a cached or inherited subset.
That is a fidelity bug under this doctrine, not a product preference.