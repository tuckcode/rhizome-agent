---
session: 2026-10-17T17:50Z
model: Grok 4.7 (Cursor)
description: >-
  Review holds on the in-app updater: placeholder key refuses before
  any network call, only HTTP 404 means no update, and unsigned feeds
  do not replace the moving tags.
commits: this slice
---

# Updater review holds

**Origin:** Grok 4.7 (Cursor) · 2026-10-17 · #220 review holds

Check and install return `In-app updates aren't available yet.` when
`plugins.updater.pubkey` is still the placeholder, before any feed
request. A 404 is "no update". 403, 429, and 5xx are check errors.
The user-facing check message stays plain. The raw detail is logged.

`alpha-latest` and `stable-latest` are republished only when every
platform object has `signature`. `updater:default` is gone from the
desktop capability. The frontend does not import the updater plugin.

Deferred: the Windows passive installer closes the app, and the banner
does not yet warn about unsaved work. That needs a new string, and
`en.json` is held by #218.
