---
session: 2026-10-16T20:05Z
model: Grok 4.6 (Cursor)
description: >-
  Retire PrimeModelPicker. NativeChatModelPicker covers Prime chats.
  Eight composer-chip nits from #175.
commits: this slice
---

# Retire PrimeModelPicker

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Rhizome runs its own engine. Prime stays optional. The composer chip is
always `NativeChatModelPicker`. `PrimeThinkingToggle` still sits next to
it on a Prime chat.

Deleted `PrimeModelPicker.tsx` and its tests. ChatHome mounts the deck
when `isPrimeChat && (showPrimeChrome || rhizomeCatalog)`. AiPanel
mounts the bar when `isPrimeTarget || (defaultAiAgent === 'prime' &&
chatEngine === 'native')`. Claude Code and Codex never get the chip,
even on native, so the footer is not an empty row.

Nits folded in:

1. `{n} provider(s) need a key` is pluralized and localized; Open settings
   is its own `text-foreground` button with underline-on-hover and a focus
   ring.
2. The current pick stays in the list when that provider has no key.
3. Deck and bar gates line up on Prime only, as above.
4. Footer Open settings is a real button.
5. Graphite `--state-menu-hover` is `#6C6B6A` (≥3:1 on the popover).
6. Truncated row labels keep `title` with the full model id.
7. Separators use `--border-subtle` in light and dark.
8. Composer column is `bg-background`; the box no longer uses `shadow-xs`.

Screenshots from the mock app (app CSS) are in
`docs/screenshots/pr-183/`: Graphite dark menu with a hovered row, Earth
light the same, and a Prime chat on the native chip.

Did not edit `HANDOFF.md`.
