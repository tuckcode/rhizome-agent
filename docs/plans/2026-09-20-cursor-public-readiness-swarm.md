# Cursor execution brief: public readiness

**Origin:** GPT-6 / Codex · 2026-09-20, following Atticus's request for a Cursor-focused agent swarm.
**Goal:** execute the [public-readiness plan](2026-09-20-public-readiness-plan.md) against its acceptance criteria.
**Budget preference:** prioritize elapsed time, useful evidence, and correctness. Credits are not the limiting constraint.
**Status:** execution brief only. Codex did not launch this swarm or authorize a release.

## Paste into Cursor

> Execute `docs/plans/2026-09-20-public-readiness-plan.md` using the swarm described in this file.
> Read `docs/plans/2026-09-20-public-readiness-inventory.md` for all open GitHub issues and parked ideas.
> Preserve the latest Astra/Codex design package, ADR-0172, ADR-0173, and the 04:38 dirty pickup.
> Start with an ownership and working-tree snapshot. Preserve existing work before creating specialist worktrees.
> Use independent agents for bounded work. Give each writing agent an isolated worktree and a concrete acceptance condition.
> Prioritize Chat reliability, vault safety, and clean installation before optional product expansion.
> Keep one integration owner and one native QA owner. Run native tests on one verified candidate at a time.
> Preserve approval gates and parked decisions. This plan does not authorize repository publication or package installation into the user's environment.
> Treat commit, push, and installed-app rebuild as separate jobs. Use the user's explicit instructions for each job.
> Report source, integrated candidate, pushed revision, and installed build separately.
> Continue through authorized work. Surface only concrete decisions or blocked actions that require Atticus.

## 1. Recommended team

Start **six specialist lanes plus one coordinator** if Cursor can support that concurrency.
Use fewer concurrent agents if the host or Cursor cannot sustain that count.
This is a concurrency target, not a reason to wait for seven slots.
Use the strongest available reasoning model for cross-layer diagnosis, security, and integration.
Use a faster model for mechanical inventory/link checks after the reasoning owner defines the task.
Do not inherit September 14's model IDs, deadline, or running-agent ownership as current facts.

| Lane | Responsibility and owned deliverable | Useful work before native slot |
|---|---|---|
| **C — Coordinator/integrator** | Candidate manifest, ownership, integration, final readiness verdict | Preserve dirty work; identify dependencies; maintain one evidence sheet |
| **A — Candidate and reasoning** | Review existing rail/reasoning diff; fix incomplete-history display with a failing regression | Source review, streaming tests, browser layout checks |
| **B — Chat reliability** | Diagnose thinking/no-answer, provider recovery, titles, and #41 remainder | Trace real event handling; build diagnostic recipe and deterministic failure fixtures |
| **S — Vault safety/security** | #46 verification and publication security review | Fixture isolation, configuration-write audit, dependency triage, secret-scan preparation |
| **I — Install and documentation** | Reproducible first-run instructions, scope/claims, issue/PR reconciliation | Dependency/resource audit, setup draft, review #66–#68 without merging |
| **D — Design and usability** | Audit current UI against latest design docs and pane decisions | Browser tests of narrow windows, long names, focus, scrolling, reading order |
| **Q — Native QA and recovery** | Native matrix, executable identity, lifecycle/tray, blank-vault memory loop | Prepare synthetic vault and cases; inspect QA prerequisites; define evidence locations |

Q owns the live Rhizome app slot. Other agents request a case from Q instead of manipulating that app concurrently.
S and B may observe Q's evidence and request additional probes.
Q does not change the user's real provider settings or stop unrelated Prime work to manufacture a failure.

## 2. Bootstrap before parallel writes

1. Read repository instructions and the new plan's source-precedence table.
2. Capture `git status --short`, branch/HEAD, `origin/main`, active worktrees, and any running local app/test processes.
3. Confirm whether another Cursor task currently owns any dirty files.
4. Preserve the 04:38 dirty diff and untracked pickup in an explicit candidate snapshot.
5. Select how specialists receive that snapshot before writing.
6. Assign paths and acceptance checks, then launch independent lanes.

A normal worktree contains committed files only. It will not contain the dirty rail/reasoning changes automatically.
If a checkpoint commit is authorized, create it by named paths before branching specialists.
Otherwise, preserve a binary diff and a named list of required untracked files outside the checkout.
Apply that baseline into isolated worktrees without treating it as each agent's new work.
Each agent must report only its delta from that baseline.
The coordinator can integrate explicit patches if commits are not authorized.

Keep the current checkout as the intake/integration surface. Avoid broad staging, shared indexes, or silent resets.
Use local `codex/`-prefixed worktree branches unless the current repository instructions or Atticus specify another prefix.
Do not create remote feature PRs merely to run the swarm in this solo repository.

**Bootstrap exit:** every agent identifies the same baseline, its owned files, and its first testable result.

## 3. Parallel schedule

### Wave 1 — Establish facts and prepare fixes

Run A, B, S, I, D, and Q independently after bootstrap.
A owns the candidate's immediate reasoning correction.
B diagnoses before modifying stream semantics or thinking defaults.
S inspects current safety paths before interpreting older #46 prose as missing code.
I produces the public quick start and discrepancy list from current code.
D reports behavioral defects, not an unrestricted redesign.
Q prepares the native slot and reports its exact prerequisites.

C integrates A first when it satisfies its acceptance criteria.
C assigns each discovered defect to one owner. Another agent may review that defect but must not implement it independently.
If D finds a defect in A's App/rail files, D supplies evidence to A.
If B and S need the same Rust module, C sequences their commits or patches explicitly.

**Wave 1 exit:** reviewed candidate delta, prioritized reproduced defects, clean-install procedure draft, and ready native cases.

### Wave 2 — Verify one integrated candidate

Integrate non-overlapping, reviewed changes in small checkpoints.
Run the complete local gate once for the integrated candidate.
Do not let several agents run full coverage or Playwright suites concurrently on the same host.
An installed-app rebuild waits for its separate authorization and the user's availability to use the new app.
Q verifies the executable path and build before starting native evidence.

During Q's native work, I reconciles public instructions and S completes the publication review.
A and B remain available for focused fixes. D checks the integrated browser candidate and reviews native screenshots where appropriate.
Read-only reviewers can examine completed deltas while Q holds the app slot.

Native order:

1. Startup and missing-runtime states.
2. Send, thinking/no-answer sample, and provider/transport recovery.
3. #46 no-vault Chat and attached test-vault scope.
4. Session switch/title, Enter queue, Steer, Stop, and draft preservation.
5. Hide/Cancel/Keep working/reopen, helper identity, and tray Done.
6. Note save/reopen and blank-vault promote/recall with provenance.
7. Narrow layout, presets, mouse/keyboard access, copy, and scrolling.

**Wave 2 exit:** each matrix row is PASS, FAIL, NOT RUN, or BLOCKED against an identified build.

### Wave 3 — Repair demonstrated blockers and qualify

Return each failure to its owning lane with a minimal reproduction and evidence.
Keep other lanes on independent documentation, review, or security findings.
Repeat the affected native case after integration. Recheck interacting cases where the fix changes shared state.
Run final integrated gates before the separately authorized push/release steps.
Use the proposed ordinary-use observation from P4 to detect failures that short scripted checks miss.

**Wave 3 exit:** publication checklist, clean-install result, native evidence, and ordinary-use result support the final verdict.
Unused agent capacity is acceptable. Do not consume spare capacity by implementing parked ideas.

## 4. Specialist acceptance contracts

### A — Candidate and reasoning

Read the 04:38 pickup, dirty diff, ADR-0173, and current reasoning tests.
Add the incomplete-stream regression before the fix. Cover complete, incomplete, history-only, and real-reasoning cases.
Retain real reasoning expansion and original persisted data.
Check rail destinations, exits, pin/resize, Settings, and Research accessibility.
Return the candidate delta and evidence. A does not change provider defaults.

### B — Chat reliability

Read the current host/event/frontend completion paths and the live #41/#45 scope.
Ask Q for a synthetic live sample with model, provider, thinking level, final event, and user-visible outcome.
Keep provider rejection, worker startup, transport loss, and empty completion separate.
Add regressions at the public behavior boundary for demonstrated client defects.
Verify input recovery and single-send behavior. Treat title-history cleanup separately from model-generated naming, which already shipped.

### S — Vault safety and publication review

Read #46, current seed/MCP/settings code, and the dated security evidence.
Verify HOME aliases and symlinks, no-vault operation, intended nested vaults, and preservation of unrelated global configuration.
Use synthetic secrets and fixtures. Report sensitive findings by category and path without publishing their values.
Run local security scans against live lockfiles. Review reachability instead of trusting dated deferrals.
Prepare any needed rotation or history-rewrite action for approval. Do not execute it from this plan.

### I — Install, claims, and backlog reconciliation

Use the inventory as the complete issue/idea ledger. Requery GitHub before changing issue state.
Read the complete diffs of #67/#68 if proposing to reuse their corrections. Preserve the no-merge condition on #66.
Write tested quick-start steps, supported scope, recovery instructions, and current permission/telemetry explanations.
Check license/attribution completeness without claiming a legal determination.
Own living-doc pointers and state stamps so multiple agents do not rewrite HANDOFF/NEXT/BOARD.
Keep every parked idea linked. A roadmap entry grants no implementation approval.

### D — Design and usability

Read the September 14 frontend/design package and newer ADR-0172/0173.
Inspect actual controls, scroll areas, focus, text contrast, long names, narrow widths, and preset persistence.
Use current accessible names and mouse paths. Keep the selected organic art and Signal identity.
Report a reproduction before editing. Coordinate overlapping App/rail files with A.
Do not implement portfolio, Today, kanban, memory badges, or a new shell from available design artwork.

### Q — Native QA and recovery

Use an isolated test vault and synthetic content. Record app path, build, environment, and steps for every result.
Protect the user's unsaved work before any requested app switch.
Remember the installed and debug apps share a single-instance identity.
Observe the first two seconds of three launches for C64. A late screenshot does not pass that case.
Measure launch, switch, Settings, and picker responsiveness. A name-list unit test does not prove helper termination.
Current hide policy leaves Prime warm and stops the app-owned bridge/Mindwalk. Verify sessions separately.
Report failures promptly with evidence to the relevant owner. Keep shared/user-started Prime sessions intact.

## 5. Standard agent handoff

Every specialist returns:

1. Baseline revision and any applied dirty snapshot.
2. Owned files and a short explanation of each behavior changed.
3. Reproduction, failing test, and passing result for each bug fix.
4. Exact tests and relevant logs. Separate source, browser, and native evidence.
5. Remaining failures or unverified assumptions.
6. Commit identifiers if authorized, otherwise an explicit patch/diff.
7. Dependencies and the next integration action.

Code-writing agents run focused tests during iteration.
At handoff, require `pnpm test` and `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, per repository subagent rules.
Run `pnpm typecheck` for TypeScript changes and relevant Rust checks for Rust changes.
Schedule heavy runs through C to avoid host contention. C owns final build/coverage/MCP/smoke/security completeness.
Passing an agent's own tests is not integration approval.

Stage owned files by name. Commit by explicit paths when authorized.
Use the actual writing model in the required Co-Authored-By trailer.
Never bypass hooks. Never restore, stash, or amend another agent's work.

## 6. Decision and permission gates

| Gate | Useful work while waiting |
|---|---|
| Commit / push / installed rebuild | Prepare exact diff, passing checks, build identity, and a concrete requested action |
| App slot or unsafe interruption of real work | Prepare fixtures, browser coverage, review, and docs |
| Session-list import `1` | Retain the proposal; continue readiness without import rows |
| #56 keep/remove decision | Document current reachable behavior and present bounded choices |
| C66 profile choices / native extension slice | Keep designs and compatibility limitations explicit |
| Publication / repository visibility / paid signing | Finish reviewable release assets and evidence before requesting the specific final action |

Use existing authorization when the user already granted the exact action.
Do not request the same permission repeatedly.
The swarm can complete the assessment, fixes, and evidence preparation without deciding parked product questions.

## 7. Final Cursor report

Lead with whether the candidate meets the advertised scope.
Include exact integrated/pushed/installed revisions, gate results, native matrix, security disposition, and fresh-install result.
List remaining blockers separately from optional backlog. Link the preserved inventory.
Name any explicit approval still required. Do not equate a finished swarm with a release-ready product.
