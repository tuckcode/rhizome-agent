---
session: 2026-10-16T20:45Z
model: Grok 4.6 (Cursor)
description: >-
  PR #183 review hold: Prime chip writes set_prime_model, Earth hover
  contrast, Ask Rhizome, shared settings-menu z-index.
commits: this slice
---

# PR #183 review hold

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Same branch. The composer chip is engine-aware: Prime reads the host
model and calls `set_prime_model`; native still writes `native_chat_target`.
Tests cover both.

Earth light hover/selected fills stay readable; a 2px accent bar gives
the row ≥3:1 against the menu. Hover is a step lighter than selected.
Graphite highlighted rows use foreground text. Earth light separators
use `--border-subtle` one step darker (`#DDD4C3`).

Placeholder is Ask Rhizome (`aiAgents` label). Open settings is a
link. Locale keys are in every catalog. Composer shadow and column
background are restored. Overlay menus share `SETTINGS_MENU_Z_CLASS`.

Screenshots in `docs/screenshots/pr-183/` recaptured from the mock app.

Did not edit `HANDOFF.md`.
