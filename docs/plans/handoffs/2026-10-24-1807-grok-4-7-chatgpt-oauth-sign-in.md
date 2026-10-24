---
session: 2026-10-24T18:07Z
model: Grok 4.7 (Cursor cloud)
description: >-
  PR 1 of the ChatGPT sign-in plan. Rust sign-in core and ChatGPT login
  only. Mock OAuth server. No frontend. PR 2 (Responses) is a separate branch.
commits: pending
---

# ChatGPT OAuth sign-in core

**Origin:** Grok 4.7 · 2026-10-24 · ADR-0186, plan Rev 2.1

## What landed

- `provider_oauth` registers through `dynamic_agent_client`, keeps the
  issued `oaiapp_` id and a per-install `urn:uuid` host id in the keychain.
- Loopback is `127.0.0.1` on a free port, never 1455. PKCE S256, state,
  nonce, five-minute timeout, cancel, and a close-this-tab page.
- ID tokens are checked against JWKS. Missing `chatgpt.tokens.use.direct`
  is stored and reported not usable.
- Refresh is one flight (mutex plus file lock). The new pair is saved
  before it is returned. `invalid_grant` is `Sign in again`.
- Sign-out revokes, deletes `<provider>:oauth`, and keeps the host id.
- The switch is `oauth-sign-in.json`, not `Settings`. API-key storage is
  unchanged. `api_key_storage: oauth` is the variant that asks for a token.

## Not in this PR

- Frontend, locales, Responses API, `rhizome_provider_model.rs`.
- A live Plus-account sign-in. CI uses the mock server only.

## Manual check still open

Sign in with a ChatGPT Plus account and confirm the status email, a model
call, refresh after the access token is near expiry, and sign-out.
