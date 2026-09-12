---
session: 2026-09-12T17:05Z
model: Cursor Grok 4.6
description: >-
  Closed Notes restore rail is locked to 46px (same as the collapsed left
  command rail). Default Button padding can no longer grow it.
commits: TBD
---

# Notes restore rail width — 2026-09-12

**Origin:** Cursor Grok 4.6 · Atticus: the Notes sidebar is thicker than the
left side if we meant to match it.

## Done

- `VaultPanelRestoreButton` is a 46px column (`min` / `max` / `width` / flex
  basis) with a 30px icon button, same as `CommandRail` collapsed.
- Keep the **Show Notes** tint and label from the earlier visual pass.

## Not done

- Open Notes column is still 300px (left expanded Sessions is 240). Say so
  if that was the thick bit, not the shut rail.
- C64 / #47 / parked C72 Inbox rename.

## Next session

Rebuild `/Applications` to see this in the daily app. Quit, uninstall, then
install. Do not launch leftovers.
