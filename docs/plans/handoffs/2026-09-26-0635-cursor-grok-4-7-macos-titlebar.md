---
session: 2026-09-26T06:35-05:00
model: Cursor Grok 4.7
description: >-
  Thin macOS title bar (32px, trafficLightPosition y=9) with Command Palette
  docked left. Rail no longer pads under the lights. Commit-only; not pushed;
  packaged app not checked.
commits: 4a322a9..HEAD
---

# macOS title bar

**Origin:** Cursor Grok 4.7 · 2026-09-26.

## What shipped

- `MacOSTitlebar` — fixed 32px band, `useDragRegion`, Command Palette via
  `laputa:dispatch-command`.
- `trafficLightPosition.y` 16 → 9; `body.mac-chrome` pads the shell 32px so
  the sessions rail starts below the lights.
- Chat subhead hides its Command Palette button on native macOS (browser /
  Linux / Windows keep it).

## Not verified

- Packaged `/Applications` app (rebuild not requested).
- Live native traffic-light seating beyond config + unit tests.
