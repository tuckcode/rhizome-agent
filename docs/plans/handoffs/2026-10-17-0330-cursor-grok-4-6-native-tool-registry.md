---
session: 2026-10-17T03:30Z
model: Cursor Grok 4.6
description: >-
  Native loop tool registry: each tool has a name, run function, and
  policy. Unknown tools error and never match a session grant.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · native file-tools PR 1 (registry only)

`rhizome_loop/tools.rs` is a small registry (`echo`, `bash`,
`create_note`). An unknown name returns an error instead of echoing
its args. `policy.rs` reads offer rules and session matching from that
registry. Unknown tools always ask and `session_matches` is false for
them. `bash` is still not a process. Default engine and `install.sh`
were not touched.

Localization: none — English only (C18).
PostHog: no event needed because this is loop policy, not a new UI
action.
