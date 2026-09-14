---
session: 2026-09-14T13:38-05:00
model: Grok 4.6 (Cursor)
description: >-
  D6 Rust dirt restamp. lib.rs now has product mod secure_fs plus
  hide-on-close test. Not all dirty Rust is test-only.
commits: none
---

# D6 Rust dirt restamp — 2026-09-14 13:38

**Origin:** Cursor Grok 4.6 · leftover D6 paper · no commit

`git diff src-tauri/src/lib.rs` shows two hunks:

1. `+mod secure_fs;` — product, group 7
2. hide-on-close test body — group 4

`settings.rs` / `ai_models.rs` / `telemetry.rs` / new `secure_fs.rs`
are product. `prime_vault_skill.rs` and `vault_list.rs` stay test-only.

The 13:11 “all test-only” sentence would have put `mod secure_fs` in
the wrong commit. Restamped in `2026-09-14-d6-commit-groups.md`.
