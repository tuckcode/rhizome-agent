---
session: 2026-10-17T09:15Z
model: Grok 4.6 (Cursor)
description: >-
  Identity drift cleanup part 1: rename frontend Tolaria/Laputa
  identifiers, mocks, and test fixtures. Rust left for part 2.
commits: local
---

# Identity drift part 1 — frontend and tests

**Origin:** Cursor Grok 4.6 · 2026-10-17 · reduce identity drift in
`tuckcode/rhizome-agent` without touching open PR files.

## What changed

Frontend-internal names, mock vault fixtures, and test data under
`src/` now use Rhizome-neutral strings:

- Markdown tokens write `@@RHIZOME_*`. Readers still accept
  `@@TOLARIA_*` so an old in-note token still parses.
- Editor fields, CSS classes/vars, dataset keys, clipboard version
  constant, and mock vault paths/titles (`/Users/luca/Laputa`,
  `Build Laputa App`, `lucaong/laputa-vault`) moved to Rhizome names.
- Persisted localStorage keys, `laputa:` / `tolaria:` event names,
  legacy vault-config prefixes, and leftover-identity guards stayed.

## What this PR did not touch

Hard exclusions for PR #200, the Chat-switch / picker-removal work,
and Rust except this note: `src-tauri/` is out of scope. Chat engine
settings, `AiMessage*`, native approval/stream files, `aiAgents.ts`,
and `ChatHome.test.tsx` / `ChatHome.hostFallback.test.tsx` stayed so
those PRs keep the files.

Prime mentions were left alone.

## Remaining for part 2

About 50 `src-tauri` files still mention Tolaria/Laputa/knispo
(~324 matches), plus Playwright `tests/` and a few scripts. The
largest buckets are legacy MCP/kiro install lookups (`mcp.rs`,
`mcp/paths.rs`, `kiro_cli.rs`) that must stay for old installs, and
fixture-heavy files such as `vault/getting_started.rs` and
`linux_appimage.rs`.
