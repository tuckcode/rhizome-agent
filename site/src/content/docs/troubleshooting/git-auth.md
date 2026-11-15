---
title: Git authentication
description: Fix push and pull failures caused by Git sign-in.
---

Rhizome uses system Git authentication. It does not manage provider passwords directly.

## Symptoms

- Push fails.
- Pull asks for credentials repeatedly.
- Remote fetch works in one terminal but not in Rhizome.

## Checks

1. Open a terminal.
2. `cd` into the vault.
3. Run `git remote -v`.
4. Run `git fetch`.

If `git fetch` fails in the terminal, fix system Git auth first.

## The URL was refused

These messages are not sign-in failures. Rhizome stopped before Git ran:

- `Repository URL cannot start with '-'.`
- `Repository URL contains control characters.`
- `Repository URL uses an unsupported transport.`

Paste a normal `https://`, `ssh://`, `git://`, or `git@host:path` URL. See [Connect a Git remote](../guides/connect-a-git-remote.md).

## Common fixes

- Sign in with GitHub CLI.
- Configure SSH keys.
- Update the remote URL.
- Check your credential helper.
