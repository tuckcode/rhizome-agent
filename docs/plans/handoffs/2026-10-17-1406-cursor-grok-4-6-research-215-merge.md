---
session: 2026-10-17T14:06Z
model: Cursor Grok 4.6
description: >-
  Merge origin/main (#215) into the Research HOLD branch. Keep #208's
  request-id guard and call parseLibraryScan instead of inline JSON.parse.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · merge 876f4d1d into #208

One conflict, `src/components/ResearchPanel.tsx` `loadLibrary`.

- Kept #208's request-id and vault-key stale-result drop, `callHost`,
  error/empty states, retry focus, attempt reset, Generate tooltip,
  Details remount, and the hidden `<pre>`.
- Replaced #208's inline `JSON.parse` map with #215's `parseLibraryScan`.
- Did not take #215's `addEvent(libraryLoaded)` write into the generate log.

No UI change. No Rust edits in this resolution.

Localization: none — English only (C18).
PostHog: no event needed because this is a merge resolution.
