---
session: 2026-10-16T06:25Z
model: Grok 4.6 (Cursor)
description: >-
  Critiquito review of be4d983: menu above the composer box, pinned
  filter, no chip on external agents, display names, keyless footer.
commits: this slice
---

# Composer chip menu review (be4d983)

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Ten review items on draft PR #175:

1. Chip menu `side=top` with `sideOffset` = trigger.top − composer-box.top + 8, so the panel clears the input. `max-h-[min(24rem,var(--radix-popover-content-available-height))]`; the list scrolls.
2. Filter is pinned above the scrolling list (`border-b`, autofocus, `Filter models`).
3. `ChatHome` mounts the deck only when `isPrimeChat && (showPrimeChrome || rhizomeCatalog)`. Claude Code, Codex, and other external agents get no chip.
4. Chip shows the model display name or id, middle-ellipsized. Tooltip and accessible name are `Model: {provider} · {id}`.
5. Hover and keyboard highlight are `bg-accent text-accent-foreground`. The selected row shows only the check.
6. Providers with no key are omitted. Footer: `{n} providers need a key · Open settings`, then `Applies to new chats`. The button opens Settings → Providers.
7. Rows use display names (`Free tier (auto)`), falling back to the id.
8. One separator: `my-1 h-px w-full bg-border`.
9. Earth light muted-on-popover is already ≥4.5:1 (`#625A4D` on `#FCFAF6`). Locked in `chatThemeContrast.test.ts`.
10. Menu stays `w-[18rem]`; row `title` is the full model id.

Portal stays on `document.body`.
