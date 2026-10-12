---
title: Vault not loading
description: What to check when Rhizome can't open or refresh a vault.
---

Use this checklist when Rhizome cannot open or refresh a vault.

## Check the folder

- Confirm the folder exists.
- Confirm the folder contains readable files.
- Confirm Rhizome has permission to access the folder.
- Try opening a smaller test vault to isolate the issue.

## macOS folder permission

If the vault is in Documents, Desktop or Downloads, macOS must allow Rhizome to read it. Allow access when macOS asks, or turn it on in System Settings → Privacy & Security → Files and Folders. Or move the vault to another folder.

## Check Git

If the vault is a Git repository, verify it is not in a broken state:

```bash
git status
```

Resolve interrupted merges or corrupted repository state before retrying.

## Reload

Run `Reload Vault` from the command palette. This clears derived cache and rescans the filesystem.
