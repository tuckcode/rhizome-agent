---
type: ADR
id: "0004"
title: "Vault vs app settings for state storage"
status: active
date: 2026-03-24
---

## Context

As features were added, there was recurring ambiguity about where to persist configuration and state: in the vault (as frontmatter in `.md` files) or in app settings (`~/.config/com.laputa.app/settings.json` / localStorage). Without a clear rule, some decisions were inconsistent.

## Decision

**Ask: "Would the user want this to follow the vault across all their installations?"**

- If **yes** → store in the vault (as frontmatter in the relevant `.md` file, using the `_` convention for system properties)
- If **no** → store in app settings

Examples:
| Data | Storage | Reason |
|------|---------|--------|
| Note type icon (`_icon`) | Vault frontmatter | Follows the vault everywhere |
| Note type color (`_color`) | Vault frontmatter | Follows the vault everywhere |
| Note sort preference | Vault frontmatter (type file) | Per-vault, consistent across devices |
| API keys (Anthropic, OpenAI) | App settings | Installation-specific |
| GitHub token | App settings | Installation-specific |
| Window size / zoom | App settings | Device-specific |
| Editor zoom level | App settings | Device-specific |
| Telemetry consent | App settings | Installation-specific |

## Alternatives considered

- **Everything in localStorage**: simple, but breaks cross-device sync for vault-level config.
- **Everything in vault**: pure, but makes device-specific settings (zoom, window size) propagate to all devices — confusing.

## Consequences

- Config that "belongs to a note or type" lives in frontmatter — readable/diffable in git
- The `_` prefix convention (see ABSTRACTIONS.md) distinguishes system properties from user properties
- App rebuilds from vault state on open — no stale config files to manage
- Triggers re-evaluation if: vault files become too polluted with system frontmatter properties
