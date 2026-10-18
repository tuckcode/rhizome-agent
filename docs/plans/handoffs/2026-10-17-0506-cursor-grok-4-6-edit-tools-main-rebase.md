---
session: 2026-10-17T05:06Z
model: Cursor Grok 4.6
description: >-
  Rebase #196 onto main after #195/#190; drop approval-card auto-scroll so
  collapsed diffs open at the @@ row with fade and Show all.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · #196 onto main + Critiquito scroll HOLD

#195 merged as `189b46a5` (not a squash; second parent is `4753141f`).
Rebased the five edit-tools commits onto current `main` so the PR diff
is edit-tools only.

Collapsed approval cards no longer auto-scroll to the first added line.
They open at the `@@` row, `overflow-hidden`, with the bottom fade and
“Show all N lines”. The collapsed window keeps a 3-line prefix and up
to 8 added lines so a 40/40 hunk still shows what will be written
without scrolling. Recaptured the eight Graphite/Earth shots from
`preview::unified`.

Localization: none — English only (C18).
PostHog: no event needed because this is collapsed-card layout.
