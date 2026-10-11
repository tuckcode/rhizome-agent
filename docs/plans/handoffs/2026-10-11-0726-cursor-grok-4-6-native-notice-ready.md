---
session: 2026-10-11T07:26Z
model: Grok 4.6
description: >-
  Rebase #148 onto origin/main after #146 merged; join pending
  VoiceOver lines with ". "; clear pendingRef on unmount.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · #148 ready

## What landed

#146 is on `origin/main`, so those commits dropped from this branch.
`HANDOFF.md` conflict kept both sides' Origin lines; nine stale
September crumbs came out so the 900-line gate still passes.

Pending `ChatRunLiveStatus` lines join with `. ` unless the first
already ends in punctuation. Unmount clears `pendingRef`.
