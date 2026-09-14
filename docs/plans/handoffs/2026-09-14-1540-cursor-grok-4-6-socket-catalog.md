---
session: 2026-09-14T15:59-05:00
model: Grok 4.6 (Cursor)
description: >-
  Leftover locks: do not spawn onto RHIZOME_PRIME_DAEMON_SOCKET. Do not
  cache a failed model catalog. Retry ensure on the status poll.
commits: uncommitted
---

# Socket / catalog leftover

**Origin:** Cursor Grok 4.6 · 2026-09-14 15:59 · leftover.

An overridden socket still stops Rhizome from spawning a second
supervisor. A failed model catalog is still not remembered. The status
poll still retries ensure when the host is down.

## Not this window

- C64 ×3 / W4 / hide / last-idle still **NOT RUN**. App still `476756c`.
- No push. No rebuild.
