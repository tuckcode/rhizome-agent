---
session: 2026-10-17T17:48Z
model: Cursor Grok 4.6
description: >-
  History and inspector commit rows keep the truncated subject, but hover,
  keyboard focus, and the accessible name now expose the full first line.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · History commit-title hover

The Notes-side History feed (`PulseView`) truncated the commit subject
with no hover or focus path to the rest of the line. The inspector
`GitHistoryPanel` used `title="View diff for <hash>"`, which hid the
message. Both surfaces now wrap the row in `CommitSubjectTooltip` and
label the first line of the message.

Review shots in `docs/review-shots/history-commit-title/`:

- `before-history-hover.png`
- `after-history-hover.png`
- `after-history-focus.png`
- `after-inspector-hover.png`

Regenerate after shots with `pnpm dev` and
`SHOT_PHASE=after node scripts/capture-history-commit-title.mjs`.

Localization: none — English only (C18).
PostHog: no event needed because this is a tooltip on existing rows.
