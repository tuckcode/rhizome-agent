---
session: 2026-10-13T01:05Z
model: Grok 4.6 (Cursor)
description: >-
  Graph keyboard: first arrow focuses a start node, selected node scales,
  flyTo pans without reorienting, and arrows/Enter stay scoped to the graph host.
commits: uncommitted
---

# Graph keyboard — G-B1–B4

**Origin:** Cursor Grok 4.6 · 2026-10-13 · G-baby blockers brief PR 2.

## What changed

- First arrow with no selection focuses the selected node, else the most
  connected node, else the first (`pickGraphStartNode`).
- Selected node is drawn larger (`graphNodeScale` / `SELECTED_NODE_SCALE`),
  not by color. Keyboard focus and click share `selectNode` → `flyToNode`.
- `flyToNode` pans with a fixed camera–lookAt offset (`panCameraToNode`).
  Click uses the same path.
- The graph host is focusable (`tabIndex=0`, `role="application"`). Arrows
  and Enter run only when the event is in that host and not on a button or
  link. Escape still clears selection / leaves the view, including when a
  graph control has focus.

## Tests

`pnpm exec vitest run src/hooks/useGraphKeyboardNav.test.ts src/components/graph/GraphView.test.tsx src/components/graph/graphData.test.ts src/components/graph/cameraFraming.test.ts`

## Click-through (Bubs)

Open the graph and press an arrow without clicking, and a node gets focus
and looks selected. Press Right three times and each hop goes visually
right. Click a node and the camera moves to it. With the graph open, Tab
to a button in another pane and press Enter, and the button fires instead
of the graph opening a note. Arrows in the note list still move the note
list.
