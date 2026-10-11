---
session: 2026-10-11T05:45Z
model: Grok 4.6
description: >-
  knispo shortcut call on #143: Mac Ctrl+Cmd+1-5, Windows/Linux Ctrl+Shift+1-5.
  Native menu platform accelerators. Option+Cmd left to BlockNote headings.
commits: cursor/navigation-grouping-d32a
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 05:45 UTC

## What landed

knispo called the Mac combo for [#143](https://github.com/tuckcode/rhizome-agent/pull/143).
Same branch. Did not touch `AiPanelChrome.tsx` or ADR-0171.

- `MAC_VIEW_SHORTCUT_POLICY` is now Ctrl+Cmd (`command-and-ctrl`).
  Windows/Linux stay Ctrl+Shift. Ctrl+Alt+digit and Option+Cmd+digit
  return null so they do not steal the chord.
- Manifest accelerators are platform objects: Mac `Ctrl+Cmd+N`,
  default `Ctrl+Shift+N`. No `CmdOrCtrl+Alt` left.
- Rust `menu.rs` resolves `PlatformAccelerator` per OS so the native
  menu matches.
- Clash check: Chat/Notes/Workbench/Read stay `CmdOrCtrl+1–4`.
  BlockNote headings stay `Mod-Alt-N` (Option+Cmd). Ctrl+Cmd+digit
  is unused there.
- Test: Option+Cmd+1 inside the note editor is not `preventDefault`ed
  by the view shortcuts.

## Hold

None on the shortcut policy. A-W8 / A-M1 / A-M3 / A-M4 still open.
