---
type: ADR
id: "0155"
title: "Wiki graph view: 3d-force-graph (three.js) for 3D rendering"
status: active
date: 2026-07-12
---

## Context

The wiki graph view (nodes = notes, edges = wikilinks/relationships,
ghost nodes for unresolved link targets) needed a rendering library. The
user explicitly asked for a GalaxyBrain-style (github.com/nerd-sniped/GalaxyBrain)
3D force-directed look rather than a flat 2D layout — that decision was
made in conversation before implementation, not re-litigated here.

No graph-rendering dependency existed in the repo (`package.json`
audited: no d3, d3-force, three.js, cytoscape, vis-network, or
`3d-force-graph` present before this feature).

## Decision

Adopted `3d-force-graph` (wraps three.js) — the same library GalaxyBrain
itself uses, so it renders the requested look directly rather than
approximating it.

**Cost mitigations locked in with this ADR:**

1. **Mandatory lazy chunk.** `GraphView` is `React.lazy`-loaded from
   `App.tsx`; `ForceGraph3DCanvas.tsx` is the only file that imports
   `3d-force-graph`, and even it defers the import to inside a
   `useEffect` (`void import('3d-force-graph')`). Verified via
   `pnpm build`: `dist/assets/3d-force-graph-*.js` is a separate
   1.36MB chunk (365KB gzip), the main `index-*.js` bundle is
   unaffected.
2. **Test isolation.** WebGL is unavailable in the Vitest/jsdom
   environment. Every test that exercises `GraphView` mocks
   `ForceGraph3DCanvas` (`vi.mock('./ForceGraph3DCanvas', ...)`) rather
   than touching three.js — coverage on the data/state layer stays real;
   the WebGL wrapper itself is intentionally thin and lightly covered.
3. **Coverage-gate scoping.** Keeping the three.js-touching code
   confined to one small file protects the ≥70% frontend line-coverage
   gate from an untestable-by-design surface.

## Options considered

- **`3d-force-graph` (chosen):** matches the requested reference
  implementation exactly; ships camera/physics/interaction handling so
  the app doesn't hand-roll a WebGL scene graph.
- **`d3-force` (2D, no three.js):** ~10KB, precise DOM/SVG popover
  anchoring, cleaner keyboard-nav math — the lighter option, but doesn't
  produce the 3D look the user asked for. Rejected for this feature;
  worth reconsidering if bundle size or WebGL support becomes a real
  problem (`d3-force` computes the same underlying physics and could
  drive a 2D canvas/SVG renderer instead).
- **Hand-rolled three.js scene:** full control, no `3d-force-graph`
  abstraction layer, but reimplements force simulation + camera
  controls + node/link picking that `3d-force-graph` already provides.
  Not justified for a single graph view.

## Consequences

**Easier:** matches the reference implementation the user pointed to;
camera controls, physics, and node/link picking come for free.

**Harder:** a genuinely large dependency (~1.36MB pre-gzip) — mitigated
by the lazy-chunk split above, but still the single largest optional
feature bundle in the app. WebGL requirement means the graph view
degrades to nothing useful on environments without GPU/WebGL2 (no
fallback UI built for that case in v1 — out of scope per the feature's
own plan; `graph-error`/`graph-empty` states exist for fetch failures
and empty vaults, not WebGL-unavailability).

Re-evaluate if bundle size complaints surface, or if a 2D mode is later
requested alongside — at that point `d3-force`-driven 2D rendering
becomes the natural second renderer behind the same
renderer-agnostic `GraphDto` contract (`src-tauri/src/vault/graph.rs`)
this feature already established.
