---
session: 2026-10-17T07:55Z
model: Cursor Grok 4.6
description: >-
  Align #200 with #202: ApprovalRequested.call_id and bash_result field
  names. Match call_id when present, else tool name. No Rust.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · align bash UI with shell runner PR

Read `cursor/native-bash-shell-e221` without merging. Wire field is
`call_id` on `EngineEvent::ApprovalRequested`; the chat prompt maps it to
`callId`. `BashResult` serde keys match `NativeBashToolResult`. Timeout
and cancel send `exit_code: null`. Matching uses `call_id`/`callId` when
present and falls back to tool name on main. No `policy.rs` or other Rust
edits.

Localization: none — English only (C18).
PostHog: no event needed because this is the same approval surface.
