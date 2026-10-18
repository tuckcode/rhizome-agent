---
session: 2026-10-16T21:45Z
model: Grok 4.6 (Cursor)
description: >-
  #184 hold at 7b7cd32: Period code shortcut, absolute hover overlay,
  neutral selected fill, open-for-now tooltip.
commits: this slice
---

# Notes panel hold at 7b7cd32

**Origin:** Grok 4.6 (Cursor) · 2026-10-16 · Ricky + Critiquito

- Shortcut matches `event.code === 'Period'` so Shift+Period still
  fires when the key is `>`.
- Auto hover lives in a 46px slot and is absolutely positioned
  (`right/top/bottom 0`, width 240).
- Selected rail rows and the mode button hover use `--state-hover`,
  not `--state-selected` or `--accent`. Rail icons use
  `--text-secondary` / `--text-primary`.
- A temporary view-switch open reads `Panel: Rail (open for now)`.
- Mode menu z-index is inline only.

Localization: none — English only (C18).
PostHog: no new event.
