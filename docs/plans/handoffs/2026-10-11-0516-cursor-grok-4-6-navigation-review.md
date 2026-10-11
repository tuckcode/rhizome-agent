---
session: 2026-10-11T05:16Z
model: Grok 4.6
description: >-
  Ricky review on #143: rail aria-current + Changes count + aria-keyshortcuts,
  classic Graph/Mycelium buttons, Win/Linux Ctrl+Shift (no Ctrl+Alt+digit).
  Mac Option+Cmd held; swap MAC_VIEW_SHORTCUT_POLICY when knispo calls it.
commits: cursor/navigation-grouping-d32a
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 05:16 UTC

## What landed

Follow-up on [#143](https://github.com/tuckcode/rhizome-agent/pull/143). Same
branch. Did not touch `AiPanelChrome.tsx` (#142 still open) or ADR-0171.

- Rail Views use `aria-current="page"`, put the Changes count in the button
  name (`Changes, 4`), and expose `aria-keyshortcuts`.
- Classic shell (`ff_shell_command_rail=false`) shows Graph and Mycelium next
  to Research on the status bar.
- `src/lib/railViewShortcuts.ts` is the swap point. Mac stays Option+Cmd.
  Windows/Linux renderer uses Ctrl+Shift+1–5 and rejects Ctrl+Alt+digit
  (AltGr). Native Win menu still inherits `CmdOrCtrl+Alt` from the JSON
  until knispo's Mac call allows a Rust/manifest change.

## Hold

knispo is choosing the Mac combo (BlockNote H1–H5 collision). Do not change
`MAC_VIEW_SHORTCUT_POLICY` until he calls it.
