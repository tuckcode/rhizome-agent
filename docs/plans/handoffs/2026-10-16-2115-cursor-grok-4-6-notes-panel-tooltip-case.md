---
session: 2026-10-16T21:15Z
model: Grok 4.6 (Cursor)
description: >-
  Notes panel tooltip uses sentence-case menu labels (Panel: Auto).
  Review shots for #184 live under docs/review-shots/184/.
commits: this slice
---

# Notes panel tooltip case + review shots

**Origin:** Grok 4.6 (Cursor) · 2026-10-16 · Critiquito on #184

`notesPanelModeTooltip` now uses `notesPanelModeLabel`, so the trigger
reads `Panel: Auto` / `Panel: Rail` / `Panel: Open`. The Open default
is unchanged.

The eight Graphite + Earth review frames (rail, hover, open, narrow)
are tracked at `docs/review-shots/184/` so reviewers do not need
cursor.com artifact links.

PostHog: no new event — tooltip copy only.
Localization: none — English only (C18).
