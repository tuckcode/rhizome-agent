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
