---
title: Connect a Git remote
description: Back up or sync a vault by connecting it to a Git remote.
---

Connect a remote when you want backup or sync beyond the current machine.

## Before you start

Make sure the remote repository exists and your system Git can authenticate to it. Rhizome uses system Git rather than storing provider-specific credentials.

## Steps

1. Open the bottom status bar remote chip, or run `Add Remote` from the command palette.
2. Paste the remote URL.
3. Confirm the remote name.
4. Fetch or push according to the app prompt.

## URLs Rhizome accepts

Paste a normal remote URL: `https://`, `ssh://`, `git://`, or `git@host:path`. A local path is also accepted by the same check.

Rhizome refuses the URL before Git runs when:

- It starts with `-`. Git would treat that string as an option.
- It contains a control character, such as a line break.
- It uses a Git transport helper. The part before `::` is a helper name when it is made only of letters, digits, `.`, `+`, and `-`. `ext::sh -c …` and `remote-foo.bar::evil` are refused. `ssh://git@[::1]/org/repo.git` is allowed, because `[` is not part of a helper name. A hostname with dots, such as `https://git.example.com/org/repo.git`, is allowed.

These sentences mean the URL was refused. Signing in again does not change that:

- `Repository URL cannot start with '-'.`
- `Repository URL contains control characters.`
- `Repository URL uses an unsupported transport.`

## Recommended auth

- SSH keys.
- GitHub CLI authentication.
- Existing Git credential helpers.
- macOS Keychain credentials for HTTPS remotes on macOS.

If authentication fails, see [Git Authentication](../troubleshooting/git-auth.md).
