---
session: 2026-10-11T06:15Z
model: Cursor Grok 4.6
description: >-
  Follow-up nits on #144: splash/startup/Mycelium/sheet greens move to
  Earth; Loam first-paint uses #15110C; Loam faint and input border
  gain margin; Earth dark comment reaches 4.5:1 on selected rows.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · Earth theme nits

## What landed

Stacked on `cursor/earth-theme-9eab` (#144). #144 stays as approved.
Do not retarget until #144 merges.

1. Splash card, `index.html` startup accents, Mycelium window skin,
   and sheet wikilink green use Earth surfaces and `#2C6A4D` /
   `#2c6a4d` / `#3D6A1E`.
2. Loam first paint sets `#15110C` on `[data-color-theme="loam"]`,
   so relaunch does not flash Earth dark `#0F110C`.
3. Loam `--text-faint` / `--muted-2` is `#998D74` (dimmer than muted
   `#A3987F`, 4.548 on `--state-selected-strong`).
4. Loam `--border-input` is `#8A7A62` (3.573 on selected-strong).
5. Earth dark `--syntax-highlight-comment` is `#88917B` (4.617 on
   selected-strong).
6. `contrast_check.py` and its tests are unchanged.
7. knispo: fresh installs start in Earth dark (`DEFAULT_THEME_MODE`
   and the `index.html` fallback). Saved light/system stays.
8. Settings → Appearance already had a system option. The control
   is now **Match system**, and it still follows
   `prefers-color-scheme` live for Earth light/dark. Loam still
   pins dark.

## Contrast (from `contrast_check.py` plus the comment pair)

- Loam faint on selected-strong: 4.55
- Loam `--border-input` on bg / surface / surface-3 / selected-strong:
  4.51 / 4.23 / 3.68 / 3.57
- Earth dark comment on selected-strong: 4.617
- muted-on-selected-strong still 5.15 / 5.18 / 5.21
- focus-ring-on-bg still 11.91 / 5.44 / 11.79

## Checks

- Focused vitest: BootSplash, bootAppearance, earthThemeTokens, SheetEditor
- `cargo test mycelium_skin`
- `python3 docs/design/earth-theme/contrast_check.py docs/design/earth-theme/colors_and_type.css`
- Localization: none — English only (C18)
- PostHog: no event needed because this is a palette nit, not a new action
