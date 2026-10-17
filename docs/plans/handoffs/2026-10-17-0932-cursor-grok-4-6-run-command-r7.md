---
session: 2026-10-17T09:32Z
model: Cursor Grok 4.6
description: >-
  Round 7 HOLD: collapsed VisibleCommand uses inline no-wrap spans so
  Chrome truncates the whole command, not the first word.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · #200 round 7 HOLD

Collapsed result rows render `VisibleCommand` with `wrap={false}`: plain
spans, no `inline-block`. The command clip is `min-w-0 truncate` without
`flex-1`, so the hidden-character marker and exit sit after the chip.
Approval and expanded command blocks keep the wrapping `inline-block`
mode. Hidden characters stay `\u{…}` badges. The timeout comment cites
#202 at `c63e712`.

Localization: none — English only (C18).
PostHog: no event needed because this is the same result row.
