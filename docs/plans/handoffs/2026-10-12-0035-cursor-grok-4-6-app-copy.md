---
session: 2026-10-12T00:35Z
model: Cursor Grok 4.6
description: >-
  User-facing product name is Rhizome. Portent credited as the vault
  template. Welcome, Contribute, and keychain copy updated. Identifiers
  and the RhizomeAgent binary stay.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-12 · app-copy PR

## What landed

1. User-facing name is **Rhizome**. `productName` and the window title
   in `src-tauri/tauri.conf.json` changed. macOS About/Hide/Quit labels
   follow `productName`. `IDENTITY.md`, About alt text, ACP client
   title, and locale strings that said "Rhizome Agent" now say Rhizome.
2. Settings → About credits Portent as the source of the vault
   structure template. `THIRD_PARTY_NOTICES` has the same one-line
   credit. No Portent spec text was copied.
3. Welcome template copy is now "Create the Rhizome Vault from the
   Portent template".
4. Contribute copy says the repo is public under AGPL-3.0 and names
   `github.com/tuckcode/rhizome-agent`.
5. API-key storage copy says the key is stored in the macOS keychain
   (on other platforms, the OS keychain). Those strings live in
   `en.json`, not in the #155 files.

## Kept as "Rhizome Agent" on purpose

| Place | Why |
|---|---|
| Bundle `identifier` `ai.rhizome.agent` | macOS identity; changing it makes a new app |
| Keychain service `ai.rhizome.agent` | existing keys stay reachable |
| Config dir `com.rhizome.app` | settings, vaults, native sessions |
| Cargo binary `RhizomeAgent` | Desktop already ships `Rhizome` on PATH; scripts look for `RhizomeAgent` |
| Repo name `tuckcode/rhizome-agent` | GitHub identity |
| ACP `CLIENT_NAME` `rhizome-agent` | protocol id, not a label |
| Existing `/Applications/Rhizome Agent.app` paths in tests and comments | old installs; quoting-spaces fixtures |
| Chat engine switch footnote in `VersionUpdateIndicator.tsx` | belongs to the #155 agent |
| Historical plans and handoffs | session record, not product chrome |

A new package is `Rhizome.app`. The executable inside stays
`RhizomeAgent`. No CI or script in this tree launches a `Rhizome`
binary for this app.

## Off-limits

Did not edit the #155 files. Item 4 and 5 lived in `en.json`.
