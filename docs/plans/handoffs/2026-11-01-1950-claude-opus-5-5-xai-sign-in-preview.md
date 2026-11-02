---
session: 2026-11-01T19:50:00-05:00
model: Claude Opus 5.5
description: xAI sign-in preview (ADR-0186 decision 3). Device-code flow, client id setting, plain 403 with API key fallback. Real sign-in and chat passed in a native dev build.
---

**Origin:** Claude Opus 5.5 · 2026-11-01 · Claude Code desktop, branch `claude/sleepy-spence-07168f`

## What changed

- `provider_oauth/xai.rs` runs the device-code grant at `auth.x.ai`. The system browser opens the approval page.
- `client_ids.xai` in `oauth-sign-in.json` replaces the default client id.
- The token goes only to `https://api.x.ai/v1`, through chat completions on the `xai` Settings row.
- Settings > Connected adds the row after sign-in, shows the short code, and offers "Add an xAI API key" on an error.
- The picker sends xAI sign-in to Settings > Connected.

## What I verified, and where

- `https://auth.x.ai/.well-known/openid-configuration`, read 2026-11-01: endpoints, scopes, and grants.
- A live `POST /oauth2/device/code` with the shared client id and `referrer=rhizome` returned 200.
- OpenCode source (`packages/core/src/plugin/provider/xai.ts`) and Hermes source (`hermes_cli/auth_xai.py`): both use device code. OpenCode moves stored browser credentials to device code.

## Decision: device code

ADR-0186 allows browser PKCE or device code. I chose device code because it is the only flow I confirmed live. `curl` to `/oauth2/authorize` returned 403, and the built-in browser blocks `auth.x.ai`, so the loopback flow is unverified.

## Real sign-in result (2026-11-01)

A probe sent the same requests as `xai.rs`, and Atticus approved code `PHPQ-AQAM` on a real account. It held tokens in memory and revoked them.

| Step | Result |
|---|---|
| Device code, token | 200. Scope includes `api:access`. `expires_in` 21600 |
| `/oauth2/userinfo` | 200, with `sub` and `email` |
| `GET /v1/models` | 200, 14 models |
| `POST /v1/chat/completions`, `grok-4.3` | 200 |
| `POST /v1/responses`, `grok-4.3` | 200 |
| Refresh | 200, the refresh token rotated |
| Revoke | 200 |

## Native QA (2026-11-01)

Atticus ran these steps in a dev build, on macOS:

- ✅ Settings > Connected > Sign in with xAI: the row showed Ready, the email, and 14 models.
- ✅ A `grok-4.7` chat replied. The keychain held `xai:oauth` and no `xai` key, so the chat used the sign-in token.

The test found two bugs, both fixed:

- The xAI API key row said Ready with no key. Connected now hides that row while the account is Ready.
- A reopened picker called a live-listed model "removed". `includeRemovedProviderModel` now checks the provider rows.

## Not verified

- A real 403. This account has access, so only a mock server covers it. The evidence for the body is hermes-agent issue 26847, and a later comment there disagrees.
- That `b1a00492-073a-47ea-816f-4c329264a828` is the current Grok CLI id. OpenCode, Hermes, and open-grok-build use it, and xAI accepted it, but Grok CLI 1.0.70 does not hold it as plain text.
- Browser loopback PKCE. Device code replaces it.

## Follow-ups

- The picker lists image and video models for xAI. These models may not work in chat.

## C102: flaky native chat test

`commands::native_chat::tests::forked_session_sends_kept_history_on_the_next_turn` failed once in the pre-push Rust lane with `send: "native chat worker closed"`. It passed 3 of 3 runs alone. This branch does not touch that code. The cause is unknown. It may be a race with another test in the full run.
