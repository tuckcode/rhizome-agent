---
session: 2026-10-17T12:16Z
model: Grok 4.7
description: >-
  Locked keychain is its own free-tier state. A bad legacy key file
  no longer hides keychain keys. Torn chat logs truncate and resync.
  Atomic metadata and skipped vault roots fail visibly.
commits: HEAD
---

**Origin:** Cursor Grok 4.7 · 2026-10-17 · keys and logs

## What landed

A locked or denied keychain is `TargetAccess::KeychainUnavailable`.
Free tier stays in the picker. Chat and Settings say "The keychain is
locked or access was denied." A missing key still says no key is set.

A legacy key file that is empty or not JSON is treated as no legacy
key and logged once. The keychain value is returned. Migration stays
write, read back, then remove. A read-back mismatch says the keychain
entry was written and the legacy file was left unchanged.

A failed native log write truncates back to the last good length. The
reader keeps later lines that still match the next sequence. A
poisoned log mutex is recovered once per session and logging continues.

`write_atomic` returns metadata errors other than not found. A failed
xattr copy is logged. An extra vault root that cannot be canonicalized
is logged and skipped.

## Left alone

Session search index, secret regex, `create_note`, `shell.rs`, and the
chat engine default.
