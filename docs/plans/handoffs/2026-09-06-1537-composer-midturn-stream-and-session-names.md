---
session: 2026-09-06T20:37Z
model: Composer
description: >-
  Mid-turn follow-up reply was dropped after first agent_end (stream fix +
  optimistic transcript bubble); new sessions named with local time first
  so quit/reopen can find the latest chat. Rebuild to /Applications pending.
commits: uncommitted
---

# Mid-turn stream drain + session clock names

**Origin:** Composer · 2026-09-06

## Problem (live dogfood)

1. Mid-turn queue chrome worked (“Waiting in this session”), and the Prime
   session log showed the follow-up + ack, but Chat often showed only the
   **first** reply — host stopped listening at the first `agent_end`.
2. After quit/reopen, sessions titled `Rhizome · Vault · hex` were hard to
   tell apart; Atticus could not tell which was latest.

## Fix (in tree)

- `stream_until_turn_complete` in `prime_session_host.rs`: after `agent_end`,
  keep listening (short grace if queue empty; long if follow-up/steer pending).
- Frontend: `appendQueuedFollowUpMessage` + `agent.appendQueuedFollowUp` wired
  through `useAiPanelSendPolicy` so the interrupt appears in the transcript.
- New-session placeholder:
  `Rhizome · Sep 6 · 3:35p · Rhizome Vault · f65c06`
  (still replaceable; first-message / rename still win).

## Fix (follow-up)

- Idempotent `appendQueuedFollowUpMessage`
- AiPanel mirrors `get_queue` follow-ups into the transcript
- `replaceMessages` during a live turn keeps optimistic `queuedFollowUp`
  bubbles the disk transcript has not caught yet

## Verify

- Unit: conversation append; naming clock helpers; turn-boundary stream test.
- Still need: live mid-turn dogfood while **Working** — Atticus hybrid Enter
  2026-09-06 showed Waiting chrome + Prime log had `MIDTURN_QUEUE_PROBE`, but
  Chat transcript did not keep that bubble (only a stray `?w` chip). Re-dogfood
  after this preserve/mirror fix.

## Not done for daily-drive goal

C57, session-import UI, Anthropic/xAI reconnect; packaging/Windows deferred.
