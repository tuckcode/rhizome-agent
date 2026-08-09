# Git

Git is Rhizome's recommended history and sync layer. Rhizome can work with plain Markdown folders, and Git unlocks local history, recovery, remote backup, and multi-device workflows when you want them.

Rhizome acts as a lightweight Git client for your vault. You can review changes, commit, pull, push, and inspect history without leaving the app.

## What Rhizome Uses Git For

- Whole-vault commit history.
- Current diff for the vault.
- Per-note history.
- Current diff for an individual note.
- Pull and push.
- Conflict detection and resolution.
- Remote connection for local-only vaults.

## History And Diffs

Each note can show its own history and current diff, so you can understand how that file changed over time or what is unsaved relative to Git.

Rhizome also shows a history of the whole vault. Use it when you want to review broader changes across multiple notes before committing or syncing.

## Local Commits

You can commit changes inside Rhizome without leaving the app. This gives you useful restore points even before a remote is configured.

## Remotes

Connect a compatible Git remote when you want sync or backup. Rhizome relies on your system Git authentication, so GitHub CLI, SSH keys, credential helpers, and existing Git configuration can continue to work.
