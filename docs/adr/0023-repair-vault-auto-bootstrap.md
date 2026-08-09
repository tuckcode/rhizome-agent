---
type: ADR
id: "0023"
title: "Repair Vault auto-bootstrap pattern"
status: active
date: 2026-03-07
---

## Context

As Laputa adds features that depend on vault files (type definitions, config files, agents), users with existing vaults would miss these files. Manually creating them is error-prone. Features must work on both new and existing vaults without user intervention.

## Decision

**Every feature that depends on vault files must auto-bootstrap: check if file/folder exists on vault open, create with defaults if missing (silent, idempotent). All bootstrap functions are registered with the central `Cmd+K → "Repair Vault"` command for manual re-creation.**

## Options considered

- **Option A** (chosen): Auto-bootstrap on vault open + manual Repair Vault command — works for new and existing vaults, idempotent, no user action needed. Downside: vault may accumulate files the user didn't explicitly create.
- **Option B**: Require users to run a setup wizard — explicit, user-controlled. Downside: friction, users forget, new features don't work until setup is run.
- **Option C**: Store defaults in app bundle, not vault — no vault files created. Downside: breaks the "vault as source of truth" principle, custom configs can't override defaults.

## Consequences

- Type definitions (`type/project.md`, etc.) are seeded on vault open if missing.
- Config files (`config/agents.md`, etc.) are seeded on vault open if missing.
- `Repair Vault` command (Cmd+K) re-creates all expected files — useful after manual deletion or vault corruption.
- All bootstrap operations are silent and idempotent — running twice has no effect.
- `getting_started.rs` creates the Getting Started demo vault with all expected structure.
- The `vault_health_check` command detects missing or misconfigured vault files.
- Re-evaluation trigger: if the number of auto-created files becomes excessive or confusing for users.
