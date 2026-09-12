---
session: 2026-09-12T08:45-05:00
model: Cursor Grok 4.6
description: >-
  Visual pass on /Applications 3a21f9f. Inbox no longer hides Notes. Chat stays
  the canvas. Show Notes strip. Uncommitted. C64 still weak.
---

# UX visual pass — 2026-09-12

**Origin:** Cursor Grok 4.6 · Atticus asked for a visual pass, gap fixes,
then a layout proposal. Do not implement the whole proposal here.

## Live app (Applications `3a21f9f`, pid 66006)

Chat, Inbox/Notes, Research, pinned Sessions, and a note Beside Chat.

Gaps that were real:

1. Closed Notes left a 46px rail that matched Chat. Hard to find.
2. Rail Inbox stole the Chat highlight and hid Notes on a second click.
3. Inbox opened Browse (`all`), so the right column stacked a folder tree on
   the note list.

What already made sense:

- Chat is the center canvas. Composer pills are readable.
- Open note **On top / Beside** lives on the note header, not the traffic
  lights.
- Research replaces Chat (Exit research). Graph stays off Inbox.

## Code (working tree, not Applications)

- Chat stays `aria-pressed` on the Chat canvas.
- Inbox pressed means Notes is open. It does not replace Chat.
- Inbox opens `editor-list` (Browse collapsed). It does not close Notes.
- Restore strip label is **Show Notes**, with a tinted rail.

Tests: `CommandRail.test.tsx`, `VaultPanel.test.tsx`, `App.test.tsx`.

## Still true

C64 first-2s is not proven. This launch was slow, then Chat appeared with
Prime session live. #47 not started.

Rebuild `/Applications` to see the rail fix. Quit first. Delete leftover
`.app` copies after install.
