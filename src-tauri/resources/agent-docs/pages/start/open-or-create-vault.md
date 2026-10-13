# Open or create a vault

Source: start/open-or-create-vault.md
URL: /start/open-or-create-vault

A Rhizome vault is a folder on disk. It's where your notes live, and it's also the agent's memory: what you save from Chat lands here as Markdown. See [Your vault is the agent's memory](../concepts/vault-as-memory.md).

The folder can contain Markdown notes, attachments, type definitions, saved views, and Git metadata.

## Open an existing folder

Choose an existing folder if you already have Markdown notes. Rhizome scans `.md` files and uses frontmatter when it exists.

Good starting points:

- A folder of plain Markdown files.
- An Obsidian-style vault.
- A Git repository containing notes.

## Create a new vault

The welcome screen offers two ways to start fresh:

- **Get started with a template** creates a vault at `~/Documents/Rhizome Vault`, with starter folders, a welcome note, an `AGENTS.md`, and the default work types from [Portent](../guides/structure-with-portent.md). It's built locally and starts as a Git repository. A `Getting Started` vault from an earlier version still opens as before.
- **Create empty vault** asks for a name and a location, then adds Rhizome's default settings files.

You can bring the template back later with **Restore Rhizome Vault** in the command palette.

## Use more than one vault

You do not have to merge everything into one folder. Register each local folder as its own vault, then turn on **Use multiple vaults at the same time** in Settings → Vaults.

Once enabled, the bottom-left vault menu lets you include vaults in the unified graph. Search, quick open, wikilinks, and note lists can span the included vaults, while Git sync and commits remain tied to each vault's own repository.

## Git is recommended, not required

Rhizome works well with a plain folder of Markdown files. You can open, edit, organize, and search notes without making the vault a Git repository.

Git is recommended when you want local history, diff views, recovery, pull, push, and remote sync without a proprietary backend. If a vault is not already a repository, Rhizome can initialize one when you explicitly ask it to.