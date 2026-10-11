---
session: 2026-10-11T02:30Z
model: Grok 4.6
description: >-
  Phase 6 Settings toggle. Default stays Prime. Native sends new chats
  through native_chat_start. Did not edit FreeTierSettings or ProviderKeys.
commits: cursor/native-engine-toggle-81d3
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 02:30 UTC

## What landed

Did not edit `HANDOFF.md`. Did not edit `FreeTierSettings.tsx`, free-tier
settings code, ProviderKeys, or the keychain.

- Settings stores `chat_engine` (`native` or absent/Prime) and
  `native_chat_target`.
- The only engine control is `ChatEngineSettings` in Settings.
- A native chat uses one picker: catalog models plus Free tier (auto).
  Anthropic ids are hidden and refused.
- `sendAgentMessage` calls `streamNativeChat` only when the engine is native.
