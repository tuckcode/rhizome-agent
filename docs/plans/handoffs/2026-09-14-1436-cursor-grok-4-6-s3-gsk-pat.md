---
session: 2026-09-14T13:59-05:00
model: Grok 4.6 (Cursor)
description: >-
  S3 leftover: gsk_ and github_pat_ redact in JS and native Sentry scrub.
  Synthetic only. No commit.
commits: none
---

# S3 Groq + GitHub PAT — 2026-09-14 13:59

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

`xai-` was locked at 13:55. The leftover was `gsk_` and `github_pat_`
in the same prefix list, plus the native Sentry scrubber.

Added one JS case and one Rust case. Synthetic bodies only. Did not
read live `.env` or real keys.

```bash
npx vitest run src/lib/sensitiveTextRedaction.test.ts
cargo test --manifest-path src-tauri/Cargo.toml \
  scrub_secrets_redacts_groq_and_github_pat_prefixes
```

**21/21 JS PASS. 1/1 Rust PASS.** `cargo fmt --check` clean.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
