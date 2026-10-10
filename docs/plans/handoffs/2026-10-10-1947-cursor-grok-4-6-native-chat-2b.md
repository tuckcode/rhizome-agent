---
session: 2026-10-10T19:47Z
model: Grok 4.6
description: >-
  Step 2b native Chat commands. Draft PR off current main after #114.
  Approval flood no longer drops the current reply. Chat still on Prime.
commits: cursor/native-chat-2b-81d3
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 19:47 UTC

## What landed

Did not edit `HANDOFF.md`. Did not start 2c or the Settings toggle.

- `native_chat_start/send/cancel/approval_reply/end` in
  `src-tauri/src/commands/native_chat.rs`. Events on `native-chat:<id>`.
- Catalog target → `ProviderModel`. `Free tier (auto)` → `RoutingModel`.
  Anthropic catalog refused until 6a.
- Each engine on its own thread. Quit settles native chats before Prime,
  bound 2s. Transcript path `rhizome-native:<uuid>`. Nothing under `~/.prime`.
- Codacy #114: stale approval replies are dropped; the live prompt uses an
  unbounded send so the current reply always gets through.

## Tests

Red first (`44fcabb`), then green. native_chat 8, engines 21 including
`native_engine_current_approval_survives_a_stale_flood`.
