---
session: 2026-09-14T16:19-05:00
model: Grok 4.6 (Cursor)
description: >-
  C64 native findings: three cold launches still NOT RUN. Packaged app
  leftover 476756c. Source withhold already in tree. No launch. No code.
commits: none
---

# C64 native findings — 2026-09-14 16:19

**Origin:** Cursor Grok 4.6 · read `src/hooks/C64.md` + `docs/plans/morning-native-observer.md` · no commit · no launch

## What C64 checks

**Fail:** Chat session subhead (or any chrome) shows install copy (`npm i -g prime-agent` / “not installed”) in the **first 1–2 seconds** while Prime is installed and coming up.

**Pass:** idle / live / working only in that window. No install instruction.

**After:** 3× clean cold launches → C64 verified; drop from NEXT leftovers. Any flash → note which launch and stop (agents reopen hardening).

## Source state (no recode unless launch fails)

`withCorroboratedProblem` in `src/hooks/usePrimeHostStatus.ts` already withholds the first problem poll. Unit tests + `parked-organs.test.ts` lock the symbol. Residual slow-start flash on a **very** slow daemon is **unreproduced** in tree — checklist exists because agents cannot watch the first second like a human.

Full checklist: [`docs/plans/handoffs/2026-09-06-2156-composer-c64-native-verify-checklist.md`](2026-09-06-2156-composer-c64-native-verify-checklist.md).

## Packaged app

| Field | Value |
|---|---|
| Daily-drive build | **`476756c`** (leftover — not rebuilt this session) |
| Path | `/Applications/Rhizome Agent.app` only |
| Not valid | Vite / `mock-tauri` |

Do **not** launch his daily-drive copy from an agent. Do **not** quit or mass-kill helpers from here.

## Three cold launches — NOT RUN

Procedure: [`docs/plans/morning-native-observer.md`](../morning-native-observer.md) §1. Tick table: [`src/hooks/C64.md`](../../src/hooks/C64.md).

Prep once: Prime installed; vault attached so Chat shows the session subhead.

For each launch: **Cmd+Q** fully → cold-launch `/Applications` → **eyes on subhead for 1–2s only** (not ~6s later).

| Launch | Install copy in first 1–2s? | Status |
|---|---|---|
| 1 | | **NOT RUN** — 2026-09-13 row says “not watched”; agent started cold launch but cannot pass the eye test |
| 2 | | **NOT RUN** — table empty |
| 3 | | **NOT RUN** — table empty |

**Session stamp 16:19:** all three launches still **NOT RUN**. Crunch / leftover-wrap commits on 2026-09-14 do not change C64. App still `476756c`.

## Related morning observer (out of scope this file)

Sections 2–5 in `morning-native-observer.md` (send/recover, steer/queue, hide vs Cmd+Q, last-conversation relaunch) are separate native checks. §5 was stamped **NOT RUN** at 16:26 in that file. This handoff is **C64 ×3 only**.

## Not done

- Launch / quit / rebuild `/Applications`
- Tick `src/hooks/C64.md` table
- Code change or C64 close from units alone
