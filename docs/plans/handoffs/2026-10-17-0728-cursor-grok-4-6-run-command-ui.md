---
session: 2026-10-17T07:28Z
model: Cursor Grok 4.6
description: >-
  UI-only Run command approval card and bash result row for the native
  bash tool. Does not change the Rust stub or BASH_SCHEMA.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · bash approval + output view

Power User `bash` uses the edit-tools approval card shell. Title is Run
command. The body is the command in a wrapping monospace block, a vault
note, and timeout only when `timeout_secs` is set. Allow once is the
primary action. The transcript result is a collapsed row with the
command and exit / timed out / stopped, expandable to stdout and stderr.
Truncated output notes that the start and end are shown. The parser
accepts the current stub echo of args (no exit code) and a later JSON
result with missing fields.

Review shots: `docs/review-shots/run-command/`.

Localization: none — English only (C18).
PostHog: no event needed because approval answers are frequent and say
little about adoption (same as edit-tools).
