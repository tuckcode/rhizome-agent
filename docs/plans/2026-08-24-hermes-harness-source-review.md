# Hermes Agent as a source for Rhizome Agent's selective harness doctrine

**Date:** 2026-08-24  
**Status:** source review, not an implementation plan  
**Hermes source snapshot:** [`NousResearch/hermes-agent@47e97e8`](https://github.com/NousResearch/hermes-agent/tree/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b) (2026-08-23)
**Follow-up verification:** [`NousResearch/hermes-agent@175054c`](https://github.com/NousResearch/hermes-agent/tree/175054c14b54404663d8614a178280cffe6062eb) (2026-08-24 UTC); the later snapshot reinforced the verdict and supplied the plugin, goal, and isolation caveats below.

## Question and boundary

Hermes Agent is useful to Rhizome as evidence of what a serious agent product makes visible and controllable. It is not a candidate execution core. Rhizome's existing decisions are explicit:

- Prime is the only runtime; Rhizome is the desktop and memory product ([v0 brief, lines 8–40](../plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md)).
- The vault is the durable source of truth; harness sessions and memory are operational ([v0 brief, lines 148–165](../plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md)).
- Hermes is a craft and capability bar, not the stack ([harness vision, lines 5–15 and 70–83](../design/rhizome-prime-harness-vision.md)).
- Prime's daemon may remain available, but Rhizome-created work is foreground-owned by default; background work requires an explicit, visible, revocable grant ([ADR-0167, lines 48–83](../adr/0167-client-owned-prime-sessions-by-default.md)).

The selective doctrine is therefore:

> **Take Hermes's product contracts and containment lessons; adapt them onto Prime's runtime and Rhizome's vault; reject duplicate execution, memory, credential, and autonomy stacks.**

## Method and source caveat

Only first-party material was used: the official Hermes repository and docs at the pinned revision, plus Rhizome repository documents that directly discuss Hermes.

The Hermes repository moves quickly enough that its docs disagree with its source at the same commit:

- The delegation guide says the default child concurrency is 3, while `config_defaults.py` and `delegate_tool.py` set it to **10** ([guide](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L22-L31), [source default](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/hermes_cli/config_defaults.py#L1917-L1964)).
- The cron internals page says cron children cannot schedule recursively, while the current feature guide and scheduler source expose the opt-in `cron.allow_agent_scheduling` escape hatch ([older statement](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/cron-internals.md#L174-L184), [current guide](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/cron.md#L265-L289), [source](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/cron/scheduler.py#L359-L382)).

Where they conflict, this review treats source at the pinned commit as authoritative. Numerical defaults are examples, not recommendations for Rhizome.

A second source pass completed against `175054c`, a newer official commit published while this review was being written. It did not change the TAKE/ADAPT/REJECT/DEFER split. It added three containment details worth preserving: Hermes plugins are unrestricted in-process Python despite capability consent metadata; worktree isolation can silently degrade to a shared checkout; and persistent-goal judge failure continues rather than pausing unattended work.

## Executive verdict

### TAKE

1. **Observable, interruptible work as a product invariant.** Every tool call is visible; running work has status, stop, steer, and post-hoc inspection rather than a spinner and a transcript ([architecture](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/architecture.md#L256-L265), [delegation controls](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L262-L325)).
2. **Explicit lifecycle objects.** Sessions, subagents, and schedules have named states, ownership, durable identifiers, and terminal outcomes. A crash yields `unknown` when side effects cannot be proven; it does not silently retry ([subagent lifecycle API](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/subagent-lifecycle-api.md#L33-L61), [cron execution history](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/cron.md#L321-L345)).
3. **Least-privilege inheritance.** Children may narrow parent capabilities but may not widen them; unsafe child tools are removed; unattended approval defaults fail closed ([delegation](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L173-L184), [lifecycle source](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/agent/subagent_lifecycle.py#L486-L540), [security](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/security.md#L24-L60)).
4. **Progressive disclosure with provenance.** Skills advertise compact metadata, load full instructions only on demand, and carry source/trust/update information ([skills](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/skills.md#L149-L196), [install provenance](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/skills.md#L302-L351)).
5. **No-spend and no-duplicate-work guards for scheduled autonomy.** Validate configuration before model dispatch, pin unattended inference intentionally, prevent overlapping claims, and distinguish a failed run from a run that may have happened ([cron guide](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/cron.md#L24-L35), [preflight](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/cron.md#L74-L99), [execution ledger](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/cron.md#L321-L345)).
6. **Session hygiene as UX, not storage trivia.** Human titles, compact resume recaps, workspace affinity, archive/pin, source tagging, and integration-session suppression keep operational history legible ([sessions](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/sessions.md#L100-L215), [archive/pin](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/sessions.md#L443-L575), [`source=tool` implementation](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/hermes_cli/sessions_cmd.py#L323-L330)).

### ADAPT

1. **Adapt Hermes's desktop observability onto Prime, not Hermes.** Rhizome should expose Prime's status, context usage, tool activity, subagent tree, and scoped controls through its own calm chat-first UI. Hermes demonstrates the useful contract: live tool output, a context meter with category breakdown, model/session status, queued-message editing, and layered failure cards ([desktop](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L35-L59), [failure cards](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L410-L441)).
2. **Adapt memory approval into vault promotion.** Hermes's staged approve/reject flow is a good interaction pattern, but the approved object should become a human-readable Rhizome note or note patch with source, diff, and undo—not an additional `MEMORY.md`/`USER.md` authority ([Hermes memory write gate](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/memory.md#L258-L283)).
3. **Adapt skills as a Prime-backed capability catalog.** Show what is available, why it is available, source/provenance, trust, required setup, and recent use. Prime remains the skill loader and executor; Rhizome owns discovery, explanation, and consent.
4. **Adapt provider UX as a view over Prime.** Hermes proves that provider setup and per-session model selection need different surfaces and that model changes can invalidate prompt caches ([providers](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/integrations/providers.md#L100-L109), [desktop model picker](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L78-L85)). Rhizome should render Prime's configured providers/models and session overrides; it should not create a second credential or routing layer.
5. **Adapt schedule creation to foreground-owned doctrine.** A schedule is an explicit background grant. Creation must state cadence, scope/workspace, model/cost policy, allowed tools, delivery, expiry/repeat, and stop/pause controls. Hermes's job state machine and run ledger are useful; its chat-driven autonomous schedule creation is too permissive as a default.
6. **Adapt subagent summaries and logs to Prime lineage.** The parent context should receive a bounded result, while the UI retains inspectable live and post-hoc execution detail. Rhizome should use Prime's native parentage and cancellation rather than reproducing Hermes's thread registry.

### REJECT

1. **Reject Hermes as a second runtime.** Its `AIAgent`, provider resolver, tool registry, gateway, scheduler, session DB, and subagent executor overlap directly with Prime ([architecture](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/architecture.md#L11-L49)). Rhizome already says Prime runs while Rhizome presents and remembers.
2. **Reject autonomous memory and skill writes as the default.** Hermes enables post-turn background review and free writes by default; approval is opt-in ([memory defaults and review](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/memory.md#L258-L347), [skill default](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/skills.md#L543-L608)). Rhizome's durable memory is user-owned markdown. Automatic analysis may propose; it must not silently canonize.
3. **Reject broad in-app "YOLO" permission bypass.** Hermes preserves an always-on catastrophic floor, but still offers session and environment switches that bypass ordinary approvals ([security](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/security.md#L63-L114)). Rhizome should expose Prime's scoped permission modes and explicit grants, not a prominent global safety-off affordance.
4. **Reject capability widening and recursive autonomy without product bounds.** Hermes permits no-ceiling concurrency/depth configuration and opt-in cron-created cron jobs ([source default](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/hermes_cli/config_defaults.py#L1917-L1964), [nested delegation](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L343-L361)). Rhizome should present finite budgets and depth/cost warnings even if Prime can do more.
5. **Reject Hermes's parallel durable-memory stack.** Bounded prompt memory, FTS session recall, and external semantic providers are coherent for Hermes, but adopting them would create competing sources beside Prime's operational history and the Rhizome vault ([memory](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/memory.md#L11-L33), [session search](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/memory.md#L185-L211)).
6. **Reject Hermes's multi-profile bot roster and messaging-gateway scope for the core product.** Those are legitimate Hermes product choices, but they dilute Rhizome's one-engine, desktop-and-vault job ([desktop Bot Mode](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L165-L230), [gateway](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/gateway-internals.md#L7-L26)).
7. **Reject arbitrary in-process extension code.** Hermes plugin capability declarations support consent and audit, but plugins execute as unrestricted Python inside the agent process; the declarations are not a sandbox ([official plugin guide](https://github.com/NousResearch/hermes-agent/blob/175054c14b54404663d8614a178280cffe6062eb/website/docs/user-guide/features/plugins.md#L147-L199), [isolation caveat](https://github.com/NousResearch/hermes-agent/blob/175054c14b54404663d8614a178280cffe6062eb/website/docs/user-guide/features/plugins.md#L380-L436)). Rhizome should prefer Prime's existing extension boundary and explicit external processes over loading third-party code into Tauri.

### DEFER

- Remote/fleet gateway management, hosted wake-to-run scheduling, Bot Mode, group-agent chats, profile distribution, marketplace breadth, voice/HUD, and cross-platform messaging should wait for demonstrated Rhizome demand.
- Bundling Prime remains a later packaging milestone. Hermes proves that one installer can coordinate a desktop shell and a separately evolving backend, but its Python + Node + Electron solution is not reusable architecture for Tauri + Prime ([installation](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/getting-started/installation.md#L16-L53), [desktop backend contract](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L272-L290)).
- Worktree orchestration is worth revisiting only after Prime's native isolation and Rhizome's review/merge UX are understood. Hermes's opt-in behavior is evidence for the user need, not a reason to copy its implementation. Critically, Hermes silently falls back to the shared checkout when isolation is unavailable; Rhizome must instead fail visibly or ask before sharing a workspace after promising isolation ([delegation](https://github.com/NousResearch/hermes-agent/blob/175054c14b54404663d8614a178280cffe6062eb/website/docs/user-guide/features/delegation.md#L389-L423)).

## Domain analysis

### 1. Runtime architecture

Hermes centralizes all frontends—CLI, gateway, ACP, batch, API, TUI, and desktop—on one synchronous `AIAgent` orchestration loop. Provider resolution, prompt assembly, tool dispatch, compression, persistence, and retry live in that core; interfaces are entry points around it ([architecture](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/architecture.md#L11-L49), [major subsystems](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/architecture.md#L190-L242)).

**Doctrine:** TAKE the separation between runtime truth and presentation surfaces. REJECT the runtime itself. In Rhizome, Prime is the equivalent shared core and Rhizome must avoid re-deriving provider, tool, subagent, scheduling, or session state from UI heuristics.

### 2. Session and process lifecycle

Hermes persists canonical session metadata and full message history in SQLite/WAL with lineage, source tags, workspace identity, costs, FTS, and contention handling ([session storage](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/session-storage.md#L1-L33), [contention](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/session-storage.md#L172-L190)). Gateway work is hosted by a long-lived service with profile-scoped process tracking; desktop instead launches a headless `hermes serve` backend and can attach to remote instances ([gateway process management](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/gateway-internals.md#L248-L265), [desktop backend](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L287-L321)).

Hermes's most useful lifecycle distinction is epistemic: completion delivery can be durable even when execution is not. A process restart does not resume an in-flight subagent; the outcome becomes `unknown` because external effects cannot be proven, while a completion produced before the restart can still be delivered later ([delegation durability](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L128-L141), [lifetime](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L363-L378)).

**Doctrine:** TAKE explicit running/terminal/unknown states and durable completion delivery. ADAPT session metadata and UX over Prime's daemon/logs. Do not add a Rhizome session database that competes with Prime; store only UI-local annotations Prime does not own.

### 3. Tools and skills

Hermes tools self-register into a central registry. Availability checks remove unusable tools from the schema; optional tool import failures do not prevent unrelated tools from loading; dispatch wraps exceptions into structured errors ([tools runtime](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/tools-runtime.md#L19-L95), [dispatch containment](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/tools-runtime.md#L124-L174)).

Skills are markdown-first procedures with on-demand loading, optional references/scripts/assets, platform/tool requirements, project trust, security scanning, provenance, and guarded updates ([skills](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/skills.md#L7-L13), [project trust](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/skills.md#L415-L456)).

**Doctrine:** TAKE capability discovery, provenance, trust, and progressive disclosure as UI contracts. ADAPT them to Prime's skills and Rhizome's vault-aware skill. REJECT an independent Rhizome registry or self-editing skill store.

### 4. Providers and models

Hermes resolves many built-in and custom providers through one runtime resolver shared across surfaces, supports OAuth/API-key/custom endpoints, permits per-session switching, auxiliary-model routing, fallback chains, and per-task model pins ([architecture](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/architecture.md#L208-L218), [provider setup](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/integrations/providers.md#L7-L59), [fallbacks](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/integrations/providers.md#L1564-L1592)).

**Doctrine:** TAKE the user model: setup is distinct from switching; show actual provider/model, scope, fallback, and cost implications. ADAPT to Prime's provider/config APIs. REJECT storing provider secrets or independently resolving routes in Rhizome.

### 5. Subagents

Hermes children start with fresh context, receive only an explicit goal/context, inherit but cannot widen tools, block shared-memory/scheduling/messaging actions, and return bounded summaries to the parent. Top-level delegations run asynchronously where later delivery is possible; owner close/reset cancels children; steering and stop are ownership-scoped ([delegation](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L7-L57), [control](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L289-L325), [key properties](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L380-L388)).

Its public lifecycle API is especially instructive: opaque parent-scoped handles, immutable terminal results, cooperative cancellation that never claims completion early, bounded payloads, and explicit `RECONNECT_UNAVAILABLE` after process restart ([API](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/subagent-lifecycle-api.md#L33-L61)).

**Doctrine:** TAKE the control and status contract. ADAPT it to Prime's session tree and native subagent lifecycle. REJECT Hermes-style Python child execution, no-ceiling fan-out, and implicit delegation policy in Rhizome.

### 6. Scheduling and autonomy

Hermes models scheduled work as stored jobs with schedule, prompt, skills, delivery, repeat count, state, next/last run, and optional model/provider. Runs are isolated fresh sessions; scheduler locking prevents duplicate batches ([cron internals](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/cron-internals.md#L21-L74), [runtime](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/cron-internals.md#L79-L101), [locking](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/cron-internals.md#L279-L288)).

The strongest containment details are user-owned model pins, drift detection that fails closed before spend, configuration preflight, pause/resume/remove controls, and an immutable execution ledger with `unknown` after an abandoned attempt ([cron guide](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/cron.md#L24-L35), [lifecycle](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/cron.md#L228-L263), [history](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/cron.md#L321-L345)).

**Doctrine:** TAKE the job/run state model and fail-before-spend safeguards. ADAPT schedule creation as an explicit Prime residency grant with visible scope and revocation. REJECT default post-turn forks and agent-created schedules unless the user has explicitly enabled that class of autonomy.

Hermes persistent goals add turn budgets, pause/resume/clear controls, deterministic quality gates, and wait barriers, but a judge/model failure means “continue” rather than pause ([goals](https://github.com/NousResearch/hermes-agent/blob/175054c14b54404663d8614a178280cffe6062eb/website/docs/user-guide/features/goals.md#L174-L214)). Rhizome should TAKE the explicit goal contract and budget, but ADAPT judge failure to pause unattended work until the user or a deterministic policy resolves the ambiguity.

### 7. Permissions

Hermes layers authorization, command approval, file-write guards, container isolation, credential filtering, context-file scanning, cross-session isolation, and URL validation ([security overview](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/security.md#L11-L23)). Headless cron and one-shot contexts deny dangerous commands by default; approval timeouts fail closed ([approval config](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/security.md#L24-L60), [timeout](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/security.md#L142-L151)). It also correctly admits that file-tool deny rules are defense-in-depth, not a sandbox, because shell can bypass them ([file safety](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/security.md#L279-L329)).

**Doctrine:** TAKE fail-closed unattended behavior, capability inheritance, explicit permanent grants, and honest boundary descriptions. ADAPT policy to Prime and Rhizome's vault access tiers. REJECT a generic safety toggle that hides which capability was granted.

### 8. Memory

Hermes deliberately separates bounded always-in-context memory from unlimited on-demand session search. Memory is mutable markdown, injected as a frozen prompt snapshot; session search returns actual DB messages without LLM summarization ([memory](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/memory.md#L11-L33), [search distinction](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/memory.md#L185-L211)).

That division is sound for a general harness but not Rhizome's authority model. Prime's session history can serve operational recall; Rhizome's vault serves durable, editable knowledge. Hermes's staged memory/skill writes are the part to borrow.

**Doctrine:** ADAPT proposal → diff → approve → vault write, with provenance back to the Prime session/tool result. REJECT silent background canonization and another always-injected memory store.

### 9. UX

Hermes treats agent state as primary UI: streaming tool rows, context accounting, session continuity, queue editing, session timelines, model scope, multi-window live streams, subagent inspection, and failure-specific recovery ([desktop chat/status](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L35-L59), [windows](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L95-L116), [TUI agents](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/tui.md#L112-L128)).

This validates Rhizome's existing use of Hermes as a craft bar, especially identity, working status, visible tools, and session continuity ([frontend roadmap, lines 27–38](../plans/2026-08-09-rhizome-agent-frontend-design-roadmap.md)).

**Doctrine:** TAKE dense but calm observability, scoped controls, and actionable failures. ADAPT every control to Prime and every durable-output affordance to the vault. REJECT Hermes's breadth as a parity checklist.

### 10. Packaging

Hermes ships one product across CLI/TUI/desktop while sharing state. Its installer coordinates a repository checkout, managed Python, Node, dependencies, a global CLI, and provider setup; the Electron desktop launches a separate headless backend and can connect remotely ([installation](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/getting-started/installation.md#L16-L53), [desktop implementation](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L272-L321)). The Python package pins core dependencies and lazy-installs optional backends to limit supply-chain blast radius ([`pyproject.toml`](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/pyproject.toml#L3-L39)).

**Doctrine:** TAKE installer ownership of prerequisites, explicit backend health/version states, separate client/backend update awareness, and lazy optional components. ADAPT to a signed Tauri app plus bundled or managed Prime. REJECT copying Hermes's source-checkout/venv/Node/Electron layout.

### 11. Failure containment

Hermes contains failures at multiple seams:

- unavailable optional tools disappear instead of breaking all tools;
- tool exceptions become structured results;
- approval and URL checks fail closed in high-risk contexts;
- session DB writes use WAL, early lock acquisition, jittered retry, and checkpoints;
- subagent stalls become explicit terminal outcomes;
- process loss marks uncertain executions `unknown`;
- completed-but-undelivered results can survive restart;
- schedule preflight avoids spending on known-bad configuration;
- desktop failure cards name the failing layer and offer matched recovery.

Sources: [tools runtime](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/tools-runtime.md#L47-L95), [dispatch errors](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/tools-runtime.md#L124-L174), [DB contention](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/developer-guide/session-storage.md#L172-L190), [subagent stall monitor](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/features/delegation.md#L226-L259), [desktop failures](https://github.com/NousResearch/hermes-agent/blob/47e97e8640cc1ceb36c00bbbae4ff67f3b65ba8b/website/docs/user-guide/desktop.md#L410-L441).

**Doctrine:** TAKE uncertainty as a first-class result. Rhizome should never translate "transport disconnected," "worker may still have side effects," "result delivery pending," and "work definitely stopped" into one generic failed state.

## Concrete doctrine for Rhizome

1. **Prime owns execution truth.** Rhizome queries and renders Prime lifecycle/capability state; it does not infer it from transcript activity or implement a parallel executor.
2. **Rhizome owns grants.** Foreground work is client-owned. Resident turns, goals, schedules, and heartbeats each expose scope, duration/budget where available, and Stop/Pause/Revoke.
3. **Every running unit is inspectable.** Session and subagent trees show owner, status, current action, elapsed time, model, workspace, and a scoped stop/steer action.
4. **Every durable write is attributable.** Vault promotions show the proposed markdown diff, source session/tool, destination note, and approval state.
5. **Children cannot widen authority.** Subagents and scheduled runs inherit or narrow parent/user-granted tools and vault access. Non-interactive ambiguity denies.
6. **Uncertainty is not failure and not success.** Interrupted, cancelled, failed, stalled, completed, delivery-pending, and unknown-side-effects are separate states.
7. **Capabilities appear when real.** Skills/tools/models are discovered from Prime and shown with availability, provenance, setup, and trust; unavailable capability is not advertised as working.
8. **Hermes parity is not a roadmap.** Adopt only a contract that strengthens Prime supervision, Rhizome memory, explicit autonomy, or failure clarity.

## Highest-signal implications

1. The most valuable Hermes idea is not a feature but a contract: **all agent work is observable and interruptible**.
2. Hermes's durable-completion/non-durable-execution distinction maps directly to Rhizome's lifecycle work: after a crash, say **unknown**, never assume retry or completion.
3. Hermes validates a rich schedule state machine, but Rhizome must invert the autonomy default: **scheduled/resident work begins only through an explicit grant**.
4. Hermes's memory approval queue should become Rhizome's **vault promotion review**, not a second memory store.
5. Provider, tool, skill, and subagent depth belong to **Prime**; Rhizome should expose their state and controls without duplicating resolution or credentials.
6. Capability inheritance is the right security seam: **children may narrow, never widen**, and unattended approvals fail closed.
7. Packaging lessons are about owning prerequisites and diagnosing backend health—not copying Hermes's Python/Node/Electron distribution.
8. Hermes's own doc/source drift is a warning: Rhizome's harness UI must probe Prime's live protocol and capabilities rather than treating docs or optional fields as runtime truth.
