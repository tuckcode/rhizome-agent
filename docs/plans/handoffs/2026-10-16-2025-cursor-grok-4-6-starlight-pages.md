---
session: 2026-10-16T20:25Z
model: Cursor Grok 4.6
description: >-
  GitHub Pages now builds site/ (Starlight) into /docs alongside the
  website/ landing page at the root. Astro base stays /rhizome-agent/docs.
  No app code.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-16 · Starlight on GitHub Pages

## What this is

PR 2 of the Starlight user docs (PR 1 was #156 / #162). Pages used to
run only `website/build.sh` for the landing page, so
https://tuckcode.github.io/rhizome-agent/docs/ was not Starlight.

## Files

- `website/build.sh` — still copies the landing page to the artifact
  root; also `npm ci && npm run build` in `site/` and copies `dist/`
  to `_site/docs/`. Then runs `website/check-pages-artifact.mjs`.
- `website/check-pages-artifact.mjs` — landing at `/`, Starlight at
  `/docs`, asset and page URLs under `/rhizome-agent/docs/`.
- `.github/workflows/pages.yml` — Node 22, `site/**` path filter.
- `.github/workflows/release.yml` — same `website/build.sh` so a
  release deploy does not wipe `/docs`.
- `website/index.html` — Docs nav/footer, Getting started →
  `docs/start/install/`.
- `.github/workflows/README.md` — Pages now ships Starlight.

Did not edit `docs/HANDOFF.md`. Did not change app code.
`site/astro.config.mjs` already had `site: 'https://tuckcode.github.io'`
and `base: '/rhizome-agent/docs'`.
