---
session: 2026-09-14T12:35-05:00
model: Grok 4.6 (Cursor)
description: >-
  Astra D1 About visual. Browser/Vite PASS at 800 and 1280.
  Organic banner full, 1774:887 reserved and rendered 2:1.
  Contribute and Docs visible and keyboard-focusable. Native
  NOT RUN. No commit.
commits: none
---

# Astra D1 — About visual — 2026-09-14 12:35

**Origin:** Cursor Grok 4.6 · Astra D1 leftover · no commit

**Result: PASS** (browser / Vite mock only). Native `/Applications`:
**NOT RUN** (not requested; no `pnpm tauri`).

Did not rebuild. Did not quit Atticus's apps. Did not commit.

## How it was reached

`:5173` was empty. `pnpm dev` came up on **`http://127.0.0.1:5202/`**
(`vite.config.ts` `server.port`, `strictPort: true`). That is this
repo's mock-tauri Vite, not a invented native launch.

Cursor's built-in browser tab would not stay open (create tab →
navigate → "view not found" / empty tab list). Settings was opened
in Playwright Chromium against the same Vite server.

Path: left rail `command-rail-settings` →
`settings-nav-settings-section-about` (`#settings-section-about`).

## What I saw

Source PNG `src/assets/brand/rhizome-organic-hero.png` is the full
organic frame: **rhizome / AGENT / Your work. Your memory. / Chat
with Prime. Keep what matters.** plus the root sculpture on the
right.

| Viewport | Image box | Ratio | Banner | Contribute / Docs |
|---|---|---|---|---|
| 1280 × 900 | 692 × 346 | **2.000** | full words, not cropped | visible, in view after scroll, both buttons took keyboard focus |
| 800 × 900 | 484 × 242 | **2.000** | same full frame, smaller | same; About nav still shown (`md` = 768) |

Reserved attributes and decoded size: **1774 × 887**. `className`
is `h-auto w-full`. Rendered ratio matched 1774/887 exactly at both
widths. `object-fit` was `fill`; because the box stayed 2:1, that
did not clip the baked copy.

The only overflow ancestor is the Settings body scroller
(`overflow-auto`). That is scroll, not a crop through the words.

At 800 the footer line on the artwork is small. It is still the
whole line, not cut mid-word.

Contribute and Docs rows sat under the banner. I did not click
through to the feedback dialog or an external docs URL. Reachable
here means: on screen after a normal scroll, and focusable.

## Not this session

- Native packaged About
- `/Applications` rebuild
- Commit / push
- `HANDOFF.md` edit (parallel writers)
