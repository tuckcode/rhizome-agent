---
session: 2026-10-16T03:55Z
model: Grok 4.6 (Cursor)
description: >-
  #169 follow-up: Dracula faint clears 4.6:1; contrast_check blends
  banners over app and sidebar; Everforest muted/faint get a small
  sat boost. Graphite and light skins unchanged.
commits: this slice
---

# Dark ink follow-up

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Follow-up to merged #169. Dracula faint on the warning tint sat at
4.51 on panel. The generator now lifts that faint to 4.6:1 and
`contrast_check.py` blends banner tints over app and sidebar as well
as panel. Everforest muted and faint keep the palette hue and gain
0.10 HSL saturation so the moss reads after the lightness lift.

Nord, Gruvbox dark, and Solarized dark also moved because their
sidebar (the palette panel) is lighter than the app surface, and
yellow/green banners there were below 4.5:1. Solarized body lifts
from `#A5B2B3` to `#A9B6B6` — the pinned body left no `INK_GAP` room
above the new faint floor. Graphite, Earth, Loam, Mycelium, and every
light skin stay as they were.
