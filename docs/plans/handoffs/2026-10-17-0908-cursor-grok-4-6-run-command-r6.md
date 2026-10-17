---
session: 2026-10-17T09:08Z
model: Cursor Grok 4.6
description: >-
  Round 6 HOLD: collapsed row keeps hidden-characters marker and exit
  outside truncate; $ prompt on expand; JSON ws trim; keep command spacing.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · #200 round 6 HOLD

The collapsed command sits in its own `min-w-0 truncate` span. The
hidden-characters marker and exit status are `shrink-0` siblings, so a
long row cannot ellipsis them away. The marker is `· has hidden
characters` whenever the command has any hidden character. Expanded
command blocks start with a muted `$ `. `cutCommand` keeps original
spacing. JSON object scan trims only space/tab/LF/CR.

Localization: none — English only (C18).
PostHog: no event needed because this is the same result row.
