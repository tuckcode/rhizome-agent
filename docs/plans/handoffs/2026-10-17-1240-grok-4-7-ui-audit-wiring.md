---
session: 2026-10-17T12:40:00Z
model: Grok 4.7 (Cursor)
description: >-
  Wiring fixes from the browser audit of main c210019b. Right-rail
  Changes click, notes overlay under the title bar, History opens the
  notes panel, Inbox list and badge share one array, Mycelium uses
  session summaries and first-user titles, shortcut labels share one
  helper, Tolaria smoke string updated.
commits: 6e05a677
---

# UI audit wiring — 2026-10-17

**Origin:** Cursor Grok 4.7 · 2026-10-17 · browser audit of `c210019b`.

## What changed

- Notes Auto keeps the icon strip mounted. The sheet starts below
  `--overlay-titlebar-height` and leaves the Command Palette clickable.
- History (rail button, Ctrl/Cmd chord, status-bar pulse) opens the
  notes column on the pulse list. The keyboard path now delivers
  filter commands, which it previously dropped.
- Inbox rows and the Inbox badge are `filterInboxEntries(entries, 'all')`
  from one memo. A missing period no longer falls back to a month.
- Mycelium reads `list_prime_session_summaries` and titles each row
  from a real title or the first user turn.
- `platformShortcutLabel` picks ⌘ / ⌃⌘ on Mac and Ctrl labels elsewhere.
- Fresh-start smoke looks for "Help improve Rhizome".

## Not in this change

Approval card, chat empty state, onboarding copy, Prime/Hermes removal,
themes, Settings copy, and PR #200 files.
