# Build custom views

Source: guides/build-custom-views.md
URL: /guides/build-custom-views

Custom views are saved filters for recurring questions.

## Design the question first

Before creating a view, write the question it answers. A good view is not "all fields with all filters"; it is a focused lens.

## Good view candidates

- Active projects.
- People without a recent follow-up.
- Drafts ready for review.
- Notes changed this week.
- Events in a date range.

## View definition

Saved views live as files in the vault. They describe filters, sorting, and visible columns using structured data.

## Filters

Custom views can use nested conditions, similar to Notion or Airtable filter groups. Combine `all` and `any` logic when a view needs to answer a more precise question than a single field filter can express.

Date filters support dynamic natural-language values such as `today`, `yesterday`, or `one week ago`. Use these for views that should keep moving over time, such as recent work, stale follow-ups, or upcoming events.

---

# Capture a note

Source: guides/capture-a-note.md
URL: /guides/capture-a-note

Use capture when you need to get an idea into the vault before you know where it belongs.

## Steps

1. Press `Cmd+N` on macOS or `Ctrl+N` on Windows and Linux.
2. Write a clear H1.
3. Add the rough content.
4. Leave structure for later if you are still thinking.

## Capture well

Prefer a useful title over a perfect taxonomy. You can add type, status, and relationships during inbox review.

## When to add structure immediately

Add structure while capturing when the note's type or relationships are already obvious. Otherwise, capture the idea first and organize it later.

---

# Coming from another harness

Source: guides/coming-from-other-harnesses.md
URL: /guides/coming-from-other-harnesses

If you already use Claude Code, Hermes Agent, Cursor or Prime, a lot of what you know carries over. This page maps your habits onto Rhizome, and shows what's different: memory lives in a folder you can read, and you can see where a run went.

## The one big difference

In most harnesses, memory is a file or store that belongs to the tool: `MEMORY.md`, `USER.md`, a database, a cloud account. In Rhizome, memory is your **vault**, a folder of Markdown notes. You choose what's saved with **Save to vault**. With Prime, answers that use a note say it came from your vault. With Git, every change can be diffed and reverted. See [Your vault is the agent's memory](../concepts/vault-as-memory.md).

## From Claude Code

| In Claude Code | In Rhizome |
|---|---|
| Your past sessions | Settings → AI Agents → **Import chat history** brings them into the vault as notes under `Imports/claude-code/`. See [Import Claude Code history](import-a-session.md) |
| `CLAUDE.md` | The vault's `AGENTS.md`. Rhizome keeps a `CLAUDE.md` alongside it for compatibility |
| MCP servers | Rhizome is an MCP server too. **Set Up External AI Tools…** (⌘K) adds it to Claude Code's config, so Claude Code can read and write your vault from the terminal |
| Claude models | Not on Rhizome's own engine yet; use another provider or Taproot |
| Permission prompts | Permission modes, **Limited tools** and **Power User**, set per vault |
| `/resume` | The sessions list. See [Sessions](sessions.md) |

Rhizome doesn't run Claude Code inside Chat. Keep using Claude Code in the terminal, connected to your vault through MCP.

## From Hermes Agent

| In Hermes | In Rhizome |
|---|---|
| `MEMORY.md` / `USER.md` | Vault notes you save on purpose. Automatic saving exists but is off by default |
| Memory writes you approve | **Save to vault** is an explicit click. It writes straight away, so review the note after, or undo with Git |
| Observable, interruptible runs | Stop any run; with Prime, send a follow-up while it works; see a Prime run's file footprint in [Mycelium](../concepts/mycelium.md) |
| Skills | Rhizome's own plugin system is planned |
| Your choice of provider | Your own providers, local models or **Taproot**. Keys live in the system keychain |

## From Cursor

| In Cursor | In Rhizome |
|---|---|
| Agent chat beside your files | Chat with notes beside it (⌘2 shows Notes) |
| Cursor's MCP settings | **Set Up External AI Tools…** (⌘K) writes Rhizome's MCP entry into `~/.cursor/mcp.json`, so Cursor's agent can use your vault |
| Rules files | The vault's `AGENTS.md` |
| Model picker | Your providers or **Taproot** |

Rhizome isn't a code editor. Keep Cursor for code, and use Rhizome as the place where what you and your agents learn is kept, reviewed and found again.

## Bring your own model

Add a provider or use **Taproot**. Rhizome's engine can read, search, edit, and create notes in the open vault. Power User can run one approved shell command in the vault folder. See [Set up models and keys](configure-ai-models.md).

## Plugins

Rhizome's own plugin system is planned, not shipped. Other apps can reach your vault through MCP.

---

# Commit, push and AutoGit

Source: guides/commit-and-push.md
URL: /guides/commit-and-push

Rhizome can act as a lightweight Git client for a Git-enabled vault. You can manage commits and pushes yourself, or enable AutoGit to create conservative checkpoints after editing pauses or when the app is no longer active.

## Manual Git

1. Open **Changes**, next to All Notes in the sidebar.
2. Review changed files.
3. Write a short commit message.
4. Commit locally.
5. Push when a remote is configured.

If the remote has changed, pull first and resolve any conflicts. If the vault has no remote, manual commits still give you local history, diffs, and rollback.

## AutoGit

AutoGit is available in Settings for Git-enabled vaults. When enabled, Rhizome automatically commits and pushes saved local changes after an idle pause or after the app becomes inactive.

> AutoGit commits and pushes everything that's saved, including the agent's edits. Review agent changes in Changes before you turn it on, or keep it off for vaults where the agent works.

Use AutoGit when you want the safety of regular checkpoints without interrupting capture or editing. You can still inspect each note's current diff, review note history, and browse the whole-vault history before making larger manual commits.

## Use small commits

Small commits make it easier to understand what changed, roll back safely, and review AI-generated edits.

---

# Set up models and keys

Source: guides/configure-ai-models.md
URL: /guides/configure-ai-models

Choose which models Chat can use, store their API keys safely, and check that they answer. Keys are kept in your operating system's keychain, never in the vault.

## Engine

New chats use Rhizome's own engine (ADR-0187). Set up the models below in Settings → AI Agents.

## Add a provider

Settings → AI Agents has three tabs. **Local model** is for models on your computer. **API model** is for hosted models and holds **Taproot**.

| Kind | Examples | Needs |
|---|---|---|
| Hosted | OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral | API key, model ID |
| Local | Ollama, LM Studio | Base URL, model ID, usually no key |
| Your own | Any OpenAI-compatible server | Base URL, model ID, optional key and headers |

Anthropic models are not offered by Rhizome's own engine yet.

## Store the key

Under **API key storage**, pick one per provider:

- **Save locally in Rhizome (recommended).** Paste the key. Rhizome stores it in the system keychain: macOS Keychain, Windows Credential Manager, or Secret Service on Linux. Keys that older versions saved in a settings file move to the keychain the first time they're read.
- **Read from env var.** Give the variable's name. Rhizome reads the key from it.
- **No key.** For local servers that don't need one.

Don't edit a key file by hand.

## Test the connection

Click **Test model** on the provider. It sends one short request with no tools. If it passes, Settings says "Connection works. The model replied successfully."

## Use free models

**Taproot**, the free automatic router on the **API model** tab, lets Rhizome pick free hosted models for you and move on when one runs out. Each free provider needs its own key. See [Free models and routing](../concepts/free-models-and-routing.md).

## Pick the model for Chat

Choose a model, or **Taproot**, in the picker. The choice is saved with your settings.

## Limit how long one turn runs

**Agent max steps**, on the same Settings → AI Agents screen, is the number of model rounds in one ordinary turn. The default is 50. The minimum is 1. The field has no upper limit.

**Continue** on a paused reply always adds 50 rounds. It does not add the number in this field. See [Chat with the agent](use-ai-panel.md#when-a-turn-reaches-its-step-limit).

## If it doesn't connect

See [Model provider connection](../troubleshooting/model-provider-connection.md).

---

# Connect a Git remote

Source: guides/connect-a-git-remote.md
URL: /guides/connect-a-git-remote

Connect a remote when you want backup or sync beyond the current machine.

## Before you start

Make sure the remote repository exists and your system Git can authenticate to it. Rhizome uses system Git rather than storing provider-specific credentials.

## Steps

1. Open the bottom status bar remote chip, or run `Add Remote` from the command palette.
2. Paste the remote URL.
3. Confirm the remote name.
4. Fetch or push according to the app prompt.

## Recommended auth

- SSH keys.
- GitHub CLI authentication.
- Existing Git credential helpers.
- macOS Keychain credentials for HTTPS remotes on macOS.

If authentication fails, see [Git Authentication](../troubleshooting/git-auth.md).

---

# Create types

Source: guides/create-types.md
URL: /guides/create-types

Create a type when several notes share the same role in your system.

## Steps

1. Run `New Type` from the command palette, or click `+` in the Types header in the sidebar.
2. Give the type a clear name.
3. Add optional icon, color, sidebar order, sidebar label, pinned properties, suggested fields, default values, or a new-note template.

You can also right-click a type in the sidebar to change its icon and color.
Type icons use Phosphor icon names in kebab-case, such as `briefcase` or `folder`.

```yaml
---
type: Type
_icon: briefcase
_color: blue
_sidebar_label: Projects
_order: 10
---

# Project
```

## Use types sparingly

A type should represent a recurring category, not a one-off label. If you only need a temporary grouping, use a saved view or property instead.

## Templates

Type documents can include a Markdown template for new notes of that type. Keep templates small and useful: a heading, a few expected fields, and the first checklist are usually enough.

You can store the template in the Type document's `template` frontmatter field. When hand-editing the Type document body, content after the Type note's own `# TypeName` heading is also used as the new-note template if it looks like template structure such as field labels, secondary headings, or checklist starters. Plain descriptive body text is ignored.

Type documents can also define fields for new notes. Empty properties and relationships become placeholders in new notes of that type. Properties with values become defaults for new notes of that type.

---

# Import Claude Code history

Source: guides/import-a-session.md
URL: /guides/import-a-session

Bring your past Claude Code chats into the vault, so what you worked out there becomes notes you can search, link and keep.

## Import

1. Open the vault you want the chats in.
2. Open Settings → AI Agents → **Import chat history**.
3. Under **Claude Code**, preview what Rhizome found, then run the import.

Rhizome scans `~/.claude/projects` on your Mac. Each chat becomes a note under `Imports/claude-code/` in the vault.

## Run it again

A second import skips chats that are already in the vault, so you can run it whenever you've done more work in Claude Code.

## Limits

- Claude Code is the only source today. Cursor and other tools aren't wired yet.
- Imported chats are notes, not sessions. You read and link them; you don't continue them in Chat.

## Related

- [Your vault is the agent's memory](../concepts/vault-as-memory.md)
- [Coming from another harness](coming-from-other-harnesses.md)

---

# Display and themes

Source: guides/manage-display-preferences.md
URL: /guides/manage-display-preferences

Display settings live with the app on this computer, unless a setting is stored in a note or the vault on purpose.

## Theme

Rhizome starts in **Graphite**. Change it in Settings → Appearance:

- **Theme.** **System**, **Dark**, and **Light**. Dark is Graphite. Light is Earth light. System follows your computer between those two. Default is Dark (Graphite). The status-bar toggle swaps Graphite and Earth light.
- **Color theme.** **Earth dark**, **Loam**, and **Mycelium** stay selectable as color skins. The other themes (Nord, Dracula, Solarized and more) are fixed skins with their own light or dark look.
- **Accent color.** Sets the colour of actions, links and highlights on Graphite. Fixed themes use their own accent.

You can also switch with **Use Light Mode**, **Use Dark Mode** and **Match System** in the command palette.

## Note width

Set the default rich-editor width in Settings:

- **Normal** for focused writing.
- **Wide** for tables, diagrams, dense notes, and generated documents.

A single note can override the default from the editor toolbar. That override is stored as `_width` in the note's frontmatter.

## Sidebar labels

**Pluralize type names in sidebar** shows "Projects" for the Project type. Turn it off to show type names as written, or set `_sidebar_label` on a type document.

## What shows in All Notes

**All Notes visibility** chooses whether PDFs, images, and other non-Markdown files appear in All Notes. Folder browsing still shows them in their folders. **Toggle Gitignored Files Visibility** in the command palette shows or hides files Git ignores.

## Closing the window

The red window button quits Rhizome. Turn on **Keep in taskbar** in Settings → Appearance to hide the window instead, so you can reopen it from the Dock or taskbar.

## Language

Settings → Appearance → **Display language**. **System** follows macOS when that language is supported. Missing translations fall back to English.

---

# Organize the Inbox

Source: guides/organize-inbox.md
URL: /guides/organize-inbox

Inbox review turns quick captures into usable knowledge.

## Remove a note from Inbox

When a note is organized enough, mark it as organized. Use `Cmd+E` on macOS or `Ctrl+E` on Windows and Linux, or click the organize action in the breadcrumb bar.

That action is what removes the note from Inbox. If **Auto-advance to next Inbox item** is on in Settings → Workflow, Rhizome opens the next Inbox item immediately after you mark the current note organized.

## Review checklist

- Rename unclear notes.
- Add or correct the first H1.
- Set `type`.
- Add `status` for actionable notes.
- Add `belongs_to`, `related_to`, or other relationship fields when useful.
- Move it into a folder only if the folder adds value.
- Archive or delete notes that no longer matter.

## Make notes navigable

A note is organized when you can answer:

- What kind of thing is this?
- What is it connected to?
- What is this useful for?
- What will I do with it?

## Avoid over-structuring

Do not add fields just because they exist. Add the structure that will help future navigation, review, or automation.

---

# Sessions

Source: guides/sessions.md
URL: /guides/sessions

A **session** is one chat with the agent. Rhizome lists your sessions on the left rail, so you can go back to one and keep working.

## Two kinds of session

Which kind you get depends on the engine that ran the chat. See [Agents, engines and models](../concepts/ai.md).

| | Prime sessions | Chats on Rhizome's engine |
|---|---|---|
| Kept in | `~/.prime/agent/sessions/` | `native-sessions/` in the app config folder |
| Owned by | Prime | Rhizome |
| Titles | From Prime | Made automatically from the first exchange |
| In Mycelium | Yes | No |

## Resume a chat

Click a session in the list to reopen it, then send a message to continue.

For chats on Rhizome's engine:

- **A turn cut off by a quit** reopens as cancelled. Rhizome doesn't repeat its tools.
- **Approvals don't carry over.** Rhizome says "Earlier permissions no longer apply. Approve new actions before continuing." Approve again when the agent asks.
- **One turn at a time.** Two windows can show the same chat, but only one turn can run.
- **A damaged log** opens up to the last good line, with a warning that some history is missing. The original file is kept, and you continue in a new chat that starts from the good part.
- **A very long chat** (100 MiB of log) continues in a new chat. History isn't dropped.
- **A turn that reached the step limit** reopens with **Continue** still on that message. See [Chat with the agent](use-ai-panel.md#when-a-turn-reaches-its-step-limit).
- **Images** are stored beside the log, as `<id>.images.json` and a folder `<id>-images/`. They are not inside the JSONL file. A chat saved before that file existed still opens.

## Fork and archive

- **Fork:** choose **Fork chat from here** on a past message to branch a new chat from that point.
- **Archive:** choose **Archive chat** to move a chat out of the list. **Show archived chats** brings them back into view.


## What's not saved in a session

API keys stay in the system keychain, never in session files. Rhizome removes known credentials from messages and tool results before it saves them. It can't recognise every private value, so don't paste secrets into a chat.

## Bring in chats from Claude Code

See [Import Claude Code history](import-a-session.md).

---

# Structure a vault with Portent

Source: guides/structure-with-portent.md
URL: /guides/structure-with-portent

[Portent](https://portent.md) is an open specification and template for work and personal knowledge bases.

It gives a Rhizome vault a small set of defaults for organizing information: clear types, generic graph-like relationships, and a simple lifecycle for captured knowledge. The goal is to make a knowledge base useful to humans and AI agents without forcing every person or team to design a private ontology first.

## Core questions

Portent favors convention over configuration. Instead of asking "where should this go?", it asks:

- What is this?
- What is it useful for?
- Is it captured, organized, or archived?

Those questions map naturally to Rhizome's type documents, relationship fields, Inbox, organized state, archive behavior, and custom views.

## Types

Portent defines eight default types.

PORT types are actionable:

- Project
- Operation
- Responsibility
- Task

ENTP types are non-actionable knowledge records:

- Event
- Note
- Topic
- Person

These defaults are meant to cover the common shape of personal and work knowledge with almost no setup. You can add custom types later, but Portent works best when the default vocabulary comes first.

## Relationships

Portent models knowledge as a graph. The two default relationships are:

- `belongs_to`: primary ownership, composition, or context.
- `related_to`: a looser semantic connection.

In Rhizome, these relationships can live in YAML frontmatter and point to other notes with wikilinks. That keeps the graph portable, searchable, and readable outside the app.

## Lifecycle

Portent separates capture from organization:

1. Capture information quickly so it is not lost.
2. Organize it by assigning a type and useful relationships.
3. Archive it when it has served its purpose.

Rhizome supports that lifecycle directly: the Inbox holds captured notes, organizing a note marks it ready for normal views, and archiving hides old or obsolete notes from active surfaces while keeping them available.

## Why use it

A blank vault is flexible, but it also asks you to make structural decisions before you have momentum. Portent gives you enough structure to start capturing, organizing, and retrieving notes immediately.

Because Portent is file-friendly and portable, the same model can work across local Markdown vaults, note apps, docs tools, and agent-readable knowledge bases. The spec isn't tied to Rhizome.

## In Rhizome

New vaults already include Portent's work types: Project, Operation, Responsibility, Task, Event, Topic and Person. On an older vault, use **Add default work types** in Settings → Workflow to add any that are missing. Existing types are never overwritten.

## Start from the template

You can also start from the Portent template vault:

- [refactoringhq/portent-vault-template](https://github.com/refactoringhq/portent-vault-template)

Use it as-is, rename pieces to match your language, or treat it as a reference model for your own Rhizome setup.

## Learn more

Visit [portent.md](https://portent.md) for the full spec, examples, and implementation notes.

---

# Chat with the agent

Source: guides/use-ai-panel.md
URL: /guides/use-ai-panel

Chat is where you work with the agent: ask, let it use tools, keep what's worth keeping in the vault, and pick the conversation up again later.

## Start a chat

1. Open Chat with ⌘1. Rhizome opens on Chat by default.
2. Attach a vault if you want the agent to read your notes or save to them.
3. Type a message and press Enter.

New chats use Rhizome's own engine (ADR-0187). See [Agents, engines and models](../concepts/ai.md).

## While a reply is running

The message box stays open, so you can write your next message while the agent works.

Enter does nothing until the reply finishes. Your text stays in the box; send it when the turn ends.

Press Stop to end the run. With VoiceOver, Rhizome announces when a run starts, when a tool starts or fails, and when the reply is complete or stopped.

## When a turn reaches its step limit

One turn is a series of model rounds. A round is one reply from the model, including the tool calls that follow it.

Settings → AI Agents → **Agent max steps** is how many rounds an ordinary turn may use. The default is 50. The smallest value is 1. The field has no maximum.

When the limit is reached, the reply pauses. It is not a failure, and it is not a finished answer. The message shows **Continue (steps/max)**. VoiceOver says "Paused at step limit. Continue available."

Continue sends that same request again on the same chat. Earlier text and tool results stay. Each Continue gets 50 new rounds. That 50 does not follow the setting: a limit of 10 still continues in blocks of 50, and a limit of 200 still continues in blocks of 50. The next message you type uses the setting again.

Continue is on the latest turn, and only while Chat is idle. If it cannot start, the chat shows `Continue couldn't start:` and the reason. The paused turn can be tried again. Reopening the chat keeps Continue on that turn.

## Attach an image

Paste, drop, or use the plus menu. Rhizome accepts PNG, JPEG, GIF, and WebP. A message can carry 4 images. Each file must be 5 MB or smaller.

A file that fails says `<name> wasn't attached.` and the reason:

| You see | What it means |
|---|---|
| `Images must be 5 MB or smaller.` | That file is over the per-image cap |
| `Use a PNG, JPEG, GIF or WebP image.` | The type is not one of those four |
| `Only the first 4 images were attached.` | Extra images were left off this message |
| `<model> can't read images. Remove the image or switch to a model that can.` | The catalog says this model is text-only. Send stays off. The text is not sent without the image |
| `Rhizome doesn't know if <model> can read images.` | This model has no catalog row. **Send anyway** remembers it on this machine until you click **Undo** |
| `Checking image support…` | The catalog lookup is still running. Send waits |
| `This message's images are … MB encoded together. The limit is 12 MB.` | This message is too large together, even when each file is under 5 MB |
| `Every model that can read images is cooling down. Try again shortly.` | Taproot will not fall through to a text-only model |

Images are saved next to the chat log, not inside it. A later request includes images from the last two turns. Older images stay on disk. In that later request they are marked `[image from earlier turn omitted]`.

## Ask from the editor or about a note

- **From the editor:** press ⌘K, then Space, and type a prompt. It uses the current note as context.
- **About a note:** run **Ask the agent about this note**. Chat stays open and the note opens beside it.
- **Show or hide Chat beside your notes:** ⌘⇧L.

## Keep what matters

Under a reply worth keeping, click **Save to vault**. Rhizome writes it as a Markdown note straight away, with no preview. It won't save an empty reply, a reply with no vault attached, text that contains a credential, or a reply that's already in the vault. See [Your vault is the agent's memory](../concepts/vault-as-memory.md).

## Come back to a chat

Chats are saved as they go and listed with automatic titles. Reopen one to continue it. If Rhizome quit in the middle of a turn, that turn is marked cancelled when you reopen the chat. Tool approvals you gave earlier aren't restored, so the agent asks again. Only one window can send to a chat at a time.

See [Sessions](sessions.md).

## Approve tools

The vault's permission mode decides what the agent may do without asking:

- **Limited tools:** Rhizome's engine can read and search the vault without asking. It asks before each new note and before each file edit. It does not offer a shell command.
- **Power User:** read, search, and new notes run without asking. File edits still ask unless you already allowed that tool and path for the session. **Run command** (`bash`) asks every time, then runs in the vault folder.

See [Agents, engines and models](../concepts/ai.md#permission-modes).

## See what the agent did

- **Changes:** next to All Notes in the sidebar. The files that changed, with diffs. Commit or revert.
- **Mycelium:** for Prime sessions, a map of which files the run searched, read or edited. See [Mycelium](../concepts/mycelium.md). Native chats are not drawn in Mycelium.

## Requests that work well

Rhizome's engine can read and search the open vault:

- "Find notes related to this project and summarize what's open."
- "Draft a weekly review from the notes linked here."
- "What did we decide about X? Check the vault."
- "Write up these meeting notes as a note called *Weekly sync*."

---

# Use the command palette

Source: guides/use-command-palette.md
URL: /guides/use-command-palette

The command palette is the fastest way to move around Rhizome.

Open it with `Cmd+K` on macOS, or `Ctrl+K` on Windows and Linux.

## Ask the agent from the palette

Type a space first to switch the palette to a prompt. It sends the prompt to Chat with the current note as context.

## Common commands

- **New Note** and **Search Notes**.
- **Go to Inbox**, **Go to All Notes**, **Go to Changes** and **Go to History**.
- **Open Research**.
- **Toggle AI Panel** and **New AI chat**.
- **Ask the agent about this note**.
- **Toggle Raw Editor**.
- **Open in New Window**.
- **Use Light Mode**, **Use Dark Mode** and **Match System**.
- **Add Remote to Current Vault** and **View Pending Changes**.
- **Reload Vault**, **Repair Vault** and **Restore Rhizome Vault**.
- **Set Up External AI Tools…** to connect Claude Code, Cursor and other MCP clients to your vault.
- **Open Settings**, **Open AI Agents** and **Keyboard Shortcuts**.

## Keyboard-first

Use the palette when you know what you want but don't want to hunt through panels. It's also the place to discover commands as the app grows. For shortcuts, see [Keyboard shortcuts](../reference/keyboard-shortcuts.md).

---

# Use spreadsheets

Source: guides/use-spreadsheets.md
URL: /guides/use-spreadsheets

Rhizome spreadsheets are sheet notes: Markdown files with frontmatter and a CSV-like body that open in a spreadsheet editor when their `Display as` value is `Sheet`.

Use a sheet note when a model needs rows, columns, calculations, or repeated numeric editing. Use a normal note when the main artifact is prose.

## Create a sheet

Use the command palette action `New Sheet`, or create/open a note and set its `Display as` to `Sheet` from the Properties panel. `Type` remains separate and can still be `Note`, `Project`, `Responsibility`, or any other Rhizome type.

When a note is a sheet:

- the YAML frontmatter remains available for type, status, relationships, wikilinks, and custom properties
- `_display: sheet` tells Rhizome to display the note with the spreadsheet editor
- the body is the sheet itself
- there is no rich-text body around the table
- the editor switches from the text editor to the spreadsheet editor

## Enter values

Click a cell and type a value. Non-formula values can be text, numbers, dates, or wikilinks.

Press `Enter` on a selected cell to edit the cell. Press `Escape` while editing to leave cell editing and keep focus in the sheet.

Use `Delete` or `Backspace` to clear the selected cell or range.

## Enter formulas

Formulas start with `=`.

```txt
=B2+B3-B4
=SUM(B2:D2)
=ROUND(E6, 2)
=IF(E6>0, "Up", "Down")
```

Rhizome shows inline formula autocomplete while you type. The autocomplete list is built from the implemented function catalog in the bundled IronCalc engine; formula evaluation is still handled by IronCalc.

See [Spreadsheet Formulas](../reference/spreadsheet-functions.md) for syntax, supported examples, and links to the full IronCalc formula reference.

## Select and edit ranges

The sheet editor follows spreadsheet conventions:

- arrow keys move the active cell
- `Shift` plus arrow keys extends the selection
- drag to select a range
- copy and paste preserves formulas where possible
- cut and paste moves formulas and shifts relative references
- right-click a selected cell or range to apply formatting

Right-click actions apply to the current selection. Keep a multi-cell selection active before opening the context menu when you want to format several cells together.

## Format cells

Use the context menu for common formatting:

- number formats such as plain numbers, currency, and percentages
- decimal precision
- bold and italic text
- alignment and clearing formatting when available

Formatting is stored as plain YAML under `_sheet`, not in an opaque workbook blob. For example, percentage formatting for `E6` is stored as:

```yaml
_sheet:
  cells:
    E6:
      num_fmt: "0.00%"
```

See [Spreadsheet File Format](../reference/spreadsheet-format.md) for the full storage model.

## Add wikilinks

Type `[[` in a cell to open note autocomplete.

```csv
Project,Owner,Status
[[website-redesign]],[[person/alice]],Active
[[sponsorship-pipeline]],[[person/matteo]],Review
```

When the cell is not being edited, Rhizome renders the wikilink like other note links. When you edit the cell, the raw `[[wikilink]]` syntax is shown again.

Command-click a wikilink in a sheet cell to open the linked note.

## Reference another sheet note

Formulas can read a cell from another sheet note with Rhizome's wikilink cell syntax:

```txt
=[[newsletter-revenue]].B5
=SUM(B2:D2)+[[sponsorship-pipeline]].E12
=ROUND([[business-plan]].$E$12, 2)
```

The part inside `[[...]]` resolves like a normal Rhizome wikilink. The part after the dot is an A1-style cell reference.

Use absolute markers when copying formulas:

| Reference | Copy behavior |
| --- | --- |
| `[[revenue]].B5` | row and column can shift |
| `[[revenue]].$B$5` | row and column stay fixed |
| `[[revenue]].B$5` | row fixed, column can shift |
| `[[revenue]].$B5` | column fixed, row can shift |

Cross-sheet references currently resolve single cells. Keep range formulas inside one sheet note.

## Work with the raw file

A sheet file remains readable text:

```md
---
type: Project
_display: sheet
status: Draft
belongs_to:
  - "[[business-plan]]"
_sheet:
  frozen_rows: 1
  columns:
    A:
      width: 180
---
Metric,January,February,March,Q1 Total
Subscriptions,1200,1350,1500,=SUM(B2:D2)
Services,800,900,750,=SUM(B3:D3)
Expenses,650,700,760,=SUM(B4:D4)
Net,=B2+B3-B4,=C2+C3-C4,=D2+D3-D4,=SUM(B5:D5)
```

When editing this file with scripts or AI agents, parse the body as CSV and preserve formulas as formulas. Do not replace formulas with displayed values.