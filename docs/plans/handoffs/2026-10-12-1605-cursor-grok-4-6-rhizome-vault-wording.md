---
session: 2026-10-12T16:05Z
model: Cursor Grok 4.6
description: >-
  Follow-up after #157/#158/#156: leftover user-facing Getting Started
  vault copy now says Rhizome Vault. Existing on-disk Getting Started
  folders are still found and opened. Contribute copy left alone.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-12 · Rhizome Vault wording follow-up

## What changed

New vaults already create `~/Documents/Rhizome Vault`. Leftover
user-facing strings still said Getting Started. Those now say Rhizome
Vault:

- create/open toasts in `App.tsx`
- restore/error toasts in `useVaultSwitcher.ts`
- create/download errors in `gettingStartedVault.ts`
- command palette fallback and native menu restore label
- Rust create-folder errors and the init commit message

`GETTING_STARTED_VAULT_NAME` and `LEGACY_DEFAULT_VAULT_FOLDER_NAME`
stay `Getting Started` so an existing folder is still labeled and
resolved.

## Pickup test

`test_existing_on_disk_getting_started_folder_is_found_and_openable`
creates a real `Getting Started` vault on disk (type.md, note.md,
welcome.md). The resolver returns that path and `vault_exists` treats
it as openable.

`useOnboarding` also asserts a resolved default of
`/mock/Documents/Getting Started` still opens ready.

## Left alone

Contribute panel copy. knispo has not picked it.

Persisted vault-menu rows and smoke fixtures that represent an
existing Getting Started folder on disk.

## C95

`tests/smoke/unified-shell-layout.spec.ts` still fails on
`prime-session-list` after opening a note beside Chat. Same #155
Chat-rail leftover. This session did not touch that spec.
