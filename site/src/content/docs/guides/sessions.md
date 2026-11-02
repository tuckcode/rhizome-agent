---
title: Sessions
description: Find, resume, fork and archive chats, and where each engine keeps its chat logs.
---

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

<!-- Verify which engines show Fork and Archive before publishing; checked strings only (ai.message.fork, ai.workspace.archive). -->

## What's not saved in a session

API keys stay in the system keychain, never in session files. Rhizome removes known credentials from messages and tool results before it saves them. It can't recognise every private value, so don't paste secrets into a chat.

## Bring in chats from Claude Code

See [Import Claude Code history](import-a-session.md).
