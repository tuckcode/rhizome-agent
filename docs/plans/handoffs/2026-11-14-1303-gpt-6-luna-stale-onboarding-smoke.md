---
session: 2026-11-14T13:03-06:00
model: GPT-6 Luna
description: >-
  Reproduced C102 and updated the two onboarding smoke assertions to match
  the current first-run flow.
---

# C102: stale onboarding smoke assertions

The baseline run failed in both specs when they searched for the removed
`claude-onboarding-screen` test id. The offline scaffold availability test
passed. The page snapshots showed that successful vault creation opens the
main app directly. The status bar displays the selected Rhizome Vault.

The two affected specs now check that the status bar displays Rhizome Vault.
The status-bar spec then opens the vault menu and checks that the Getting
Started clone action remains available.

## Verification

- Baseline: 2 failures at the stale Claude onboarding test id; 1 test passed.
- `pnpm exec playwright test tests/smoke/getting-started-template.spec.ts tests/smoke/offline-onboarding-status.spec.ts`: 3 passed.
- `pnpm lint`: passed.
- `PYTHONUTF8=1 LC_ALL=en_US.UTF-8 codacy-cli analyze --tool opengrep`: 41 findings across the repository; the scan did not report either changed smoke spec. Three files were partially analyzed and 12 large files were skipped.

The Playwright web server stopped after the test run.
