---
session: 2026-10-11T17:30Z
model: Cursor Grok 4.6
description: >-
  Follow-up on #154: leftover Earth dark mint copies in index.html,
  Mycelium skin, and companion fallback. Loam and themeMode swatches
  stay #6FE3A0. Rebased onto main after #153 merged; DESIGN.md
  kept #153 shipped-app facts and this PR's brighter mint.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · Earth dark mint leftovers

Ricky / Critiquito on #154: first paint and Mycelium still used
`#6FE3A0`. Updated:

- `index.html` `:root` and `[data-theme="dark"]` `--primary` → `#7DF0AE`
- `src-tauri/src/mycelium_skin.rs` dark `--moss` / `--act-verify` →
  `#7DF0AE`, `--moon` → `#9AF5C2`
- `src/components/MenuBarCompanionApp.tsx` focus-ring fallback →
  `rgba(125,240,174,0.14)`

Left alone (listed, not Earth-dark accent paint):

- Loam in `themeMode.ts`, `themes.css`, generator, and `index.html`
  `[data-color-theme="loam"]`
- Earth light
- syntax / diff mint in `index.css`
- Earth dark `--info` in `docs/design/earth-theme/colors_and_type.css`
- Historical critiques / website hero-mock

#153 merged as `5f4911d`. Rebase onto `origin/main` was clean: DESIGN.md
kept #153's shipped-app facts (Plex mono, radii, 3px ring, live region,
six-node mark) and this PR's Earth dark accent `#7DF0AE` / `#9AF5C2`.
