---
type: ADR
id: "0157"
title: "Canonical Rhizome brand mark: 5-satellite asymmetric geometry, cyber teal-green"
status: superseded
date: 2026-07-18
superseded_by: "0172"
---

> **Superseded for the OS / Dock icon master** by [ADR-0172](0172-dock-icon-signal.md)
> (Signal direction, 2026-09-15). Topology (core + five satellites) is
> affirmed; the grayscale/mint SVG→`tauri icon` path and “identical teal
> OS SVGs” claim here are no longer the shipping Dock source. In-app
> BrandMark reconciliation remains a follow-up.

## Context

`design_handoff_rhizome_brand_shell/README.md` specifies the "3c Network"
brand mark two ways that disagree with each other:

- **Prose**: "one bright core node (center) + five satellite nodes... "
- **The README's own literal code block**, explicitly labeled "SVG source
  (100×100 viewBox, reuse exactly)": four `<path>` links and four satellite
  `<circle>` elements, `stroke-width="9"`.

Two implementers read the same doc at different times and each followed a
different part of it: `src/components/BrandMark.tsx` copied the README's
literal 4-satellite code block; `src-tauri/icons/icon-source.svg` /
`icon-source-dark.svg` (the actually shipped OS icon) followed the prose —
5 satellites (4 diagonal + 1 vertical spoke), stroke-width 7, grayscale
(luminance-mapped from an earlier mint-green palette per the 2026-07-13
recolor commit).

## Decision history (this session)

This ADR went through two rounds before landing:

1. **First pass**: picked the 4-satellite/stroke-9 geometry as canonical
   (matches the README's literal "reuse exactly" block, and required no
   `BrandMark.tsx` changes). Regenerated the OS icon to drop the 5th
   spoke. User sign-off was given for this initially.
2. **User course-correction**: after seeing the actual installed Dock icon
   side by side, the user confirmed the *real* prior icon — 5 satellites,
   asymmetric, grayscale — was the one they deliberately chose (see the
   2026-07-13 "recolor to true grayscale" commit) and is the one they
   actually recognize as "the app's logo." They then asked for a new
   color direction (light core, "sci-fi green" satellites) and flagged
   that `BrandMark.tsx` — small, theme-reactive blue core — doesn't
   visually relate to the OS icon at all.

## Final decision

**Canonical geometry**: 5 satellites, asymmetric (4 diagonal links + 1
vertical spoke straight up from the core) — the mark's original OS-icon
geometry, not the README's 4-satellite code block. Coordinates (100×100
viewBox): core `(50,52)`; satellites `(27,33)`, `(74,30)`, `(30,73)`,
`(71,70)`, `(50,22)`.

**Canonical color** ("cyber teal-green," brand-fixed, never theme-reactive):
- tile: `#0F1B14` (unchanged)
- core: `#E4E7E5` (light gray-white)
- satellite A (smaller nodes): `#1FCFA8`
- satellite B (larger nodes): `#4CEFCB`
- links: `#4A5850`, stroke-width `5` (thinner than either prior version —
  7 or 9 — per explicit "lines too thick, indistinguishable" feedback)

**`BrandMark.tsx` changes from theme-reactive to brand-fixed**: the core no
longer takes `var(--accent-blue)` (which made it render blue in the
default theme, unrelated to the OS icon's green) — all colors are now the
literal hex values above, identical to the OS icon in every theme. Default
size bumped 18px → 26px (was "somewhat indistinguishable" at 18px); sidebar
call site (`SidebarSections.tsx`) and the Linux titlebar lockup
(`LinuxTitlebar.tsx`, 15px → 20px) were bumped to match.

### Scope of the fix

- `src-tauri/icons/icon-source.svg` and `icon-source-dark.svg`: now
  identical (the former grayscale/color split is retired — both use the
  teal-green palette above). `icon-source.svg` is the one that actually
  feeds `npx tauri icon`.
- Every platform icon (`src-tauri/icons/*.png`, `.icns`, `.ico`, iOS/
  Android sets) regenerated via `rsvg-convert` (alpha-preserving, not
  `qlmanage`) → `npx tauri icon`.
- `src/components/BrandMark.tsx`: geometry + colors rewritten, default
  size bumped; `BrandMark.test.tsx` updated to assert 5 links/6 circles
  and brand-fixed hex colors (was 4 links/5 circles + theme-token
  assertions).
- `SidebarSections.tsx`, `LinuxTitlebar.tsx`: mark size bumped at call
  sites.
- Verified live (native `pnpm tauri dev`, real Rhizome Vault): the running
  Dock icon and the in-app sidebar mark both show the corrected geometry
  and color via `cua-driver` zoom screenshots. Note: a `pnpm tauri dev`
  restart alone does **not** re-embed icon changes if no `.rs` source
  file changed (Cargo sees no reason to relink) — `touch src-tauri/build.rs`
  before restarting to force a real rebuild; a fast (<1s) "Finished" log
  line on restart is the tell that the rebuild was skipped.
- `design_handoff_rhizome_brand_shell/README.md`: not modified (external
  handoff artifact) — this ADR is the authoritative record for the app's
  actual mark going forward, superseding both the README's prose and its
  code block.

### Not in scope

Wordmark lockup adoption in the sidebar header (Wave 5.1 — the mark
already lives there via `SidebarTitleBar`, this ADR only changed its
size/color, not whether the full lockup with wordmark is shown), theme-
token drift tests (Wave 5.2), and the icon command rail (Wave 5.3) are
separate, independently-shippable Wave 5 sub-waves.
