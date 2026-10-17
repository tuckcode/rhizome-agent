---
session: 2026-10-17T17:12Z
model: Grok 4.7 (Cursor)
description: >-
  In-app Tauri updater checks the moving alpha-latest and stable-latest
  tags. Pubkey is still a placeholder. Signing secrets are optional.
commits: this slice
---

# In-app updater

**Origin:** Grok 4.7 (Cursor) · 2026-10-17 · in-app updater PR

## What landed

`app_updater.rs` calls the Tauri updater plugin. Alpha uses
`releases/download/alpha-latest/alpha-latest.json`. Stable uses
`stable-latest`. Those tags are prereleases because
`releases/latest/download` ignores alpha releases.

`PLACEHOLDER_KNISPO_TAURI_UPDATER_PUBKEY` is not a key. Replace it after
`pnpm tauri signer generate`. Secrets: `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. A missing key still builds unsigned.

Restart stays on the existing Restart control. Windows passive install
can relaunch from the installer.

## Follow-up

Commit the real minisign pubkey and set the two secrets. Then cut a
signed alpha release so the moving tag exists.
