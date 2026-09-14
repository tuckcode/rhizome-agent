# D5 — Dock direction and website arrangement

**Origin:** Cursor Grok 4.6 · 2026-09-14 · Astra D5 review only.
**Status:** spec for review. No Dock install. No platform icon replace. No website project.

This file is the D5 deliverable from `CURSOR-FIVE-HOUR-PLAN.md`. It compares sources that already exist. It does not choose a new identity. It does not supersede [ADR-0157](../../../adr/0157-canonical-brand-mark.md).

Hard nos observed this session: no `.icns`, no `npx tauri icon`, no `/Applications` rebuild, no import, no commit, no second God plan.

---

## 1. Who has chosen what

**Astra recommends Signal:** one core plus five asymmetric satellites (four diagonals and one vertical spoke). That is a continuity recommendation, not a product decision.

**Atticus has not selected a Dock design.** He selected the organic network banner for README and Settings → About. The Dock board (Signal / Rootwork / Thread) remains an identity study.

Until Atticus picks a Dock direction:

- Keep the shipped OS icon sources as they are.
- Do not install `dock-signal-concept.png` or `dock-icon-directions.png`.
- Do not adopt Rootwork or Thread.
- Do not rewrite ADR-0157 as if Signal (or any new geometry/color) were already decided.

---

## 2. Current sources vs ADR-0157

ADR-0157 (2026-07-18, **active**) is still the written decision for the app mark:

- Geometry, 100×100 viewBox: core `(50,52)`; satellites `(27,33)`, `(74,30)`, `(30,73)`, `(71,70)`, `(50,22)`.
- Color, brand-fixed, never theme-reactive: tile `#0F1B14`, core `#E4E7E5`, satellite A `#1FCFA8`, satellite B `#4CEFCB`, links `#4A5850`, stroke `5`.
- `icon-source.svg` and `icon-source-dark.svg` identical, both teal-green; `icon-source.svg` feeds `npx tauri icon`.
- `BrandMark.tsx` uses those same hex values in every theme.

The tree on 2026-09-14 does **not** match that decision. Record the conflicts. Do not treat this section as a new ADR.

### Topology (agreed)

All three current drawings keep the ADR topology: six circles, five straight links, one spoke straight up. That part is not in conflict.

### Geometry conflicts

| Node | ADR-0157 | `icon-source.svg` (100-space inside the 8.2× group) | `BrandMark.tsx` |
|---|---|---|---|
| Core | `(50,52)` r not listed; sources use `12` | `(50,52)` r `12` | `(50,52)` r `12` |
| NW | `(27,33)` | `(27,33)` r `7` | `(20,27)` r `7` |
| NE | `(74,30)` | `(74,30)` r `8` | `(81,23)` r `8` |
| SW | `(30,73)` | `(30,73)` r `6.5` | `(24,79)` r `6.5` |
| SE | `(71,70)` | `(71,70)` r `7.5` | `(77,75)` r `7.5` |
| N | `(50,22)` | circle `(50,22)` r `5`; **path ends `(50,24)`** | `(50,15)` r `5` |

`icon-source.svg` / `icon-source-dark.svg` sit on the ADR satellite points, except the north link is 2 viewBox units short of the north circle.

`BrandMark.tsx` kept the radii and pushed every satellite outward (about 6–7 units). Spoke lengths in 100-space: ADR about 28–33 units; BrandMark about 35–42 units. That is a different drawing, not a scale of the same one.

### Stroke conflicts

- ADR-0157: stroke **5**.
- Both OS SVGs: stroke **7**.
- `BrandMark.tsx`: stroke **3**.

### Color conflicts

ADR-0157 retired the grayscale / mint split and locked cyber teal-green.

`src-tauri/icons/icon-source.svg` (1024×1024, comments still say “grayscale rendering (2026-07-13)”):

- tile `#0F1B14` (matches ADR)
- links `#707070`, core `#C5C5C5`, satellite A `#B2B2B2`, satellite B `#D8D8D8`

`src-tauri/icons/icon-source-dark.svg` (same geometry, “R1 Network Core” mint, not ADR teal-green):

- links `#52796F`, core `#95D5B2`, satellite A `#74C69D`, satellite B `#B7E4C7`

The two OS sources are **not** identical. Neither uses `#E4E7E5` / `#1FCFA8` / `#4CEFCB` / `#4A5850`.

`src/components/BrandMark.tsx` is theme-reactive on purpose in its current comment: core `var(--primary)`, satellites `var(--text-primary)`, links `var(--text-muted)`. Tests in `BrandMark.test.tsx` assert **no hex** and those three tokens. That is the opposite of ADR-0157’s “brand-fixed hex in every theme.”

The file comment gives a later rationale (OS tile has guaranteed contrast; the in-app mark sits on themed chrome). That is an implementation drift, not a superseding ADR. `docs/HANDOFF.md` Wave 5.0 still says BrandMark was rewritten to brand-fixed hex. That living-doc line is stale. Leave ADR-0157 as written.

### Size call sites (informational)

- `BrandMark` default `26` matches the ADR bump.
- `BrandLockup` default mark `18`.
- Sidebar lockup `markSize={20}`; Linux titlebar `markSize={20}`.
- Welcome hero uses `BrandMark size={64}`.

ADR also mentioned a sidebar bump and Linux 15→20. Those call-site sizes are not the geometry/color conflict.

### One-line conflict

ADR-0157 requires a brand-fixed teal-green 5-spoke mark at the listed coordinates with stroke 5; shipped `BrandMark` is theme tokens plus spread geometry plus stroke 3, and `icon-source.svg` is still grayscale stroke 7.

---

## 3. Generated Dock rasters are references, not masters

| File | Size | Role |
|---|---|---|
| [`docs/design/brand/2026-09-13/dock-icon-directions.png`](../2026-09-13/dock-icon-directions.png) | 1536×1024, opaque RGB | Three-up board: Signal, Rootwork, Thread, each with large + two small tiles |
| [`docs/design/brand/2026-09-13/dock-signal-concept.png`](../2026-09-13/dock-signal-concept.png) | 1254×1254, opaque RGB | Standalone Signal tile on an ivory field |

Both are ivory-background presentations. Neither has an alpha channel. The ivory is **outside** the evergreen squircle. Cropping the ivory does not create a transparent macOS icon.

Do not feed these PNGs to `npx tauri icon`. Do not replace `src-tauri/icons/*`. Derive a future native set only from an approved **vector** after Atticus selects a direction.

**Signal** (left column / standalone): same six-node family as ADR-0157. Larger core, more air between nodes, thinner links, ceramic relief on a deep evergreen tile. Continuity study.

**Rootwork** (center): branching letterform. Larger identity change.

**Thread** (right): ribbon / leaf “R”. Letter recognition still weak in the study. Larger identity change.

Astra’s recommendation is Signal only. Rootwork and Thread stay in the identity gallery.

---

## 4. Small-size review (16 / 24 / 32 / 64 / 128)

No new `.icns`. These are measurements from the current SVG viewBoxes.

Scale rules:

- `BrandMark` viewBox `0 0 100 100`. One viewBox unit = `size / 100` CSS pixels.
- OS sources: canvas `1024×1024`, mark `translate(102 102) scale(8.2)` so the 100-space mark is 820 units with a 102-unit inset. One 100-space unit = `size × 8.2 / 1024` pixels.

### `BrandMark.tsx` (stroke 3, spread satellites)

| Display | Unit | Stroke 3 | Core Ø | North Ø | North disk top → viewBox top |
|---|---|---|---|---|---|
| 16 | 0.160px | **0.48px** | 3.84px | 1.60px | 1.60px |
| 24 | 0.240px | 0.72px | 5.76px | 2.40px | 2.40px |
| 32 | 0.320px | 0.96px | 7.68px | 3.20px | 3.20px |
| 64 | 0.640px | 1.92px | 15.36px | 6.40px | 6.40px |
| 128 | 1.280px | 3.84px | 30.72px | 12.80px | 12.80px |

If this same viewBox used ADR stroke 5: 0.80 / 1.20 / 1.60 / 3.20 / 6.40 px.

Node bbox in 100-space is about `x 13–89`, `y 10–85.5`. The north satellite (`r=5` at `y=15`) sits closer to the crop than ADR’s north node at `y=22`.

### `icon-source.svg` (stroke 7, ADR-ish points, 102px inset)

| Display | Stroke 7 | Core Ø | North Ø | Tile corner `rx` | Mark inset |
|---|---|---|---|---|---|
| 16 | 0.90px | 3.08px | **1.28px** | 3.59px | 1.59px |
| 24 | 1.35px | 4.61px | 1.92px | 5.39px | 2.39px |
| 32 | 1.79px | 6.15px | 2.56px | 7.19px | 3.19px |
| 64 | 3.59px | 12.30px | 5.13px | 14.38px | 6.38px |
| 128 | 7.18px | 24.60px | 10.25px | 28.75px | 12.75px |

### Readability notes (review only)

- **16px:** both drawings go sub-pixel. BrandMark stroke 3 is 0.48px; the OS north node is 1.28px across. Expect a soft blob, not five distinct satellites.
- **24px:** nodes start to separate. Stroke is still under 1.4px. Fine links will disappear on a 1x Dock or favicon.
- **32px:** BrandMark core is readable (~8px). North node ~3px. This is the smallest size where the six-node story is plausible on a sharp display.
- **64px:** current app Welcome size. Geometry reads. Theme tokens will still recolor the in-app mark away from the OS tile.
- **128px:** both drawings are clear. Conflicts (spread vs packed, gray vs teal, stroke 3 vs 7 vs 5) are obvious here.

Signal’s extra spacing helps 64–128 and hurts 16 unless a later optical-size drawing fattens the north node and stroke. Do not invent that drawing until a Dock direction is selected.

A later vector study may try ADR points with stroke 5, or Signal-like spacing with a 16px optical cut. That is post-choice work. Not this file’s job.

---

## 5. Website arrangement

This repository has **no marketing site**. Do not create one here. The following is a composition spec for a future site elsewhere.

Rules come from [`ASSET-GALLERY.md`](ASSET-GALLERY.md) and [`docs/design/brand/2026-09-13/README.md`](../2026-09-13/README.md).

### Surfaces

**Header.** Use either the dark lockup (`logo-lockup-dark.png`, 2172×724, solid evergreen) **or** a live `rhizome` wordmark plus a small six-node mark. Never both. Never put the lockup next to another wordmark.

**Hero.** Organic banner (`src/assets/brand/rhizome-organic-hero.png`, 1774×887). Full frame. Live page title and lede as real HTML text. The PNG already bakes “Rhizome Agent: Your work. Your memory.” — do not crop through those words. At narrow widths, show the whole image or a separately prepared art-only crop with live text.

**Favicon / app-tile on the site.** Not the ivory Dock rasters. Not the three-up board. Until Atticus selects a Dock vector, a site favicon should follow the current six-node mark or stay a simple type mark. Do not ship Rootwork or Thread as the public icon.

**Developer / docs strip (optional).** Dither banner as a documentation header. Real copyable ASCII from `rhizome-ascii.txt`, not the ASCII PNG (that PNG is not selectable text). Keep dither off Chat, status, and dense controls — that rule is for the app; on a marketing site, keep dither off the primary hero and any status-looking chrome.

**Memory / editorial (optional, below the fold).** `hero-memory-archive.png` as an illustration of retained work. Caption it as a concept. Do not present proposed memory states from [`MEMORY-DIRECTION.md`](MEMORY-DIRECTION.md) as shipped product.

**Identity appendix (design notes only, not the homepage hero).** `dock-icon-directions.png` and `dock-signal-concept.png`, labeled as unselected studies. Signal = Astra recommendation. Atticus has not chosen.

### Do not

- Stand up a site project in this repo.
- Put all seven artworks on the homepage.
- Recolor artwork with CSS filters.
- Fake transparency or show a checkerboard.
- Use Dock rasters as icon masters.
- Imply Nous affiliation; dither is Rhizome’s own mark in a terminal-like texture.

All seven PNGs are opaque RGB. Plan opaque placements or a later true-alpha derivative after a vector exists.

### Suggested page order (future site)

1. Header (one lockup path).
2. Organic hero + live heading.
3. Short product copy (Chat, vault, Prime as engine). No extra logos.
4. Optional developer strip (dither + real ASCII).
5. Optional memory editorial (archive art, concept caption).
6. Footer. Identity studies stay off this path unless the page is explicitly a design note.

---

## 6. Reviewable next steps (after Atticus chooses)

Do now (this spec): nothing to install.

After a Dock choice:

1. If **keep current OS icon:** leave rasters as gallery only; open a follow-up to reconcile `BrandMark` / OS SVG / ADR-0157 (same decision or a new ADR that supersedes 0157). Do not silently edit 0157.
2. If **Signal:** new ADR with the approved vector, then one source SVG, then platform icons from that source. Ivory PNGs stay references.
3. If **Rootwork or Thread:** treat as a new identity, not a tweak to 0157.
4. Website: implement the arrangement above in whatever site repo exists then. Not here.

D5 acceptance: this file plus the session handoff. No native icon change. No site scaffold.
