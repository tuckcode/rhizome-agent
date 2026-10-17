---
session: 2026-10-17T14:15Z
model: Cursor Grok 4.6
description: >-
  Reserve Chat top bar height before engineChromeReady so PrimeSessionSubhead
  does not jump the transcript down.
commits: cursor/audit-chat-ui-2269
---

# Audit chat top-bar placeholder

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Critiquito on #209.

`showChatTopBar` still waits for `engineChromeReady`. While settings are
unsettled, Chat now paints an empty/skeleton band with
`CHAT_TOP_BAR_BAND_CLASS` (`app-titlebar-band min-h-[30px]`). No buttons.
`aria-hidden`. New chat stays unclickable until settle.

Shots: `docs/review-shots/audit-chat/{graphite,earth}-topbar-loading.png`.
