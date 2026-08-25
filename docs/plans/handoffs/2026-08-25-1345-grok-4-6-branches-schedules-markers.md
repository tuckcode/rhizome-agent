---
session: 2026-08-25T13:45-05:00
model: Grok 4.6 (Cursor)
description: >-
  #17 branch band (get_session_tree / navigate_tree) in this conversation;
  #14 create schedules (heartbeat_set / cron_add); #18 compact/fork/model
  markers. See/pause/cancel was already built. Issues left open (no live demo).
---

# Branches, schedules, markers

User: keep going on #17 then #14, then the next Prime surface from issues.
Lunch; do not wait.

## What landed

**#17** — Chat band on the transcript column, copy *"N branch(es) in this
conversation"*. Sessions drawer untouched. Linear trees stay quiet. Select →
`navigate_tree`, then rehydrate the *current leaf's* ancestry from disk
(`transcriptAlongBranch`). Poll does not create a session.

**#14** — GitHub AC (see/pause/cancel, silence when idle, PostHog) was already
in `ScheduledWorkPopover`. Remaining hole from local pickup was **create**.
`PrimeScheduleDialog` next to Goal (not on the idle band). `heartbeat_set` /
`cron_add`. Refuses without a session.

**#18** — next issue after those. Compaction/model/fork markers are system
events (hairline, not a bubble). Live compact already marked; live fork and
same-session model change now do. Rehydration reads `compaction`,
`model_change`, and `branch_summary`.

Snapshot: **36 spoken / 102 daemon**.

## Do not close the GitHub issues yet

Each ticket asks for a live Prime demonstration. That did not happen this
session. `pnpm l10n:translate` is still C18 / out of scope; English keys only.

## Next

Composer cluster **#38 / #9 / #35 / #21**, or **#29** (credentials). Do not
start a plugin kernel. Do not mix RLM roster with the fork tree.
