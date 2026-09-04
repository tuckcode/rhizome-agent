---
session: 2026-09-04T15:36:00Z
model: GPT-5.6 Sol
description: >-
  Real-vault native QA found and fixed a Prime 0.8.0 provenance wrapper gap,
  resolved stale C23/C25 tracking and tests, and reopened C22 after a rebuilt
  macOS app relaunched without a reachable window.
commits: uncommitted
---

# Native provenance follow-up

## What changed

- #25: `prime_tool_unwrap` recognizes Prime 0.8.0's live `content` wrapper and
  Python `subprocess.run([...])` argv shape, including a separately assigned
  `path` variable. The regression fixture was copied from the native run.
- C23: the stale `C23-OPEN` label and load-bearing `get_messages` comments now
  match the settled disk-log transcript design.
- C25: create-note browser coverage follows the current Notes panel; the stale
  duplicate visibility spec was removed because Sidebar unit tests own that
  behavior.
- C22: reopened after the rebuilt debug app ran with no attachable main window
  across exact-path open, activation, process restart, and relaunch.

## Verification

- `cargo test --manifest-path src-tauri/Cargo.toml prime_tool_unwrap::tests --lib`
  — 15 passed.
- `npx playwright test tests/smoke/type-create-note.spec.ts --reporter=line --retries=0`
  — 2 passed.
- `pnpm vitest run src/components/Sidebar.test.tsx src/components/Sidebar.typeVisibilityWorkspaces.test.tsx`
  — 81 passed.
- `pnpm tauri build --debug --bundles app` — app bundle built successfully.

## Next

Diagnose C22's hidden relaunch, then repeat the real-vault retrieval and verify
the `From your vault` link opens the cited note. Commit/push only with Atticus's
approval.
