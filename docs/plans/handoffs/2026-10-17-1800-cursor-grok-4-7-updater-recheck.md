---
session: 2026-10-17T18:00Z
model: Grok 4.7 (Cursor)
description: >-
  Updater re-check: the config endpoint is an unused fallback, find_update
  refuses a placeholder config before any request, and HTTP 204 means no update.
commits: this slice
---

# Updater re-check

**Origin:** Grok 4.7 (Cursor) · 2026-10-17 · #220 re-check

`UpdaterBuilder::endpoints` replaces the config list. The checked-in
endpoint stays as an unused fallback. `find_update` reads the pubkey
from a mock app and returns before `fetch_feed` when it is the
placeholder. An empty or whitespace-only pubkey does the same. HTTP 204
is no update, same as 404.

The extra feed probe stays. The plugin reports 404, 403, and 5xx as the
same `ReleaseNotFound`, so one plugin request cannot tell "no update"
from a check error. The user-facing unavailable sentence lives only in
`app_updater.rs`.
