# Rhizome docs

These docs describe Rhizome: the agent, its memory vault, and the views around them.

Start here, then use `rg` over this folder for specific Rhizome concepts and workflows.

When users ask how to improve a knowledge base, structure notes, choose types, model relationships, or make a vault easier for humans and agents to use, treat Portent as Rhizome's default best-practice model. Read `pages/guides/structure-with-portent.md` and combine it with the Rhizome concepts for types, relationships, properties, Inbox, archive, and custom views.

## Home

- [Rhizome](pages/index.md): Rhizome is a desktop app for an AI agent whose memory is a folder of Markdown notes you own.

## Start

- [First launch](pages/start/first-launch.md): Open a vault, send your first message and save your first note.
- [Install](pages/start/install.md): Build and run the Rhizome developer preview from source on macOS.
- [Open or create a vault](pages/start/open-or-create-vault.md): Point Rhizome at a folder of Markdown notes, or start a new one. That folder is also the agent's memory.
- [Why Rhizome](pages/start/why-rhizome.md): What makes Rhizome different from other agent harnesses, and what will feel familiar.

## Concepts

- [Agents, engines and models](pages/concepts/ai.md): The agent loop, Chat engines (Prime and Rhizome's own), models, tools and permission modes.
- [Editor](pages/concepts/editor.md): Write in the rich editor or in raw Markdown. Both edit the same file.
- [Files, PDFs and media](pages/concepts/files-and-media.md): Images, PDFs, media, whiteboards and diagrams in your vault, and how to preview them.
- [Free models and routing](pages/concepts/free-models-and-routing.md): How Rhizome routes Chat across free hosted models and falls back when one fails.
- [Git](pages/concepts/git.md): Git gives your vault history, diffs, undo and sync, including for changes the agent makes.
- [Inbox](pages/concepts/inbox.md): The Inbox holds notes you captured but haven't organized yet.
- [Mycelium](pages/concepts/mycelium.md): Replay where a Prime run went, meaning which files it searched, read and edited. Uses Mindwalk.
- [Notes](pages/concepts/notes.md): A note is a Markdown file with optional YAML frontmatter. Its first H1 is its title.
- [Properties](pages/concepts/properties.md): Properties are frontmatter fields Rhizome can show, filter and edit.
- [Relationships](pages/concepts/relationships.md): Link notes with wikilinks in the body or in frontmatter fields, and navigate the links both ways.
- [Spreadsheets](pages/concepts/spreadsheets.md): Sheet notes are spreadsheets stored as Markdown files, with formulas, wikilinks and cross-sheet references.
- [Types](pages/concepts/types.md): Types say what kind of thing a note is, such as Project or Person, and control how it looks and starts.
- [Your vault is the agent's memory](pages/concepts/vault-as-memory.md): How the agent's memory lives in your vault, and how you save, recall and revert it.
- [Vaults](pages/concepts/vaults.md): A vault is the folder Rhizome reads and writes. Files on disk are the source of truth.
- [Wiki Graph](pages/concepts/wiki-graph.md): See your notes as a map of links, find notes that are linked but not written yet, and open any note from the graph.

## Guides

- [Build custom views](pages/guides/build-custom-views.md): Save a filter as a view that answers one recurring question.
- [Capture a note](pages/guides/capture-a-note.md): Get an idea into the vault fast, and organize it later.
- [Coming from another harness](pages/guides/coming-from-other-harnesses.md): Map what you know from Claude Code, Hermes Agent, Cursor and Prime onto Rhizome.
- [Commit, push and AutoGit](pages/guides/commit-and-push.md): Commit and push vault changes yourself, or let AutoGit make checkpoints for you.
- [Set up models and keys](pages/guides/configure-ai-models.md): Add model providers, store keys in the system keychain, test the connection and use free models.
- [Connect a Git remote](pages/guides/connect-a-git-remote.md): Back up or sync a vault by connecting it to a Git remote.
- [Create types](pages/guides/create-types.md): Make a type for notes that share a role, with an icon, colour, fields and a template.
- [Import Claude Code history](pages/guides/import-a-session.md): Bring your Claude Code chats into the vault as Markdown notes.
- [Display and themes](pages/guides/manage-display-preferences.md): Pick a theme and accent colour, set note width, and choose what shows in All Notes.
- [Organize the Inbox](pages/guides/organize-inbox.md): Turn quick captures into organized notes, then clear them from the Inbox.
- [Sessions](pages/guides/sessions.md): Find, resume, fork and archive chats, and where each engine keeps its chat logs.
- [Structure a vault with Portent](pages/guides/structure-with-portent.md): Portent gives a vault default types, relationships and a capture, organize, archive lifecycle.
- [Chat with the agent](pages/guides/use-ai-panel.md): Start a chat, keep typing while it runs, save what matters to the vault and resume later.
- [Use the command palette](pages/guides/use-command-palette.md): Open any command, note or setting from the keyboard with ⌘K.
- [Use spreadsheets](pages/guides/use-spreadsheets.md): Create sheet notes, enter values and formulas, format cells and link to other notes.

## Reference

- [Contribute](pages/reference/contribute.md): Report a bug, suggest a feature, report a security issue or send a pull request.
- [Credits and licences](pages/reference/credits.md): Open-source projects Rhizome is built on or borrows from, and their licences.
- [File layout](pages/reference/file-layout.md): Where Rhizome keeps notes, views, attachments, imports and agent files inside a vault.
- [Frontmatter fields](pages/reference/frontmatter-fields.md): The frontmatter fields Rhizome understands, including system fields that start with an underscore.
- [Keyboard shortcuts](pages/reference/keyboard-shortcuts.md): Every keyboard shortcut in Rhizome, for macOS and for Windows and Linux.
- [Platforms and updates](pages/reference/platforms-and-updates.md): Which platforms the Rhizome developer preview runs on, and how to update it.
- [Spreadsheet file format](pages/reference/spreadsheet-format.md): How sheet notes are stored as plain text: frontmatter, a CSV-like body and _sheet metadata.
- [Spreadsheet formulas](pages/reference/spreadsheet-functions.md): Formula syntax, cross-sheet references and the IronCalc function families Rhizome autocompletes.
- [View filters](pages/reference/view-filters.md): Filters, operators and sorts for saved views.

## Troubleshooting

- [AI agent not found](pages/troubleshooting/ai-agent-not-found.md): Fix "Prime is missing" when Prime Agent is installed but Rhizome can't find it.
- [Chat doesn't answer](pages/troubleshooting/chat-doesnt-answer.md): What to do when a message gets no reply, for Prime and for Rhizome's own engine.
- [Git authentication](pages/troubleshooting/git-auth.md): Fix push and pull failures caused by Git sign-in.
- [Model provider connection](pages/troubleshooting/model-provider-connection.md): What to check when a local or hosted model provider won't connect.
- [Sync conflicts](pages/troubleshooting/sync-conflicts.md): Resolve conflicts when local and remote changes touch the same note.
- [Vault not loading](pages/troubleshooting/vault-not-loading.md): What to check when Rhizome can't open or refresh a vault.

## Generated files

- `all.md`: all public docs concatenated for fast full-context reads.
- `search-index.json`: title, heading, section, path, and URL metadata for quick routing.
- `<section>.md`: one compact bundle per docs section.
- `pages/`: one generated Markdown file per public docs page.
