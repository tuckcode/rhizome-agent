---
session: 2026-10-13-0105
model: Cursor Grok 4.6
description: PR B vault inbox and editor polish (V-W1/2/3/6/7, V-M1/3/5).
---

# Vault inbox and editor polish

**Origin:** Cursor Grok 4.6 · 2026-10-13 · PR B of the G-baby nav/inbox brief

## Done

- V-W1: docked AI side width defaults to 320px (was 420, ~29% of 1440).
- V-W2: empty chat names the agent (`Ask {agent}` / `Ask {agent} about this note`); sparkle removed from the empty state.
- V-W3: one inbox date (Today / `Nd` / calendar); Created duplicate gone.
- V-W6: type icon `right-6` and 24px row padding so it clears the scrollbar.
- V-W7: `extract_snippet` skips `→` / `Asking ` prompt lines.
- V-M1: chip is "Full access" with the existing tooltip.
- V-M3: breadcrumb is folder › title; organized (✓) lives in ⋯.
- V-M5: H1 `text-wrap: balance`.

## Skipped (confirmed)

- V-M2: CommandRail already has `aria-label` + `ActionTooltip`.
- V-M4 / A-M2: Contribute and Docs live in About settings.
- V-W4 / V-W5: color and mono-label theme hold. No Δ glyph remains.

## Held

- Color / contrast. Theme still being decided.
---
