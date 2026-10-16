---
session: 2026-10-16T02:58Z
model: Grok 4.6 (Cursor)
description: >-
  #169 hold: dark skins keep primary > secondary > muted > faint at
  ≥4.5:1 on the app, banners, and selected rows. Monokai selected-row
  text now clears 4.5:1.
commits: this slice
---

# Dark ink ladder hold

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Reviewers held #169 at `c08a4a6` because muted rose above body text on
Solarized dark and One dark, and faint sat on muted in several skins.
The generator now fits the four ink roles from the 4.5:1 floor up, with
a 0.02 luminance gap, on the app surface, banner tints, and selected-row
fills. Earth and Loam muted were lifted one step so faint stays dimmer.
Graphite and Mycelium are unchanged.

`contrast_check.py` and a new cascade test gate the order on every dark
skin. Monokai `--text-muted` on `--state-selected-strong` is 4.72.
