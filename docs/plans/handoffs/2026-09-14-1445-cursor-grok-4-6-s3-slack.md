---
session: 2026-09-14T14:12-05:00
model: Grok 4.6 (Cursor)
description: >-
  S3 leftover Slack prefixes xoxa/xoxr/xoxs/xoxe in JS. Native Sentry
  already listed them; leftover rust cases plus hf_/npm_/glpat-. No
  commit.
commits: none
---

# Slack leftover prefixes — 2026-09-14 14:12

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

JS `TOKEN_PREFIXES` already listed `xoxa-` / `xoxr-` / `xoxs-` / `xoxe-`.
Earlier cases locked `xoxb-` and `xoxp-`. Native `scrub_secrets` already
matches `xox[abprse]-` plus `hf_` / `npm_` / `glpat-`.

`sk_live_` / `sk_test_` / `ghr_` stay **JS-only**. Did not widen rust.

```bash
npx vitest run src/lib/sensitiveTextRedaction.test.ts
cargo test --manifest-path src-tauri/Cargo.toml \
  scrub_secrets_redacts_remaining_slack_prefixes
cargo test --manifest-path src-tauri/Cargo.toml \
  scrub_secrets_redacts_listed_hf_npm_and_gitlab_prefixes
```

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
