---
session: 2026-09-05T05:35:00-05:00
model: GPT-5
description: >-
  A1 first implementation slice: stopped inactive Graph/Mycelium renderers,
  retained small UI state, removed duplicate rail destinations, and repaired
  narrow-width panel reachability. Native timing remains open.
---

# A1 — visualization lifecycle and rail consolidation

## Implemented

- `ConnectionsPanel` renders exactly one selected view. Switching unmounts the
  inactive renderer, allowing Graph's WebGL cleanup and Mycelium's iframe
  cleanup to run.
- The panel retains only lightweight Graph selection/filter state and
  Mycelium session/action/scroll state while the renderer is stopped.
- Removed Wiki Graph and Mycelium from the left command rail. Existing direct
  routes remain temporarily for status-bar and session-footprint callers;
  moving those callers into Connections is the next A1 slice.
- Removed `AiPanel`'s `min-w-[55%]` constraint that could push the right-side
  Connections edge beyond a narrow native window.

## Evidence

- 126 focused tests passed across App, AiPanel, CommandRail, ConnectionsPanel,
  SessionActivityHistory, and GraphView.
- `pnpm lint`, `pnpm typecheck`, `git diff --check`, and the Impeccable UI
  detector passed.
- `pnpm tauri build --debug --bundles app` passed twice; current bundle is
  `src-tauri/target/debug/bundle/macos/Rhizome Agent.app`.

## Measurement and native limitation

- Source review established the before condition: `visited` kept all visited
  Graph/Mycelium views mounted. The after condition is covered by a regression
  test that verifies each inactive view is removed from the document.
- The requested ten-cycle timing, CPU, and memory record is still open.
- Codex native controls opened an app with the same bundle identifier from
  `/Applications/Rhizome Agent.app` when asked for "Rhizome Agent", even after
  launching the exact debug bundle with `open -n`. Its accessibility tree kept
  the old Graph/Mycelium rail, so it is not evidence about this rebuilt code.
  Both test windows were closed; no user data or window geometry was changed.

## Next

Complete A1 by routing remaining Graph/Mycelium callers into Connections and
capturing the ten-cycle timing plus process CPU/memory against the exact debug
bundle. Do not commit or push without Atticus’s approval.

## Low-cost continuation packet

**Objective:** finish the remaining A1 proof without changing the panel’s
appearance.

1. Read this handoff, then inspect every remaining `handleRailSelectGraph`,
   `handleOpenSessionFootprint`, and status-bar Graph caller before editing.
2. Give `ConnectionsPanel` one controlled request API so those callers select
   Graph or Mycelium there; do not re-add rail destinations or create another
   column.
3. Add focused tests for each rerouted entry and for one active renderer only.
4. Use the exact debug executable rather than app-name lookup for native QA;
   record its PID, window bounds, ten switch acknowledgement/content-ready
   times, and CPU/RSS before and after. Restore the original bounds.
5. Run focused tests, lint, typecheck, detector, `git diff --check`, and
   `pnpm handoff:check`. Report any unavailable native metric plainly.

**Stop condition:** if Codex native controls still cannot attach to the exact
debug executable after one direct launch attempt, preserve the source/tests and
record the blocker. Do not spend another long diagnostic loop on the bundle-ID
collision.
