---
session: 2026-10-11-1856
model: Cursor Grok 4.6
description: Replay last Prime host status so ChatHome does not miss the first poll
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · #155 CI follow-up

## What was true

`usePrimeHostStatus` shares one poll per vault. App starts that loop.
ChatHome often subscribed after the first tick had already published.
New listeners started at `EMPTY` (`running: false`) until the next 4s
interval. After the catalog slice, that empty status flipped the
composer to the Rhizome catalog and send went native, so Prime-path
App tests never saw `prime-model-chip` and `streamAiAgent` stayed at 0.

## What changed

- The shared loop keeps `lastStatus` and replays it to late subscribers.
- App tests wait for a live host (and the Prime chip) before asserting
  Prime send; a down host stays on the native path.

## C-numbers

None opened.
