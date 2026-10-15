---
session: 2026-10-13T20:15Z
model: Cursor Grok 4.6
description: >-
  Rebased PR #163 onto main after #164/#165. Exit labels follow the on-screen
  surface, placement-off is gone, labels go through translate, and View 1-4
  yield while typing.
---

# PR #163 rebase + navigation nits

**Origin:** Cursor Grok 4.6 · 2026-10-13 · rebase of app navigation onto current main

## Done

- Rebased `cursor/polish-app-navigation-924a` onto `main` after #164 and #165.
- `GraphView.tsx` kept #165's host focus, fly-to, and keyboard nav, plus this PR's shared exit button.
- Exit copy uses the surface on screen, not whether a note tab exists.
- Removed the dead connections-placement `off` path. Nothing in the product could switch it.
- Exit labels and Today/{n}d go through `translate()`.
- CmdOrCtrl+1-4 View shortcuts do not fire while the editor or chat box is focused.

## Tests

- Focused vitest on peerToolExit, dateDisplay, app keyboard, ConnectionsPanel, CommandRail, GraphView.
---
