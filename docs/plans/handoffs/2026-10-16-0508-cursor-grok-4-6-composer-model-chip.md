---
session: 2026-10-16T05:08Z
model: Grok 4.6 (Cursor)
description: >-
  Rebuild knispo's Oct 11 native model picker as a composer-row chip
  on current main. No Rust list_ai_model_provider_models command.
commits: this slice
---

# Composer-row native model chip

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Reference branch `backup/mac-provider-models-oct11` is 88 commits
behind main. This slice copies the UI intent only: the native picker
leaves the top of chat and sits on the composer row as a small chip
whose menu opens upward.

Current main already hosted `NativeChatModelPicker` inside
`ChatComposerDeck`, but `AiPanel` only mounted that deck on a Prime
target. Native chat therefore had no composer chip. The foot now
renders when a deck is present or the target is Prime.

Critiquito constraints built in:

- Chip uses `rounded-md` and `CHAT_FOCUS_RING_CLASS`. No primary or
  mint fill next to send.
- Long names truncate at `max-w-[8.5rem]`; full name is `title` on
  the chip and on each menu row.
- Preferred menu side is up; `resolveComposerMenuSide` flips down
  when the chip is near the top. Radix `avoidCollisions` and
  `collisionPadding` keep the menu in the window.
- Keyboard: Enter opens, item Enter/click selects, Escape closes and
  returns focus to the chip.
- Accessible name is `ai.composer.modelNamed` (`Model: {name}`).
  Height stays `h-6 self-center` when the composer grows.

Settings still uses the row variant. Dank.bot's provider-model
command is not in this PR.
