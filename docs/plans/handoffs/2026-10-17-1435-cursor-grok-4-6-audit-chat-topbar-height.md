---
session: 2026-10-17T14:35Z
model: Cursor Grok 4.6
description: >-
  Lock Chat top bar placeholder and real strip to one 39px box-border height
  so settle no longer drops the transcript.
commits: cursor/audit-chat-ui-2269
---

# Audit chat top-bar height

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Critiquito HOLD on #209 at 2ac9bb29.

`CHAT_TOP_BAR_BAND_CLASS` is now `box-border h-[39px]`: 32px New chat +
`pb-1.5` + 1px border. Placeholder and real strip share it. Measured
39.0px / 39.0px. Placeholder uses the same window-drag handler.
