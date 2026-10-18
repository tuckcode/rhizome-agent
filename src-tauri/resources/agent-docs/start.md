# First launch

Source: start/first-launch.md
URL: /start/first-launch

In a few minutes you'll have a vault open, an answer from the agent, and one note saved to disk that you can reopen after a restart.

## 1. Choose about telemetry

The first launch may ask **Help improve Rhizome**. You can decline.

- **Accept** turns on crash reports and usage analytics.
- **Decline** turns both off.

Change either one later in Settings → Telemetry. Analytics events leave out vault content, note titles and file paths. A build made without a Sentry or PostHog key sends nothing, whatever you choose.

## 2. Chat opens

Rhizome opens on Chat. On a first launch, the sessions list opens next to it. The theme is Graphite. Dark is Graphite, Light is Earth light, and System follows the OS between those two. Earth dark, Loam, and Mycelium are color skins in Settings → Appearance.

The left rail holds your sessions, the **Views** group (Research, Graph, Mycelium and History) and Settings. On a Mac, Ctrl+⌘1 to Ctrl+⌘4 open the four Views. On Windows, use Ctrl+Shift+1 to Ctrl+Shift+4.

## 3. Open or create a vault

A **vault** is the folder where Rhizome keeps notes, and where the agent's saved memory goes. You have three choices:

- **Get started with a template.** Rhizome creates a vault at `~/Documents/Rhizome Vault`. It's built on your computer; nothing is downloaded. It has starter folders, a welcome note, an `AGENTS.md` for agents, and the default work types from [Portent](../guides/structure-with-portent.md) (Project, Operation, Responsibility, Task, Event, Topic, Person). It's a Git repository with one first commit. If you already have a `Getting Started` vault from an earlier version, it still opens as before.
- **Create empty vault.** Name a new folder and choose where it goes. Rhizome adds its default settings files.
- **Open existing vault.** Pick a folder you already have. Any folder of Markdown files works, including an Obsidian vault or a Git repository.


If the folder is in Documents, Desktop or Downloads, macOS asks for permission. Allow it, or move the vault somewhere else.

Git is optional, but recommended. In a Git repository, every change, including the agent's, can be reviewed and reverted. See [Open or create a vault](open-or-create-vault.md).

## 4. Send one message

Type a message and press Enter. You should get an answer, or a clear failure:

| You see | Do this |
|---|---|
| No provider key | Add a key in Settings → AI Agents → API model, or turn on a free provider. See [Set up models and keys](../guides/configure-ai-models.md) |
| Prime is installed, but Chat still says it's missing | Applies to Prime-locked chats only. Wait a few seconds. The check repeats |
| The provider login expired (Prime) | Run `prime-agent` and `/login` in a terminal. Settings no longer has a Prime sign-in |

More cases: [Chat doesn't answer](../troubleshooting/chat-doesnt-answer.md).

## 5. Save something to the vault

Under an answer you want to keep, click **Save to vault**. Rhizome writes it as a Markdown note in your vault.

Show Notes with ⌘2 (or the View menu), open the note, quit Rhizome with ⌘Q, and reopen it. The note is still there, because it's a file on your disk.

> The red window button quits Rhizome. If you turn on **Keep in taskbar** in Settings → Appearance, it hides the window instead, and you bring it back from the Dock.

## Where things are kept

| What | Where |
|---|---|
| Notes, attachments, types, saved views | Your vault folder |
| Prime chat sessions | `~/.prime/agent/sessions/` |
| Chats from Rhizome's own engine | `native-sessions/` in the app config folder (`com.rhizome.app`) |
| API keys | The system keychain |
| Settings, window size, recent vaults | Local app settings |

## Next

- [Why Rhizome](why-rhizome.md): what's different here.
- [Your vault is the agent's memory](../concepts/vault-as-memory.md)
- [Chat with the agent](../guides/use-ai-panel.md)

---

# Install

Source: start/install.md
URL: /start/install

You build Rhizome from source on a Mac and run it from there. This takes a few minutes, mostly for the first build.

:::note
**Developer preview.** macOS only. There is no signed download, no Homebrew package and no in-app updater yet. See [Platforms and updates](../reference/platforms-and-updates.md).
:::

## Before you start

You need:

1. macOS with the Xcode Command Line Tools (`xcode-select --install`)
2. Node.js `^20.19.0` or `>=22.12.0`
3. pnpm
4. Rust `1.77.2` or newer
5. git

Prime Agent is not required for Chat. Rhizome's own engine is the only chat engine. Prime and Hermes are no longer chat engines (ADR-0189); leftover code is still in the repo until the follow-up PRs.

## Build and run

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
./install.sh
pnpm tauri dev
```

`./install.sh` installs the project's dependencies. If Prime Agent isn't on the machine, it may still download Prime's command-line tool. Chat doesn't use it (ADR-0189), and that step comes out with the leftover engine code. Rhizome doesn't include a copy of Prime or Node. Chat runs on Rhizome's own engine.

`pnpm tauri dev` builds the app and opens it.

## Set up Prime (legacy)

Skip this section unless you use Prime from the CLI. New chats use Rhizome's own engine. Add a provider key or use **Taproot** in Settings → AI Agents. See [Set up models and keys](../guides/configure-ai-models.md).

The first time `prime-agent` runs in a terminal, it asks you to run `/login` and choose a model provider. Rhizome's Settings no longer has a Prime sign-in.

Prime stops when the terminal that started it closes. To keep it running in the background:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

## If you already have a built copy

Quit `/Applications/Rhizome Agent.app` before you run `pnpm tauri dev`. Both use the bundle id `ai.rhizome.agent`, so a second launch attaches to the copy that's already open.

## Look at the interface without an engine

```bash
pnpm dev
```

Then open `http://localhost:5202`. This runs the interface in a browser. Chat doesn't answer.

## Next

[First launch](first-launch.md): open a vault and send your first message.

---

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

---

# Why Rhizome

Source: start/why-rhizome.md
URL: /start/why-rhizome

A coding harness that doesn't forget. Rhizome runs its own agent loop on any model, free ones included, and keeps what matters as plain Markdown in a vault you own. You can check what the agent did to your files after the fact.

## The problem it solves

Most agent harnesses either forget everything when a session ends, or remember things in a store you can't easily read: a hidden memory file, a database, a cloud account. You can't tell what the agent "knows", fix it when it's wrong, or take it with you.

## Memory is a folder of Markdown

Rhizome keeps memory in a **vault**: an ordinary folder of Markdown files on your disk. You can start from a template with starter folders and note types, so you don't have to design a structure first. You can open the same files in any editor, search them with `grep`, and back them up however you like.

When a chat produces something worth keeping, you click **Save to vault**. Rhizome writes a note. Nothing is saved without a click unless you turn automatic saving on. [How memory works](../concepts/vault-as-memory.md)

## Git is the undo button

If the vault is a Git repository, every change to it can be committed, including the agent's changes. You can see what a note looked like before, see what changed, and revert it. Git is optional, but it's what makes agent memory safe to trust. [Git](../concepts/git.md)

## See where the agent went

**Mycelium** replays a Prime session as a map. The folder the agent worked in becomes a city of files, and each file the agent searched, read or edited lights up. When something breaks, you can see which files a run touched and where it went in circles. Mycelium uses the open-source Mindwalk project, which you install separately. [Mycelium](../concepts/mycelium.md)

## Free models, routed for you

**Taproot**, Rhizome's free automatic router, sends a chat to free hosted models (Groq, Mistral, LLM7, OpenRouter's free models, NVIDIA NIM) in a fixed order. When one fails or runs out of free use, Rhizome moves to the next. Models whose free tier trains on your prompts are left out. You can add your own endpoint as the last stop. It builds on two open-source projects, OmniRoute and freellmapi. [Free models and routing](../concepts/free-models-and-routing.md)

## Rhizome runs its own loop

An **agent loop** is the cycle that sends your message to a model, runs the tools the model asks for, and repeats until the answer is done. Rhizome has its own, and that is the only chat engine (ADR-0187). Prime and Hermes are no longer chat engines (ADR-0189); leftover code is still in the repo until the follow-up PRs. The vault, permissions, and memory stay with Rhizome.

Rhizome's engine can read, search, edit and create notes in the open vault. In Power User it can run one approved shell command in the vault folder. [Agents, engines and models](../concepts/ai.md)

## What will feel familiar

If you've used Claude Code, Hermes Agent, Cursor or Prime, most of the basics carry over:

| You know | In Rhizome |
|---|---|
| Sessions you can resume | Saved native chats with automatic titles |
| Tool approval | Permission modes: **Limited tools** and **Power User** |
| Bring your own model | Hosted providers, local models (Ollama, LM Studio), any OpenAI-compatible endpoint; keys in the system keychain |
| `CLAUDE.md` / `AGENTS.md` | A vault `AGENTS.md`, with `CLAUDE.md` kept as a compatibility file |
| MCP | Rhizome runs an MCP server, so other apps can read and write your vault |
| Past chat history | Import Claude Code chats into the vault |
| Extensions | Rhizome's own plugin system is planned |
| An editor | A rich Markdown editor with a raw mode, plus PDF and image previews, sheets, diagrams and whiteboards |
| A graph | The Wiki Graph: notes as nodes, links as edges |

[Coming from another harness](../guides/coming-from-other-harnesses.md) maps each one in detail.

## What it isn't yet

Rhizome is a macOS developer preview. You build it from source; there is no signed download or in-app updater. Chat runs on Rhizome's own engine and does not need Prime.