---
session: 2026-10-17T10:55Z
model: Cursor Grok 4.6
description: >-
  Round 9 HOLD: never JSON-parse ApprovalRequested.args; it is the
  literal command from driver.rs:669.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · #200 round 9 HOLD

`bashApprovalCommand` returns args unchanged. The pending bash row
stores `prompt.args` as `command`. ToolCall JSON is still parsed only
from `action.input`. A contract test pins driver.rs:669 `shown_args`,
including JSON-looking commands, through VisibleCommand.

Localization: none — English only (C18).
PostHog: no event needed because this is the same result row.
