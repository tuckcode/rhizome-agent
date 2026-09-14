---
session: 2026-09-14T12:30-05:00
model: Grok 4.6 (Cursor)
description: >-
  Astra D5 Dock/site spec only. Signal is Astra's recommendation;
  Atticus has not selected a Dock design. Records BrandMark and
  icon-source conflicts vs ADR-0157 without rewriting that ADR.
  Ivory Dock rasters stay references. No install, no site project.
commits: none
---

# Astra D5 — Dock and site spec — 2026-09-14 12:30

**Origin:** Cursor Grok 4.6 · 2026-09-14 · D5 review only

Did not commit. Did not push. Did not install a Dock icon. Did not
replace `src-tauri/icons/*`. Did not rebuild `/Applications`. Did
not create a website. Did not touch `import_jsonl`, PR #66, or a
second God plan.

`HANDOFF.md` left alone (Wave 5.0 still claims brand-fixed hex;
that stale line is noted in the spec, not edited here).

## Spec

[`docs/design/brand/2026-09-14-handoff/D5-DOCK-AND-SITE.md`](../../design/brand/2026-09-14-handoff/D5-DOCK-AND-SITE.md)

## Conflict vs ADR-0157 (one line)

ADR-0157 requires a brand-fixed teal-green 5-spoke mark at the listed
coordinates with stroke 5; shipped `BrandMark` is theme tokens plus
spread geometry plus stroke 3, and `icon-source.svg` is still grayscale
stroke 7.

## What this session did

Compared `BrandMark.tsx`, `icon-source.svg`, `icon-source-dark.svg`
to ADR-0157. Measured 16/24/32/64/128 from the SVG viewBoxes.
Labeled `dock-signal-concept.png` and `dock-icon-directions.png` as
ivory-background references. Wrote a website arrangement spec from
the gallery rules. This repo still has no marketing site.

## Files touched

- `docs/design/brand/2026-09-14-handoff/D5-DOCK-AND-SITE.md`
- `docs/plans/handoffs/2026-09-14-1230-cursor-grok-4-6-d5-dock-site.md`
