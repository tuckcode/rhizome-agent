---
session: 2026-10-10T21:30Z
model: Grok 4.6
description: >-
  Step 2c save and resume native chat sessions. Draft PR off current main
  after ADR-0183. Chat still on Prime. Did not edit HANDOFF.md.
commits: cursor/native-chat-2c-81d3
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 21:30 UTC

## What landed

Did not edit `HANDOFF.md`. Did not start step 4 or Claude step 3.
`SecretsKeyStore` was not edited.

- One append-only JSONL log per native session at
  `<app config dir>/native-sessions/<session_id>.jsonl`.
- Header line `{ version, session_id, created_at, target, permission_mode,
  vault_path }`. Later lines are `DurableEvent` with seq + checksum.
- Flush + `sync_all` after every line. 100 MiB session cap, 1 MiB tool
  result cap (truncated and marked). Owner-only `0600`. Known-credential
  scrub. No encryption.
- `AgentLoop::from_log`: unfinished turn closes as
  `Cancelled { cause: "restart" }`. Grants and pending approvals do not
  restore. Unanswered tools get "Not run: the turn stopped first."
- `native_chat_list` / `native_chat_open` / `native_chat_delete`.
  Reopen always returns the D13 warning. Unknown version and a second
  window are read-only. Tail damage opens the last good line. Middle
  damage preserves the original and continues in a new session.
- Nothing under `~/.prime`.

## Tests

Red first (34 compile errors against missing `from_log` / `native_log`).
Then green: native_chat 22 including the plan's 10, D13, middle-damage,
and two-window lock; native_log 2 (scrub + tool-result cap).
