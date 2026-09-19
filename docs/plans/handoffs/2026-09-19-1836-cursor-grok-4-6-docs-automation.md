---
session: 2026-09-19T18:36Z
model: Cursor Grok 4.6
description: >-
  Weekly docs automation. Corrected living docs that still said hide
  stops the spawned Prime daemon (C75 leaves it warm). Documented
  BootSplash / idle restore, tray Done rows, traffic lights at x:14,
  and Getting Started env names. No code change.
commits: docs-only
---

# Docs automation — 2026-09-19

**Origin:** Cursor Grok 4.6 · cron documentation automation.

Verified against source at **`35f217f`**. Packaged app is still
**`712024d`**. No product code. No rebuild.

## Why this pass

Living pages (`ARCHITECTURE`, `GETTING-STARTED`, `YOU-SHOULD-KNOW`,
`CROSS-MODEL-HANDOFF` §21, `hide-on-close-helpers.md`) still told the
next session to stop the spawned Prime daemon on hide. `lib.rs`
`hidden_window_helper_stops` is `ws_bridge` + `mindwalk` only (C75).
That contradiction would have invited a “fix” that undoes cold-reopen.

## Pages touched

- `docs/ARCHITECTURE.md` — hide, BootSplash / restore, tray Done,
  traffic-light inset, `latest_prime_session_for_restore`
- `docs/GETTING-STARTED.md` — pitfalls + Getting Started env (#57)
- `docs/YOU-SHOULD-KNOW.md` — stamp, hide, tray, Signal Dock
- `docs/CROSS-MODEL-HANDOFF.md` — §21 rewrite + §24
- `docs/plans/hide-on-close-helpers.md` — C75 settled the gray zone
- `docs/plans/issue-52-menu-bar-done.md` — Done row is in source

## Still open

Native glance of hide/reopen and tray Done. Do not close #52 from
units. Import still waits for `1`.
