---
session: 2026-10-17T12:05Z
model: Grok 4.7 (Cursor)
description: >-
  Session search index scrubs chat text and is owner-only. The secret
  scrubber catches prefixed KEY/TOKEN/SECRET assignments and known key
  prefixes. create_note refuses secret and .git paths.
commits: secret-index commit on this branch
---

# Secret index and create_note denylist

**Origin:** Cursor Grok 4.7 · 2026-10-17 · audit of main `c210019b`

## What changed

- Indexed turn text and titles go through `scrub_secrets` before the
  session transcript index is written. The index file is `0600` on Unix,
  including a file that already exists when it is loaded. Writes use
  `write_owner_only_atomic`. Updates share an in-process lock. A failed
  index update is logged.
- `scrub_secrets` matches prefixed `KEY` / `TOKEN` / `SECRET` assignments,
  `nvapi-` and `AIza` keys, and a 32-character Mistral key next to the
  word mistral. Ordinary words and a bare hash stay.
- `create_note` calls `resolve_for_write`, so Power User cannot write
  `.env*`, private keys, or anything under `.git`.
- A vault root that cannot be canonicalized is logged and skipped.

## Not in this change

Prime, Hermes, the chat engine default, and `shell.rs` were left alone.
