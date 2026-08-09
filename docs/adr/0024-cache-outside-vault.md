---
type: ADR
id: "0024"
title: "Vault cache stored outside vault directory"
status: active
date: 2026-03-08
---

## Context

The vault cache was originally stored as `.laputa-cache.json` inside the vault directory. This caused problems: the cache file appeared in git status, polluted the user's repo, and could be accidentally committed. It also confused vault scanning (the cache file was itself a file in the vault).

## Decision

**Store the vault cache at `~/.laputa/cache/<vault-hash>.json`, outside the vault directory. The vault path is hashed (via `DefaultHasher`) to produce a deterministic filename. Legacy cache files inside the vault are auto-migrated and deleted on first run.**

## Options considered

- **Option A** (chosen): External cache at `~/.laputa/cache/` — never pollutes the vault, no git issues, deterministic filename from vault path hash. Downside: separate cleanup needed if vault is deleted.
- **Option B**: Cache inside vault with `.gitignore` — simpler, travels with the vault. Downside: .gitignore can be overridden, users may not have one, still appears in file listings.
- **Option C**: No persistent cache (in-memory only) — simplest, no file management. Downside: full rescan on every app launch, slow for large vaults.

## Consequences

- Cache path: `~/.laputa/cache/<vault-hash>.json` (e.g., `~/.laputa/cache/12345678.json`).
- Writes are atomic: write to `.tmp` then rename.
- Legacy `.laputa-cache.json` files inside the vault are auto-migrated and deleted.
- `reload_vault` command deletes the cache file before rescanning.
- The `.laputa/` directory also stores other app data (future: vault metadata, indexes).
- Re-evaluation trigger: if vaults need to be portable between machines (cache would need to travel with the vault or be regenerated).
