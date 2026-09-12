---
session: 2026-09-12T17:05Z
model: Cursor Grok 4.6
description: >-
  Right Notes mirrors the left Sessions rail: 240px open, 46px shut, same
  sidebar color (no tinted Show Notes strip). Old stored 300px remaps to 240.
commits: TBD
---

# Notes rail mirrors the left side — 2026-09-12

**Origin:** Cursor Grok 4.6 · Atticus: Notes on the right is too wide; make
it a mirror of the left, not a different color.

## Done

- Open Notes default is **240px**, same as the expanded Sessions rail
  (`COMMAND_RAIL_EXPANDED_WIDTH_PX`). Stored **300px** (the old default)
  remaps to 240. A drag to another width still wins.
- Shut Notes rail stays **46px**, same sidebar surface as the left rail.
  The blue-tinted Show Notes strip is gone. Label stays **Show Notes**.

## Not done

- C64 / #47 / parked C72 Inbox rename.

## Next session

Rebuild `/Applications` to see this in the daily app. Quit, uninstall, then
install. Do not launch leftovers.
