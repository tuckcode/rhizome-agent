---
session: 2026-09-06T23:02Z
model: Composer
description: >-
  Daily-drive gap audit on providers: DeepSeek/Nous Settings cards already in
  working tree. Fixed false “connected” when OAuth Expired (Chat preflight) and
  Nous env-key detection.
commits: uncommitted
---

# Provider preflight gap (expired + Nous)

**Origin:** Composer · 2026-09-06

## Audit

| Ask | Evidence |
|---|---|
| DeepSeek / Nous in Settings | Already in uncommitted `PrimeProviderStatusSection` (`ALWAYS_SHOW_PROVIDERS`) |
| Anthropic / xAI reconnect | Settings Reconnect copies `prime-agent --provider …` |
| Chat false status on Expired | **Was a bug:** `connected_providers` listed expired OAuth names → preflight green |
| Mid-turn / tools | Live mid-turn proven earlier; tooling path shipped C69 |

## Fix this turn

- `providers_from_auth_file` drops `expired` providers before Chat preflight.
- `PROVIDER_ENV_VARS` includes `("nous-portal", "NOUS_API_KEY")`.
- Tests: `expired_oauth_is_dropped_from_the_connected_name_list`,
  `nous_portal_key_in_the_environment_counts_as_connected`.

## Still open for daily-drive goal

C57 · session-import UI · C70/C71 · first-run vault scaffold · packaging.
Do not mark goal complete.
