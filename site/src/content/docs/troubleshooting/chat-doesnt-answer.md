---
title: Chat doesn't answer
description: What to do when a message gets no reply, for Rhizome's own engine and for Prime.
---

New chats use Rhizome's own engine (ADR-0187).

## Rhizome's engine

| You see | Do this |
|---|---|
| No key for the model | Add the key in Settings → AI Agents → API model (or Local model). Settings points you there |
| "No free-tier provider key is set." | Turn on at least one provider under **Taproot** and paste its key |
| A provider row says **Keychain error** | Unlock the keychain, or allow Rhizome to use it, then reopen Settings |
| A notice appears, but the reply goes on | Something went wrong that didn't stop the turn, such as part of the chat not being saved. Read the notice; the chat still works |
| The model can't be reached | Click **Test model** on the provider. See [Model provider connection](model-provider-connection.md) |
| Enter does nothing while a reply runs | Rhizome's engine takes one turn at a time. Wait for the reply, or press Stop |
| **Continue (12/50)** (your numbers may differ) | The step limit paused the turn. It is not a failure. Click Continue for 50 more rounds. **Agent max steps** changes the next message you type, not the size of Continue. See [Chat with the agent](../guides/use-ai-panel.md#when-a-turn-reaches-its-step-limit) |
| `Continue couldn't start:` | Read the reason on that line. The paused turn is still there and can be tried again |
| `<model> can't read images` | Remove the image, or pick a model that can read images. The message is not sent as text only |
| `Every model that can read images is cooling down. Try again shortly.` | Wait, then send again. Taproot does not switch to a text-only model to get an answer |
| Another window is already running this chat | Only one turn can run at a time. Wait, or continue in that window |

## Prime Agent

| You see | Do this |
|---|---|
| Prime is missing | Applies to Prime-locked chats only. Install Prime with `./install.sh`, run `prime-agent` once, and start the daemon (see [Install](../start/install.md#set-up-prime-legacy)) |
| Prime is installed, but Chat still says it's missing | Wait a few seconds. The check repeats. If it keeps failing, see [AI agent not found](ai-agent-not-found.md) |
| Chat stopped answering after you closed a terminal | Prime stops with the terminal that started it. Start it as a daemon: `(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status` |
| The provider login expired | Run `prime-agent`, then `/login`. Settings no longer has a Prime sign-in |

## Either engine

| You see | Do this |
|---|---|
| No network | Notes on disk still open. Chat can't answer until the network is back, unless you use a local model |
| The window disappeared | The red button quits Rhizome unless **Keep in taskbar** is on. Reopen the app, or click the Dock icon |
