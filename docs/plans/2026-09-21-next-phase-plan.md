# Rhizome Agent: next phase

**Origin:** GPT-6 / Codex. Thorough replacement for the September 21 thin draft, at Atticus's request.
**Status:** planning only. A shelf row does not authorize implementation.
**Direction:** install the current source on launch day, verify Update now, then select subsequent work from evidence and explicit claims.

## Planning basis

The [2104 handoff](handoffs/2026-09-21-2104-cursor-grok-4-7-astra-next-phase.md) supplies the current baseline.
`HEAD` and `origin/main` are recorded as **`2a24eed`**. The installed `/Applications/Rhizome Agent.app` is **`b7264d6`**.
The product push reached **`4ec3832`**. The later tip stamps documentation.
The 2104 handoff and this plan remain local planning files. The footer rule remains a separate uncommitted item.

This pass read the six requested documents. It did not inspect the running app or verify external behavior.
Design recommendations below are proposals, not findings from a current visual audit.
Older build stamps, queue orders, and issue descriptions do not override the 2104 handoff or Atticus's current instructions.

| Source | Use in this plan |
| --- | --- |
| [2104 handoff](handoffs/2026-09-21-2104-cursor-grok-4-7-astra-next-phase.md) | Current source/install distinction, launch order, settled constraints, and immediate shelf. |
| [Readiness plan](2026-09-20-public-readiness-plan.md) | Reliability, setup, publication, and native acceptance. Older candidate stamps remain historical. |
| [Frontend direction](../design/brand/2026-09-14-handoff/FRONTEND-DESIGN.md) | Existing hierarchy, accessible controls, honest states, and restrained artwork. |
| [NEXT](../NEXT.md) | Retained work and unresolved decisions. Its historical ordering is not a new assignment. |
| [Inventory](2026-09-20-public-readiness-inventory.md) | Complete parked tables and dated issue dispositions. These are not a fresh GitHub status check. |

The former draft is replaced by the three parts below. No research pass is added.
The closed September 13 God-plan document was not opened.

## Part one — Launch day: rebuild, Update now, and the exit check

### 1. The bounded job

On a day Atticus intends to launch the app, rebuild Rhizome from this source and install the named candidate.
Then test **#26 Update now in the native app** before other native checks.

These are two distinct operations. The rebuild updates the Rhizome application.
Update now updates the Prime engine through Rhizome's existing control.
NEXT records that control in `b7264d6`. This slice verifies the control rather than assumes it needs implementation.
It does not establish an application updater, runtime bundling, or public distribution support.

The first slice ends with evidence for #26. It does not absorb the shelf or begin a redesign.
The steps below describe future execution. This planning pass performs none of those operations.

### 2. Establish and install the candidate

1. Record the source commit and the exact product diff, if any, from `2a24eed`.
2. Keep the local planning files and footer rule distinct from product changes.
3. If product source changed, name the new candidate and its applicable verification before proceeding.
4. Preserve the current installed build identity and a recoverable application copy before replacement.
5. Build through the repository's established macOS packaging path.
6. Record the build result and the checks applicable to that candidate.
7. Install the candidate in `/Applications` and launch that application through the normal user path.
8. Record the installed identity, macOS version, architecture, and Prime version before the update.

The 2104 handoff records a passing pre-push run for the product push. The Rust lane skipped unchanged Rust source.
That is source evidence. It does not establish a successful package build or native acceptance.
Do not count a development server, another application copy, or the old `b7264d6` process as the new candidate.
Do not erase the user's configuration to create a clean test environment.

### 3. Exercise Update now through the native UI

Use the mouse path first. Record relevant keyboard access afterward.
Use synthetic prompts and a disposable session for any active-session case.
Do not put unrelated Prime sessions at risk to force an update scenario.

| Step | Evidence | Required outcome |
| --- | --- | --- |
| Open the existing update control | Current Prime version, offered version, and visible state | The control describes Prime accurately and presents the actual available action. |
| Check active-session protection | UI response and session state for a disposable running turn, where applicable | Updating cannot silently terminate or lose active work. A block, wait, or explicit warning matches the implemented contract. |
| Start the update when safe | Deliberate click, progress, and terminal result | One click produces one attempt. Unknown outcomes cannot look complete. |
| Verify the applied result | Prime version after the operation and the runtime actually serving Chat | Success corresponds to the intended engine version. A still-running older daemon cannot count as an applied update. |
| Resume ordinary use | Open an existing session and send one synthetic prompt | Session access survives. Chat reaches an answer or an actionable terminal outcome without losing input. |
| Confirm persistence | Reopen the app when safe and inspect engine/session availability | The result survives the normal app lifecycle. Shared Prime work remains intact. |

If no newer Prime version is available, record the apply check as **BLOCKED** on that prerequisite.
A successful version check is not proof that applying an update works.
Do not downgrade Prime or alter the user's installation merely to manufacture an update.
An isolated rehearsal can be proposed separately if waiting for a real update is impractical.

Capture failure or cancellation through a controlled, recoverable case when possible.
Do not interrupt a package write to simulate failure.
If a required failure case cannot be exercised safely, mark it **NOT RUN** and retain that limitation.

### 4. Evidence and exit check

Use one compact record for the slice:

| Field | Required content |
| --- | --- |
| Candidate | Source commit, product diff status, installed identity, and application path. |
| Environment | macOS version, architecture, and relevant Prime installation method. |
| Update | Prime before, offered version, Prime after, and the runtime serving Chat. |
| Native result | Actions, visible states, session continuity, and the post-update reply result. |
| Exceptions | Reproduction steps, redacted diagnostics, and exact missing prerequisites. |
| Verdict | PASS, FAIL, BLOCKED, or NOT RUN for each acceptance case. |

**PASS:** the named installed candidate applies a real Prime update, and the expected engine serves Chat afterward.
Session continuity and active-session protection meet #26's acceptance scope.
A happy-path result cannot silently satisfy an untested protection case.

**FAIL:** a reproducible defect violates update safety, reports false success, loses recoverable input, or breaks post-update Chat.
Record the smallest reproduction. A repair becomes a bounded implementation task with regression coverage and an affected native recheck.
Do not append unrelated polish while resolving that failure.

**BLOCKED:** a required update, environment, or safe setup is unavailable. Name the prerequisite.
**NOT RUN:** the case was not attempted. State why. Neither status is a pass.

**Exit:** all required #26 acceptance cases pass on the named candidate.
Otherwise, stop with the exact failing or blocked case. Do not claim completion from tests or a screenshot.
Issue closure remains a separate action. This pass closes nothing.

### 5. Preserve the next order and the larger readiness gate

The accepted native order remains **#26 → #46 no-vault Chat → #52 / #13 tray behavior**.
#41 also needs native evidence. This plan does not insert it ahead of that order.
Verify its existing Enter/Steer behavior before considering queue editing.

Public readiness still requires product evidence and publication evidence.
The initial advertised scope remains macOS, English, Chat through Prime, optional vault, and shipped Notes/memory behavior.
Claim support only for tested macOS and architecture combinations.
Linux build support does not establish daily-use support. Windows shipping remains parked.

## Part two — Shelf, decisions, and later acceptance

**A shelf row is not approval to build it.** Each row retains work and its condition for a later claim.
Readiness checks, product decisions, and optional additions have different exits.
This ledger is not one continuous implementation assignment.

### A. Current source, native queue, and immediate decisions

| Item | Current disposition | Next condition or acceptance |
| --- | --- | --- |
| Edit list (`c7827a5`) | On origin, absent from the recorded installed build | Confirm in the rebuilt candidate before proposing another implementation. |
| Notes width drag (`2f75bd1`) | On origin, absent from the recorded installed build | Verify resizing and retained widths in the existing presets. |
| Workspace destinations (`266532c`) | On origin, absent from the recorded installed build | Verify destinations and focus without adding navigation. |
| First-run contrast (`48efd2b`) | On origin, absent from the recorded installed build | Evaluate the new candidate before proposing another contrast change. |
| Chrome references (`cbce53c`) | On origin, absent from the recorded installed build | Preserve the current chrome contract. Evaluate it in the candidate. |
| Linux CI lanes (`dfc82a4`) | On origin as infrastructure | Preserve the lanes without claiming Linux native qualification. |
| TypeScript gate (`9b019d3`) | On origin as infrastructure | Preserve the gate. It does not supply native proof. |
| #26 Update now | First slice | Part one's native acceptance. |
| #46 no-vault Chat | Next accepted native check | Chat works without a vault. HOME, aliases, and symlinks cannot become vault scope. Preserve unrelated Prime settings and skills. |
| #52 / #13 tray | After #46 | Running count and the 45-second Done row open the correct session. Failed polling cannot invent completion. |
| #41 queue and Steer | Native queue, source already wired | Enter queues once. Steer redirects explicitly. Rejected admission preserves input. Queued text stays visible through its lifecycle. |
| `prototype/session-list-scale` | Undecided branch on GitHub | Atticus chooses keep, delete, or land. This plan does none of them. |
| #56 direct-provider exception | Decision required | Choose keep, remove, or document. Describe reachable behavior honestly meanwhile. Resolve this before #40 or #48. |
| Import | Parked | Prime session-list import waits for Atticus to type **`1`**. Existing vault Imports support does not waive that gate. |
| Windows | Parked | Requires an explicit platform claim and test environment. Preserve Windows paths. |
| Chunk installation | Parked | Install only when Atticus asks. The CLI is absent. Config still names `refactoringhq/tolaria` and an old org id. Never invent a CircleCI org id. |
| Footer rule | Parked local change | `.cursor/rules/one-job-in-flight.mdc` stays separate from the plan and product work. Atticus must claim its disposition. |
| #69 and Actions | Merged per 2104, hosted jobs never started | Billing or spending limits need resolution before a later hosted run. Unstarted jobs are not passing CI. |
| #66–#68 and remaining references | Closed, settled | Do not reopen or merge. README still names #66 per 2104. Retain that cleanup without reviving the drafts. |
| C75 wording | Settled behavior | Hide stops app-owned ws-bridge and Mindwalk. A spawned Prime daemon stays warm. Daemon lifetime does not authorize background work. |

The handoff reports Chunk sidecars as free for now. That report neither repairs the stale configuration nor authorizes installation.

### B. Readiness work retained from NEXT and the readiness plan

These rows preserve acceptance work. They do not assert that every older reported defect still occurs.

| Work | Boundary and later exit |
| --- | --- |
| Thinking / no-answer | Capture model, provider, supported thinking level, terminal event, and visible result. Distinguish provider rejection, worker failure, transport loss, and an empty successful turn. Preserve expandable reasoning. Never force thinking Off globally. |
| Provider connection and recovery (#45) | Verify current allow-list and preflight behavior. Distinguish missing/expired credentials, unavailable models, and transport failure. Preserve input. Existing Reconnect copies a Terminal command; that alone does not establish reconnection. |
| Session retrieval (#23) and titles | Verify search, replay, switching, rename, archive/restore, fork, and reopen. Treat history blobs in titles as a bounded follow-on. #49 is closed; naming is not a missing feature. |
| Chat interaction leftovers | Retain suspend/retry, DOM composer send, and selection/Copy checks from NEXT. Verify current behavior before fixes. Queue-message mutation remains separate from #41 acceptance. |
| Stop and lifecycle | Verify Stop, Cancel, Stop and close, Keep working, reopen, and Cmd+Q against actual ownership. Preserve shared Prime work. |
| First minute and startup | Retain C64, C60 blank paint, and C75 responsiveness. Observe three full launches, including the first two seconds. Starting, missing Prime, and unknown health need truthful states. |
| Durable notes and memory loop | Use a blank test vault. Create, edit, save, switch, reopen, and relaunch. Promote a useful note and recall it in a new session with working provenance. Failed saves cannot look saved. |
| Public-install dogfood | Use a clean account or equivalent isolated setup. Follow one documented route to a reply and saved/reopened note without private coaching. Preserve the author's configuration. |
| Prerequisites and offline behavior | Cover missing Prime/Node, offline launch, credentials, unavailable models, and permission denial. Existing Notes remain usable without a model provider. |
| Runtime independence | Verify packaged vault tools without the build checkout or the author's login-shell PATH. C69 and the hybrid skill are implemented work to test. |
| Layout and native shell QA (C7) | Verify the four presets, narrow windows, long names, focus, scrolling, selection/copy, and Notes restore. Browser tests do not replace native shell evidence. |
| Graph tooling (#39 and C40) | Verify scoped tool answers. Distinguish C40's remaining Rust CLI path from the MCP graph-health path. Do not assume both summaries describe the same graph. |
| Prime surface and composition (#5 / #40) | Describe supported user jobs and actual ownership. Resolve #56 and ratify the composition slice before grafts. Command-name parity is not the goal. |
| Setup and claims | Reconcile README, GETTING-STARTED, CONTRIBUTING, SECURITY, and platform claims with the candidate. Separate developer/user setup. Describe telemetry, package trust, data locations, recovery, and the supported extension subset accurately. |
| Publication security and licensing | Retain current security/lockfile checks, synthetic-secret redaction checks, tracked-file/history review, attribution/license review, and the README license-confirmation note. Reassess Tiptap/Medium deferrals and redaction limits. Dated passes are not publication clearance. |
| Distribution and recovery | Select and test the actual route before advertising it. A preview can use explicit prerequisites and manual application updates. #26 does not establish the public app updater. |
| Final qualification | Retain the proposal for three ordinary sessions across at least two days on one candidate. Include cold start, sleep/wake, a long conversation, and failure recovery. Record build and environment. |
| Gate and maintenance risks | Retain C28/C31 failures if they recur, C39 live-test isolation, C58 symlink handling, C53 worker/provider distinctions, and `.rhizome/events.jsonl` retention. Require evidence before changes. |
| Branding residues and living docs | Retain C21/C30 and the living-docs audit. Correct dangerous operational claims first. Do not normalize intentional names or revive settled decisions from old prose. |

P1 still requires no unresolved reproducible data loss, unintended vault scope, silent terminal failure, or broken core control.
P2 requires a new person to reach a reply and saved/reopened note through tested instructions.
P3 requires publication evidence with no unresolved release blocker and accurate limitations.
P4 requires the integrated candidate to support installation, work, recovery, and retained data within the advertised scope.
Visibility changes and release publication remain separate decisions.

### C. Every parked product and workflow row

These are the inventory's complete product/workflow rows, including their re-entry conditions.
They are retained proposals. No row becomes an instruction through inclusion here.

| Idea | Source | Condition for a later claim |
|---|---|---|
| Portfolio overview: recent projects plus pinned projects | [Idle Chat design](../design/idle-chat-overview.md) | Reliable Chat first; derive content from real git/vault/session facts |
| Today strip: overview docks as replies arrive | Same | Click-only expansion; retain composer and settings visibility control |
| Bottom launcher for board, schedules, and in-flight work | Same | Agree useful destinations; do not add empty navigation solely to reserve space |
| Human kanban from vault notes with `status` | Same; ADR-0144 | Vault files remain the data source; no `kanban.db` |
| Agent board over Prime sessions/subagents | [Composition](../design/harness-composition.md) | Probe current registry/observe semantics; no second task authority |
| Scheduled lint and intake audit | [Evening dump](handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md) | Explicitly enabled, visible, cancelable, report-only; no auto-delete |
| Vault as shared skill and memory home | [Vault skill home](../design/vault-skill-home.md) | Name vault paths and ownership; Prime reads or links those files |
| Shared instruction copies and drift checks | Same | Separate global preferences from repo rules; voice remains in the vault |
| Continual-learning writer toward vault facts/preferences | Same; evening dump | Define incremental index, deduplication, caps, and secret handling; retain current repo Learned guard |
| Doctor-door handoff to a waiting session | Same; evening dump suggestions 1–7 | Choose coding-tool versus Prime surface and handoff mechanism; user remains in control |
| Speech-to-text learned spellings and digits | Evening dump | Decide correction/override workflow; do not treat heuristic spelling fixes as a finished feature |
| Stuck-agent path: Mycelium, useful Graph, then fullscreen | Evening dump | Make the diagnostic job useful before adding another overlay |
| Native Mycelium M4 view | [HANDOFF](../HANDOFF.md), [run-map plan](2026-08-09-mycelium-run-map.md) | Confirm current API and design before implementation; keep Mindwalk ownership and attribution |
| Theme sun/moon polish and Settings skins | Evening dump | Optional visual work after current readability/accessibility defects |
| Packages/skills rail shortcut and market link | [04:38 pickup](handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md) | Explicit claim; Settings Packages already works |
| Automations/kanban rail destinations | Same | Real screens and user jobs first |
| Vault pop-out | Same | Separate layout decision; preserve the current four presets |
| C66 response/instruction profile | [Profile card](c66-agent-profile.md) | Decide one/per-agent, app/per-vault, and Settings placement |
| Prime session-list import | [Import decision](import-jsonl-decision.md), [full plan](2026-09-01-session-import-plan.md) | Atticus must type `1`; vault Imports support is already separate and shipped |
| Additional chat-import adapters and Welcome import offer | Same; NEXT C9 | Define source formats and onboarding behavior; preserve list-import gate |
| Spotlight onboarding tour | HANDOFF C10 | Separate feature; a working quick start does not require a tour |
| Rhizome-owned remote starter vault | HANDOFF C11 | A real maintained remote and an explicit need; local scaffold is already the default |
| Model-backed Tab completion | #51 | Case 1 remains sufficient; preserve the no-approval-autofill boundary |
| Timezone override | #36 | Decide display scope without changing stored filenames/dates |
| Global hotkey, implicit screen capture, focused composer | #52 job 2 | Mute-first design and permission flow; voice follows demonstrated use |
| Voice companion | #52 job 2 | Separate consent, audio permissions, model, and latency design |
| Agent live-app view / `pnpm live-ui` | #50 [plan](2026-08-29-live-app-view-plan.md) | Choose surface; developer tooling does not replace native QA |
| Website and further identity work | Latest Dock/site and frontend design | Separate site project; approved Signal remains; no broad theme or animated-root redesign now |
| Windows first launch and packaging | C42 / #32 | Explicit platform claim and test hardware |
| Prime/Node bundling, managed updates, paid signing | #26; BOARD ship rules | Separate delivery decision; document the preview's actual prerequisites meanwhile |

### D. Every parked memory and harness row

These are the inventory's complete memory/harness rows.
They remain proposals or decision work. Verify external behavior when a row is later claimed.

| Idea | Source | Condition / constraint |
|---|---|---|
| Inspectable retained claims, provenance, correction history | [Latest memory direction](../design/brand/2026-09-14-handoff/MEMORY-DIRECTION.md) | Decide authority and correction semantics; render only fields that exist |
| Automatic L0–L3 consolidation | [Consolidation proposal](../design/automatic-memory-consolidation.md) | Define background-safe execution and approval; current Distill is not that system |
| Pre-write near-duplicate checks | [Memory mechanics research](2026-08-10-memory-mechanics-worth-stealing.md) | Revalidate current implementation; local matching before expensive model judgment |
| Temporal supersession and contradiction links | Same | Preserve earlier records; define valid/superseded fields and visible correction behavior |
| Two-stage save gate and extraction rules | Same | Distinguish model screening from human approval; preserve explicit memory authority |
| Unique-string amendments versus wholesale rewrites | Same | Separate narrow edits from explicitly gated replacement |
| Before/after versioning, inverse rollback, optimistic concurrency | Same | Required with mutation features; prove recovery before shipping update-in-place |
| Reversible `expires:` search filtering | Same | Low-priority soft-hide proposal; not automatic deletion or decay |
| Correction-triggered capture | [Seven memory ideas](2026-09-02-pi-hermes-memory-ideas-plan.md) | Decide whether unsolicited memory proposals are welcome; proposal is not a save |
| Pinned rules separate from searched memory | Same | Decide permission to edit vault AGENTS and global versus per-vault scope |
| Retrieval policy instead of full-memory injection | Same | Inspect current skill first; measure retrieval behavior without installing another memory store |
| Guard-wrap retrieved memory as data | Same | Assess current trust boundaries; a text wrapper is not a security boundary |
| Duplicate/staleness checks before saving | Same | Define candidate and approval flow before background consolidation |
| Candidate lane that is not yet memory | Same | Decide visible proposals folder versus hidden operational state, exclusions, and expiry |
| Declined-proposal ledger | Same | Depend on candidate flow; make rejection reversible and keep ledger out of model memory |
| Native extension dialogs | [Composition](../design/harness-composition.md), [Prime surface](../design/prime-agent-surface.md) | Ratify slice; required before claiming full interactive-extension compatibility |
| Loaded skill/extension catalog with provenance | Same | Reconcile with shipped Packages hub; avoid duplicate catalog surfaces |
| Tool-allowlist profiles | Same | Review candidate Pi extensions and actual enforcement; separate from C66 response instructions |
| Sandbox exploration | Composition sandbox section | Distinguish worker isolation from a sandboxed code-runner tool; no current sandbox claim |
| Read-only agent terminal versus human terminal | Composition Hermes source review | Separate output stream and ownership; one UI style does not imply shared input |
| RLM tree/depth, observe, side questions, refine, agent messages, tool introspection | [Prime surface](../design/prime-agent-surface.md), [spoken surface](../design/prime-spoken-surface.md) | Pick a user job and probe live behavior; command names alone do not justify controls |
| Editing one queued message | Same; #41 | Separate from verifying existing Enter/Steer behavior |
| TokenJuice-shaped compression | [Routing/compression notes](../design/token-routing-and-compression.md) | Prime owns model-visible context; retain originals/retrieval evidence; no desktop compaction authority |
| Switchyard model routing | Same | Consent and protocol-fidelity trial before routing; `set_scoped_models` is not a router |
| Managed OmniRoute | #48 | Resolve #56 and prove lifecycle/endpoint behavior |
| OpenHuman full source review | Composition | Compression notes do not constitute a full review |
| TraderAlice patterns | NEXT parked row | Prove/verify/shadow, content-addressed provenance, allowed-next-actions; verify rights before copying code |
| Compatibility and dead-code cleanup | #57; [cross-model traps](../CROSS-MODEL-HANDOFF.md) | Keep actual user data, ambient declarations, spawned entry points, and migration fingerprints safe |
| Grokbot audit leftovers | [Review](handoffs/2026-09-14-1155-cursor-grokbot-leftover-review.md) | Review recorded zero accepted findings; do not replay rejected work without new evidence |

### E. NEXT-only boundaries and retained decisions

| Item | Disposition |
| --- | --- |
| W11 cards | Remain cards. Portfolio, Today, launcher, boards, scheduled lint, shared skills, and learning ideas do not become UI in this phase. |
| Right icon rail | Remains undecided. Notes stays available through Show Notes. Do not add navigation to fill unused space. |
| Harness composition option 2 | Ratify ownership, first slice, and incompatibilities. The provider contradiction prevents treating ADR-0168 as settled authority for new grafts. |
| C66 profile | Agreed but unbuilt. Decide one/per-agent, app/vault scope, and Settings placement. Keep response instructions separate from model choice and tool permissions. |
| Ship workflow and memory-loop index | Existing workflow/index assets, not missing features. Retain them without starting a ship task. |
| Design-to-issue links | Retain useful cross-references. Do not reopen settled layout questions or rely on the old claim that design documents contain no issue links. |
| Current shipped baseline | Preserve timestamps, prompt history, rules-first Tab, session context menus, note lock, local scaffold, provenance, and schedules. Retesting does not make these missing features. |
| Historical packaging and layout leftovers | Use `2a24eed` and `b7264d6`, not older hashes in NEXT. Verify the candidate before converting historical packaging complaints into work. |

Rejected ideas stay distinct from parked ones. OpenCode was an example, not a requested runtime.
CC Switch is not a proposed port. Do not install `pi-hermes-memory` or introduce its second durable store.
Cordis/DSH kernels and personal voice skills in this repository remain outside scope.
Memory proposals do not authorize automatic recency/frequency decay, a replacement vector/graph database, or unsupervised arbitrary-note rewrites.
They also do not authorize an extra reconciliation call solely to choose ADD/UPDATE/DELETE.
Keep `kanban.db` out. Preserve Limited tools / Power User names without a sandbox claim.
TokenJuice and Switchyard remain discuss-only. `set_scoped_models` filters model cycling; it does not route requests.

## Part three — Design: improve, leave, and rethink

### 1. Design judgment

The existing direction fits the product: Chat is the primary work surface, with sessions left and optional Notes at the right.
The supplied documents do not establish that **Chat / Notes / Read / Workbench** are wrong.
This plan preserves their names, layout contracts, shortcuts, Chat-first launch, and user-selected widths.
It proposes no replacement screens or mockups.

The next design effort should help a person understand the available action, the request's outcome, and the safe next step.
Readable controls and recoverable failures serve that job directly.
Visual identity can remain distinct through restrained artwork, typography, and consistent details.

The September 14 direction names inspection candidates, including small composer and notice text.
Those measurements do not prove a defect in `2a24eed`, especially after later contrast and chrome commits.
Implement a proposal only after a later claim and evidence of its trigger, or an explicit design choice from Atticus.

### 2. What to leave

| Preserve | Reason and boundary |
| --- | --- |
| Chat / Notes / Read / Workbench | Existing user choices. No source read here establishes a need for a replacement layout system. |
| Chat-first launch and optional vault | Notes setup must not become a mandatory Chat prerequisite. |
| Sessions left, Chat center, optional right column | Preserve the 46px Notes restore strip, inner divider, Notes split toggle, and green Chat working strip. |
| Navigation | Keep Sessions, Settings, and pin on the rail. Research remains on the status bar and command palette. No empty destinations. |
| Reading preferences and themes | Preserve font/scale preferences and current semantic tokens. Do not impose a forest palette across themes. |
| Input behavior | Preserve Enter's send/queue contract, Shift+Enter newline, and Escape's Chat-close behavior. Stop remains click-only. |
| Shipped assistance | Preserve rules-first Tab, prompt history, expandable real reasoning, and current message actions. No competing suggestion system. |
| Identity and controls | Preserve Signal for the OS icon and the Phosphor/shadcn family. Use the appropriate small mark at icon scale. |
| Brand placement | Keep transcript/editor surfaces free of texture. Organic artwork belongs primarily in About and marketing. |
| Security presentation | Mask secrets by default. Credentials do not prove connection health. Limited tools does not establish a sandbox. |

### 3. What to improve — bounded proposals

Each item below is a **proposal**. None changes the first slice.
Component references in the frontend direction are entry points, not proof of current defects.

#### Proposal D1 — Clarify the composer hierarchy

**Job:** write, choose the model, and send or stop without searching through secondary hints.
Inspect the existing composer deck and footer on the installed candidate.
Change spacing or contrast where typing, controls, and hints compete or become unreadable.

Keep the input and primary action dominant. Group model/provider/thinking controls using current components.
Let secondary hints wrap or occupy a quieter line without hiding consequential state.
Use the existing spacing rhythm. Treat 4/8/12/16/24px as targets rather than a migration mandate.
Try 12–13px for consequential small text only if native reading at normal scale demonstrates the need.

**Acceptance:** Send/Stop remains discoverable with a multiline draft, long model name, Notes open, and a narrow supported window.
The input, focus indicator, and Notes seam remain accessible. Larger text must not force a new minimum window width.
Case 2 completion stays parked. This proposal changes no send, queue, or Steer semantics.

#### Proposal D2 — Make failed turns recoverable at the point of failure

**Job:** explain the terminal outcome and the safe next action without requiring interpretation of raw engine output.
Use the current runtime notice or failed-turn component. Do not introduce a global status dashboard.

Show the state in readable text with an icon. Explain the known cause briefly.
Offer one primary recovery action only when implemented and safe. Keep supporting diagnostics expandable.
Preserve input. Never automatically resend a request that may already have executed.

| Runtime evidence | Required presentation |
| --- | --- |
| Prime accepted a follow-up | Queued plus its visible message. Local draft storage is insufficient evidence. |
| Prime reports execution | Working with supported detail. Animation reinforces the state rather than creates it. |
| Stop requested | Do not show Stopped before confirmed interruption. |
| Provider, worker, or transport failure | Show the known category. Do not replace missing evidence with a confident diagnosis. |
| Connection unknown | Do not show connected merely because credentials exist. |
| Empty terminal outcome | Do not style it as an ordinary successful answer. Show the supported explanation and safe next step. |

**Acceptance:** queued, active, stopped, and failed states remain distinguishable without color alone.
Recovery retains the draft and cannot silently duplicate execution.
Diagnostics preserve reading position and composer access.
This proposal does not replace P1's investigation of the actual no-answer cause.

#### Proposal D3 — Make long names distinguishable where a choice occurs

**Job:** select the intended model, session, or note when similar names exceed the available width.
Prioritize the model picker, Sessions rows, and Notes rows before adding navigation.

Keep model, provider, and supported reasoning level readable.
Reuse working full-name affordances. Where they fail, consider wrapping in the open picker or a focus-accessible full label.
Keep compact row actions stable. Make full names available to keyboard users as well as pointer users.
When truncated labels collide, prefer existing path/provider context over new badges.

**Acceptance:** two names with the same prefix remain distinguishable at narrow widths and larger text sizes.
Long names cannot conceal selection or push actions beyond reach.
History blobs in titles need a bounded data/presentation fix. Wider rows alone do not solve that problem.

#### Proposal D4 — Show the next available action during first run

**Job:** reach a first reply while understanding the optional Notes path.
Use current first-run and empty-state locations. Do not replace Chat with onboarding cards or impose a tour.

Explain the next unmet prerequisite: engine, authentication, model selection, or an optional vault action.
Keep the composer available when Chat can proceed. Place the supported setup action near a blocking explanation.
Describe the local scaffold accurately: it creates a starter vault, not a remote clone.
Retain offline access to existing Notes and the applicable Welcome action.

**Acceptance:** a new person distinguishes required Chat setup from optional Notes setup without private coaching.
Missing Prime, expired credentials, unavailable models, and offline operation show distinct truthful outcomes.
The person can resume after completing a prerequisite without repeating unrelated setup.
C9 import offers, C10 tours, C11 remote starters, and session-list import retain their existing gates.

#### Proposal D5 — Give Settings About clear identity and utility areas

**Job:** identify the product, read its version, and find Docs or Contribute.
Use the selected organic artwork as an illustration within the existing About surface.
Preserve the image and its copy. Do not crop meaningful text to force a fixed-height hero.

Keep utility links and available version information readable within the current layout.
Reserve image space so loading cannot move controls. Supply useful alternative text without duplicating adjacent copy.
Detailed roots and baked-in lettering do not become tiny control icons.

**Acceptance:** the image remains legible at the supported narrow width.
Docs and Contribute remain accessible by mouse and keyboard across current themes.
About provides identity without imposing artwork on daily work surfaces.

#### Proposal D6 — Align action and focus treatments in touched controls

**Job:** make copy, save, regenerate, fork, and row actions predictable.
Retain the current icon family and meanings. Correct inconsistent size, spacing, labels, or focus only where inspection finds a problem.

Use accessible names and visible focus. Tooltips cannot be the only labels available to assistive technology.
Target 32×32px hit areas where the current layout permits them.
Use the frontend direction's contrast targets: 4.5:1 for ordinary text and 3:1 for large text and meaningful boundaries.
These are design targets, not a claim of accessibility compliance.

**Acceptance:** primary actions work by mouse before shortcut verification.
Focus remains visible in the composer, lists, and Settings.
Streaming, diagnostics, and images preserve reading position. Reduced motion retains all state information.

### 4. What to rethink — proposals with decision gates

#### Proposal R1 — Put application and engine identity in existing support information

The source/install distinction complicates verification. Rhizome's build and Prime's runtime version answer different questions.
**Proposal:** if current About or update details do not expose both clearly, add two plain fields and a compact Copy diagnostics action there.
Use only information the application can determine reliably. Do not imply that the app knows the checkout or remote branch.

The copied record should contain the app version/build, Prime version when known, OS, and architecture.
Omit secrets, prompts, vault content, and unnecessary paths. Show unknown where a value cannot be established.
This proposal is not a launch-day prerequisite. Record those values manually for part one.

**Decision gate:** establish that current details fail this support job before adding another action.
**Acceptance:** a person can identify the installed app and active engine without confusing them or sharing private content.

#### Proposal R2 — Treat recovery as a continuation of the draft

Recovery can require a user to reconstruct the request or guess whether it already ran.
**Proposal:** if D2 exposes that gap, keep the failed request available in the existing flow and explain what retry will do.
Distinguish editing a request from sending it again when the runtime cannot prove that nothing executed.

Do not add an automatic retry loop or another queue authority.
Do not invent Resume unless the actual client/Prime contract supports it.
**Decision gate:** reproduce lost input or ambiguous recovery in the current candidate.
**Acceptance:** the user chooses the next action with the request intact and without silent duplicate execution.

#### Proposal R3 — Concentrate visual identity in the margins of daily work

**Proposal:** keep organic expression in About and future marketing. A restrained dither illustration can occupy an appropriate existing onboarding slot.
Typography, alignment, readable states, and the small mark should provide continuity across the operating UI.
Do not add animated roots, decorative transcript backgrounds, a new theme system, or another navigation rail.

This preserves the current direction and requires no mockup of an existing screen.
**Decision gate:** Atticus claims a specific identity surface after functional readability checks.
**Acceptance:** artwork does not compete with writing, reading, recovery, or utility links.

Inspectable memory, portfolio/Today, boards, and native extension dialogs require separate product decisions.
Their potential value does not insert them into this refinement plan.
Provenance and correction history should display real records and authority before decorative state badges are considered.

### 5. Sequence for a later design claim

1. Complete the launch-day slice or record its explicit blocker.
2. Claim one design problem from evidence in the named candidate.
3. Inspect applicable normal, empty, working, failure, long-content, and narrow-window states.
4. Reuse current components and tokens for the smallest change that solves the problem.
5. Verify mouse access, relevant keyboard access, focus, contrast, text scaling, and reduced motion.
6. Record behavior and evidence. Stop when the agreed acceptance passes.

Prioritize D2 if a demonstrated failure leaves input or recovery unclear.
Otherwise prioritize D1 and D3 for actual reading/selection failures, then D4, then About and optional identity work.
D6 applies to touched controls. It is not a repository-wide cleanup assignment.
If a surface already meets its acceptance, leave it alone.

Use a failing regression before behavior fixes and appropriate focused checks afterward.
Native evidence must exercise the actual application path.
Pure CSS/layout changes do not require tests that only mirror CSS.
Meaningful new actions should emit safe adoption/failure events without prompts or note content.
Small readability changes need no dedicated event solely to satisfy a checklist.

## Completion of this planning pass

The replacement contains the launch-day slice and exit check, the complete retained shelf, and marked design proposals.
Chat / Notes / Read / Workbench remain unchanged. The supplied evidence does not justify replacing them.
The first slice remains a launch-day rebuild followed by native Update now acceptance.
This pass changes only the plan. It does not rebuild, push, close issues, or change the installed app.
