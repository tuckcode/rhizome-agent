---
session: 2026-09-07-0137
model: Composer
description: >-
  Rebased C72 onto origin after #58/#59/#63; smoke fixture fixes; pushed main;
  rebuilt and replaced /Applications Rhizome Agent.app
commits: 26b3bc9..cd97743
---

# Merge C72 onto main + Applications rebuild

**Origin:** Composer · 2026-09-07 · merge-c72-applications

## What landed on origin

`origin/main` = **`cd97743`** (was behind #58/#59/#63; local C72 rebased and pushed).

| Commit | Summary |
|---|---|
| `26b3bc9` | **C72:** default `editor-list` (Notes open); Chat rail no longer forces `editor-only`; Mycelium tooltip |
| `980ce06` | docs: stamp C72 handoff |
| `e9e5770` | test: App expects vault panel open by default |
| `028f16e` | fix: icon-only AI message action toolbar (local commit that rode along) |
| `8b545b8` / `c05d064` / `2245777` / `cd97743` | smoke/fixture alignment for C72 (Inbox toggles Notes closed; Browse before All Notes; wikilink mock-tauri path) |

**Not merged:** #60 / #61 / #62 (Grokbot — held).

## Push

- Earlier push attempts failed on: old App.test assertion, C72 smoke (Inbox toggle), port 41741 collisions, concurrent SIGTERM.
- Final push: frontend + playwright OK under `LAPUTA_PREPUSH_SERIAL=1` / alternate smoke port; **push yes** → `cd97743` on origin.

## Applications rebuild

- Quit running Rhizome Agent.
- `pnpm tauri build` → `src-tauri/target/release/bundle/macos/Rhizome Agent.app`
- `ditto` replace `/Applications/Rhizome Agent.app`
- Binary mtime: **2026-09-07 03:00** (was 2026-09-06 15:47)
- Relaunch verified: PID **41091** → `/Applications/Rhizome Agent.app/Contents/MacOS/RhizomeAgent`

## Return

| Item | Result |
|---|---|
| push | **yes** |
| Applications rebuild | **yes** |
| HEAD SHA | **`cd977439a898e62e5ebb1d62bb897f2b311f9f77`** |

## Still open

- C72 remainder: Inbox rename / right icon rail
- Daily-drive dogfood of Notes-open default on the new Applications build
