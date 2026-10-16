---
title: Chat with the agent
description: Start a chat, keep typing while it runs, save what matters to the vault and resume later.
---

Chat is where you work with the agent: ask, let it use tools, keep what's worth keeping in the vault, and pick the conversation up again later.

## Start a chat

1. Open Chat with ⌘1. Rhizome opens on Chat by default.
2. Attach a vault if you want the agent to read your notes or save to them.
3. Type a message and press Enter.

Which engine answers depends on **Chat engine** in Settings → AI Agents: Prime Agent (the default) or Rhizome's own engine. See [Agents, engines and models](../concepts/ai.md).

## While a reply is running

The message box stays open, so you can write your next message while the agent works.

- **With Prime:** press Enter to send it to the running turn. Prime queues it and reads it before its next step.
- **With Rhizome's engine:** Enter does nothing until the reply finishes. Your text stays in the box; send it when the turn ends.

Press Stop to end the run with either engine. With VoiceOver, Rhizome announces when a run starts, when a tool starts or fails, and when the reply is complete or stopped.

## Ask from the editor or about a note

- **From the editor:** press ⌘K, then Space, and type a prompt. It uses the current note as context.
- **About a note:** run **Ask the agent about this note**. Chat stays open and the note opens beside it.
- **Show or hide Chat beside your notes:** ⌘⇧L.

## Keep what matters

Under a reply worth keeping, click **Save to vault**. Rhizome writes it as a Markdown note straight away, with no preview. It won't save an empty reply, a reply with no vault attached, text that contains a credential, or a reply that's already in the vault. See [Your vault is the agent's memory](../concepts/vault-as-memory.md).

## Come back to a chat

- **Rhizome's engine:** chats are saved as they go and listed with automatic titles. Reopen one to continue it. If Rhizome quit in the middle of a turn, that turn is marked cancelled when you reopen the chat. Tool approvals you gave earlier aren't restored, so the agent asks again. Only one window can send to a chat at a time.
- **Prime:** use the sessions list to switch between, fork and archive Prime sessions.

See [Sessions](sessions.md).

## Approve tools

The vault's permission mode decides what the agent may do without asking:

- **Limited tools:** Rhizome's engine can echo and create notes, and asks before each note.
- **Power User:** creates notes without asking, and also offers `bash`, with approval each time. `bash` doesn't run a shell yet.

Prime always runs as Power User, with its local tools and no sandbox. See [Agents, engines and models](../concepts/ai.md#permission-modes).

## See what the agent did

- **Changes:** next to All Notes in the sidebar. The files that changed, with diffs. Commit or revert.
- **Mycelium:** for Prime sessions, a map of which files the run searched, read or edited. See [Mycelium](../concepts/mycelium.md).

## Requests that work well

With Prime, which can read and search the vault:

- "Find notes related to this project and summarize what's open."
- "Draft a weekly review from the notes linked here."
- "What did we decide about X? Check the vault."

With Rhizome's engine, which can create notes but not read them yet:

- "Write up these meeting notes as a note called *Weekly sync*."
