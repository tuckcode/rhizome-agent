---
session: 2026-10-17T08:00Z
model: Cursor Grok 4.6
description: >-
  Bash ApprovalRequested.args is the raw command, not JSON. Keep
  surrounding whitespace. Dual-parse JSON tool-call input .command.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · raw bash approval args

On the shell runner branch, `shown_args` is the command string from
`command_from_args` (not trimmed). The approval card shows that exact
string and Copy writes it. Tool-call `action.input` may still be JSON
`{command, timeout_secs}`; `bashCommandFromArgs` reads `.command` when
the value is that object and otherwise uses the raw string. Timeout on
the card comes from `action.input`. `call_id` matching and the UI hide
of Allow for session stay. No Rust.

Localization: none — English only (C18).
PostHog: no event needed because this is the same approval surface.
