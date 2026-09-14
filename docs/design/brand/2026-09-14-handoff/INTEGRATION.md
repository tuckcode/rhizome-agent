# Astra handoff — integrated into the five-hour burn

**Origin:** Cursor Grok 4.6 · 2026-09-14 · D0.
**Source zip:** `/Users/dtc/Documents/Codex/2026-09-13/you-are-astra-write-the-god/outputs/rhizome-design-cursor-handoff.zip`

This folder is Astra’s planning/design pack **as received**. Cursor implements.
It does **not** replace `docs/plans/s-plans/2026-09-14-five-hour-burn.md`.

## Path map (do not duplicate 9MB of PNGs)

Checksums match `ASSET-MANIFEST.json` against files already in the tree:

| Zip path | Repo path |
|---|---|
| `assets/hero-organic-network.png` | `src/assets/brand/rhizome-organic-hero.png` |
| `assets/banner-dither.png` | `../2026-09-13/banner-dither.png` |
| `assets/banner-ascii.png` | `../2026-09-13/banner-ascii.png` |
| `assets/rhizome-ascii.txt` | `../2026-09-13/rhizome-ascii.txt` |
| `assets/logo-lockup-dark.png` | `../2026-09-13/logo-lockup-dark.png` |
| `assets/hero-memory-archive.png` | `../2026-09-13/hero-memory-archive.png` |
| `assets/dock-icon-directions.png` | `../2026-09-13/dock-icon-directions.png` |
| `assets/dock-signal-concept.png` | `../2026-09-13/dock-signal-concept.png` |

Gallery prose that Cursor already wrote stays in
[`../2026-09-13/README.md`](../2026-09-13/README.md). Do not overwrite it.

## Slice status (2026-09-14 ~11:55)

| Slice | Status |
|---|---|
| D0 | **Done** — this file + five-hour plan update |
| D1 | **Done (browser)** — About PASS at 800 and 1280 on Vite `:5202`. Native **NOT RUN**. [1235](../../../plans/handoffs/2026-09-14-1235-cursor-grok-4-6-d1-about-visual.md) |
| D2 | **Done** — code [1220](../../../plans/handoffs/2026-09-14-1220-cursor-grok-4-6-d2-readability.md). Vite visual **PASS** [1240](../../../plans/handoffs/2026-09-14-1240-cursor-grok-4-6-d2-visual.md). Working/preflight not shown in mock. Native **NOT RUN** |
| D3 | **Done (presentation)** — queue + preflight 12px. Mid-turn fail still has no banner (W4). [1225](../../../plans/handoffs/2026-09-14-1225-cursor-grok-4-6-d3-status.md) |
| D4 | **Done (docs)** — gallery links point at existing files. Memory-loop says archive art is concept only. [1221](../../../plans/handoffs/2026-09-14-1221-cursor-grok-4-6-d4-gallery.md) |
| D5 | **Done (spec)** — Signal is Astra’s rec only. ADR-0157 vs shipped BrandMark conflict recorded. [D5-DOCK-AND-SITE.md](D5-DOCK-AND-SITE.md) |
| D6 | Final 45 minutes. No push unless asked. No Applications rebuild |

## Owners (do not collide)

- W7 HOME/MCP Rust: already committed `4416411`. Extra tests only. Do not restyle.
- C72 labels / KEEP living docs: already in the dirty tree. Do not revert.
- Astra design docs in this folder: read-only after D0 except Origin stamps.
