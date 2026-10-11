---
session: 2026-10-11T04:55Z
model: Grok 4.6
description: >-
  PLAN item 4 first slice: one Views group on the command rail
  (Research, Graph, Mycelium, Changes, History), Option+Cmd+1-5, Go + Cmd+K.
  Leftover primary buttons removed. A-W8 / A-M1 / A-M3 / A-M4 deferred.
commits: cursor/navigation-grouping-d32a
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 04:55 UTC

## What landed

First coherent slice of `docs/design/critiques/PLAN.md` item 4 (A-B1 plus
the grouping work that makes the home real).

- `src/lib/railViews.ts` is the catalog. Order and nouns are the same on
  the rail, in the Go menu, and in Cmd+K.
- Command rail always shows Views. Icons when collapsed; labels and
  Option+Cmd+1-5 when expanded. Changes carries the muted count badge.
- Go menu and Cmd+K "Views" are the second path. Research left Settings.
  Duplicate `view-changes` left Git.
- Removed `NotesChromeShortcuts`, sidebar Changes, composer Research /
  Mycelium, status-bar Research while the rail is on, and History from
  the vault pill.
- Contextual stays: note "Show in Graph", session "Show in Mycelium",
  subhead Mycelium, status "N changed".

## Still open from the plan

- A-W8: peer tools still open in different containers (full-page
  Research / Graph / Mycelium vs list filters for Changes / History).
  No origin-named exit copy.
- A-M1: extra Settings surfaces beyond the rail gear.
- A-M3: placement-off still shows the rail item.
- A-M4: View menu still Cmd+1, Cmd+2, Cmd+4, Cmd+3.

Did not touch colors, theme tokens, Rust, the key store, provider
settings, or native chat/session code.
