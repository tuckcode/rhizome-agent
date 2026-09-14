---
session: 2026-09-14T12:20-05:00
model: Grok 4.6 (Cursor)
description: >-
  D2 Chat readability. Kept preflight 12px and composer-foot 12px
  plus mt-2. Added long context-pill truncate. Skipped already-fixed
  provider contrast, session-title overflow, and action focus.
commits: none
---

# D2 Chat readability — 2026-09-14 12:20

**Origin:** Cursor Grok 4.6 · Astra D2 only · no commit

Cap is three observed defects. Did not touch rail/Notes geometry,
Enter/Esc, themes, `import_jsonl`, PR #66, `/Applications`, memory-state
badges, Dock, or wallpaper. Did not edit BOARD / HANDOFF / Astra god plan.

## Kept (parent, 2 of 3)

1. **`ChatPreflightBanner.tsx`** — title and body `11px` → `12px`.
   Recovery text. Tests assert copy and order, not font size. No revert.
2. **`ChatComposerFoot.tsx`** — status row `10px` → `12px`,
   `mt-[7px]` → `mt-2`. Idle/working is status. Key chips stay `10px`.
   Tests assert wording, not size. No revert.

## Added (1 of 3)

3. **Long open-note name on the composer context pill clips the strip.**
   Model chip already truncates at 180px. Context pill was `shrink-0`
   with no max width, so a long filename could hide neighboring pills or
   run into the Notes seam. `ChatComposerDeck.tsx` now caps the pill at
   `max-w-full` and truncates the label. Full name stays on `aria-label`
   and `title`. Same cap on the non-menu fallback chip.

## Skipped

- **Provider contrast while scrolling.** `PrimeModelPicker.tsx` already
  uses `text-primary` (`PROVIDER_LABEL_CLASS`). Neighbor test
  `renders provider names in the accent so they scan in a long list`
  already locks that. No restyle.
- **Lost focus on message actions.** `AiMessage.tsx` actions stay visible
  (not `opacity-0`), have `aria-label`s, `ActionTooltip`, and the shared
  Button `focus-visible` ring. Not a current defect.
- **Long session title overflow.** `PrimeSessionList.tsx` already
  `truncate`s the title. Outside this file-ownership slice.

## Tests

`npx vitest run` on the four neighbor files: **20/20 pass**
(`ChatComposerFoot` 4, `ChatPreflightBanner` 5, `ChatComposerDeck` 5,
`ChatComposerDeck.contextPill` 6 including the new truncate case).

No commit. No push.
