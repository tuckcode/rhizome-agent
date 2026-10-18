---
session: 2026-10-17T00:45Z
model: Cursor Grok 4.6
description: >-
  Brand sweep: drop the README hero image, match the About line on
  README / landing / Starlight, and replace living-doc "Rhizome Agent"
  product-name uses. GitHub About needs a paste. No app code. No ADRs.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · brand framing sweep

One PR off current `origin/main` (includes #187). Docs, landing, and
Starlight only. `src/` TypeScript and Rust were not edited. ADR bodies
were not edited. Dated plans, critiques, and session handoffs were left
as historical records.

## About

`gh repo edit` returned HTTP 403. The exact About line is in the PR body
under **About text for knispo to paste**. No `about-box.png`.

## Kept

- Factual Prime-default and `./install.sh` fetches Prime lines.
- Bundle and executable names (`Rhizome Agent.app`, `RhizomeAgent`,
  `ai.rhizome.agent`).
- The PNG `src/assets/brand/rhizome-organic-hero.png` (Settings About and
  Pages `og.png` still use it).
