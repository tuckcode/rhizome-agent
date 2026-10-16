---
session: 2026-10-16T22:58Z
model: Cursor Grok 4.6
description: >-
  Critiquito design pass on the GitHub Pages landing and Starlight docs:
  hero brand/contrast, sidebar selected state, TOC contrast, IBM Plex Mono,
  nav/docs title/aside/Install list. No app code. No Graphite/Earth token remap.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-16 · docs + landing design pass

One PR off fresh `main` (not #185's branch). Landing and Starlight only.

## Blockers

1. Removed `hero.png` (baked "Chat with Prime. Keep what matters." at ~1.3:1 plus the CSS fade). Hero is HTML; intro copy is `--ink-85` (≥4.5:1 with no fade). `prefers-reduced-motion` skips the fade and the caret blink.
2. Wordmark is "Rhizome" (no AGENT). Slogan "Your work. Your memory." is gone with the image. Glossy 3D molecule dropped; layout holds without a placeholder, so no GitHub issue.
3. Sidebar current page: `--sl-color-gray-6` fill, `--sl-color-text`, 2px accent inset. Not a mint/forest block.

## Also

5. `--sl-font-mono` stays IBM Plex Mono and the font is loaded. Nav labels sentence case at `--ink-60`.
6. TOC, sidebar groups, landing eyebrow use gray-2 / `--ink-kicker` (≥4.5:1). Light TOC checked.
7. Light inline code `#ddd4c0` plus `#857b66` border; code frames `#e6decc` + same border.
8. Nav: Docs is the solid primary; GitHub is a plain link.
9–12. Home title `Docs | Rhizome`, H1 `Rhizome docs`, developer-preview is a Starlight `note` aside, Install list has no terminal periods on fragments.

Did not remap Starlight `--sl-color-*` to Graphite/Earth. Did not edit app
code or `docs/HANDOFF.md`. Did not run `pnpm agent-docs`.

`.husky/pre-push` treats `website/` and `site/` as a Pages-only push: first
PR push diffs against `origin/main`, and the skip path runs `website/build.sh`
instead of `pnpm docs:build` (that script writes `src-tauri/resources/agent-docs`).

Review shots: `docs/review-shots/docs-pass/`.
