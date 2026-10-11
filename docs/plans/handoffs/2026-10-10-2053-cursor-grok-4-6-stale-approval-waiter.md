---
session: 2026-10-10T20:53Z
model: Grok 4.6
description: >-
  Follow-up to merged #116. Abandoned native approval waiter now
  clears only its own live prompt id. Draft #120. Keep #119.
commits: cursor/stale-approval-waiter-81d3
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 20:53 UTC

## What landed

Did not edit `HANDOFF.md`. Did not start 2c or the Settings toggle.
Did not write a long-haul plan. Keep draft #119.

- Claude finding 1 on #116: after cancel, `start` drops the approval
  sender and returns without joining the waiter. The waiter then set
  `live_prompt = None` for any id. A newer turn's AllowOnce was refused.
- `release_live_prompt` clears only when the live id is still this
  waiter's. Covered by own-id / newer-id unit tests and
  `native_engine_later_approval_survives_abandoned_waiter`.
- #116 already merged (`f990155`), so this is a new branch from `main`.
  Draft PR #120.

## Still Before step 4

Claude findings 2 and 3 stay listed, not fixed: frontend index overwrite
can wipe native records; quit bound is 2s per chat, sequential.
