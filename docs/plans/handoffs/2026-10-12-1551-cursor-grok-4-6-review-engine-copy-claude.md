---
session: 2026-10-12-1551
model: Cursor Grok 4.6
description: >-
  Review follow-up after #158: Prime status follows the open chat engine,
  Settings copy rewrite, OpenRouter Claude models show in the Rhizome list.
---

**Origin:** Cursor Grok 4.6 · 2026-10-12 · review fixes after #158 merged

## What was true

An open Prime chat kept its engine after a Settings flip (#158), but
`ChatHome` still started `usePrimeHostStatus` from the Settings switch.
The live status and model label died on that flip.

`settings.chatEngine.description` repeated the last two sentences.

`isAnthropicTarget` hid any id that contained `/claude`, so OpenRouter
Claude models never appeared in the Rhizome/native model list.

## What changed

- Prime status polls from `effectiveEngineForStatus === 'prime'` (lock
  or requested engine), not `chatEngine !== 'native'`.
- Settings description is the reviewer text: changes apply to new chats,
  and an open chat keeps the engine it started with.
- The catalog filter hides Anthropic and Claude Code ids, including a
  custom provider whose kind is anthropic. OpenRouter Claude stays.
  There is no `prime/` catalog prefix; that claim was dropped.

## Tests

- Open Prime chat, flip Settings to native → status checks stay on;
  New Chat turns them off.
- Seed list includes `home-openrouter/anthropic/claude-sonnet-4` and
  still hides `anthropic/` and Anthropic-kind providers.
