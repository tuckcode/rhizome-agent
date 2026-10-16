---
session: 2026-10-16T06:10Z
model: Cursor Grok 4.6
description: >-
  Settings → AI Agents model menu opened behind the dialog (z-50 vs
  z-[1300]). Row picker now portals at z-[12000]. Catalog list was not empty.
commits: cursor/settings-model-dropdown-f40f
---

**Origin:** Cursor Grok 4.6 · 2026-10-16 · Settings model dropdown clipped / never visible.

Did not edit `docs/HANDOFF.md`.

## Root cause

Not PR #153 (docs-only UI rules). The picker landed in **PR #155**
(`8e0deda`). `NativeChatModelPicker` uses `DropdownMenuContent`, which
already portals to `document.body` at **`z-50`**. The Settings overlay is
**`z-[1300]`**, so the menu painted behind the dialog. Radix's modal
scroll lock then shifted the overlay and clipped the header.

## Fix

Settings (row) variant only: `z-[12000]` plus
`data-settings-panel-portal="true"`. Shared `dropdown-menu.tsx` is
unchanged. Composer chip stays `z-50`.

## Catalog emptiness

Out of scope. Seed catalog still lists every non-Anthropic default plus
Free tier. Live `discover_ai_models` only fills local / configured
providers. Gemini as the trigger label is the saved selection, not a
one-item menu.

## Review follow-up

Portal tests walk ancestors for `overflow-hidden` / `overflow-clip` and
computed/inline `overflow` `hidden`/`clip`, require `document.body`, and
keep the selected row outside `[data-slot=dialog-content]`. Review PNGs:
`docs/screenshots/pr-178/`.
