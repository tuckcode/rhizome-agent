---
session: 2026-10-17T13:10Z
model: Cursor Grok 4.6
description: >-
  Round 2 HOLD on #209: empty Review, escaped labels, path filename,
  grapheme title cap, leftover-message guard.
commits: cursor/audit-chat-ui-2269
---

# Audit chat Round 2 (Ricky + Critiquito)

**Origin:** Cursor Grok 4.6 · 2026-10-17 · PR #209 at 12e41c74.

## Code

- Empty or missing collapsed display → Review + Deny, no Allow once.
- Aria labels use VisibleCommand escaping and a 80-grapheme cap.
- Long paths keep the filename (`…/dir/plan.md`); full path stays in title/aria.
- Edit/write rows read `Edit path` with a file or pencil icon.
- Two or more pending rows share a fixed 15rem button grid.
- Newlines count as overflow. Overflow copy is "Long command".
- Session titles cap at 60 graphemes (`Intl.Segmenter`).
- `sessionHeaderReport` does not attach leftover first-user text when a new
  path has no native session id yet.
