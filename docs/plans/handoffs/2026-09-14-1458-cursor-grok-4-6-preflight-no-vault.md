---
session: 2026-09-14T14:28-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat preflight still runs with no vault. Provider warn can show.
  Do not close #46.
commits: uncommitted
---

# Preflight without a vault

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:28 · leftover chrome lock.

Empty `vaultPath` still calls `preflight_chat`. A healthy check stays
silent. A disconnected provider can still warn. Chat does not hide.

## Tests

`src/components/ChatPreflightBanner.test.tsx` **7/7** (added 2).

Pairs with ChatHome empty-vault mount
([1456](2026-09-14-1456-cursor-grok-4-6-chat-no-vault.md)).

## Not this window

- Live Chat-without-vault **NOT RUN**
- Do **not** close #46
- Do not change `normalize_cwd("")`
- D6 commits wait ~15:45
