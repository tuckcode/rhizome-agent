---
session: 2026-10-11T05:26Z
model: Cursor Grok 4.6
description: >-
  #142 second review: pending run announcements survive streamed
  re-renders; stale composer-lock comment removed.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · #142 reread frames

`ChatRunLiveStatus` keeps rAF ids in refs. A newer line or unmount
cancels them. A streamed token does not. Tests cover a re-render
between frames and a tool start plus one chunk.
