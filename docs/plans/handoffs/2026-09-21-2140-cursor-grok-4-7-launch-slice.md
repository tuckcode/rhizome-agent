---
session: 2026-09-21T21:40-05:00
model: Cursor Grok 4.7
description: >-
  Atticus is starting the launch slice. Rebuild from 2a24eed and check
  #26 Update now in the native app. The plan file is still local.
commits: 2a24eed
---

# Launch slice — start here

**Origin:** Cursor Grok 4.7 · 2026-09-21 21:40 CDT.

Atticus asked for a new session to start the launch. He will open the new app.

## Git and install

- `main` matches `origin/main` at **`2a24eed`**. Product work inside that push is **`4ec3832`**.
- `/Applications/Rhizome Agent.app` is still **`b7264d6`** (2026-09-20 07:23).
- Uncommitted in this folder, not on origin:
  - `docs/plans/2026-09-21-next-phase-plan.md`
  - `docs/plans/handoffs/2026-09-21-2104-cursor-grok-4-7-astra-next-phase.md`
  - `docs/plans/handoffs/2026-09-21-2140-cursor-grok-4-7-launch-slice.md`
  - `docs/HANDOFF.md` index edits
  - `.cursor/rules/one-job-in-flight.mdc` (footer only)
- Open this same folder. A fresh clone will not have the plan.

## First action

Follow `.cursor/skills/rhizome-ship/SKILL.md` **rebuild** only. Do not push in the same turn.

1. Ask before quitting a live Rhizome window. It may hold unsaved chat or notes.
2. Rebuild `/Applications/Rhizome Agent.app` from this tree (`pnpm tauri build --bundles app`, then install). Remove leftover `.app` copies so Spotlight cannot open the old binary.
3. Stamp `docs/HANDOFF.md` and `docs/BOARD.md` with the installed commit and time.
4. Have Atticus launch. Exercise **#26 Update now** on a real Chat-engine offer. Record the result. Tests do not close #26.

**Done when:** the installed app's commit matches the candidate, and #26 is either verified or left with a concrete reproduction. An unavailable update path stays unverified.

## After that, still not this slice

#46, then tray #52 / #13, then #41. Do not close them from tests. Shelf stays in the next-phase plan. Import waits for `1`. Do not reopen #66–#68. Do not invent a CircleCI org id.
