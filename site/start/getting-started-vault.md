# Getting Started Vault

The Getting Started vault is a small public sample vault hosted at [refactoringhq/tolaria-getting-started](https://github.com/refactoringhq/tolaria-getting-started).

It exists to show Rhizome's conventions without requiring you to restructure your own notes first.

## What It Demonstrates

- Markdown notes with YAML frontmatter.
- Types such as Project, Person, Topic, and Procedure.
- Wikilinks in note bodies.
- Relationship fields in frontmatter.
- A local Git repository that can be connected to a remote later.
- Vault guidance files for AI agents.

## Local-Only By Default

When Rhizome clones the sample, it removes the remote from the local copy. This makes the sample vault disposable. You can edit it freely, commit locally, and delete it later.

To connect a vault to your own remote, use the bottom status bar remote chip or run `Add Remote` from the command palette.

Rhizome also repairs starter-vault guidance files when needed. `AGENTS.md` is the canonical guidance file, `CLAUDE.md` is kept as a compatibility shim, and `GEMINI.md` is only created when you explicitly restore Antigravity/Gemini guidance.

## Use It Alongside Your Own Vaults

You can keep the Getting Started vault open while working in your own notes. Enable `Settings` -> `Vaults` -> `Use multiple vaults at the same time`, then use the bottom-left vault menu to include both the sample vault and your real vault in the unified graph.

This lets search, quick open, note lists, backlinks, and wikilink navigation span both vaults. Git actions still stay scoped to each vault's own repository, and new notes go to the default vault you choose in `Manage vaults`.

## When To Move On

After you understand the sample, open your own vault. Rhizome does not require a special folder structure: a folder of Markdown files is enough to start. You can remove the sample from Rhizome's vault list later without deleting its files from disk.
