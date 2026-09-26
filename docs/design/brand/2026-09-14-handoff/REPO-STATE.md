# Repository state and evidence boundary

**Observed:** September 14, 2026, approximately 11:40 CT.
**Repository:** `~/code/projects/rhizome-agent`.
**HEAD at observation:** `4416411`.
Cursor was actively editing source and documentation. This is a moving snapshot.

## Already present

- `e64a283` includes the earlier Astra banner integration and design gallery.
- `README.md` uses `src/assets/brand/rhizome-organic-hero.png` as the lead image.
- `src/components/AboutSettingsSection.tsx` imports that same PNG with intrinsic dimensions, lazy loading, and asynchronous decoding.
- Existing Contribute and Docs actions remain below the image.
- `docs/design/brand/2026-09-13/` contains the supporting art, prompts, gallery, and real ASCII file.

These source facts do not prove push status, native appearance, or installation.
Astra stopped implementation when Atticus assigned implementation exclusively to Cursor.
This new handoff writes only planning/design artifacts in the Codex output folder.

## Prior checks, before the overnight Cursor changes

The prior session recorded passing ESLint for About, `pnpm typecheck`, and the existing SettingsPanel About interaction test.
The targeted test run had 1 passed test and 68 skipped tests. A focused `git diff --check` also passed.
Those checks are historical. They do not certify the current integrated tree.
The planned browser About visual check did not complete. No matching native About check was claimed.
Astra stopped its temporary Vite preview process after the planning-only instruction.

## Current files to consult, without replacing them

| Purpose | Repository path |
|---|---|
| Active work window | `docs/plans/s-plans/2026-09-14-five-hour-burn.md` |
| God plan and live priorities | `docs/ASTRA_GOD_PLAN.md`, `docs/BOARD.md`, `docs/MORNING.md` |
| Product identity | `docs/IDENTITY.md` |
| Canonical mark history | `docs/adr/0157-canonical-brand-mark.md` |
| Current app mark | `src/components/BrandMark.tsx` |
| Native icon source | `src-tauri/icons/icon-source.svg` |
| Notes constraints | `docs/adr/0170-notes-heavy-right-panel.md`, `docs/plans/c72-notes-delta.md` |
| Existing memory loop | `docs/design/memory-loop.md` |
| Existing brand gallery | `docs/design/brand/2026-09-13/README.md` |

ADR-0157 describes a fixed-color app mark. The current BrandMark uses theme tokens and different coordinates.
Preserve the functioning app mark while reconciling that history. The old ADR alone does not authorize a visual rollback.
The C72 file reports the Notes menu-label update already in the tree. Do not repeat it from an old packaged screenshot.
The packaged build remains a separate evidence surface. The active work plan forbids rebuilding `/Applications` in this window.

The package intentionally excludes copies of BOARD and the old God plan. Their current repository versions are the coordination source.
It also excludes implementation scripts, cache files, source patches, private vault content, and credential files.
