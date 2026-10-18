---
session: 2026-10-16T21:30Z
model: Grok 4.6 (Cursor)
description: >-
  #184 review notes: view-switch no longer saves Open, folded-Open
  tooltip, radio menu, cycleMode outside setState, overlay z-order,
  Cmd+Shift+.
commits: this slice
---

# Notes panel review notes (#184)

**Origin:** Grok 4.6 (Cursor) · 2026-10-16 · Ricky + Critiquito

- View switches call `setNotesSessionOpen` and leave the stored mode
  alone. A test keeps Rail through Cmd+2.
- Tooltip stays `Panel: Auto` / `Rail` / `Open`. Folded Open reads
  `Panel: Open (window too narrow)`.
- Mode menu is a radio group. `cycleMode` computes the next value
  outside the updater.
- Overlay is z-40, menu is z-60. Shortcut is `⌘⇧.` / `Ctrl+Shift+.`
  so it does not take macOS Cancel or Chat stop (`⌘.`).
- `index.css` no longer sources `../scripts`. The harness CSS does.

Localization: none — English only (C18).
PostHog: no new event.
