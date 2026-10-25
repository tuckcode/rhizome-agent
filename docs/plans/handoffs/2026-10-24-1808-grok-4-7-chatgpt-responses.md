---
session: 2026-10-24T18:08Z
model: Grok 4.7 (Cursor)
description: >-
  ChatGPT Responses streaming client. store false, namespaced tools,
  reasoning replay, model-list fallback. Gated until the sign-in core
  marks a provider as signed-in ChatGPT.
commits: feat: stream signed-in ChatGPT through the Responses API
---

# ChatGPT Responses client

**Origin:** Cursor Grok 4.7 · 2026-10-24 · PR 2 of the sign-in plan (ADR-0186)

## What landed

- `src-tauri/src/ai_models/openai_responses.rs` streams `POST /v1/responses`
  into `ModelEvent`. `store` is false, `stream` is true, the system prompt
  is `instructions`, and `temperature` / `max_output_tokens` are not sent.
  The body always includes `reasoning.encrypted_content`, which is what
  makes reasoning replay work with `store: false`.
- Tools go out in the `rhizome` namespace and come back as the bare name.
  Tool results go back as `function_call_output`.
- A finished reasoning item with `encrypted_content` is replayed on the
  next step of the same in-memory session.
- A turn is done only at `response.completed`. `response.failed` and a
  stream that ends early are errors. Usage-limit codes are plain English.
- An expired token before any text or tool call refreshes once and retries.
  After output, or when refresh fails, the turn ends with "Sign in again".
- `GET /v1/models` keeps `visibility: "list"` (`slug`, `display_name`).
  A failed list returns the built-in models and does not error.

## Hookup

`chat_auth_kind_for_provider` calls
`chat_auth_kind(provider_is_signed_in_chatgpt(&provider.id))`.
The bearer is `fresh_access_token` when that is true, otherwise
`api_key_from_provider`. A mid-stream expiry calls `force_refresh`.
The same access token coming back is a failure.

`rhizome_loop/mod.rs` was not changed.
