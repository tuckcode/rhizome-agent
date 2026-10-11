---
session: 2026-10-11T08:15Z
model: Cursor Grok 4.6
description: >-
  Boot splash no longer freezes two grow-in arms invisible when a
  Tauri/WebKit window reports document.hidden at first paint.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · boot splash frozen arms

The HTML bootstrap set `--boot-motion-state: paused` whenever
`document.hidden` was true. Grow-in uses `animation-fill-mode: both`
from opacity 0, so a pause at frame 0 hid path 4–5 and circle 5–6.
A Mac Tauri window often starts hidden and may never fire
`visibilitychange` when shown.

Fix: stay `running` until the page has been visible once; paused
state drops the grow animations so the settled mark stays on screen;
`prefers-reduced-motion: reduce` shows the full still logo.
