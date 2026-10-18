---
session: 2026-10-17T14:00Z
model: Cursor Grok 4.6
description: >-
  Merge origin/main #213 into audit-chat UI. Keep Chat switch and
  every #209 collapsed-row / title / empty-state behavior.
commits: cursor/audit-chat-ui-2269
---

# Audit chat merge #213

**Origin:** Cursor Grok 4.6 · 2026-10-17 · PR #209 onto `6bf83037`.

Conflicted file: `src/components/ChatHome.tsx`.

Resolution: #213's `engineChromeReady`, `panelEngine`, and settled lock stay.
#209's `showChatTopBar` stays off `effectiveEngine === 'prime'` and still
waits for settings to settle. `onSessionHeader` and the primitive title key
stay.
