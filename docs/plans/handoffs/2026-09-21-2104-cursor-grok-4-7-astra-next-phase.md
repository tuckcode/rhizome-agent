---
session: 2026-09-21T21:04-05:00
model: Cursor Grok 4.7
description: >-
  Thorough Astra plan, not the 15-second draft. origin/main is 2a24eed.
  App is still b7264d6. Include the shelf and a real design pass.
commits: 93fae73..2a24eed
---

# Astra — next phase planning input

**Origin:** Cursor Grok 4.7 · 2026-09-21 21:04 CDT.

This file is the fact sheet. It is not a plan. Astra writes the next phase.

## Git and install

- Branch `main`. `HEAD` and `origin/main` are **`2a24eed`**. Nothing is ahead of origin.
- That tip is a docs stamp. The push that carried product work is **`4ec3832`** (`93fae73..4ec3832`). Local pre-push passed in 3m 7s. Rust lane skipped (no `src-tauri/` changes).
- Product commits now on origin, which were only on this Mac before that push: Edit list (`c7827a5`), Notes width drag (`2f75bd1`), workspace destinations (`266532c`), first-run contrast (`48efd2b`), chrome refs (`cbce53c`), Linux CI lanes (`dfc82a4`), TypeScript gate (`9b019d3`).
- `/Applications/Rhizome Agent.app` is still **`b7264d6`**, installed 2026-09-20 07:23. Not rebuilt tonight. Atticus deferred rebuild until a day he will launch.
- Uncommitted local file: `.cursor/rules/one-job-in-flight.mdc`. Footer change only. Not on origin.

## Settled this session

- Docs drafts #66 #67 #68 are closed. Do not reopen them to merge. Their pre-C75 hide sentence is wrong.
- C75 wording is on `main`: hide stops ws-bridge and Mindwalk. A spawned Prime daemon stays warm.
- `src/lib/leftover-public-preview-claims.test.ts` now locks “drafts closed,” not “Do not merge #66” in `PUBLIC-PREVIEW.md`. README still names PR #66.
- Chunk sidecar use is free for now (CircleCI, including the free plan; they will say before they charge). The `chunk` CLI is not installed. `.chunk/config.json` still says `refactoringhq/tolaria` and an old org id. Do not invent the org id. Do not install Chunk unless Atticus asks.
- [#69](https://github.com/tuckcode/rhizome-agent/pull/69) merged 2026-09-21 when `main` pushed. Its GitHub Actions jobs never started (billing or spending limit). The docs are on `main`. A later Actions run still needs billing fixed.

## Unverified

Native glances are not done. Do not close #26, #41, #46, or #52 from tests. After a launch-day rebuild, the order Atticus accepted is #26 Update now, then #46 no-vault Chat, then tray #52 / #13.

`prototype/session-list-scale` is still on GitHub. Keep, delete, or land is undecided.

Import still waits for `1`. Windows ship stays out. #56 still needs a keep / remove / document call before #40 or #48.

## Shelf and queue

Astra must include these, in a shelf section, separate from the first slice. A row here is not approval to build it.

- In the works, not in the app: the `4ec3832` product commits (Edit list, Notes width, destinations, first-run contrast, chrome refs, Linux CI lanes, TypeScript gate). They are on origin. `/Applications` is still `b7264d6`.
- Next native queue, after a launch-day rebuild: #26 Update now, then #46, then #52 / #13. #41 is the same class of live check.
- Undecided: `prototype/session-list-scale` (keep, delete, or land). #56 keep / remove / document, which blocks #40 and #48.
- Parked until Atticus claims them: import until he types `1`, Windows, Chunk install (config still names `refactoringhq/tolaria`), the uncommitted footer rule in `.cursor/rules/one-job-in-flight.mdc`.
- Older shelf: read `docs/NEXT.md` § Pickup now and the parked tables in `docs/plans/2026-09-20-public-readiness-inventory.md`. Carry those rows forward. Do not drop them because this file is short.

## Ask of Astra

Replace `docs/plans/2026-09-21-next-phase-plan.md`. That file is a thin draft from a stop-early pass. Atticus wants a thorough plan. A full five-hour window is acceptable. High reasoning is acceptable.

Plan against `2a24eed` on origin and `b7264d6` in `/Applications`. Those are different trees. Do not rebuild, push, or close issues.

The plan has three parts:

1. **First slice.** What happens on launch day, and the exit check. Update now in the native app is the agreed first check.
2. **Shelf.** Keep every row in the shelf section above, plus the parked rows in `docs/NEXT.md` and `docs/plans/2026-09-20-public-readiness-inventory.md`. A shelf row is not approval to build it.
3. **Design.** Read `docs/design/brand/2026-09-14-handoff/FRONTEND-DESIGN.md`. Say what to improve, what to leave, and what to rethink. Composer, failed-turn notices, long names, first-run guidance, and Settings About are already named. Add only the surfaces he believes matter. He may propose a different visual idea. He must not mock up screens that already exist unless he believes the current design is wrong. Chat / Notes / Read / Workbench stay. Mark proposals as proposals.

Do not open `docs/ASTRA_GOD_PLAN.md`. That file is a closed 13 September night, and re-walking it is what burned the last window. Thorough means the current app and the current shelf, not that old packet.

His own further thoughts belong in the plan when he has them. They are not a drug prompt and not a required mockup set. If a thought does not change the first slice, label it so.
