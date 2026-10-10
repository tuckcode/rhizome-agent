---
session: 2026-10-10T01:35Z
model: Grok 4.7
description: >-
  Phase 2 Rhizome loop: tools, Limited tools vs Power User, and the three
  Phase 1 review notes. Chat still talks to Prime. Test-only.
commits: 9b52d70b
---

**Origin:** Cursor Grok 4.7 · 2026-10-10 01:35 UTC (20:35 America/Chicago)

## What landed

The test-only loop can call tools. Limited tools (`Safe`) offers `echo`
and denies `bash`. Power User runs an identical call once, then denies
it. A missing or cancelled approval wait denies the tool and does not
run it. The shared allow-once / deny table lives in
`permission_decision.rs`. ACP still calls that table.

Review notes from the Phase 1 draft:

- Cancel while idle does nothing. A cancel ends the current turn, then
  the next inbox message can reach `TurnEnd`.
- A cancel before any chunk does not log an empty assistant event.
- `ModelView.history` is ordered user text, assistant text, and tool
  results.

## Not in this change

No plugin seam, no Chat toggle, no HTTP model client. Prime and Hermes
stay. Vault `create_note` stays on its existing path. Close / quit and
PR #88 were not touched. Not installed.
