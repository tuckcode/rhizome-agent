---
session: 2026-10-16T00:10Z
model: Grok 4.6 (Cursor)
description: >-
  Native Chat fork copies the transcript into a new native chat; native
  archive files Rhizome session ids. Inbox date labels take the app
  locale. #167 YAML keys stay unindented and "1 tool" is singular.
  #165 drops the duplicate graphData import and respects Escape
  defaultPrevented.
commits: this slice
---

# Native fork / archive plus leftover nits

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

ChatHome always asked the panel to fork a Prime entry. Native turns have
no Prime entry id, so Fork was disabled or called `fork_prime_session`.
The panel now forks Prime entries only on the Prime engine. Native Fork
copies the transcript through the chosen turn into a new native chat.

Archive on native chats called the Prime settings list. Native rows now
come from `native_chat_list`, and Archive writes
`archived_native_sessions` through `set_native_session_archived`. The
rail session list mounts on native as well as Prime (C95).

NoteItem passes `useAppLocale()` into `formatInboxDateLabel`. Agent-run
YAML matches unindented keys only. One tool prints as "1 tool". The 3D
graph imports `./graphData` once. Graph Escape returns when
`event.defaultPrevented` is set.

Did not edit `docs/HANDOFF.md`. Did not merge.
