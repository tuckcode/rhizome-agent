---
session: 2026-10-11T06:30Z
model: Grok 4.6
description: >-
  Native Error events now carry fatal. Log-save failures and the 100 MiB
  rollover notice stay non-fatal so Chat keeps streaming.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · native error fatal flag

## What landed

#145 ended the native Chat stream on every `error` event. Since #130 the
Rust host also emits `Error` for a failed session-log save and the 100 MiB
rollover notice. Those are not turn-stoppers, so the reply cut off while
the turn kept running.

`EngineEvent::Error` now has `fatal`. Log-save I/O and the rollover notice
are `fatal: false`. `ensure_log` failure, provider failure, and missing
keys stay `fatal: true`. The frontend ends the listen only on a fatal
error or `TurnEnd`. A non-fatal error is an `onNotice` local marker and
does not set status to error.

## Not in this change

No HANDOFF.md edit (avoid conflicts). No Settings UI. knispo merges.
