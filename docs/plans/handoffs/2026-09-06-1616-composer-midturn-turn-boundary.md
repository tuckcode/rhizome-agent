---
session: 2026-09-06T21:16Z
model: Composer
description: >-
  Mid-turn follow-up reply was merging into the first Chat bubble (flash then
  look gone). Emit TurnBoundary on each agent_end; Chat seals and retargets
  onto the queued user turn. Empty-queue grace 400ms → 2s for dequeue race.
commits: uncommitted
---

# Mid-turn TurnBoundary (split bubbles)

**Origin:** Composer · 2026-09-06

## Problem

Stream drain (`stream_until_turn_complete`) fixed the missing follow-up
**bytes**, but Chat still wrote every delta into the **first** streaming
message. The optimistic follow-up user line looked abandoned; Waiting chrome
vanished when the queue drained; the ack looked “flashed then gone.”

## Fix

- Rust: `AiAgentStreamEvent::TurnBoundary` on each `agent_end` during
  `stream_prime_session`; `FOLLOW_UP_DRAIN_GRACE_EMPTY` = 2s.
- FE: `createStreamCallbacks` seals the active bubble, retargets to
  `queuedFollowUp` message, keeps status thinking until final `Done`.
- `appendQueuedFollowUpMessage` sets `queuedFollowUp: true`.

## Verify

- Unit: `aiAgentStreamCallbacks` turn-boundary test; Rust
  `prompt_keeps_streaming_through_follow_up_after_first_agent_end`.
- Still need: live hybrid dogfood on `pnpm tauri dev` (short ask → Working →
  `MIDTURN_QUEUE_PROBE` → see **two** reply bubbles).

## Daily-drive goal

Not complete — live mid-turn UI proof + C57 / import / OAuth still open.
Packaging deferred.
