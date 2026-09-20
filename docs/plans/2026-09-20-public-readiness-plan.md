# Public readiness: assessment and execution plan

**Origin:** GPT-6 / Codex · 2026-09-20. Requested by Atticus after the 04:38 pickup.
**Status:** assessment complete; plan proposed; implementation not started by this session.
**Scope:** make the advertised macOS experience dependable for another person's daily use.
Public visibility, commit, push, and installed-app rebuild remain separate actions.

**Primary executor: Cursor.** Atticus permits a swarm and prioritizes elapsed time over credit conservation.
Use the [Cursor swarm brief](2026-09-20-cursor-public-readiness-swarm.md) to execute this plan.
Independent stages may overlap under its file ownership and integration rules.

## 1. Assessment

Rhizome has a substantial working product. Public daily-driver readiness is **not established**.
The remaining work includes actual defects, missing native evidence, incomplete setup instructions, and stale claims.
Feature count and issue closure do not establish readiness.

| Evidence checked on September 20 | Result | Limit |
|---|---|---|
| Local HEAD and local `origin/main` reference | Both `dc44d84`; no local commits ahead of that reference | No remote fetch in this assessment |
| Working tree | 22 modified tracked files plus the untracked 04:38 pickup at assessment start | Rail/reasoning changes remain uncommitted |
| Installed application | Pickup records `6860762`, installed September 19 at 11:27 | Build identity and behavior were not independently verified natively |
| `pnpm typecheck` | PASS | Type checking does not exercise native flows |
| Focused Vitest run | PASS: 292 tests across eight files | App, rail, status bar, reasoning, and source locks only |
| Complete history echo | Direct function probe strips it | Display change only; does not fix why a turn produces no answer |
| Incomplete history echo | Direct probe leaves `<conversation_history>old exchange` visible | Streaming/truncated blocks need a regression test and a fix |
| GitHub | 17 open issues; three draft PRs, #66–#68 | Issue descriptions contain older implementation claims |
| Full release verification | NOT RUN | No full coverage, native QA, clean install, security rescan, or history scan this session |

The dirty reasoning change is useful but narrower than the no-answer problem.
`prime_session_host.rs` reports a provider error when an empty turn includes one.
Otherwise, the client can complete without assistant text; the frontend supplies a generic empty-response message.
That code explains one possible presentation. It does not establish the cause of the reported live failure.
Capture the model, provider, thinking level, terminal event, and visible result before changing defaults.

The public setup path also needs work. The README gives developer commands and assumes Prime exists.
`GETTING-STARTED.md` says Node 18+ and browser port 5173.
Installed Vite requires `^20.19.0 || >=22.12.0`; `vite.config.ts` fixes the port at 5202.
A fresh user needs one tested route from prerequisites to the first reply and saved note.

## 2. Sources and precedence

Use current code and observed behavior for implementation claims. Use current user decisions for product scope.
Treat dated plans and issue bodies as leads when their claims conflict with either.

| Source | How this plan uses it |
|---|---|
| [04:38 pickup](handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md), [HANDOFF](../HANDOFF.md), [NEXT](../NEXT.md), [BOARD](../BOARD.md) | Preserve the dirty work, current priorities, and parked boundaries |
| [Prior Astra plan](../ASTRA_GOD_PLAN.md), [input inventory](../PLAN_FOR_A_PLAN.md), [Astra packet](../ASTRA_PACKET.md) | Reuse W4/W7 acceptance criteria; their overnight ownership and deadlines are historical |
| [Latest Astra/Codex design package](../design/brand/2026-09-14-handoff/START-HERE.md) and [frontend direction](../design/brand/2026-09-14-handoff/FRONTEND-DESIGN.md) | Preserve readable controls, honest runtime states, accessible actions, and restrained artwork |
| [Asset gallery](../design/brand/2026-09-14-handoff/ASSET-GALLERY.md), [memory direction](../design/brand/2026-09-14-handoff/MEMORY-DIRECTION.md), [Dock/site paper](../design/brand/2026-09-14-handoff/D5-DOCK-AND-SITE.md) | Retain the design work; distinguish concept art from shipped features |
| [ADR-0173](../adr/0173-pane-presets.md), [ADR-0172](../adr/0172-dock-icon-signal.md) | Newer decisions govern pane presets and the selected Signal OS icon |
| [ARCHITECTURE](../ARCHITECTURE.md), [ABSTRACTIONS](../ABSTRACTIONS.md), [cross-model traps](../CROSS-MODEL-HANDOFF.md), [briefing](../YOU-SHOULD-KNOW.md) | Locate implementation and known failure modes; recheck stale passages |
| [Prime surface](../design/prime-agent-surface.md), [composition](../design/harness-composition.md), [memory loop](../design/memory-loop.md) | Separate implemented jobs from unresolved ownership and future work |
| [Roadmap inventory](2026-09-20-public-readiness-inventory.md) | All 17 open issues, draft PRs, parked ideas, and their source documents |

### Corrections that execution must preserve

- Fresh launch uses **Chat**, with Notes closed. ADR-0173 supersedes older Notes-open defaults.
- The dirty rail contains Sessions, Settings, and pin. Research uses the status bar and command palette.
- Signal is selected and implemented for the OS icon. Older design paragraphs calling it unselected are historical.
- Hide leaves Prime's daemon warm. Current `lib.rs::hidden_window_helper_stops` names only `ws_bridge` and `mindwalk`.
- A warm daemon does not grant background work. Test session ownership separately from daemon lifetime.
- C40 is partly stale: MCP `rhizome_graph_summary` delegates to graph health; the Rust command still calls the external CLI.
- #49 is closed on GitHub. History blobs in titles are a concrete follow-on problem, not proof that naming never shipped.
- #41's unwired title is stale. Verify the existing path before proposing implementation.
- `set_scoped_models` filters model cycling. It does not route requests between models.
- #56 remains unresolved. Describe the reachable direct-provider path honestly; do not delete it from an architectural assumption.
- Packages installation exists. Installation alone does not establish full compatibility with interactive Prime extensions.
- The remote starter override reads `RHIZOME_GETTING_STARTED_REPO_URL`; older aliases in developer prose are stale.

## 3. What counts as public-ready

Recommended first supported scope: **macOS, English, Chat through Prime, optional vault, and the shipped Notes/memory workflow**.
Record the tested macOS version and hardware architecture. Claim support only for tested combinations.
Windows remains deferred. Linux source/build support must not imply verified daily-driver support.

A source release can require a documented Prime/Node installation.
A downloaded app can also be labeled a developer preview with explicit prerequisites.
Neither can advertise a self-contained installation until the tested package provides one.
Bundling Prime/Node, managed Prime updates, and paid Apple signing remain separate decisions.

Public readiness requires both:

1. **Product evidence:** the candidate passes the native acceptance matrix below.
2. **Publication evidence:** setup, security, repository contents, licenses/attribution, and support claims match the candidate.

Proposed final confidence check: use the same candidate for three ordinary daily-use sessions across at least two days.
Include a cold start, sleep/wake, a long conversation, and recovery from a failed request.
This supplements deterministic checks. It is not a guarantee or a substitute for them.

## 4. Execution sequence

Claim one bounded slice per agent. Name the owner, files, candidate revision, and evidence before changing shared files.
This document schedules no agents and changes no GitHub issue status.

### P0 — Establish the candidate

Review the dirty rail/reasoning diff against the 04:38 intent.
Add a behavioral regression for incomplete streamed history before fixing its display.
Preserve real expandable reasoning. Keep thinking Off as the existing user control.
Check mouse access to Research, Back to chat, Sessions, Settings, and pin.
Verify narrow layouts and all four pane presets.

Run the applicable full local gates after integration. Use native QA for the rail's window-edge placement.
Record source revision and executable identity separately.
Commit, push, and rebuild occur as separately requested steps; this planning request performs none of them.

**Exit:** the candidate has a reviewed diff, passing gates, and an explicit native-check status.
The installed app must match the candidate before candidate-level native results count.

### P1 — Close the reliability and safety gaps

Use the matrix in section 5. Prioritize these jobs:

1. Capture the reported thinking/no-answer failure on a named model and thinking level.
2. Trace terminal events and UI state. Distinguish provider rejection, worker failure, transport loss, and an empty successful turn.
3. Fix only demonstrated client defects. Show an actionable outcome and preserve recoverable input.
4. Verify #46 with and without a vault, including HOME aliases and symlinks.
5. Verify #41 queue and steer, then Stop, hide, Keep working, reopen, and tray completion.
6. Verify note save/reopen and promote/recall in a blank test vault.

Keep stronger-model and Flash observations separate. Compare thinking levels only where the selected model supports them.
Do not infer a model's behavior from one sample or globally force thinking Off.
Do not change `normalize_cwd("")` to repair vault scope; Chat without a vault is supported.
Use synthetic notes and prompts for shared evidence.

**Exit:** no unresolved reproducible data loss, unintended vault scope, silent terminal failure, or broken core control.
Source-only and untested claims stay open. Close issues only against their actual acceptance scope.

### P2 — Make setup reproducible and claims accurate

Write a user-facing quick start and a separate developer setup path.
Test them with a fresh OS account or equivalent clean environment without the author's saved credentials and vault configuration.
Do not erase the author's configuration to simulate first run.

Cover prerequisites, supported versions, Prime installation/login, launch, optional vault creation, first reply, and first saved note.
Cover missing Prime, missing Node, offline launch, missing/expired credentials, unavailable models, and folder-permission denial.
Document where notes and sessions live, how to recover them, and how to update or revert the app safely.
Verify packaged resources without allowing the build checkout to mask missing runtime files.
Prove that existing Notes remain usable when the model provider is unavailable.

Reconcile README, GETTING-STARTED, CONTRIBUTING, SECURITY, and the supported-platform statement.
Describe Prime's tool access and package trust accurately. Vault scope is not a general Prime sandbox.
Describe current telemetry controls and what leaves the machine from verified code/configuration.
For #56, document the existing exception now; defer keep/remove implementation until Atticus decides.
For extensions, either verify and describe the supported subset or schedule native dialogs after the required product decision.

**Exit:** a person follows the published instructions to a reply and saved/reopened note without private coaching.

### P3 — Complete the publication review

Run the local Codacy security checks and inspect the live lockfiles.
Reassess the dated Tiptap finding and Medium findings against actual reachability and current advisories.
The September 14 deferral is not a new security clearance. Avoid blanket editor overrides or patch removal.
Review residual native/frontend redaction differences using synthetic secrets.

Scan tracked files and Git history for secrets, personal vault content, account-specific data, and accidental local artifacts.
Record findings by path and category without copying sensitive contents into the report.
If remediation requires credential rotation or history rewriting, prepare the specific action for approval.
Inventory license and attribution files for the inherited code, bundled assets, Mindwalk, and distributed dependencies.
Resolve the README's license-confirmation note before publication.

Choose and test the actual distribution/update route.
Current Tauri configuration disables updater artifacts and has no updater endpoints; it does not demonstrate a working public updater.
An explicit manual update route is acceptable for a clearly labeled preview if installation and recovery are verified.
Paid signing, managed Prime updates (#26), and runtime bundling are not silently added to scope.

Verify the security-report channel and contribution policy against the public repository settings.
Keep local gates while the repository is private. Plan free public CI only when the repository becomes public.

**Exit:** publication review names no unresolved release blocker and accurately states remaining limitations.
Changing repository visibility or publishing a release requires its own explicit instruction.

### P4 — Qualify the candidate

Run the supported clean-install path and all required native cases on the final integrated revision.
Run the proposed ordinary-use sessions. Record any crash, freeze, lost draft, incorrect status, or lost note.
Fix demonstrated blockers and repeat affected checks. Repeat the complete gate only when the candidate changes materially.

Produce release notes, known limitations, setup/recovery instructions, and a compact evidence sheet.
Record each case as PASS, FAIL, NOT RUN, or BLOCKED, with the exact prerequisite for BLOCKED.

**Exit:** another person can install, work, recover, and retain their data within the advertised scope.
Readiness is approved from evidence, not from a percentage of completed backlog items.

## 5. Native acceptance matrix

All rows require the candidate build unless a row explicitly concerns repository publication.
Use the primary mouse path first. Check relevant keyboard access second.

| Case | Pass condition | Related work |
|---|---|---|
| First minute | Three complete launch observations include the first two seconds; starting and missing Prime have distinct truthful states | C64, C75, C60 |
| Reply and reasoning | Answer or actionable terminal outcome; genuine reasoning remains inspectable; complete and partial history echoes stay hidden | Current pickup |
| Provider recovery | Missing/expired auth, unavailable model, and transport failure are distinguishable; input remains recoverable; retry does not silently duplicate work | #45, #47 closed baseline |
| Model selection | Model/provider and supported thinking level match the live session after changes and relaunch | #45 |
| Sessions | Switch, rename, archive/restore, fork, and reopen preserve the intended transcript and readable title | #23, #49 follow-on |
| Mid-turn input | Enter queues once; Steer redirects explicitly; rejected admission preserves input; queued text stays visible until consumed/cleared | #41 |
| Stop and lifecycle | Stop, Cancel, Stop and close, Keep working, reopen, and Cmd+Q match session ownership; shared Prime work survives | C47, C22 |
| Helpers and tray | Hide stops app-owned bridge/Mindwalk; Prime can remain warm; running/Done rows open the correct session; failed polling cannot invent completion | #13, #52, C75 |
| Vault scope | HOME and aliases cannot become a vault; no-vault Chat works; Rhizome preserves unrelated Prime global settings and skills | #46 |
| Durable notes | Create, edit, switch, reopen, and relaunch preserve contents; failures cannot look saved | Existing core smoke flows |
| Memory loop | Blank-vault save/promote succeeds; a new session recalls the note with working provenance; unavailable tools show failure | Memory-loop investigation (a), #24/#25 baseline |
| Layout and performance | Four presets, small supported window, long names, scrolling, focus, selection/copy, and Notes restore remain usable; timings are recorded | ADR-0173, latest frontend design |
| Runtime independence | Packaged vault tools work without the source checkout or the author's login-shell PATH | C69, hybrid PATH work |
| Daily use | Proposed multi-session observation produces no unresolved blocker; evidence names the build and environment | P4 |

Track C28/C31 gate failures with their complete logs if they recur.
Review C39 isolation before running live-daemon tests against any real session store.
Inspect C58's current symlink handling before assuming its older failure remains.

## 6. Scope after readiness

The [inventory](2026-09-20-public-readiness-inventory.md) retains the future roadmap and decision gates.
Nothing becomes approved merely because it appears there.
The next implementation brief should contain P0 and the first reproduced P1 defect only.
Its evidence will determine the next fix. Optional visual and harness expansion follows a stable candidate.

## Assessment artifacts

- Focused test output: `/tmp/rhizome-readiness-focused.log` (temporary).
- Typecheck output: `/tmp/rhizome-readiness-typecheck.log` (temporary).
- GitHub responses: `/tmp/rhizome-readiness-{issues,closed,prs}.json` (temporary).
- Durable issue/idea summary: [inventory](2026-09-20-public-readiness-inventory.md).

No product source changed during this assessment. No commit, push, rebuild, issue closure, or PR merge occurred.
