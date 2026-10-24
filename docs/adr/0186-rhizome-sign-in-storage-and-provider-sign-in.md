---
type: ADR
id: "0186"
title: "Rhizome keeps its own sign-in storage; provider browser sign-in follows each provider's terms"
status: active
date: 2026-10-16
supersedes: "0176 (sign-in part only)"
---

**Origin:** MyNAEga · 2026-10-16 · Builders room
**Decisions confirmed:** knispo · 2026-10-16 · own sign-in storage, OpenAI and xAI first, key import. Claude subscription sign-in dropped for now (knispo, 2026-10-16); it may return only with extra usage enabled and only if Anthropic allows Rhizome (see decision 4 and Provider terms).

## Context

[ADR-0176](0176-settings-sign-in-through-prime-auth-storage.md) routed Settings sign-in through Prime's auth storage. [ADR-0185](0185-provider-keys-in-the-os-keychain.md) put provider keys in the OS keychain. knispo wants subscription sign-in (no API key) inside Rhizome, as other harnesses offer.

## Decision

1. **Rhizome owns its sign-in storage.** OAuth tokens live in the OS keychain (macOS Keychain first) through `provider_keys` / `keyring`, service `ai.rhizome.agent`, account `<provider id>:oauth`. This supersedes the sign-in part of ADR-0176. Prime login is gone with the Prime engine (ADR-0189).
2. **OpenAI first:** "Sign in with ChatGPT" through OpenAI's documented open-source flow (system browser, loopback on 127.0.0.1, PKCE, `client_id=dynamic_agent_client`, `agent_name_hint=Rhizome`, scopes incl. `offline_access` and `resource.invoke chatgpt.tokens.use.direct`, resource `https://api.openai.com/v1`). Do **not** reuse the Codex CLI client id, `~/.codex/auth.json`, or `chatgpt.com/backend-api/codex`. If Rhizome ever ships as a paid or hosted app, join OpenAI's waitlist first.
3. **xAI first, with a caveat:** SuperGrok / X Premium+ browser sign-in (PKCE, loopback) or device code against `auth.x.ai`, calling `https://api.x.ai/v1`. xAI publicly endorses this for open-source agents, but publishes no client registration; current tools reuse a shared public client id with `referrer=hermes-agent`. v1 ships xAI sign-in as a preview on the Grok CLI's public client id (knispo, 2026-10-24: "oauth isnt against any rules"). The client id is a setting that defaults to that id, and Rhizome is never presented as another product. Rhizome still asks xAI for its own client id. If xAI blocks the shared id or returns a 403 entitlement error, show a clear "use an API key" message; the API key path stays as the fallback.
4. **Claude: API key only.** Anthropic's terms forbid third-party apps from offering Claude.ai login or holding Claude.ai tokens. Rhizome builds no Claude OAuth. The extra-usage opt-in does not change this (see Provider terms). There is no Claude Code engine either: ADR-0189 removed outside engines, and knispo confirmed on 2026-10-24 that Claude stays out of sign-in.
5. **API key import from other harnesses:** keys only, never another app's OAuth tokens. The user ticks each key, sees it masked, Rhizome copies it into the keychain, makes one test call, and never writes back to the source app.
6. **OpenRouter (optional):** OpenRouter's PKCE flow returns a user-owned API key; store it like any key (ADR-0185).

**Builder:** G-baby (changed from Dank.bot on 2026-10-24, when knispo approved Julian's four-PR sign-in plan in Builders). v1 keeps one signed-in account per provider; switching accounts is sign out, then sign in.

## Rev 2 (2026-10-24): implementation rules for the sign-in PRs

knispo approved Julian's four-PR plan in Builders ("go", 2026-10-24 1:07 PM CT). These rules bind PRs 1 to 4 (#264, #265 and their follow-ups):

1. **ChatGPT chat uses the Responses API** with `store: false`, `stream: true` and `include: ["reasoning.encrypted_content"]`. A turn is done only at `response.completed`.
2. **ChatGPT login registers through `dynamic_agent_client`**, which returns Rhizome's own `oaiapp_` id. No borrowed client id and no fixed port 1455; the loopback listener takes any free port.
3. **Refresh is single-flight** (an in-process mutex plus a file lock). The rotated token pair is saved before it is used. `invalid_grant` shows "Sign in again". A token that expires mid-stream refreshes once, and only before any output has streamed.
4. **Reasoning replay** between tool steps is kept per chat and cleared when the chat closes.
5. **Accounts:** one account per provider. Sign-out revokes the token. Each sign-in has its own on/off setting, and the API key path always keeps working.
6. **xAI login (PR 4)** follows decision 3: a preview on the Grok CLI's public client id, which is a setting, with the API key as the fallback.
7. **Tests and redaction:** CI uses only a mock OAuth server and a mock Responses stream, with no live provider calls. Tokens are redacted from logs, Sentry and error messages, and a test proves it. A sign-in PR that breaks either rule is held.

## Provider terms (checked 2026-10-16)

| Provider | Works | Allowed by current terms | Client registration |
| --- | --- | --- | --- |
| OpenAI (ChatGPT Plus/Pro) | Yes | Yes for open-source / local apps via Sign in with ChatGPT; paid or hosted apps need waitlist approval | Yes, dynamic registration in the flow. Codex CLI endpoint is undocumented, not a contract |
| xAI (SuperGrok / X Premium+) | Yes (some standard-tier 403s reported) | Endorsed by xAI for open-source agents (OpenCode, Kilo Code) | None published; tools share one public client id |
| Anthropic (Claude Pro/Max) | Technically, until enforced | No. Third parties may not offer Claude.ai login or store its tokens | None; OAuth is for Anthropic's own apps |
| OpenRouter | Yes | Yes, documented for apps | Not needed; PKCE yields an API key |

**Claude "extra usage":** Anthropic "may at its discretion allow paid subscribers who have enabled usage credits to use certain third-party tools", billed from credits, not plan limits. That is Anthropic's call per tool, not a door a third party opens with its own login, and the Claude Code legal page still bars third-party Claude.ai login. Revisit only if Anthropic names Rhizome or publishes a registration path.

Sources:
- OpenAI: https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt ; https://developers.openai.com/siwc/quickstart ; https://github.com/openai/codex/issues/36886
- xAI: https://x.ai/news/grok-opencode ; https://x.ai/news/grok-kilocode ; https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth ; https://github.com/NousResearch/hermes-agent/issues/26847
- Anthropic: https://code.claude.com/docs/en/legal-and-compliance ; https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account ; https://www.theregister.com/software/2026/02/20/anthropic-clarifies-ban-on-third-party-tool-access-to-claude/5014546 (2026-02-20)
- OpenRouter: https://openrouter.ai/docs/guides/overview/auth/oauth

## Options considered

- **A** (chosen): own keychain storage plus per-provider terms.
- **B**: keep Prime auth storage (ADR-0176). Ties sign-in to the Prime engine.
- **C**: reuse official CLI client ids and token files for all three. Works today, breaks without notice, and for Claude violates the terms.

## Consequences

- Claude in Rhizome is API key only; there is no Claude subscription path.
- xAI sign-in depends on a shared client id until xAI issues one; re-evaluate when it does.
- Re-check terms before each sign-in release.
