---
session: 2026-10-04T14:17:47-05:00
model: Astra through Hermes desktop
description: >-
  Recorded browser design findings, evidence, and recommendations.
  Tracked splash, theme, and Settings defects. Native review remains open.
---

# Design audit handoff

**Origin:** Astra through Hermes desktop · 2026-10-04 · checkout `9a48e00`.

## Read first

1. `docs/design/2026-10-04-ui-audit.md` — consolidated findings and suggestions.
2. `docs/design/2026-10-04-ui-audit/` — screenshots and JSON measurements.
3. `.hermes/plans/2026-10-04_125339-design-and-rendering-audit.md` — approved audit scope and MacBook reminder.
4. `AGENTS.md` and `docs/CROSS-MODEL-HANDOFF.md` — repository rules.

## State

The user requested a design review before product changes.
The review covers typography, logos, controls, layout, accessibility, and splash rendering.
The user approved audit execution and bounded cheaper workers.
No product fixes received separate approval yet.
No product source changed. No commit, push, or rebuild occurred.

The browser review found reproducible defects. The complete product audit remains unfinished.
The report separates measured findings, design proposals, and unavailable evidence.

## Reference

The user supplied `~/Downloads/rhizome-design-system.zip`.
Its integrity check passed. The archive metadata references `main@9a48e00`.
The original Claude link requires sign-in, but the archive supports continued review.
The archive omits component API cards and its hero image.
Do not execute its React 18 demonstration bundle inside the React 19 application.

## Tracked findings

- **C89:** HTML splash reads older theme keys, lacks the early local wordmark face, and restarts motion when React replaces it.
- **C90:** Tailwind dark variants follow the operating-system preference rather than the application theme. The destructive treatment also needs contrast correction.
- **C91:** Settings lacks dialog semantics. Closing it returned focus to BODY in the tested sequence.
- **C92:** Theme labels truncate, appearance changes survive Cancel, and Windows displays a macOS shortcut hint. Cancellation policy needs a design decision.

Keep the font families and green identity unless further evidence supports a replacement.
Try larger consequential labels and control targets before changing the entire density scale.
The report contains the precise recommendations and owner paths.

## Verification

Chromium used mock Tauri behavior and controlled fixture content.
The audit captured 1400 × 900, 834 × 700, and 480 × 400 viewports.
These are browser dimensions, not native display-scale checks.

The focused Vitest command passed 83 tests across four files:

```bash
pnpm exec vitest run src/components/BootSplash.test.tsx src/components/BrandMark.test.tsx src/index.theme.test.ts src/components/SettingsPanel.test.tsx
```

No complete release gates ran. No native rendering claim is valid yet.
Research's browser fixture raised an `invoke` error during library scanning.
Mycelium, complete onboarding, attachments, and several keyboard flows remain unreviewed.

## Worker results and rejected claims

Two GPT-5.4-mini CLI workers completed with exit code 0.
Both printed `Warning: Unknown toolsets: stt` without failing.
Their session IDs are `20261004_131412_1c1e58` and `20261004_131412_06f6a5`.
Their temporary reports remain under `%LOCALAPPDATA%/hermes/cache/scratch/`.
The consolidated report supersedes them.

One worker incorrectly treated the default `--primary` alias as a broken accent picker.
The parent verified that red accent overrides work and rejected that finding.
The surface worker offered generic leads, not complete runtime coverage.
Do not cite those workers as independent verification of the whole interface.

## Probe lessons

- Wait for the surface's settled state, not only `__rhizomeFrontendReady`.
- Prime onboarding can replace the shell after its first paint.
- Use `rhizome:ai-agents-onboarding-dismissed` for an isolated browser fixture when onboarding is not the target.
- `TOLARIA_DEV_VAULT_ROOT` changes the server root but not Vite's injected demo-vault path.
- The survey rewrites fixture requests into a copied scratch vault. Other probes block vault requests and use in-memory mock data.
- Settings uses `data-testid="settings-panel"`, not a dialog role. This absence is part of C91.
- Vite dependency imports can expose CommonJS exports under `default` in browser probes.
- Wait for CSS transitions before measuring colors.
- Test operating-system and application theme independently.
- Do not call a clipped scroll-list row a defect without testing its scrolling container.
- Do not treat synthetic replies or update notices as provider facts.

Probe copies now live in `docs/design/2026-10-04-ui-audit/probes/`.
The scripts use absolute paths for this machine.
Early failed attempts do not invalidate successful final runs, but preserve the report's limits.

## Runtime and workspace

Vite responded on `http://127.0.0.1:5201` during handoff preparation.
Its tracked process is `proc_b889e6456a1d`.
The copied fixture is `%LOCALAPPDATA%/hermes/cache/scratch/rhizome-design-audit-vault`.
Orca opened during native-control discovery. No Rhizome application opened.

The available debug executable is `src-tauri/target/debug/RhizomeAgent.exe`.
Its modification time is `2026-10-03T10:47:32-05:00`, earlier than the checkout commit.
Do not rebuild or launch an installed application without the required scope approval.

`main` remains at `9a48e00`, with 15 commits in the local `origin/main..HEAD` comparison.
No remote refresh occurred.
Existing changes in `.gitignore`, `AGENTS.md`, `README.md`, and the September swarm plan remain untouched.
`demo-vault-v2/AGENTS.md` already appeared modified at audit entry. Preserve it.
Other untracked documents and `my-marketplace/` are not this audit's work.

## Next

1. Read the consolidated report before restarting inspection.
2. Complete missing browser coverage instead of repeating the confirmed probes.
3. Get approval for the proposed design and behavior corrections.
4. Use test-driven fixes for approved defects.
5. Verify a current Windows native build after explicit rebuild authorization.
6. Remind the user to perform the focused MacBook review on the same commit.

The MacBook check must cover splash, Retina text, Dock icon, traffic lights, scrolling, and trackpad behavior.
The reminder lives in the plan, report, and this handoff. It is not a scheduled notification.
