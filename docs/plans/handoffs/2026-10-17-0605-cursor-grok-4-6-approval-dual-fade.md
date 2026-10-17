---
session: 2026-10-17T06:05Z
model: Cursor Grok 4.6
description: >-
  Collapsed approval diffs open at scrollTop 0 with @@ visible, no auto-scroll,
  top fade when scrolled, bottom fade when more remains.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Critiquito dual-fade spec on #196

Collapsed cards keep the full unified hunk in a `max-h-64 overflow-auto`
scroller. They start at `scrollTop` 0 (hunk header visible). A top fade
appears when `scrollTop > 0`; the bottom fade stays while more content
is below, with Show all. Recaptured overwrite/long shots plus a
partway-scrolled long-diff in both themes.

Localization: none — English only (C18).
PostHog: no event needed because this is collapsed-card layout.
