---
session: 2026-10-04T15:48:12-05:00
model: Claude Opus 5.5
description: >-
  Three vault-memory MCP fixes merged to local main (bf22be8): one listing per
  vault, server instructions, distill SKIP. Claude Code now runs this repo's
  MCP server and rhizome-tool. Not pushed.
commits: 9a48e00..bf22be8
---

# Vault memory MCP fixes

**Origin:** Claude Opus 5.5 (Claude Code desktop) · 2026-10-04 · branch `fix/rhizome-mcp-memory`, merged as `bf22be8`.

## Why

Atticus asked whether Claude Code should save to the vault through the Rhizome
MCP or a Claude Code plugin hook. Reading the live vault and this repo showed
three defects.

## What changed

| Commit | Fix | Test |
|---|---|---|
| `5d7be95` | `\\?\C:\…` and `C:\…` count as one vault (`mcp-server/vault-path.js`). | `vault-path.test.js` |
| `454ffc4` | MCP initialize reply carries static `SERVER_INSTRUCTIONS`: when to read (`get_vault_context`, `rhizome_search`) and save (`rhizome_distill`). | `test.js` › stdio lifecycle |
| `ba6137e` | Distill prompt offers `SKIP`; a SKIP reply writes no card and no event. | `rhizome_distill.rs` tests |

Each test was seen failing before its fix.

## Verified

- `pnpm test:mcp` on merged main: 96 pass, 0 fail, 6 skipped.
- `cargo test --lib rhizome_` on the branch: 174 pass. `cargo fmt --check`
  and `cargo clippy --all-targets -D warnings` clean.
- Not run: full pre-push suite, coverage, Codacy, native QA.
- Not verified: a real model answering `SKIP`. Only the fake-model test
  proves a SKIP reply writes nothing.

## Machine state

- Claude Code's user-scope `rhizome` MCP runs `mcp-server/index.js` from this
  checkout with `RHIZOME_TOOL_PATH` at `src-tauri/target/release/rhizome-tool.exe`.
  Before: `AppData\Local\Rhizome\mcp-server\index.js`, an older bundle that
  still ships `rhizome_grok_import` and reads `com.tolaria.app`. It is untouched.
- The vault holds two junk cards written before the SKIP fix. Left for Atticus.

## Decision recorded

Claude Code memory keeps how to work with the user; the vault keeps knowledge.
The server instructions say so. A Claude Code plugin hook that captures every
turn was rejected: `docs/design/memory-loop.md` forbids auto-wiki from every turn.
