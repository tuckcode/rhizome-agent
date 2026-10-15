---
session: 2026-10-15T01:00Z
model: Grok 4.6 (Cursor)
description: >-
  Graphite is the new default dark theme (warm gray, mint #76EAA7).
  Mycelium restored. Selected rows, banner copy, and mono status labels.
commits: this slice
---

# Graphite default theme

**Origin:** Grok 4.6 (Cursor) · 2026-10-15 · Graphite default

## What landed

1. Graphite is `:root.dark` / `[data-theme="dark"]` in `src/index.css`.
   Empty storage and new installs start there. A stored `rhizome` / Loam
   / Mycelium / community slug is kept.
2. Earth lives on slug `rhizome`: light is the default light contract,
   dark is `:root.dark[data-color-theme="rhizome"]`. The picker lists
   Graphite, Earth dark, Earth light, Loam, Mycelium first.
3. Mycelium is a selectable green-black skin (`#0E120C` / `#151A12` /
   `#6FE3A0`). Muted/faint raised so banner tints pass 4.5:1.
4. Selected rows use `.list-row-selected` (`--state-selected` fill +
   2px `--accent-blue` left bar) on notes, folders, and sessions.
5. Banner/toast body copy uses `--text-secondary`. Tool status words
   are OK / RUN / ERR in `font-mono` (IBM Plex 11–12px). Status-bar
   branch, change count, and build labels match.
6. Rust `SUPPORTED_COLOR_THEMES` now includes `graphite`, `loam`, and
   `mycelium` so those picks persist through settings.

## Token names

Every name in the brief exists on main's `src/index.css`. No remaps.

## Contrast (Graphite values, `scripts/contrast_check.py`)

- `--state-hover-subtle` `#1A1917`: heading 16.27, primary 15.02,
  secondary 10.19, faint 6.56, accent 11.79.
- code block `#0D0D0B`: primary 16.63, faint 7.27.
- overlay `rgba(5,5,4,0.6)` on `#131210` → `[11,10,9]`: primary 16.91,
  faint 7.39.
- Designer banner tints vs faint: info 4.62, success 4.55, warning 4.85,
  error 4.87.

JetBrains Mono stays wordmark-only. Status labels use IBM Plex via
`font-mono`, which is what `docs/design/earth-theme/DESIGN.md` ships.
