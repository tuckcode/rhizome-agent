---
session: 2026-10-16T03:22Z
model: Grok 4.6 (Cursor)
description: >-
  #169 hold: tertiary is a fitted ladder step; contrast_check counts
  Graphite/Earth/Loam/Mycelium; order test covers hover/sidebar/panel/
  selected-strong; shared INK_GAP 0.015; muted/faint keep hue and sat.
commits: this slice
---

# Dark ink tertiary hold

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Reviewers held #169 at `d951dce` because `--text-tertiary` sat above
secondary on several community skins, Graphite/Earth/Loam/Mycelium
were left out of the contrast_check fail count, and Everforest /
Gruvbox muted+faint had lost warmth (Solarized faint had drifted cyan).

The generator now fits primary > secondary > tertiary > muted > faint.
Faint and muted stay on each palette muted hue and change HSL
lightness only. Solarized dark body stays `#A5B2B3`; its tertiary
uses that same muted hue so the 8-bit steps still clear `INK_GAP`.
Generator, `contrast_check.py`, and the order test all read
`scripts/ink-gap.json` (`0.015`).
