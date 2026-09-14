---
session: 2026-09-14T16:22-05:00
model: Grok 4.6 (Cursor)
description: >-
  Packaged-app gap audit. Source tip 057f227 vs origin 5c629a0 vs app
  leftover 476756c. Four stamps. Native NOT RUN. Not daily-driver ready.
commits: 057f227
---

# Packaged-app gap — 2026-09-14 16:22

**Origin:** Cursor Grok 4.6 · 2026-09-14 16:22 · gap audit.

The tree has moved since [1522](2026-09-14-1522-cursor-grok-4-6-d6-report.md).
The installed daily-drive copy has not. That gap is why the product is
still not daily-driver ready.

## Four stamps (do not collapse)

1. **Source** — local HEAD **`057f227`**. Origin **`5c629a0`**. Nineteen
   local commits not pushed (`e64a283` .. `057f227`). D6 landed seven
   commits; post-D6 added burn close, leftover chrome locks, and crunch
   test locks through 1559.
2. **Browser** — D0–D5 Vite/spec earlier today. This slice did not
   re-open the browser. Browser evidence does not substitute for the
   packaged app.
3. **Native** — C64 ×3 cold launches, W4 five God-plan cases, hide
   live-check, last-idle relaunch, Sessions header drag: **NOT RUN**.
   See [1619](2026-09-14-1619-c64-native-findings.md) and
   [1620](2026-09-14-1620-w4-native-findings.md). No launch from here.
4. **App** — `/Applications/Rhizome Agent.app` dated **2026-09-12
   22:43**, leftover **`476756c`**. Not rebuilt. Thirteen-plus source
   commits and all post-D6 work are absent from the installed binary.

## The gap

| Stamp | SHA | When |
|---|---|---|
| Origin `main` | `5c629a0` | last push |
| Packaged app | `476756c` | 2026-09-12 22:43 |
| Local HEAD | `057f227` | 2026-09-14 ~16:22 |

Origin → app: app is **two days stale** relative to what GitHub has.
App → source: app is **nineteen commits behind** what this machine
would push. Native QA that matters for daily drive must run on a
**fresh rebuild**, not on `476756c` and not on Vite/mock-tauri.

## Still true

- Import waits for **`1`**. Do not merge #66. Do not close #46 or #41.
- Tiptap High parked. Medium Hono / qs parked.
- `rhizome-ship` stays three verbs: commit, push, rebuild are separate.
- **Not daily-driver ready** — source ahead, app stale, native unproven.

## Next

1. Say **push** to send nineteen local commits (pre-push gates first).
2. Say **rebuild** only if you will launch the new `/Applications` copy.
3. After rebuild: run C64 ×3 and W4 five cases on the new app — native
   slots remain **NOT RUN** until a human watches them.
