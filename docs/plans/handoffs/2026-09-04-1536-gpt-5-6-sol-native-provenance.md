---
session: 2026-09-04T15:36:00Z
model: GPT-5.6 Sol
description: >-
  Real-vault native QA found and fixed a Prime 0.8.0 provenance wrapper gap,
  resolved stale C23/C25 tracking and tests, and retired an attempted C22
  reopening after a controlled native relaunch check passed 10/10 cycles.
commits: 31741f8
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
- C22: the attempted reopening was retired. A CoreGraphics visible-window
  probe and exact-process-path check showed the debug bundle opening normally
  in 10/10 controlled quit/relaunch cycles; no window code changed.

## Verification

- `cargo test --manifest-path src-tauri/Cargo.toml prime_tool_unwrap::tests --lib`
  — 15 passed.
- `npx playwright test tests/smoke/type-create-note.spec.ts --reporter=line --retries=0`
  — 2 passed.
- `pnpm vitest run src/components/Sidebar.test.tsx src/components/Sidebar.typeVisibilityWorkspaces.test.tsx`
  — 81 passed.
- `pnpm tauri build --debug --bundles app` — app bundle built successfully.
- Exact debug-bundle quit/relaunch loop — 10/10 cycles exposed a visible
  layer-0 window; final executable path matched the debug bundle.

## Next

Repeat the real-vault retrieval and verify the `From your vault` link opens the
cited note. Commit/push only with Atticus's approval.
