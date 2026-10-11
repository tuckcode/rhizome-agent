---
session: 2026-10-11T11:15Z
model: Cursor Grok 4.6
description: >-
  Pages stopped because pages.yml path filters never matched after
  2026-09-27. Landing and user docs now match shipped Rhizome (own
  engine, Earth, Views 1–4, keychain). No app code.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · Pages and user docs

## Why Pages stopped

`.github/workflows/pages.yml` runs on `push` to `main` only when
`website/**`, `docs/assets/**`, `src/assets/brand/rhizome-organic-hero.png`,
or the workflow file change. Last success: 2026-09-27 11:36 UTC on
`8ed9817`. Later main commits did not touch those paths, so GitHub
queued no run. The repo is public. Pages is `build_type: workflow`.
The last run succeeded. This is not a disabled workflow and not a
Pages setting.

A merge that touches `website/` deploys. If a run does not appear,
Actions → Landing page → Run workflow.

## Verified on main, then written

- Native engine exists and sends without Prime. Settings still default
  Chat to Prime until **Chat engine** is switched.
- Hermes is not in `PRODUCT_AI_AGENT_DEFINITIONS`. Not a usable engine.
- Free-tier UI label is **Free tier (auto)**. Taproot is not on main.
- Earth dark default, Earth light, Loam, Match system.
- Views: Research, Graph, Mycelium, History. Ctrl+Cmd+1–4 /
  Ctrl+Shift+1–4. Changes next to Notes. Not 1–5.
- Native loop tool that writes a note is `create_note`. No agent
  vault search or Mycelium-session search.
- Provider keys: OS keychain (ADR-0185). Legacy JSON migrates.

## Files

`website/index.html`, `website` workflow comment, `README.md`,
`docs/start/README.md`, `docs/PUBLIC-PREVIEW.md`,
`docs/GETTING-STARTED.md`, `docs/for-agents/README.md`,
`src/lib/leftover-website-copy.test.ts`. Did not edit `HANDOFF.md`.
Did not change app code.

## knispo

Merge. No Pages click required. After merge, confirm the Landing page
workflow runs. If it does not, Run workflow.
