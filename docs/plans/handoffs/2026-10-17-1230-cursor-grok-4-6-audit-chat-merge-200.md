---
session: 2026-10-17T12:30Z
model: Cursor Grok 4.6
description: >-
  Merge origin/main #200 into audit-chat UI. Keep VisibleCommand / literal
  ApprovalRequested.args / call_id / wrap={false}. Layer pending-approval
  auto-expand and collapsed Allow/Deny plus the bash command.
commits: cursor/audit-chat-ui-2269
---

# Merge #200 into audit chat UI

**Origin:** Cursor Grok 4.6 · 2026-10-17 · follow-up after #200 landed on main.

## What stayed from #200

`ActionCardRow` still sends bash approvals through `bashApprovalCommand(args)`
and never JSON-parses `ApprovalRequested.args`. `call_id` matching is
unchanged. Collapsed bash rows still use `VisibleCommand` with `wrap={false}`.

## Item 1 on top

A pending approval still opens the Tool use group. The collapsed row keeps
Allow/Deny (no `allow_session` on bash, same as the card) and, for bash, the
literal command via `VisibleCommand wrap={false}`.
