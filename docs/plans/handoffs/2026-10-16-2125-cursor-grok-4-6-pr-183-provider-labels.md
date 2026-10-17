---
session: 2026-10-16T21:25Z
model: Grok 4.6 (Cursor)
description: >-
  PR #183: chip menu group headers use Prime provider display names;
  screenshots for Open settings close-up and selected+hover rows.
commits: this slice
---

# PR #183 provider labels and screenshots

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Chip menu group headers call `primeProviderLabel` from the shared Prime
map (`nous-portal` → Nous Portal, `mock` → Mock). Settings provider cards
use the same helper. Unknown ids still fall back to the raw name.

Screenshots in `docs/screenshots/pr-183/` from the mock app: Open settings
link hover close-up, selected+hovered row in Graphite dark and Earth
light, Ask Rhizome placeholder in both themes.

Did not edit `HANDOFF.md`.
