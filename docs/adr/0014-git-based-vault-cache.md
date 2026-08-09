---
type: ADR
id: "0014"
title: "Git-based incremental vault cache"
status: active
date: 2026-03-08
---

## Context

Scanning a vault of 9000+ markdown files on every app launch takes several seconds. A caching strategy was needed that could detect which files changed since the last scan and only re-parse those, while remaining correct even after external edits (e.g., from a text editor or git pull).

## Decision

**Use git as the change detection mechanism. The cache stores all `VaultEntry` objects in a JSON file at `~/.laputa/cache/<vault-hash>.json`. On load, it compares the cached git HEAD commit hash with the current one: if the same, only re-parse uncommitted changed files; if different, use `git diff` to find changed files and selectively re-parse. Full rescan only on cache miss or version bump.**

## Options considered

- **Option A** (chosen): Git-based incremental cache — leverages existing git infrastructure, precise change detection, handles both committed and uncommitted changes. Downside: requires git-tracked vault, cache invalidation logic is complex.
- **Option B**: File modification time (`mtime`) based cache — works without git. Downside: unreliable across filesystems (iCloud, Dropbox), clock skew issues.
- **Option C**: File hash (content-based) cache — always correct. Downside: must read every file to compute hash, defeating the purpose of caching.

## Consequences

- Cache file stored outside the vault at `~/.laputa/cache/<vault-hash>.json` — never pollutes the user's git repo.
- Writes are atomic (write to `.tmp` then rename) to prevent corruption.
- Cache version (v5) is bumped on `VaultEntry` field changes to force full rescan.
- Legacy `.laputa-cache.json` files inside the vault are auto-migrated and deleted on first run.
- `reload_vault` command deletes the cache file before rescanning, guaranteeing fresh data.
- Stale cache entries are pruned on vault open (files that no longer exist on disk).
- Re-evaluation trigger: if non-git vaults (e.g., iCloud-only) need to be supported.
