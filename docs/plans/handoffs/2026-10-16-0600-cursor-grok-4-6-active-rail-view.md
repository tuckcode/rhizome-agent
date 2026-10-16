---
session: 2026-10-16T06:00Z
model: Grok 4.6 (Cursor)
description: >-
  Pulled MainApp's active-rail-view ternary into computeActiveRailView
  in src/lib/railViews.ts. No behavior change. Unit tests cover each
  destination branch plus Pulse and the empty case.
commits: this slice
---

# Extract computeActiveRailView

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

MainApp derived `activeRailView` from the destination flags and
`effectiveSelection`. That ternary now lives in
`computeActiveRailView` next to `RailViewId`. `App.tsx` only gained
the import and the call.
