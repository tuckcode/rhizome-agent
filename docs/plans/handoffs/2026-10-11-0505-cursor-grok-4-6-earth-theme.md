---
session: 2026-10-11T05:05Z
model: Cursor Grok 4.6
description: >-
  Item 2 of the UI/UX plan: Earth dark and Earth light become the
  default rhizome contract; Loam is an optional warm-dark theme.
  Contrast tokens from B1–B5 stay at 4.5:1 on the new surfaces.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · Earth theme

## What landed

App token work only. No navigation, graph, Rust, or key-store edits.
Stacked on the a11y B1–B5 branch (`cursor/a11y-chat-b1-b5-8b31`).

1. `src/index.css` light and dark contracts take the Earth values from
   `docs/design/earth-theme/HANDOFF.md` / `colors_and_type.css`.
2. `--border-input` is now at least 3:1 (`#857B66` light, `#75705C` dark,
   `#7E6F59` Loam).
3. `--ok-text` / `--danger-text` / `--warn-text` stay and point at Earth
   status colors. Feedback text aliases still resolve through them.
4. Loam is in `scripts/generate-themes-css.mjs` as an exact theme, then
   regenerated into `src/themes.css`. `COLOR_THEMES` adds the Loam chip.
5. `--muted` on `--state-selected-strong` is in `contrast_check.py` and
   stays ≥ 4.5:1 (Earth dark 5.15, Earth light 5.18, Loam 5.21). #142's
   mycelium pair was 4.08 / 4.29.
6. Focus ring is `--state-focus-ring`, aliased to `var(--accent-blue)`
   (design-system `var(--accent)`), 2px, never a hard-coded hex.
   `--focus-ring on --bg` is in `contrast_check.py` and stays ≥ 3:1
   (Earth dark 11.91, Earth light 5.44, Loam 11.79).
7. Rebased onto #142 `0adab44`. Earth muted/faint/tertiary stay on the
   paper/forest ladder and still meet 4.5:1 on `--state-selected-strong`.

## Checks

- `python3 docs/design/earth-theme/contrast_check.py docs/design/earth-theme/colors_and_type.css`
- Focused vitest: Earth tokens, chat contrast, themeMode, index.theme
- Localization: none — English only (C18)
- PostHog: no event needed because this is a palette swap, not a new action
