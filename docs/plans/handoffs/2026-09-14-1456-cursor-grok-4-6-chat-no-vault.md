---
session: 2026-09-14T14:24-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat still mounts with no vault. Preflight sits on the composer.
  Do not close #46 from this unit lock.
commits: uncommitted
---

# Chat without a vault still mounts

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:24 · leftover chrome lock.

Chat is first. A vault is optional. Empty `vaultPath` must not hide
Chat. Preflight (banner) sits on the composer and names a blocked
folder or missing provider — it is not a gate that removes Chat.

## Tests

`src/components/ChatHome.test.tsx` **15/15** (added 2):

- Empty vault still renders the Chat panel stub
- `ChatPreflightBanner` gets `vaultPath` + provider

## Not this window

- Live Chat-without-vault on packaged `476756c` — **NOT RUN**
- Do **not** close GitHub **#46** from this unit
- Do not change `normalize_cwd("")`
- D6 commits wait ~15:45
