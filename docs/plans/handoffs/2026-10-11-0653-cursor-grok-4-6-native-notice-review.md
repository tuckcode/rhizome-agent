---
session: 2026-10-11T06:53Z
model: Grok 4.6
description: >-
  Ricky #148 review: warning-tone LocalMarker, notices go through
  ChatRunLiveStatus, same-text notice is shown once per turn.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · native notice review

## What landed

`LocalMarker` can take `tone="warning"` (`--feedback-warning-text`). It is
not a live region. `onNotice` appends that marker once per distinct text
in the turn and `ChatRunLiveStatus` announces it on the existing polite
status region.

A missing `fatal` field is still fatal. After a fatal no-key error,
`NativeChats::send` must not return "already running".
