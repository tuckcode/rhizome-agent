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
renders only when the target is Prime or the engine is native, so
Claude Code and Codex do not get Prime's chip.

The chip still writes the global `native_chat_target`. A running
native session keeps its start model, so the chip menu has a muted
line: "Applies to new chats". Settings keeps the row label `Model`
(`ai.composer.modelLabel`), not the unknown-model fallback.

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

## Collapsed composer height

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

knispo's single-line composer was taller than the 30px send
control, with extra empty space above the button and more padding
on top than on the right or bottom.

Root cause is not the deck and not a textarea `rows` value. The
deck / `ChatComposerBar` sits under the box (`{foot}`). The editor
is contenteditable. The leftover height is the shared wikilink
field's `min-h-[34px] py-[8px]`. Compact overrides (`min-h-0`,
`py-1`) used to apply only when Prime banners set `hasControls`,
so native chat kept the taller field. The outer box also used
`px-1.5 py-0.5` — 6px sides, 2px top/bottom.

The box is now always `p-1 items-center` with
`data-testid="chat-composer-box"`. The editor always uses
`min-h-[30px] py-1 leading-5 border-0` and still grows to
`max-h-[120px]`. Test: `AiPanelChrome.composerBox.test.tsx`.

Review follow-up: the chip menu "Applies to new chats" line is
`text-[12px] text-muted-foreground`. The empty placeholder uses
`p-1` on the same 4px grid. `data-multiline` comes from
`composerIsMultiline` (`scrollHeight` vs the 30px single-line
floor), so a wrapped line without `\n` counts. The always-on
composer border stays.
