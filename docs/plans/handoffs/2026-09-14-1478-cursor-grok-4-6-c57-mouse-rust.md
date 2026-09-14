---
session: 2026-09-14T14:56-05:00
model: Grok 4.6 (Cursor)
description: >-
  Prime stream still omits Limited tools. Mouse-back stays on the note
  trail. Native Sentry still leaves ghr_ / sk_live_ / sk_test_.
commits: uncommitted
---

# C57 prompt-only + mouse-back + rust prefixes

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:56 · leftover tests.

Prime still does not send a permission field on `stream_prime_session`.
Mouse back/forward still walks notes only — no session stack. Native
Sentry still leaves `ghr_` / `sk_live_` / `sk_test_` (JS already
redacts them). Do not widen rust this window.

```bash
npx vitest run src/utils/streamAiAgent.test.ts src/hooks/useNavigationGestures.test.ts -t "Limited tools|note trail"
cargo test --manifest-path src-tauri/Cargo.toml scrub_secrets_does_not_yet_cover_ghr
```

**3 JS + 1 rust PASS.** No product edit. Do not pick a mouse-back
winner. Do not close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
