---
title: Chat with the agent
description: Start a chat, keep typing while it runs, save what matters to the vault and resume later.
---

Chat is where you work with the agent: ask, let it use tools, keep what's worth keeping in the vault, and pick the conversation up again later.

## Start a chat

1. Open Chat with ⌘1. Rhizome opens on Chat by default.
2. Attach a vault if you want the agent to read your notes or save to them.
3. Type a message and press Enter.

New chats use Rhizome's own engine (ADR-0187). See [Agents, engines and models](../concepts/ai.md).

## Send an image

Paste or drop a PNG, JPEG, GIF, or WebP into the composer. You can send an image with no text. A message can hold up to 4 images. Each image can be up to 5 MB.

Rhizome keeps those images next to the chat log, not inside it. A reopened chat can send them again.

| You see | Meaning |
|---|---|
| Checking image support… | Rhizome is looking up whether this model can read images |
| The model can't read images | Remove the image, or switch to a vision model. Anthropic is not offered here yet |
| Rhizome doesn't know if the model can read images | **Send anyway** treats it as a vision model for this request. **Undo** takes that back |
| BMP, TIFF, or SVG refused | Those types are not attached |

## While a reply is running

The message box stays open, so you can write your next message while the agent works.

Enter does nothing until the reply finishes. Your text stays in the box; send it when the turn ends.

Press Stop to end the run. With VoiceOver, Rhizome announces when a run starts, when a tool starts or fails, and when the reply is complete or stopped.

If a turn hits **Agent max steps**, Chat shows **Continue** on that reply with the step count. Only the latest idle turn can continue. Continue keeps the same chat and the work already done, then adds 50 more rounds. Stop ends the run; Continue is still available after an idle cancel. Quit is final.

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
