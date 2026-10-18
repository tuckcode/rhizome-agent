---
session: 2026-10-16T23:48Z
model: Grok 4.6 (Cursor)
description: >-
  Cap the native chip model list, pin filter/footer, and land the
  design-review follow-ups (offline label, muted Loading, cache reset).
commits: this slice
---

# Chip menu review follow-up

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

The live-list menu grew past its max-height. The list is now
`max-h-[min(60vh,420px)]` with `overflow-y-auto`. Filter and footer stay
pinned. The selected row scrolls into view on open.

Failed live lists show `offline, showing saved list` next to the group
heading. `Loading…` uses `text-muted-foreground`. Open settings is a
primary link. Empty filter gets Clear filter. Section dividers use
`--border-input` so Earth light stays at 3:1 on the popover. The session
cache clears when a key is saved or deleted, or when the provider list
changes. Live-only rows use an API display name when the host sends one.
Providers with no seed models still get a heading.
