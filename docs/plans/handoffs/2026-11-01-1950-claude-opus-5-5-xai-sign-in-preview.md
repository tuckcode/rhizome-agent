---
session: 2026-11-01T19:50:00-05:00
model: Claude Opus 5.5
description: xAI sign-in preview (ADR-0186 decision 3). Device-code flow, client id setting, plain 403 with API key fallback. Real sign-in still needs one approval.
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

## Not verified

- A real sign-in from Rhizome. A probe with the same requests waits for approval.
- Chat with a sign-in token. Chat completions on `api.x.ai` is an assumption. Hermes uses the Responses API.
- That `b1a00492-073a-47ea-816f-4c329264a828` is the current Grok CLI id. OpenCode, Hermes, and open-grok-build use it, but Grok CLI 1.0.70 does not hold it as plain text. The string search matched zero times.
- The 403 body and tier rules. The evidence is hermes-agent issue 26847, and a later comment there disagrees.

## Follow-ups

- Run the Connected sign-in in a native build and record the result here.
- If chat completions rejects the token, route xAI through the Responses client.
