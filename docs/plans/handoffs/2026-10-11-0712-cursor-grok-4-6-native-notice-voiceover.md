---
session: 2026-10-11T07:12Z
model: Grok 4.6
description: >-
  Rebase #148 onto #146; append pending VoiceOver lines; combine
  notice plus Response complete; log-save notice wording.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · native notice VoiceOver

## What landed

#148 now sits on `origin/cursor/chat-status-reread-8b31` (#146, not
yet in `origin/main`). PR base stays `main`.

`ChatRunLiveStatus` appends a newer line onto a pending announcement
instead of cancelling the frames. `nextChatRunAnnouncement` returns
the notice and the end-of-turn line together when both land in one
render.

The non-fatal log-save notice is now exactly: "This part of the chat
couldn't be saved, so it won't be there after a restart." The 100 MiB
rollover wording is unchanged.

`send_after_a_fatal_no_key_error_is_not_already_running` holds the
engine on the fatal Error (before TurnEnd). It failed without the
`turn_busy` clear on fatal Error, then passed with it.
