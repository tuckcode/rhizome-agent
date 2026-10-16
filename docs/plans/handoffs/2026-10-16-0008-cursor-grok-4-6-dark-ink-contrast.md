---
session: 2026-10-16T00:08Z
model: Grok 4.6 (Cursor)
description: >-
  Raise community dark --text-faint/--text-muted to 4.5:1 on the app
  surface and banner tints. Generator lifts HSL lightness only.
  contrast_check and the #168 cascade test now gate every dark skin.
commits: this slice
---

# Dark faint/muted contrast

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Community dark skins failed AA on `--text-faint` and `--text-muted`
(Dracula 2.18 / 3.03 on `--surface-app`; worse on yellow/green banners).
The generator now raises HSL lightness and keeps each palette hue.
Graphite, Earth, Loam, and Mycelium values from #168 are unchanged.

`scripts/contrast_check.py` prints `== dark faint/muted` for every dark
skin and fails below 4.5:1 on `--surface-app` or the banner tints. The
resolved-cascade Vitest from #168 checks the same pairs.
