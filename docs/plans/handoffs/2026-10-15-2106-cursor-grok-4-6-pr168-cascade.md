---
session: 2026-10-15T21:06Z
model: Grok 4.6 (Cursor)
description: >-
  PR #168 cascade holds: shared dark base, resolved-token tests,
  unsaved dark stays Earth, Graphite toggle partner, 2px rings,
  sentence case, real screenshots.
commits: this slice
---

# PR #168 cascade holds

**Origin:** Grok 4.6 (Cursor) · 2026-10-15 · Graphite cascade hold fixes

## What landed

1. Shared `:root.dark, [data-theme="dark"]` is Earth dark again so Loam,
   Mycelium, Dracula, Nord inherit syntax/diff/shadcn. Graphite is only
   the `:not([data-color-theme])` overlay.
2. `contrast_check.py` resolves the cascade. Vitest asserts no dark skin
   inherits light syntax/diff/surface. Syntax strings and
   diff-added/removed are checked on each product skin's bg.
3. Saved dark/system/light with no color stay Earth. Only empty storage
   is Graphite. Empty storage cannot be told apart from a user who never
   wrote `theme_mode`.
4. Status-bar toggle Graphite → Earth light remembers Graphite; next
   press returns to Graphite.
5. Shared UI controls use a solid 2px `--state-focus-ring`.
6. Picker names are sentence case.
7. Real Vite+CSS captures of a code block and diff panel in seven skins.
8. There is no `ToolLog` component. Tool rows live on `AiActionCard`.
