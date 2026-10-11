---
session: 2026-10-11T05:10Z
model: Cursor Grok 4.6
description: >-
  #142 review: move run status beside the log, Stop-before-reply
  announces Stopped, identical lines re-announce, contrast and nits.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · #142 Ricky review

## What changed

Ricky's review on #142. Same branch `cursor/a11y-chat-b1-b5-8b31`.
#143 also touches `AiPanelChrome.tsx`; whichever merges second rebases.

1. Status announcer sits beside the transcript log. The log uses
   `aria-live="off"` so streaming chunks are not spoken twice.
2. Snapshot reads only the latest message. Stop before any reply on
   that turn announces "Stopped", not the previous turn's complete.
3. Identical announcements clear, then restore on the next frame.
4. Model chip lets Radix set `aria-haspopup="menu"`. Tool errors
   announce `{tool} failed`. Ignored mid-turn Enter is not stored
   in prompt history. Muted/faint/tertiary now meet 4.5:1 on
   `--state-selected-strong`.

Focus ring stays `--state-focus-ring`: forest green in light
(`#2E6B4F`), mint in dark (`#6FE3A0`).
