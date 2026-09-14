---
session: 2026-09-13T22:25-05:00
model: Grok 4.6 (Cursor)
description: >-
  #46 HOME-vault path is already guarded on main (e90e37c). Wrote
  docs/plans/import-jsonl-decision.md (recommend route 1). No list-import
  code. Hide-on-close already in tree.
commits: none
---

# #46 judgment + import_jsonl decision — 2026-09-13 night

**Origin:** Cursor Grok 4.6 · 2026-09-13 · packet W6 / W7

## #46 reality

The clobber path is **already guarded on main** (`e90e37c`, 2026-08-27).

`looks_like_vault` / `is_home_directory` refuse `$HOME`. Seeding `$HOME/.prime/agent/settings.json` does not run. `preflight.rs` only **reads** Prime `auth.json`. Tests: `the_home_directory_is_never_a_vault`, `seeding_the_home_directory_is_refused`.

This machine: no leftover `~/.prime/agent/skills/rhizome-vault`; no `mcpServers.rhizome` in global settings.

A sibling tonight added defense in depth (uncommitted): MCP/ws-bridge drop HOME, `save_vault_list` refuses HOME, `cli-call.mjs` rejects HOME, connect scrubs a poisoned global skill, writer refuses Prime’s global `settings.json`. That is not the first fix.

**Leftover:** GitHub **#46 still OPEN**. Close after a live Chat-without-vault connect (confirm no global skill returns). `normalize_cwd("")` still uses `$HOME` as Prime cwd — that is Chat-without-vault, not MCP scope. Do not invent a Prime sandbox. Attaching `/` or `/Users` as a vault was never the reported bug.

## import_jsonl

Wrote [`docs/plans/import-jsonl-decision.md`](../import-jsonl-decision.md). Recommend **route 1**. Did not code list-import.

## Hide-on-close

Already on main (`43059e3e`, `release_helpers_for_hidden_window`). Plan file stamped. Live-check remains.

## ASTRA

One table cell on #46. Did not rewrite the packet.
