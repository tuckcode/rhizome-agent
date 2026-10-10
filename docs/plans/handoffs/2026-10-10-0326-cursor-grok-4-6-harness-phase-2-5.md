---
session: 2026-10-10T03:26Z
model: Grok 4.6
description: >-
  Phase 2.5 Rhizome loop: Power User bash asks each call unless a
  session grant matches. Session grants, step cap, stop-and-drain.
  Chat stays on Prime. Test-only.
commits: 816393e..HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 03:26 UTC

## What landed

Loop-side Phase 2.5 after the Phase 1/2 audit. File boundary held:
`rhizome_loop/*` and `permission_decision.rs` only.

- Power User no longer treats `allow_session` as allow-once. `find`
  was taking the first match, so `[allow_session, allow_once]` widened
  the grant. `is_allow_session` is its own class.
- Allow-once is still one call (name + args), then spent, for echo.
  Power User bash does not use the spent-grants list: each call Asks
  unless a session grant matches the exact command.
- Allow-session matches the tool; bash matches the exact command.
  `end_session` clears session grants only.
- Default step cap is 8 model rounds per turn.
- Cancel is checked before each queued tool, not only between chunks.
- `stop_and_drain` is the quit path: cancel in-flight, drop the inbox,
  ignore later submits. `cancel` still ends one turn only.

## Not in this change

`engines/native.rs` is a Phase 5 file. Adding it here needs `lib.rs`
(`mod engines`), which is outside the boundary. No stub.

Model trait, async/cancel, tool-call identity, and step order wait for
Claude's `model_events` PR to merge. Do not edit that shape from this
side.

Chat still talks to Prime. Not installed.

## Decisions flagged, not worked around

None of §5 looked wrong. Native Keep working stays later (Decision 2).

## Review (2026-10-10)

Power User bash no longer auto-selects `allow_once`. Echo still does.
Did not leave auto-run bash for knispo to decide: the mix (new command
silent, exact repeat denied) was the bug.
