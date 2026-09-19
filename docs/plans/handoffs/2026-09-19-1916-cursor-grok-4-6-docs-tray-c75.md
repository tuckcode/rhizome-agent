---
session: 2026-09-19T19:16Z
model: Cursor Grok 4.6
description: >-
  Living-docs sync against origin 35f217f. Corrected C75 hide (Prime stays
  warm), tray Done, empty-rejection labels, Getting Started env (#57),
  and traffic lights {x:14}. Packaged app still 712024d.
commits: docs-only
---

# Living docs vs `35f217f`

**Origin:** Cursor Grok 4.6 · 2026-09-19 cron · documentation automation.

No product code. Verified against source, then updated existing pages.

## What was stale

- `HANDOFF.md` / `BOARD.md` still said tip `712024d`. Origin is `35f217f`.
  Packaged `/Applications` is still `712024d`.
- Hide docs still said hide stops the spawned Prime supervisor. C75
  (`lib.rs` `hidden_window_helper_stops`) is `["ws_bridge", "mindwalk"]`
  only. `leftover-hide-close-names.test.ts` locks that.
- `ARCHITECTURE.md` Getting Started still described a default Tolaria
  clone and `LAPUTA_GETTING_STARTED_REPO_URL`. Code reads only
  `RHIZOME_GETTING_STARTED_REPO_URL`; unset = local scaffold.
- Tray Done (`Done: {title}` / 45s / failed roster does not invent
  finishes), empty-turn rejection copy, and traffic-light `{ x: 14, y: 16 }`
  were missing from living docs.

## Pages touched

- `docs/ARCHITECTURE.md` — hide/C75, BootSplash + idle restore, tray,
  empty rejection, traffic lights, Getting Started default
- `docs/CROSS-MODEL-HANDOFF.md` — §21 corrected; §24 added
- `docs/plans/hide-on-close-helpers.md` — gray zone marked settled by C75
- `docs/GETTING-STARTED.md` — drop “legacy alias”
- `docs/YOU-SHOULD-KNOW.md` — stamp + shell-map rows
- `docs/HANDOFF.md` / `docs/BOARD.md` — tip vs packaged app

## Still true / not claimed

- Do not close #52 from units. Native tray glance not run.
- Do not close #46 from units.
- Import still waits for `1`.
- Native hide/reopen live-check still NOT RUN.
