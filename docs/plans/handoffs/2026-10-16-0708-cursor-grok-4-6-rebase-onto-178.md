---
session: 2026-10-16T07:08Z
model: Grok 4.6 (Cursor)
description: >-
  Rebase #175 onto main after #178. Settings row keeps z-[12000] and
  data-settings-panel-portal; composer chip does not.
commits: this slice
---

# Rebase #175 onto #178

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

`#178` (`c56a401`) raised the Settings (row) model menu to `z-[12000]`
and marked it `data-settings-panel-portal="true"` so it paints above
the Settings overlay. This branch kept the composer chip menu from
`#175` and put those two Settings-only attributes back on the
non-chip `DropdownMenuContent`.

Chip menus still omit the marker and the 12000 z-index. Tests cover
both variants. `SettingsPanel` portal test now picks `free_tier_auto`
because keyless catalog groups stay out of the list.
