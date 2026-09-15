---
type: ADR
id: "0172"
title: "Dock / OS app icon: Astra Signal direction"
status: active
date: 2026-09-15
supersedes: "0157"
---

## Context

Astra’s 2026-09-13 identity board offered three Dock directions: **Signal**,
**Rootwork**, and **Thread**. Spec D5 kept them as proposals until Atticus
chose. On 2026-09-15 Atticus selected the **far-left** board column — Signal —
and asked to replace the shipped OS icon with that render. Signal keeps the
same six-node / five-spoke family as ADR-0157, with more air, ceramic depth,
and mint-on-evergreen color from the concept raster.

ADR-0157 remains the written decision for **in-app** mark intent (geometry
coordinates and brand-fixed teal-green hex). This ADR decides only the
**native Dock / window / installer icon** master.

## Decision

1. **Dock direction = Signal** (board column 01). Rootwork and Thread stay
   gallery-only. The concept PNG is a color/mood reference, not the master.
2. **Platform icon master** is vector → PNG:
   `icon-source.svg` uses the **original OS node geometry** (ADR-0157
   coordinates, `translate(102) scale(8.2)`, original radii) with the
   **Signal / teal-green palette** (tile `#0F1B14`, core `#E4E7E5`,
   satellites `#1FCFA8` / `#4CEFCB`, links `#4A5850`, stroke 5). Full-bleed
   opaque tile (no transparent margin) so Dock does not show an ivory/white
   fringe. Rasterize with `rsvg-convert`, then
   `pnpm tauri icon src-tauri/icons/icon-source.png`, then refresh
   `512x512.png` / `512x512-dark.png` / `256x256.png` from that master
   (Tauri’s icon CLI does not write those three; `app_icon.rs` embeds the
   512 pair).
3. **Do not** feed ivory presentation boards into `tauri icon`.
4. **In-app `BrandMark.tsx`** is unchanged by this ADR. Reconcile BrandMark
   later if product wants one drawing everywhere.

## Consequences

- Installed `/Applications` Dock icon changes only after a **rebuild** that
  embeds the new `icon.icns`.
- ADR-0157 is **superseded for the OS icon palette/master** (grayscale /
  mint SVG→icns path). Its topology (core + five satellites) is affirmed.
- A future true vector Signal master can replace the raster without changing
  the product decision (still Signal).
