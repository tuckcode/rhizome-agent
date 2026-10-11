# Fix list: Knowledge graph (Wiki Graph / Node map)

Source critique: [2026-10-10-design.md](./2026-10-10-design.md). When a new version comes in, change the status to `fixed` or `won't fix` instead of deleting the row.

**Open:** 5 blockers · 9 worth fixing · 5 minor

| ID | Severity | Category | Finding | Fix (tokens) | Status | First seen |
|---|---|---|---|---|---|---|
| G-B1 | blocker | interaction and states | Arrows and Enter do nothing until a node is clicked (`if (!focusedId) return`) | Select the origin or top hub on open; show the ring and preview | open | 2026-10-10 |
| G-B2 | blocker | interaction and states | Selection not drawn: `colorForNode` ignores `selectedId` | `--accent` ring at 1.6× scale, neighbours full, rest at 0.25 opacity | open | 2026-10-10 |
| G-B3 | blocker | interaction and states | `flyToNode` re-orients the camera, so arrow directions change after each move; click doesn't fly | Fixed orientation, pan only; same behaviour for click and keys | open | 2026-10-10 |
| G-B4 | blocker | interaction and states | Window-level, always-on listener steals arrow keys from other panes and Enter from focused buttons | Scope to the focused canvas host (`tabIndex=0`, `role=application`) | open | 2026-10-10 |
| G-B5 | blocker | hierarchy and layout | Screenshot: traffic lights over "Find a note…" | Overlays below the 28px titlebar or at `left: 80px`; check on the current build | open | 2026-10-10 |
| G-W1 | worth fixing | hierarchy and layout | Preview is a snippet + badges; reading means leaving the graph | Rendered first section, Linked from/to with context, outline, Open beside | open | 2026-10-10 |
| G-W2 | worth fixing | hierarchy and layout | `zoomToFit` includes orphans (cluster ≈ 25% of the canvas) and refits on engine stop | Fit the largest component once; never refit after user input | open | 2026-10-10 |
| G-W3 | worth fixing | visual design | 3D adds occlusion and rotation, no meaning | 2D default (`force-graph`); 3D opt-in | open | 2026-10-10 |
| G-W4 | worth fixing | hierarchy and layout | Floating panels cover 20–40% of the canvas; they overlap in compact | Toolbar strip above the canvas; Key as a popover | open | 2026-10-10 |
| G-W5 | worth fixing | copy | "Back to chat" / "Exit graph" regardless of origin; a third Esc closes the view | "Close graph"; Esc stops at clearing the selection; ⌘W closes | open | 2026-10-10 |
| G-W6 | worth fixing | hierarchy and layout | No labels on the canvas (hover only) | Label the selection, neighbours, and top 12 hubs; 11px `--fg-secondary` with a `--bg` halo | open | 2026-10-10 |
| G-W7 | worth fixing | color | 17 types on ~6 hues; 4 accent edge colours indistinguishable | Top 6 types coloured, rest `--muted`; edges `--border-strong` | open | 2026-10-10 |
| G-W8 | worth fixing | hierarchy and layout | Type list duplicated in the filter pills and the Key | One Key list with checkboxes and counts | open | 2026-10-10 |
| G-W9 | worth fixing | hierarchy and layout | 32 ghosts + orphans shown by default | Hide by default; "Show N unwritten links" toggle | open | 2026-10-10 |
| G-M1 | minor | copy | Raw `isA` casing in the labels | Sentence-case the display labels | open | 2026-10-10 |
| G-M2 | minor | copy | Hint vague, wraps, hidden in the collapsed Key | Toolbar hint "↑↓←→ linked notes · ↵ open · Esc clear" | open | 2026-10-10 |
| G-M3 | minor | copy | Four names: Wiki Graph / Graph / Node map / Exit graph | One name: "Graph" | open | 2026-10-10 |
| G-M4 | minor | visual design | `nodeVal = 1+links+backlinks`, no cap | `1+sqrt(degree)`, clamped to 6 | open | 2026-10-10 |
| G-M5 | minor | interaction and states | No mouse help (`showNavInfo(false)`) | "Drag to pan · scroll to zoom" | open | 2026-10-10 |
