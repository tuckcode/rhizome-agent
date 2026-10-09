---
session: 2026-10-09T23:35Z
model: Cursor Grok 4.6
description: >-
  Chat stayed Working/Stop after a finished reply when Prime kept emitting
  agent_status after agent_end. Host now ignores that spinner noise. Composer
  no longer prints "last tool"; tool names sit in Reasoning.
commits: 77c12d5..
---

**Origin:** Cursor Grok 4.6 · 2026-10-09 · stuck Working after turn end

## What was true

Atticus sent a Chat turn (DeepSeek V4 Pro, High). The reply fully rendered
with action icons. The composer still showed a red Stop and
"Working · last tool ipython" with the 13% context ring. The turn was over.

## Root cause

Not #88 (red X). Not the 13% ring (that is context usage). Not a missing
`agent_end` from Prime.

`stream_until_turn_complete` waits 2s after `agent_end` for a queued
follow-up. **Any** later event cancelled that grace. Prime then keeps
writing `agent_status` / `session_state` (spinner noise; thousands of lines
in a real jsonl). The host treated that as "the turn continued" and waited
until `TURN_IDLE_TIMEOUT` (15 min). The frontend already seals the bubble
on `TurnBoundary` and only returns to idle on `Done`, so Stop stayed red.

Hermes ACP is not this path: `session/prompt` returns when the turn ends,
then the host emits `Done`. Same composer status machine.

## Fix

Ignore `agent_status`, `session_state`, and `tool_status` while awaiting a
follow-up. `agent_start`, text, or a new tool still cancel the grace.

Regression: `prompt_emits_done_when_status_noise_follows_the_last_tool`
failed at 8s before the change; passes after. Follow-up after noise still
streams.

## UX (second commit)

The composer no longer prints "Working · last tool …". While a turn is
live it shows a small spinner plus Stop. Tool names are one line each
inside the message Reasoning block (collapsed when the turn is done).
The context percent control is unchanged. No new `en.json` keys (C18).

## Still needs a live Mac check

A real Prime turn that ends on ipython, then a genuine mid-turn follow-up,
then a resident/Keep-working session that must stay Working.
