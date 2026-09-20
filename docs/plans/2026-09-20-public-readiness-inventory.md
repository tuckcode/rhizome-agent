# Public readiness: issues, design sources, and parked ideas

**Origin:** GPT-6 / Codex · 2026-09-20. Companion to the [assessment and plan](2026-09-20-public-readiness-plan.md).
**GitHub snapshot:** 2026-09-20, about 05:06 America/Chicago, via authenticated `gh`.
Open means open on GitHub. It does not mean unimplemented.
Parked means retained for a later explicit claim, not approved by this plan.

## Live open issues: all 17

| Issue | Readiness disposition | Next action |
|---|---|---|
| [#5 — Prime harness surface](https://github.com/tuckcode/rhizome-agent/issues/5) | Scope/spec work; parent of shipped and future jobs | Reconcile [current surface index](../design/prime-agent-surface.md). Describe supported jobs; do not chase protocol parity. |
| [#13 — Running work in menu bar](https://github.com/tuckcode/rhizome-agent/issues/13) | Implementation exists; native evidence matters | Test running count and opening the correct session with #52. |
| [#23 — Sessions as searchable knowledge](https://github.com/tuckcode/rhizome-agent/issues/23) | Basic session retrieval belongs to readiness; expansion is later | Verify existing search/replay. Keep import and broader knowledge integration separate. |
| [#26 — Prime updates in-app](https://github.com/tuckcode/rhizome-agent/issues/26) | Later if preview explicitly documents manual installation/updates | Design consent and active-session protection before calling the update CLI. Packages installation is a different job. |
| [#32 — Windows harness](https://github.com/tuckcode/rhizome-agent/issues/32) | Deferred platform; issue title predates named-pipe code | Preserve Windows paths. First native launch requires a Windows environment; no Windows ship work now. |
| [#36 — Display timezone](https://github.com/tuckcode/rhizome-agent/issues/36) | Parked enhancement | Decide timestamp scope; keep display changes separate from stored dates. [Plan](issue-36-timezone-setting.md). |
| [#39 — Graph as an agent tool](https://github.com/tuckcode/rhizome-agent/issues/39) | Existing tools need truth checks; visual query expansion is later | Verify shipped scoped tools. Reconcile C40's remaining Rust CLI path before treating all graph answers as equivalent. |
| [#40 — Harness versus client](https://github.com/tuckcode/rhizome-agent/issues/40) | Product decision linked to #56 | Record accepted ownership when decided. Do not close from agent-authored doctrine alone. |
| [#41 — Steer and queue](https://github.com/tuckcode/rhizome-agent/issues/41) | P1 native gate | Existing wiring needs live verification. Queue mutation is a separate extension. |
| [#45 — Providers and curated models](https://github.com/tuckcode/rhizome-agent/issues/45) | First connection and truthful failure states are P1/P2 | Verify allow-list and preflight already present. Implement only the remaining demonstrated gaps. |
| [#46 — HOME vault/global Prime configuration](https://github.com/tuckcode/rhizome-agent/issues/46) | P1 safety gate | Verify no-vault Chat, aliases, scope, and configuration preservation live. Units alone do not close it. |
| [#48 — Managed OmniRoute gateway](https://github.com/tuckcode/rhizome-agent/issues/48) | Parked | Resolve #56 and trial the real endpoint/lifecycle before implementation. |
| [#50 — Agent view of running app](https://github.com/tuckcode/rhizome-agent/issues/50) | Parked developer tooling | [Plan](2026-08-29-live-app-view-plan.md) awaits surface choice. Use current browser/native tools for readiness. |
| [#51 — Tab reply completion](https://github.com/tuckcode/rhizome-agent/issues/51) | Case 1 shipped; Case 2 parked | Preserve rules-first completion. A later model-backed slice must never autofill action approval. |
| [#52 — Finished agent in menu bar](https://github.com/tuckcode/rhizome-agent/issues/52) | Done-row verification is P1; broader companion later | Source contains a 45-second Done row. Verify it live. Hotkey capture and voice are distinct later jobs. [Plan](issue-52-menu-bar-done.md). |
| [#56 — Direct provider path versus doctrine](https://github.com/tuckcode/rhizome-agent/issues/56) | Honest documentation is P2; removal requires a decision | Trace reachable behavior, describe the exception, then present keep/remove/amend choices. |
| [#57 — Compatibility cleanup](https://github.com/tuckcode/rhizome-agent/issues/57) | Parked cleanup | [Plan](issue-57-ghost-compat.md). Protect actual data and migration fingerprints. Remove only verified obsolete paths. |

Live closed baseline includes #9, #11, #14, #17, #18, #19, #21, #22, #24, #25,
#27, #29, #31, #34, #35, #37, #38, #42, #43, #44, #47, #49, #53, #54, and #55.
Retest relevant behavior without assuming these features are missing or reopening tickets from old prose.
#49 closed on September 13 local time. The latest title-history problem needs its own evidence and bounded follow-on.

## Open draft documentation PRs

| PR | Live title | Treatment |
|---|---|---|
| [#66](https://github.com/tuckcode/rhizome-agent/pull/66) | docs: catch living pages up to the daily-drive batch | Existing no-merge instruction remains. Its hide description predates C75. |
| [#67](https://github.com/tuckcode/rhizome-agent/pull/67) | docs: align living pages with C75 hide, tray Done, and boot restore | Read as a candidate source of corrections; compare each claim with current code. |
| [#68](https://github.com/tuckcode/rhizome-agent/pull/68) | docs: sync living pages to 35f217f (tray Done, C75 hide, Getting Started) | Overlaps #67 and the dirty living docs. Reconcile once through the documentation owner. |

This assessment read PR metadata and bodies, not their complete diffs.
No merge recommendation follows from their descriptions. Do not merge competing historical state stamps into current docs.

## Latest design work retained

| Source | Current use |
|---|---|
| [Astra/Codex September 14 package](../design/brand/2026-09-14-handoff/README.md), [execution brief](../design/brand/2026-09-14-handoff/CURSOR-FIVE-HOUR-PLAN.md), [integration](../design/brand/2026-09-14-handoff/INTEGRATION.md) | Preserve deliverables and evidence. The former five-hour deadline and agent assignments have expired. |
| [Frontend design](../design/brand/2026-09-14-handoff/FRONTEND-DESIGN.md) | Readable composer and notices, accessible controls, contrast, focus, narrow windows, and restrained artwork. Audit current build before changing it. |
| [Asset gallery](../design/brand/2026-09-14-handoff/ASSET-GALLERY.md), [original brand set](../design/brand/2026-09-13/README.md) | Organic banner leads About/README. Dither/ASCII retain their assigned roles. Rootwork and Thread remain gallery studies. |
| [Memory direction](../design/brand/2026-09-14-handoff/MEMORY-DIRECTION.md) | Preserve claim/source/reason/correction history and observed/inferred/proposed/verified vocabulary as design questions. No invented badges or state machine. |
| [Dock and site](../design/brand/2026-09-14-handoff/D5-DOCK-AND-SITE.md) | Preserve the future website arrangement. ADR-0172 supersedes its unselected-Signal passages. |
| [ADR-0172](../adr/0172-dock-icon-signal.md), [ADR-0173](../adr/0173-pane-presets.md) | Current Signal OS master and Chat/Notes/Read/Workbench contract. Preserve user-selected widths and Chat-first launch. |
| [Prior readiness plan](../ASTRA_GOD_PLAN.md), [W4 evidence](handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md) | Reuse acceptance cases. Replace old installed-build stamps and helper-stop assumptions with current evidence. |

## Parked product and workflow ideas

Each row retains an idea found in NEXT, BOARD, the evening dump, design papers, or live issues.
The source documents retain detailed proposals; this table supplies disposition and re-entry conditions.

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

## Parked memory and harness ideas

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

Rejected or non-proposals remain distinct from parked work: OpenCode was an example, not a requested runtime.
CC Switch is not a proposed product port. `pi-hermes-memory` installation was rejected; its ideas have separate proposals above.
Cordis/DSH kernels, a second durable memory store, and copying personal voice skills into this repository remain outside the plan.
The memory research also rejects automatic recency/frequency decay, a replacement vector/graph database,
unsupervised arbitrary-note rewrites, and an extra reconciliation call solely to select ADD/UPDATE/DELETE.

## Maintenance risks to recheck, not automatically rebuild

Track C28/C31 test failures, C39 live-test isolation, C58 symlink handling, C60 blank paint, C64 startup, and C75 responsiveness.
Review `.rhizome/events.jsonl` retention for long-term daily use.
Reconcile C40's split graph-summary paths. Preserve C53's distinction between worker startup and provider errors.
Use the [September 14 security evidence](s-plans/2026-09-14-security-audit/README.md) as a dated baseline.
Tiptap/Medium deferrals, redaction coverage limits, and source-only security passes require a current publication review.

The [living-docs audit](living-docs-audit.md) remains useful. Correct operationally dangerous claims first.
Archive historical state rather than copying every prior status paragraph into a new board.
