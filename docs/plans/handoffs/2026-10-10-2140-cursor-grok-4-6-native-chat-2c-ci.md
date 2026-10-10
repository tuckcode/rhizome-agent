---
session: 2026-10-10T21:40Z
model: Grok 4.6
description: >-
  CI follow-up for draft #130 (step 2c). Rust index race + CodeQL
  session_id write in tests. Did not edit HANDOFF.md.
commits: cursor/native-chat-2c-81d3
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 21:40 UTC

## What landed

Did not edit `HANDOFF.md`. Product 2c behaviour is unchanged.

- `transcript_index_contains_native_turn` waited 80ms and missed the
  index write under `cargo llvm-cov`, then poisoned `ENV_LOCK`.
- Tests now isolate HOME then cache, wait for the index/log path, and
  recover a poisoned mutex.
- Fixtures go through `native_log::write_fixture` / `create_session_log`
  instead of test `fs::write` of `session_id` (CodeQL cleartext-logging).

## Tests

`cargo test --lib native_chat` 22 passed. Combined `transcript_index`
filter (native + session_transcript_index) 5 passed. Clippy `-D warnings`
and `cargo fmt` clean.
