---
session: 2026-10-04T14:22:39-05:00
model: Astra through Hermes desktop
description: >-
  Separated Cursor implementation scope from Astra audit work.
  Defined bounded fixes, verification, exclusions, and return requirements.
---

# Cursor handoff: design defect corrections

**Origin:** Astra through Hermes desktop · 2026-10-04 · checkout `9a48e00`.

## Assignment

Correct the bounded defects below when the user instructs you to execute this handoff.
This document does not authorize a redesign, commit, push, or native rebuild.
Astra owns the unfinished audit, design choices, and independent final review.
Do not repeat the full audit.

## Read first

1. `AGENTS.md` and `docs/CROSS-MODEL-HANDOFF.md`.
2. This document.
3. Sections F01–F08 in `docs/design/2026-10-04-ui-audit.md`.
4. The relevant source and tests for each task below.

Use the report as evidence, not as proof that every suggested fix is correct.
Read only the evidence needed for the current task.
The original design archive is unnecessary for these corrections.

## Workspace protection

Run these commands before editing:

```bash
git status --short
git branch --show-current
git log --oneline origin/main..HEAD
```

The handoff checkout is `main` at `9a48e00`, with 15 commits in the local comparison.
The working tree contains other work and untracked audit evidence.
Preserve `.gitignore`, `AGENTS.md`, `README.md`, demo files, older plans, and `my-marketplace/`.
Do not reset, clean, stash, or stage unrelated paths.
Do not commit or push unless the user explicitly asks.
Use an isolated worktree if other agents will write product code concurrently.
Transfer these uncommitted handoff and evidence files explicitly if the worktree lacks them.

## Task 1: Correct splash continuity — C89 / F01–F03

**Inspect and modify only as necessary:**

- `index.html`
- `src/main.tsx`
- `src/components/BootSplash.tsx`
- `src/components/BootSplash.css`
- `src/index.css`
- `src/lib/themeMode.ts`
- `src/constants/appStorage.ts`

**Existing tests:**

- `src/components/BootSplash.test.tsx`
- `src/components/BrandMark.test.tsx`
- `src/main.test.ts`
- `src/lib/themeMode.test.ts`
- `src/index.theme.test.ts`

**Reproduction:**

The HTML bootstrap reads older theme keys.
With only `rhizome-theme=dark`, it paints light before React paints dark.
The bootstrap lacks the local JetBrains font declaration when remote fonts are unavailable.
The HTML-to-React replacement restarts the entrance animations.

**Required behavior:**

- Read current keys first. Preserve the application's actual legacy fallback order.
- Resolve system mode and named-theme polarity before the first visible paint.
- Keep backgrounds and accent interpretation consistent across startup stages.
- Make the local wordmark font available before React without adding a network dependency.
- Do not replay the entrance animation when React replaces the bootstrap.
- Preserve reduced motion, hidden-document behavior, and existing startup recovery.
- Do not delay readiness for decoration.
- Keep the current logo geometry, wordmark family, and animation concept.

**Evidence and reproduction helpers:**

- `docs/design/2026-10-04-ui-audit/splash.json`
- `docs/design/2026-10-04-ui-audit/transition.json`
- `docs/design/2026-10-04-ui-audit/probes/rhizome-audit-splash.cjs`
- `docs/design/2026-10-04-ui-audit/probes/rhizome-audit-transition.cjs`

Convert important checks into maintained regressions rather than relying only on audit scripts.
Test current-only, legacy-only, conflicting, invalid, and unavailable storage.
Test light, dark, system, and a named dark theme.
Check production font URLs after `pnpm build`.
The recorded request delays are test controls, not measured startup performance.

## Task 2: Correct theme variants and destructive contrast — C90 / F04

**Inspect and modify only as necessary:**

- `src/index.css`
- `src/themes.css`
- `src/components/ui/button.tsx`
- `src/index.theme.test.ts`

Trace all sibling `dark:` uses before changing the shared selector.

**Reproduction:**

Semantic tokens follow the application theme, but the tested Tailwind dark variants follow the operating-system preference.
`dark:bg-destructive/60` therefore changes button opacity independently of the application selection.

**Required behavior:**

- Bind dark variants to the application's resolved theme, including descendants and portaled controls.
- Keep existing named themes and accent selection working.
- Correct destructive foreground/background contrast without redesigning the palette.
- Verify normal, hover, focus, and disabled treatments separately.
- Do not treat disabled-text exceptions as permission for weak active controls.

Test every operating-system/application light-dark combination.
Normal button text must reach at least 4.5:1 against its actual composited background.
Verify the color after CSS transitions finish.

Evidence: `docs/design/2026-10-04-ui-audit/mode-matrix.json`.
Helper: `docs/design/2026-10-04-ui-audit/probes/rhizome-audit-mode-matrix.cjs`.

The default alias `--primary: var(--accent-blue)` is not a bug.
The live accent probe verified that user accent overrides still work.
Do not change that alias merely because a worker criticized it.

## Task 3: Correct Settings accessibility — C91 / F05

**Inspect and modify only as necessary:**

- `src/components/SettingsPanel.tsx`
- `src/components/useSettingsPanelFocus.ts`
- `src/components/ui/dialog.tsx`
- `src/components/SettingsPanel.test.tsx`

Read existing Dialog consumers before changing the modal structure.
Do not change the shared Dialog primitive unless the defect requires it.

**Required behavior:**

- Settings exposes a named dialog and modal semantics.
- Initial focus remains useful.
- Tab and Shift+Tab remain within the active modal and its supported portals.
- Escape closes the appropriate overlay before closing Settings.
- Closing Settings returns focus to its actual opening control.
- Model menus, selects, nested dialogs, and keyboard opening still work.
- Keep one focus-management owner rather than stacking another trap over the current one.

Prefer the existing shadcn Dialog pattern.
Preserve open/close state, draft persistence, and current appearance-save behavior in this task.
The current evidence does not prove that the entire existing focus trap fails.

Evidence: `focus` in `docs/design/2026-10-04-ui-audit/measurements.json`.

## Task 4: Correct Settings labels and platform hint — limited C92

**Inspect and modify only as necessary:**

- `src/components/SettingsPanel.tsx` — `ColorThemeControl`
- `src/components/SettingsFooter.tsx`
- `src/components/SettingsPanel.test.tsx`
- Existing platform and shortcut utilities, after locating their definitions and callers.

**Required behavior:**

- Show complete theme names, including Light/Dark and Mocha/Latte distinctions.
- Preserve swatches, accessible names, and selection behavior.
- Prefer two columns with wrapping 12px labels at the current settings width.
- Adapt the grid at narrow widths without increasing the application's minimum width.
- Use existing shadcn controls when replacing the affected raw controls.
- Render the Settings shortcut for the actual platform.
- Verify the shortcut binding before changing the displayed hint.

Evidence: `themeLabels` in `docs/design/2026-10-04-ui-audit/measurements.json`.
Visual proposal: `docs/design/2026-10-04-ui-audit/proposal-theme-labels.png`.
The proposal is a temporary browser override, not a source change.

**Explicit exclusion:** Do not change Cancel, Save, or immediate appearance persistence.
F07 needs a user decision and stays with Astra.
Do not close all of C92 when only labels and the shortcut are corrected.

## Test cycle

For each behavior defect:

1. Write the failing regression.
2. Run it against the old behavior.
3. Confirm that it fails for the intended reason.
4. Add the smallest correction.
5. Run the regression and neighboring tests.
6. Inspect the diff for unrelated changes.

Pure CSS corrections can use deterministic browser assertions and before/after images.
Do not create source-string assertions as a substitute for rendering or behavior checks.

Focused starting command:

```bash
pnpm exec vitest run src/components/BootSplash.test.tsx src/components/BrandMark.test.tsx src/main.test.ts src/lib/themeMode.test.ts src/index.theme.test.ts src/components/SettingsPanel.test.tsx
```

Expected: Exit 0 with no failed tests after corrections.
The earlier 83-test result covered fewer files. Do not reuse that count.

Final frontend checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Expected: Exit 0 for each command. Frontend coverage remains at least 70%.
Run the focused browser regressions at 1400 × 900, 834 × 700, and 480 × 400.
Follow repository security and release gates before any release claim.
Do not add cosmetic tests to the curated smoke lane.
Do not rebuild an installed application without explicit authorization.

## Exclusions

- No new typeface, logo, navigation model, or theme.
- No global root-size change or broad spacing rewrite.
- No font downloads or new dependencies without approval.
- No localization work or string migration.
- No Prime adapter, account, vault, or session-import changes.
- No complete product audit or native verification claims.
- No edit to the historical findings or captured evidence.

## Return to Astra

Write `docs/design/2026-10-04-cursor-implementation-result.md`.
Include changed paths, exact test commands, actual results, before/after evidence, and unresolved defects.
Identify the checkout commit and whether changes remain uncommitted.
List any acceptance condition you did not verify.
Distinguish browser evidence from native evidence.

Astra owns the central audit status and recommendation document during this split.
Do not edit `docs/HANDOFF.md` concurrently with Astra.
Coordinate the final status update after your implementation report is ready.
The user still needs the focused MacBook review on the same final commit.
