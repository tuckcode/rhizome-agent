---
session: 2026-09-11T20:45-05:00
model: Cursor Grok 4.6
description: >-
  Applications rebuilt 18:39 with Graph-on-Changes. Extra .app copies deleted.
  Origin stamp pushed. C64 still not first-2s proven. #47 not closed.
commits: bd27b96
---

# Applications rebuild — 2026-09-11

**Origin:** Cursor Grok 4.6 · Atticus: stamp, C64, then rebuild the daily app.

## Done

- Origin **`bd27b96`** pushed (docs stamp only). Last **app** git is still
  **`0fa00a2`**.
- Deleted leftover project `Rhizome Agent.app` + installer DMG so Spotlight
  and agents cannot open the wrong copy. `/Applications` is the only bundle.
- Rebuilt `/Applications/Rhizome Agent.app` at **2026-09-11 18:39** from this
  tree (`pnpm tauri build --bundles app`, ditto, adhoc sign). Then deleted
  the project bundle again.
- Continual-learning: AGENTS.md now says delete leftover `.app` copies after
  install. That edit is **local / uncommitted**.

## Not done

- **C64** still weakly verified. One later Chat look showed **Prime session
  live** (no install copy). Not three first-1–2s cold launches.
- **#47** not confirmed in-app, not closed.
- New Applications layout (tall Notes, Graph only on **Changes**) not
  eyeballed after this rebuild.
- Parked stays parked: portfolio/kanban, Inbox rename, Grokbot #60–#62.

## Next session

1. Open `/Applications/Rhizome Agent.app`. Confirm Notes is a tall list and
   Graph/Mycelium only under Changes.
2. Optional: C64 first-2s watches; then #47 confirm-close.
3. Commit `AGENTS.md` + this handoff if wrapping.
4. Do not start parked UI. Do not rebuild over a live app. After any future
   install, delete extra `.app` copies.
