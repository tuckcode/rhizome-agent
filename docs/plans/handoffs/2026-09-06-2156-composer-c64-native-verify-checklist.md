---
session: 2026-09-06-2156
model: Composer
description: >-
  C64 first-2-seconds native verify checklist — no code change; corroboration
  already in tree; residual slow-start flash unproven
---

# C64 — native verify checklist (first 1–2 seconds)

**Origin:** Composer · 2026-09-06 21:56 · stay-busy (no commit)

## Why checklist, not code

`withCorroboratedProblem` already withholds the first problem poll (`dc9df84`). Unit tests cover withhold-then-surface. Triage residual (second agreeing poll ~4s later on a very slow start) is **unreproduced**. Do not harden until this checklist fails.

## Pass / fail

**Fail** = subhead (or any chrome) shows install copy (`npm i -g prime-agent` / “not installed”) while Prime is installed and coming up.

**Pass** = idle / live / working only in those first 1–2 seconds. No install instruction.

## Three cold launches — eyes only on first 1–2 seconds

Prep once: Prime is installed; vault attached so Chat shows the session subhead.

For each launch:

1. Quit Rhizome fully (not just hide).
2. Cold-launch the native app.
3. **Immediately** look at the Chat session subhead — first **1–2 seconds only**. Do not wait ~6s and then glance.
4. Note: install copy? Y / N. Anything else saying live/working while install shows? Y / N.

| Launch | Install copy in first 1–2s? | Notes |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |

## After

- **3× clean:** mark C64 fully verified in `HANDOFF.md` / drop from `NEXT.md` §0 leftovers (docs-only).
- **Any flash:** reopen hardening — withhold `not_installed` / `service_unreachable` until `ensure_prime_session_host` succeeded once **or** problem survives ~8–12s; tests in `usePrimeHostStatus.test.ts`.

No CUA loops. Screenshot optional if it fails.
