---
session: 2026-10-05T03:20Z
model: Cursor Grok 4.6
description: >-
  #57: leftover is_a: never ran on the active vault because list_vault
  skipped the migrator. Open-path rewrite added; dead Laputa/Tolaria env
  names dropped. Settings shape migrations kept.
commits: pending
---

# #57 — is_a migration on the vault in use

**Origin:** Cursor Grok 4.6 · 2026-10-05 · GitHub [#57](https://github.com/tuckcode/rhizome-agent/issues/57)

## Root cause

`run_startup_tasks_for_vault` is gone. `migrate_is_a_to_type` only ran from
Repair Vault. Normal open uses `list_vault`. The leftover
`agents/claude/session-logs/2026-08-26 - Rhizome Agent live check and Mycelium skin.md`
is on Atticus's machine, not in this repo.

## What changed

- `migrate_is_a_on_open` from `list_vault` and `reload_vault`
- New notes write `type: Note`
- `LAPUTA_CACHE_DIR` → `RHIZOME_CACHE_DIR`; AppImage re-exec env renamed
- Settings normalizers kept (no settings file on this VM)

Spec: [`issue-57-ghost-compat.md`](../issue-57-ghost-compat.md)
