---
session: 2026-10-12T00:35Z
model: Cursor Grok 4.6
description: >-
  User-facing product name is Rhizome. Portent vault-template MIT pin.
  New vaults create Rhizome Vault; existing Getting Started stays.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-12 · app-copy PR #157 follow-up

## What landed

1. User-facing name is **Rhizome**. Bundle id `ai.rhizome.agent`,
   keychain service, config dir, and Cargo binary `RhizomeAgent` stay.
2. Settings → About credits Portent as the vault structure template.
   `THIRD_PARTY_NOTICES` and `docs/vendored-sources.md` pin
   `refactoringhq/portent-vault-template` at
   `87c4adcb1ab031ec3b2eed9f0d3f5c61d6dc90bb` (MIT, Copyright (c) 2026
   Refactoring). Used in `src-tauri/src/vault/config_seed.rs`. The
   “no Portent text is copied” line is gone.
3. Welcome copy is “Create the Rhizome Vault from the Portent template”.
4. Contribute copy says public AGPL-3.0. Left “pull requests welcome”
   vs hidden “Contribute code” alone.
5. API keys: “Save in your system keychain.” Onboarding says keys live
   in the system keychain, not in Rhizome’s files.
6. New starter vaults create `~/Documents/Rhizome Vault`. An existing
   `~/Documents/Getting Started` (or any saved path) is still picked up.
7. Non-English catalogs dropped the stale keys so i18n falls back to
   `en.json`.
8. Ship skill and living docs install `/Applications/Rhizome.app` and
   archive `/Applications/Rhizome Agent.app` to
   `~/Documents/Rhizome archives` (move, not delete).

## Kept as "Rhizome Agent" on purpose

| Place | Why |
|---|---|
| Bundle `identifier` `ai.rhizome.agent` | macOS identity; changing it makes a new app |
| Keychain service `ai.rhizome.agent` | existing keys stay reachable |
| Config dir `com.rhizome.app` | settings, vaults, native sessions |
| Cargo binary `RhizomeAgent` | Desktop already ships `Rhizome` on PATH |
| Repo name `tuckcode/rhizome-agent` | GitHub identity |
| ACP `CLIENT_NAME` `rhizome-agent` | protocol id, not a label |
| Historical plans and handoffs | session record, not product chrome |

## Off-limits

Did not edit the #155 files.

## C95

`tests/smoke/unified-shell-layout.spec.ts` still fails on
`prime-session-list` visibility after opening a note beside Chat. Same
Chat-rail leftover as PR #155. This session did not touch that spec or
the #155 files. Four other smokes were flaky on first try and passed
on retry. Frontend lint, typecheck, coverage, and mcp passed.
