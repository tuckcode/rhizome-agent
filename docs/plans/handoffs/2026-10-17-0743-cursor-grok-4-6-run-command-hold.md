---
session: 2026-10-17T07:43Z
model: Cursor Grok 4.6
description: >-
  HOLD on #200: hide session for bash, visible command escaping, no
  grouping, strict bash_result parser, Denied/Failed, call_id matcher.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · HOLD fix for run-command UI

v1 bash cards filter out Allow for session in the UI only. Commands show
⏎ on real newlines and `\u{XXXX}` badges for hidden/control/bidi chars,
with a danger warning. Copy still writes the raw string. Consecutive bash
calls are not grouped. Structured output requires `kind: "bash_result"`
plus a numeric exit_code or timed_out/stopped. Command text comes from
the approval prompt args, not `action.input`. `matchPendingApprovalAction`
uses call_id when present; TODO notes the shell runner PR.

Earth outline-button contrast (1.35:1) is a shared-component follow-up.

Localization: none — English only (C18).
PostHog: no event needed because this is the same approval surface.
