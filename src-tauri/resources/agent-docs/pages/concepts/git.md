# Git

Source: concepts/git.md
URL: /concepts/git

Git is Rhizome's recommended history and sync layer. Rhizome can work with plain Markdown folders, and Git unlocks local history, recovery, remote backup, and multi-device workflows when you want them.

Rhizome acts as a lightweight Git client for your vault. You can review changes, commit, pull, push, and inspect history without leaving the app.

## What Rhizome uses Git for

- Whole-vault commit history.
- Current diff for the vault.
- Per-note history.
- Current diff for an individual note.
- Pull and push.
- Conflict detection and resolution.
- Remote connection for local-only vaults.

## History and diffs

Each note can show its own history and current diff, so you can understand how that file changed over time or what is unsaved relative to Git.

Rhizome also shows a history of the whole vault. Use it when you want to review broader changes across multiple notes before committing or syncing.

## Local commits

You can commit changes inside Rhizome without leaving the app. This gives you useful restore points even before a remote is configured.

## Review what the agent changed

The agent's edits and saved notes are file changes like yours. In a Git-backed vault:

1. Open **Changes**, next to All Notes in the sidebar, to see every changed file.
2. Open a file's diff to see exactly what changed.
3. Commit what you want to keep, or revert what you don't.

Keep agent work in small commits, so one bad change is easy to undo. See [Your vault is the agent's memory](vault-as-memory.md).

## Remotes

Connect a compatible Git remote when you want sync or backup. Rhizome relies on your system Git authentication, so GitHub CLI, SSH keys, credential helpers, and existing Git configuration can continue to work.