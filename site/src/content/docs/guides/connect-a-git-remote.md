---
title: Connect a Git remote
description: Back up or sync a vault by connecting it to a Git remote.
---

Connect a remote when you want backup or sync beyond the current machine.

## Before you start

Make sure the remote repository exists and your system Git can authenticate to it. Rhizome uses system Git rather than storing provider-specific credentials.

## Steps

1. Open the bottom status bar remote chip, or run `Add Remote` from the command palette.
2. Paste the remote URL. Rhizome refuses a URL that starts with `-`, contains control characters, or uses a transport helper such as `ext::`. Use `https://`, `ssh://`, `git@host:path`, or a local path.
3. Confirm the remote name.
4. Fetch or push according to the app prompt.

## Recommended auth

- SSH keys.
- GitHub CLI authentication.
- Existing Git credential helpers.
- macOS Keychain credentials for HTTPS remotes on macOS.

If authentication fails, see [Git Authentication](../troubleshooting/git-auth.md).
