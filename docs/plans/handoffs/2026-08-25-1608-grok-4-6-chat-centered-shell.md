---
session: 2026-08-25T16:08-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat-centered shell: sessions left, Chat the permanent center, inbox and
  notes on the right, all collapsible. ADR-0166 open questions on ⌘1/⌘2/⌘3
  and right-panel exclusivity settled.
---

# Chat-centered shell

The user cut the remaining ADR-0166 debate: sessions on the left, inbox and
notes on the right, all collapsible, Chat in the center.

## What landed

With the command rail on (the default product):

```
rail | sessions | CHAT | inbox (note list) | notes (tree)
```

- Chat is furniture, not a destination. Clicking Notes/Inbox/Changes no
  longer hides it. Classic shell (`ff_shell_command_rail=false`) still
  replaces the window.
- Sessions stay the 228px column inside ChatHome (always shown when open;
  the 900px hide is gone).
- Inbox (list) and notes (tree) dock on the right of Chat. Not exclusive —
  the 2026-08-22 exclusivity attempt stays reverted.
- Selecting a note opens the editor *beside* Chat, not instead of it.
- ⌘1 Chat only, ⌘2 Chat + Inbox, ⌘3 Chat + Notes. Stored `viewMode` values
  unchanged.
- Rail Chat focuses the conversation (collapses the vault). Rail Notes
  opens both right-hand panels. Graph/Mycelium still take the canvas.

## Settled vs still open

Settled: Chat-as-center map, ⌘1/⌘2/⌘3 meaning, no right-panel exclusivity.
Still open: Wiki Graph / Mycelium as canvas vs panel (#39 / #11 / #22).

GitHub #27/#34 unblocked (the sessions column is the panel). Issues not
closed (no live Prime demo).

## Out of scope

`pnpm l10n:translate` (C18). English strings only. Do not start a plugin
kernel. Do not close GitHub issues without a live check.
