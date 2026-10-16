---
session: 2026-10-16T06:15Z
model: Cursor Grok 4.6
description: >-
  Vault open no longer writes Prime skill files under .prime/. Seeding
  happens only when a Prime chat starts; a write failure is a notice.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-16 · vault open without Prime skill write

## Bug

Opening `~/Documents/Rhizome Vault` on macOS failed with "Selected
folder is not available." The log showed permission denied while
writing `<vault>/.prime/agent/skills/rhizome-vault/SKILL.md`.

## Root cause

`registerVaultSelection` checks `check_vault_exists`. Setting the vault
path also starts Chat's Prime host poll (`usePrimeHostStatus` →
`ensure_prime_session_host` → `PrimeHost::connect`). Connect seeded the
Prime project skill under the vault `.prime/` directory.

A TCC / permission error on that write was swallowed (`let _ =` /
`log::warn`). The picker path then treated the folder as unavailable.

Prime is an optional backup engine (ADR-0180). Opening a vault must not
depend on writing anything under `.prime/`.

## Fix

- `PrimeHost::connect` and `ensure_host_for_cwd` no longer seed.
- `run_prompt_stream` seeds when a Prime chat turn starts.
- A `.prime/` write failure emits `AiAgentStreamEvent::Notice` (non-fatal).
  The frontend routes that to `onNotice`, not `onError`.

## Tests

- Vault exists / list succeeds when `.prime` is not writable.
- Attaching a vault does not create `.prime/` or `SKILL.md`.
- The first Prime prompt writes the skill.
- A blocked write is a notice; the prompt still streams.

Did not edit `docs/HANDOFF.md`.
