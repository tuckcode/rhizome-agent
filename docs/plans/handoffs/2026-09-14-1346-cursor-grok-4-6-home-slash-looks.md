---
session: 2026-09-14T13:46-05:00
model: Grok 4.6 (Cursor)
description: >-
  looks_like_vault also refuses HOME with a trailing slash.
  Pair with vault_list ~/ and HOME/. Did not close #46. No commit.
commits: none
---

# looks_like_vault HOME/ — 2026-09-14 13:46

**Origin:** Cursor Grok 4.6 · leftover #46 test · no commit

`the_home_directory_is_never_a_vault` now also checks `$HOME/`.
`is_home_directory` canonicalizes, so the slash must still fail.

Focused `cargo test --lib prime_vault_skill::tests::the_home_directory_is_never_a_vault` — **ok**.

Did not close #46. Did not change `normalize_cwd("")`.
