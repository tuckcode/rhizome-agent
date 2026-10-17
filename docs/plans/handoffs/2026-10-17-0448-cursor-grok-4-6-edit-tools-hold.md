---
session: 2026-10-17T04:48Z
model: Cursor Grok 4.6
description: >-
  HOLD fix on #196: real unified hunks, stale-preview hash, write caps,
  approval-card design, atomic nits, recaptured review shots.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Ricky+Critiquito HOLD on #196

Preview hunks now use context, separate +/- budgets (40/40), and
visible CRLF/EOF notes. Approval carries a sha256 (or `absent`) and
refuses if the file changed. `write_file` caps existing reads and
content at 2 MiB. Session grants key on canonical path and clear on
vault change. Preview errors fail before the card. LF `old_string`
matches CRLF files.

The card is Allow once as filled primary, muted “Needs approval”,
New file / Replaces the whole file, fade + Show all, Earth light
diff ink darkened one step. Shots are real `preview::unified` output
in `docs/review-shots/edit-tools/`.

Localization: none — English only (C18).
PostHog: no event needed because approval answers are frequent.
