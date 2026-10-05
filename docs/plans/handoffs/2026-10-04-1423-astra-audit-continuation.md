---
session: 2026-10-04T14:22:39-05:00
model: Astra through Hermes desktop
description: >-
  Reserved unfinished audit work and independent verification for Astra.
  Separated that work from the bounded Cursor implementation assignment.
---

# Astra handoff: finish the audit and review Cursor corrections

**Origin:** Astra through Hermes desktop · 2026-10-04 · checkout `9a48e00`.

## Assignment

Complete the remaining design audit and independently review Cursor's corrections.
Do not duplicate Cursor's product edits.
Keep design decisions and verification with Astra.

Cursor's assignment is `docs/plans/handoffs/2026-10-04-1422-astra-cursor-implementation.md`.
That assignment covers C89, C90, C91, and only the labels/shortcut portion of C92.
The user requested this split. This turn created handoffs, not product fixes.

## Read first

1. `AGENTS.md` and `docs/CROSS-MODEL-HANDOFF.md`.
2. `docs/design/2026-10-04-ui-audit.md`.
3. `docs/plans/handoffs/2026-10-04-1422-astra-cursor-implementation.md`.
4. `docs/plans/handoffs/2026-10-04-1417-astra-design-audit.md` for probe pitfalls and runtime context.
5. `.hermes/plans/2026-10-04_125339-design-and-rendering-audit.md` for the original scope.

Do not reread the entire transcript or rerun all successful probes without a reason.

## Current status

The plan, initial browser evidence, consolidated report, and handoff exist.
The complete product audit remains unfinished.
No product code changed during the audit.
No native test, commit, push, or rebuild occurred.

The six-item tracker originally remained stale. Astra corrected it after the user challenged the count.
Its completed items included administration and the MacBook reminder, not completed implementation.
Track substantive remaining checks individually. Do not describe the whole audit as complete.

## Ownership

| Owner | Work |
|---|---|
| Cursor | Bounded product corrections and regression tests in its handoff |
| Astra | Remaining source/browser audit, evidence quality, design choices, and final independent review |
| Astra | Central audit report and `docs/HANDOFF.md` status updates |
| User with Astra | Rebuild authorization and native checks on Windows and the MacBook |

Cursor writes `docs/design/2026-10-04-cursor-implementation-result.md`.
Read that file before reviewing its changes.
Use an isolated worktree for any parallel product-writing work.
Do not change Cursor-owned files while Cursor edits them.
Do not overwrite another session's staged or untracked files.

## Unfinished audit work

### 1. Complete the surface ledger

Use the coverage table in `docs/design/2026-10-04-ui-audit.md` as the starting point.
Create `docs/design/2026-10-04-ui-audit-evidence.json` if it does not exist.
Map each reachable surface to its exact owner, tested states, evidence, and remaining gaps.
Count reviewed, partial, and blocked rows programmatically.
Do not equate a screenshot with a complete interaction test.

### 2. Complete browser interaction checks

- Chat: attachments, reasoning folds, tool results, errors, and scroll preservation.
- Composer: keyboard sequence, stop, queue, long input, and disabled states.
- Sessions: context menus, keyboard selection, rename/archive, and long names.
- Notes: properties, inner scrolling, long content, and the main reading/editing path.
- Settings: nested portals, keyboard entry/exit, all named themes, and narrow navigation.
- Onboarding: first-run, missing engine, failure, and escape paths.
- Graph: labels, search, zoom, and readable controls.
- Mycelium: actual reachable runtime surface.
- Research: resolve the browser fixture limitation before drawing a product conclusion.

Use copied fixture data or in-memory mock data. Do not use personal vault content.
Distinguish presentation tests from real provider/backend behavior.
Do not send real model requests merely to test layout.

### 3. Resolve the remaining design decision

F07 records appearance changes that survive Cancel.
Cursor must leave that behavior unchanged until the user chooses a policy.
Recommend clear immediate-save feedback for immediate preferences, but examine the entire panel before proposing a footer change.
Explain the alternative: staged edits with complete rollback on Cancel.
Do not decide by changing labels alone while retaining contradictory behavior.

### 4. Prepare limited visual comparisons

Compare larger consequential labels and 28–32px controls against the current density.
Compare 14px chat body text against the current 13px treatment.
Compare a softer splash card against the existing card only after C89 fixes the transition.
Keep existing font families, green palette, and logo family during these comparisons.
Use temporary browser overrides or separate previews, not product edits.

Do not expand the review into a full rebrand.
Do not accept every design-system statement as independently verified truth.

### 5. Review Cursor corrections independently

Read Cursor's result file and exact diff.
Verify test output rather than accepting its completion summary.
Reproduce the original failures against the corrected behavior.
Test the four operating-system/application theme combinations.
Verify current and legacy startup keys, early local fonts, and animation continuity.
Check Settings semantics, focus return, nested overlays, theme names, and platform hints.
Leave F07 and native checks open until their own acceptance conditions pass.

Update C89–C92 with precise status. Source-corrected does not mean native-verified.

### 6. Verify native Windows behavior

No Rhizome process ran during initial discovery.
The discovered `src-tauri/target/debug/RhizomeAgent.exe` predates checkout `9a48e00`.
Ask for explicit rebuild authorization if no suitable current binary exists.
Do not substitute Rhizome Desktop for Rhizome Agent.

Check cold startup, splash transition, font rendering, window controls, taskbar icon, and available display scales.
Record the exact executable, commit, and settings.
Do not claim native success from browser results.

### 7. Arrange the MacBook pass

Remind the user after Windows verification and again in the final result.
Use the same final commit and matching settings.
Check native splash, Retina text, Dock icon, traffic lights, scrolling, and trackpad behavior.
Start with a focused native pass, not another full source audit.
Expand it if macOS reveals broader differences.
The existing reminder is documentary, not a scheduled notification.

## Evidence quality rules

- The current archive is readable. Do not spend more time on the Claude sign-in wall.
- The archive demonstration bundle expects React 18. Do not install it into the React 19 application.
- The favicon's four-spoke simplification is intentional, not a missing-node defect.
- The default `--primary` alias is valid. A live red-accent probe confirmed overrides.
- `text-muted` contrast numbers alone do not identify every affected visible label.
- The destructive contrast calculation assumes sRGB alpha compositing. Verify the final rendered treatment.
- A partially visible scroll-list row is not proof of inaccessible content.
- Rich-content widths at 480px need a stable remeasurement after layout transitions.
- Initial loading captures do not represent settled screens.
- Image-analysis descriptions included inaccurate guesses. Prefer source and measured DOM evidence.

## Runtime notes

Vite responded at `http://127.0.0.1:5201` during handoff preparation.
Its process identifier in Hermes is `proc_b889e6456a1d`.
Check current ownership before stopping it.
The fixture copy lives at `%LOCALAPPDATA%/hermes/cache/scratch/rhizome-design-audit-vault`.

The audit scripts live in `docs/design/2026-10-04-ui-audit/probes/`.
They retain machine-specific paths.
`TOLARIA_DEV_VAULT_ROOT` does not change Vite's injected demo-vault path.
Some probes rewrite fixture requests. Others block vault requests and use in-memory fixtures.

Orca opened for native-control discovery. No native Rhizome interaction followed.
Two GPT-5.4-mini workers finished. Their reports contain leads, not independent runtime proof.
No more worker results are pending from those two processes.

## Completion criteria

- The surface ledger accounts for every requested area with a reviewed or explicit blocked status.
- Recommendations distinguish defects, preferences, and unavailable evidence.
- Cursor's assigned changes receive independent review.
- F07 receives a user decision before behavior changes.
- Native Windows and MacBook evidence either exists or remains clearly open.
- The final report gives the user concrete priorities and next actions.
- No completed checkbox implies that untested code or native behavior passed.
