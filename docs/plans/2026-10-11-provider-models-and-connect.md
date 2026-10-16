# Provider model list and connect flow

**Origin:** Claude Haiku 5.5 · 2026-10-11 · uncommitted, first slice only

## Problem

- The composer model picker shows only models from providers the user added in settings. Each provider has one default model id, so the list looks like one or two old models per lab.
- Settings "connected" badges come from Prime's `~/.prime/agent/auth.json` and env vars (`src-tauri/src/preflight.rs` `provider_statuses`). They do not reflect the keys Rhizome saves in its own keychain (`src-tauri/src/provider_keys.rs`, ADR-0185). So a key saved in Rhizome shows as disconnected, and a Prime leftover shows as connected.
- Rhizome is its own harness (ADR-0180). Prime is optional. Settings should not depend on Prime's credential file.

## What providers allow (checked 2026-10-11, one search per provider, not official docs)

| Provider | Third-party OAuth | Path to use |
|---|---|---|
| Anthropic / Claude | No. Subscription OAuth in third-party apps is reported as banned (Feb to Apr 2026). | Console API key, validated by `GET /v1/models`. |
| OpenAI / ChatGPT | Limited. "Sign in with ChatGPT" needs an OAuth client from OpenAI for selected partners. Reusing the Codex CLI token is unsupported. | API key now. Apply for the OAuth client as a separate track. |
| xAI / Grok | No official third-party OAuth found. The OAuth seen in the wild uses an undocumented endpoint. | Console API key. |
| Google Gemini, OpenRouter, others | API key | API key, validated by `GET /models`. |

Decision: "connect" means a guided API-key flow with a live check. Do not build subscription-token reuse or undocumented endpoints.

Sources for the search results: [Anthropic third-party block](https://gigazine.net/gsc_news/en/20260220-anthropic-third-party-block), [OpenAI sign-in with ChatGPT](https://developers.openai.com/siwc/website), [xAI API keys](https://go.collab365.com/how-to-get-a-grok-api-key). These are secondary sources except the OpenAI docs link. Check the official Anthropic, OpenAI, and xAI docs before shipping.

## Done (this slice)

- `ai_models::list_provider_models`: calls `GET {base_url}/models` with the key Rhizome holds. Test: `list_provider_models_returns_the_ids_the_provider_reports`, passing.
- Tauri command `list_ai_model_provider_models` (desktop), mobile stub, registered in `lib.rs`.
- `cargo fmt --check` passes.

## Remaining

1. Frontend hook `useProviderModels(provider)` that calls the command, caches per provider id, and returns `{ models, error }`.
2. Composer picker (`buildAiWorkspaceTargetGroups` in `src/components/aiWorkspaceTargetGroups.ts`) lists discovered models for each provider that has a key. Keep the saved default model.
3. Settings connection state: a Rhizome-owned command that reports, per catalog provider, whether a keychain key exists and whether the last live check passed. Replace the Prime-derived badges in `PrimeProviderStatusSection.tsx` for these providers.
4. Guided connect: paste key, run live check, show model count or the provider's error, then save. Use `Input` and `Button` from shadcn.
5. Update the provider catalog defaults in `src/shared/aiModelProviderCatalog.json` to current model ids after checking each provider's model docs.
6. Tests: Vitest for the hook and picker grouping; Rust for the connection-state command.
7. Not started: OpenAI OAuth client application (outside code).
8. Docs and branding for "Rhizome, not Prime" (raised by the user). Track separately.

## Not changed

`src/components/ChatHome.tsx` had uncommitted edits before this session. Left as is.
