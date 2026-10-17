---
session: 2026-10-17T12:16Z
model: Grok 4.7 (Cursor)
description: >-
  Keychain lock, corrupt legacy key file, read-back wording, torn
  native log lines, and small atomic/sandbox warnings.
commits: local
---

# Backend robustness

**Origin:** Cursor Grok 4.7 · 2026-10-17 · audit of `c210019b`.

## What changed

- A locked or denied keychain stays in Free tier (auto) and the chat
  error names the keychain. A missing key still says no key is set.
- A legacy key file that cannot be read no longer hides a keychain
  key. Migration is still write, read back, then remove.
- A save that does not read back restores the previous key when it
  can, and the error says what happened.
- A short log write is truncated to the last good length. A bad line
  on reopen does not drop later lines with the next sequence number.
- A metadata error other than "not found" is not treated as a new
  file. A failed extended-attribute copy and a vault root that cannot
  be resolved are logged.

## Left alone

`scrub_secrets`, `shell.rs`, `engines/native.rs`, the chat engine
default, and Prime/Hermes.
