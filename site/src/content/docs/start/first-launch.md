---
title: First launch
description: Open a vault, send your first message and save your first note.
---

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

<!-- The app builds the template vault locally unless RHIZOME_GETTING_STARTED_REPO_URL is set. Update this page if the welcome card copy or the default folder name changes. -->

If the folder is in Documents, Desktop or Downloads, macOS asks for permission. Allow it, or move the vault somewhere else.

Git is optional, but recommended. In a Git repository, every change, including the agent's, can be reviewed and reverted. See [Open or create a vault](open-or-create-vault.md).

## 4. Send one message

Type a message and press Enter. You should get an answer, or a clear failure:

| You see | Do this |
|---|---|
| No provider key | Add a key in Settings → AI Agents → API model, or turn on a free provider. See [Set up models and keys](../guides/configure-ai-models.md) |
| Prime is installed, but Chat still says it's missing | This applies only if **Chat engine** is off. Wait a few seconds. The check repeats |
| The provider login expired (Prime) | Settings → AI Agents → Local agent → **Reconnect** on that provider, or run `prime-agent` and `/login` in a terminal |

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
