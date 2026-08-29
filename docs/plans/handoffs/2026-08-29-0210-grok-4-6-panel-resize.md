---
session: 2026-08-29T02:17-05:00
model: Grok 4.6 (Cursor)
description: >-
  Notes panel and Mycelium session list are drag-resizable. Compact layout
  stays window-width-only; the overlay Notes panel keeps a handle and the
  persisted width.
commits: 47c36dc
---

# #44 — Notes panel and Mycelium list resize — 2026-08-29

**Origin:** Grok 4.6 (Cursor) · 2026-08-29 · `47c36dc`

Chat sessions (`a26eb40`) and the chat note pane (`fe97f99`) were already
resizable. The remaining #44 surfaces were not.

## What works now

- **Notes panel** (rail Inbox): a 12px trailing handle on the panel itself,
  including compact overlay. Width is the existing `noteList` slot in
  `rhizome:layout-panels` (220–500px). CSS no longer forces overlay width with
  `!important`.
- **Mycelium session list**: same recipe as Chat sessions — `usePanelWidth`,
  224 default, 180–420, stored as `rhizome:mycelium-sessions-width`. Hidden
  when Mycelium is focused on one session.

## Compact decision (the safe path)

`useShellCompactLayout` stays **window-width** only. Dragging a panel does
not enter or leave compact mode. Compact still overlays Notes so Chat keeps
room on a narrow window; the overlay remains resizable.

That is the opposite of “drag below the collapse threshold to overlay.” A
drag changing docking would fight the ResizeObserver and surprise anyone who
only meant to see longer titles.

## Not in this commit

GitHub #44 is still open on the tracker — this tree does not push. Mycelium
still opens as a modal (separate from #44).
