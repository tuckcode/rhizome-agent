---
session: 2026-09-21T20:21-05:00
model: Cursor Grok 4.7
also: [Grok 4.6 (Cursor)]
description: >-
  Evening wrap. Draft #69 is pushed. Local main is 7 commits ahead of
  origin/main and unpushed. App stays b7264d6. Rebuild waits until launch.
commits: d3d6d25..2d73e7e
---

# Evening wrap — branches, C75 docs, unpushed main

**Origin:** Cursor Grok 4.7 · 2026-09-21 20:21 CDT.

## Git (verified this session)

- Checkout: `cursor/c75-hide-docs-3cfb`. Docs commit `d3d6d25`. Evening wrap `2d73e7e`. Use `git log -1` on this branch for the tip. The Mac pre-push hook refuses a non-`main` branch, so a new session on this machine should stay on the local branch.
- Draft PR [#69](https://github.com/tuckcode/rhizome-agent/pull/69) is the only open PR.
- `origin/main` is `93fae73`.
- Local `main` is `9b019d3`, **7 ahead of origin, unpushed**:
  `c7827a5` Edit list, `2f75bd1` Notes width drag, `266532c` workspace
  destinations, `48efd2b` first-run contrast, `cbce53c` chrome refs,
  `dfc82a4` Linux CI lanes, `9b019d3` TypeScript gate.
- After `git fetch --prune`, remotes are `main`, `cursor/c75-hide-docs-3cfb`,
  and `prototype/session-list-scale`.
- `/Applications` stamp is still `b7264d6` (2026-09-20 07:23). Not rebuilt.

## Settled

- Leftover docs drafts #66 #67 #68 were closed. Do not reopen them to merge.
- Hide leaves a spawned Prime daemon warm (C75). Living pages on this branch
  match `lib.rs::hidden_window_helper_stops`.
- #69 CI did not run. All four jobs failed before start: GitHub Actions
  billing or spending limit. Not a docs failure. A rerun cannot start until
  billing is fixed.
- Rebuild is tomorrow. Atticus said not tonight. Do not rebuild unless he
  says rebuild and will launch.

## Next

1. Decide what to do with the **7 unpushed commits on local `main`** before
   treating `origin/main` as the product tip.
2. After a launch-day rebuild, glance **#26** Update now, then **#46**
   no-vault Chat, then tray **#52** / **#13**. Do not close those from units.
3. `prototype/session-list-scale` still needs a keep / delete / land call.

Import still waits for `1`. Windows ship stays out.
