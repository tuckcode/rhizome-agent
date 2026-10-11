---
session: 2026-10-11T05:20Z
model: Grok 4.6
description: >-
  Native Chat engine can send when Prime is not installed. Review follow-up:
  rebase, Cmd+K gate, native isPrimeTarget, no-key Settings copy.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · native send without Prime

## What landed

`useAiPanelSendPolicy` is mid-turn follow-up/steer only. The install gate
was `agentReadiness !== 'ready'` in the composer plus `!context.ready` in
`sendAgentMessage`, both keyed on the default Prime target.

`chatEngineAllowsSendWithoutPrime` treats the native engine as send-ready.
Prime-targeted chats with Prime missing still block and show install copy.

Draft PR may overlap #142 on the chat panel. This change does not edit
`AiPanelChrome.tsx`.

Review follow-up on the same branch: rebase onto main (keep both
HANDOFF entries). Cmd+K uses `settings.chat_engine === 'native' ||
aiTargetReady(...)`. `isPrimeTarget` is false on the native engine.
Native no-key errors point at Settings → AI Agents → API models.

## Not in this change

No Rust key-store. No Earth theme. knispo merges.
