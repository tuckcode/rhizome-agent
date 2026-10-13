---
session: 2026-10-13T01:58Z
model: Grok 4.6 (Cursor)
description: >-
  Ricky review on #165: read orbit look-at from controls().target, and
  restore Escape outside the graph without stealing it from inputs or dialogs.
commits: uncommitted
---

# Graph keyboard — Ricky review

**Origin:** Cursor Grok 4.6 · 2026-10-13 · review on #165.

## What changed

- `flyToNode` reads `lookAtFromControls(graph.controls())` so the first hop
  after fit or a drag-rotate keeps heading. `lastLookAtRef` is gone.
- Escape again clears selection or leaves the view when focus is outside
  the graph. Inputs and dialogs keep Escape.

## Tests

`pnpm exec vitest run src/components/graph/cameraFraming.test.ts src/hooks/useGraphKeyboardNav.test.ts src/components/graph/GraphView.test.tsx`
