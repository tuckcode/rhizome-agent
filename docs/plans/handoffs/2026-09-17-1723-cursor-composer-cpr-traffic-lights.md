---
session: 2026-09-17T17:23-05:00
model: Composer (Cursor)
description: >-
  CPR: macOS traffic lights moved to left corner (x:14) as 712024d;
  Applications rebuilt 17:23 after deleting the old app.
commits: 712024d
---

# CPR — 2026-09-17 17:23

**Origin:** Cursor Composer · rhizome-ship commit → push → rebuild.

| Item | Value |
|---|---|
| HEAD / origin / app | `712024d` |
| Change | `trafficLightPosition.x` 58 → 14; rail vertical inset kept |
| Prior app | Removed before install |
| Installed | `/Applications/Rhizome Agent.app` mtime 17:23 |
| Launch | opened from `/Applications` |

Expect: red/yellow/green flush left corner, not mid-sidebar.
Next board: Native W4 + #46.
