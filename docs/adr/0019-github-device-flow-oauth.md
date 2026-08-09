---
type: ADR
id: "0019"
title: "GitHub device flow OAuth for vault sync"
status: active
date: 2026-02-28
---

## Context

Laputa supports git-backed vaults synced to GitHub. Users need to authenticate with GitHub to clone repos, push changes, and create new vault repositories. In a desktop app, the standard OAuth redirect flow is awkward (no web server to receive the callback). The Device Authorization Flow is designed for exactly this scenario.

## Decision

**Use GitHub's Device Authorization Flow (OAuth device code grant) for GitHub authentication. The user sees a code, opens a browser to enter it, and the app polls for the token. Token is persisted in app settings for future git operations.**

## Options considered

- **Option A** (chosen): Device Authorization Flow — designed for desktop/CLI apps, no redirect URI needed, secure (user authenticates in their own browser). Downside: requires user to switch to browser and back.
- **Option B**: Personal Access Token (PAT) entry — user generates token on GitHub, pastes it in Settings. Downside: poor UX, users must navigate GitHub settings, token scope management is manual.
- **Option C**: OAuth redirect with local server — spawn a local HTTP server to receive the redirect. Downside: port conflicts, firewall issues, more complex implementation.

## Consequences

- `GitHubDeviceFlow` component handles the OAuth flow UI (device code display, polling, success/error states).
- `GitHubVaultModal` enables cloning existing repos or creating new ones.
- Token persisted in `settings.json` under `github_token` / `github_username`.
- `SettingsPanel` shows connection status with disconnect option.
- Uses Tauri opener plugin to launch the browser for user authentication.
- Re-evaluation trigger: if Tauri gains native OAuth redirect support that's simpler than the device flow.
