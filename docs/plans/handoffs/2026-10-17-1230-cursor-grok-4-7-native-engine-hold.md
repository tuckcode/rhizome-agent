---
session: 2026-10-17T12:30Z
model: Grok 4.7 (Cursor)
description: >-
  HOLD follow-up on the native Chat default. A missing engine no longer
  skips the install check. Settings writes null for native and prime
  only when someone picks Prime. Chat chrome waits until settings load.
commits: this slice
---

# Native default HOLD fixes

**Origin:** Grok 4.7 (Cursor) · 2026-10-17

`chatEngineAllowsSendWithoutPrime` is true only for a resolved `native`
engine. The workspace passes that engine into the conversation
controller. A Codex send with no engine and a missing install still
gets the local unavailable reply.

Chat does not show engine chrome or accept a send until
`chatEngineSettled`. Settings stores null for the native default and
`prime` only for an explicit Prime choice.

Known follow-up, not fixed here: a settings save after a failed load
can spread the empty in-memory settings (`onNativeTargetChange` in
`App.tsx`).
