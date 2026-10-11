---
session: 2026-10-11T23:58Z
model: Cursor Grok 4.6
description: >-
  PR 1 of Starlight user docs: add site/ (Astro + Starlight, 50 pages),
  regenerate the in-app agent-docs bundle, fix the Portent path in the
  system prompt, and teach ci.yml to treat site/ as docs. No Pages
  deploy. knispo reviews and merges.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · Starlight docs PR 1

## What this is

The first of two Starlight docs PRs. This one adds the docs source and
the regenerated in-app bundle. It does **not** change Pages. PR 2
(`website/build.sh`, `pages.yml`, landing nav) stays later.

Applied `pr1-starlight-site-and-bundle.patch` from a design review
against `main` at `d3b7edf`. `git apply --binary` was clean. Main had
not moved.

## Files

- `site/` — own npm package (`rhizome-docs`). Not in the pnpm
  workspace. Astro 7.3.8 + Starlight 0.42.6. 50 Markdown pages.
- `scripts/build-agent-docs.mjs` — reads `site/src/content/docs`
  again. Frontmatter title/description. Strips `<!-- -->` from the
  bundle.
- `src-tauri/resources/agent-docs/` — regenerated bundle (50 pages).
- `src/utils/ai-agent.ts` + test — Portent path is now
  `pages/guides/structure-with-portent.md`.
- `.github/workflows/ci.yml` — docs filter includes `site/`.
- `.gitignore` — `site/node_modules/`, `site/dist/`, `site/.astro/`.

Did not edit `docs/HANDOFF.md`. Did not apply the PR 2 patch.

## Checks

Recorded after the commit. See the PR body for the live list.

## knispo

Review the facts, the six open comments, Earth contrast, the bundle
diff, and the generator frontmatter parser. Merge when ready. Do not
ask this agent to merge.
