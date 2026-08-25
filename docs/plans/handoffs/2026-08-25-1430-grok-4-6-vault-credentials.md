---
session: 2026-08-25T14:30-05:00
model: Grok 4.6 (Cursor)
description: >-
  #29: tokens-only credential redaction before chat/distill vault writes;
  explicit Save to vault refuses. Detector was telemetry-only and would have
  mangled notes if wired as-is.
---

# Vault credential redaction (#29)

The open security-consequence issue is **#29**, not adapter drift. Chat can
put a PAT or API key into a vault note; AutoGit commits it; auto-sync can
push it. A secret in git history on a remote survives file deletion.

## What landed

New public entry point `redactCredentialTokens` — tokens only, formatting
and paths preserved. `sk-` now requires a ≥20-char `[A-Za-z0-9_-]` body so
SpinKit (`sk-circle`) is not a key. Assignments like `TOKEN="ghp_…"` are
redacted in place.

**Unattended distill** (auto-save chat knowledge, Research distill, menu-bar
clipboard): redact-and-continue, then tell the user (transcript marker /
event log / hint flash). The provider never sees the raw token.

**Explicit Save to vault:** refuse-and-warn. The user is present; silent
mangling is not.

PostHog `vault_credentials_handled` `{ source, action, count }` — no token
text, no note body.

## Out of scope

Prime `~/.prime/agent/sessions/*.jsonl` — Prime writes those, local-only.
`pnpm l10n:translate` (C18). GitHub issue left open.

## English keys

`ai.message.saveToVaultCredentials`, `ai.marker.credentialsRedactedDistill`,
`research.event.credentialsRedacted`, `menuBarCompanion.distillQueued`,
`menuBarCompanion.credentialsRedacted`.

## Next

Composer cluster **#38 / #9 / #35 / #21**, or close #29 on GitHub after a
live check. Do not start a plugin kernel.
