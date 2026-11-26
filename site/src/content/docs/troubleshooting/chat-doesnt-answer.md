---
title: Chat doesn't answer
description: What to do when a message gets no reply.
---

New chats use Rhizome's own engine (ADR-0187). There is no Prime setup on first launch.

## Rhizome's engine

| You see | Do this |
|---|---|
| No key for the model | Add the key in Settings → AI Agents → **Connected**, or on the API model / Local model tab |
| "No free-tier provider key is set." | Turn on at least one provider under **Taproot** and paste its key |
| A provider row says **Keychain error** | Unlock the keychain, or allow Rhizome to use it, then reopen Settings |
| Couldn't load models | Retry in the picker. The live list waits 10 seconds, then shows this with Retry |
| A notice appears, but the reply goes on | Something went wrong that didn't stop the turn, such as part of the chat not being saved. Read the notice; the chat still works |
| The model can't be reached | Click **Test model** on the provider. See [Model provider connection](model-provider-connection.md) |
| The model can't read images | Remove the image, or switch to a vision model. See [Chat with the agent](../guides/use-ai-panel.md#send-an-image) |
| Continue on the last reply | The turn hit **Agent max steps**. Click Continue for 50 more rounds, or stop |
| Enter does nothing while a reply runs | Rhizome's engine takes one turn at a time. Wait for the reply, or press Stop |
| Another window is already running this chat | Only one turn can run at a time. Wait, or continue in that window |

## Leftover Prime chats

New chats never need Prime. These rows apply only to an old Prime-locked chat that is still open.

| You see | Do this |
|---|---|
| Prime is missing | Install Prime with `./install.sh`, run `prime-agent` once, and start the daemon (see [Install](../start/install.md#set-up-prime-legacy)). Or start a new chat on Rhizome's engine |
| Prime is installed, but Chat still says it's missing | Wait a few seconds. The check repeats. If it keeps failing, see [AI agent not found](ai-agent-not-found.md) |
| Chat stopped answering after you closed a terminal | Prime stops with the terminal that started it. Start it as a daemon: `(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status` |
| The provider login expired | Run `prime-agent`, then `/login`. Settings no longer has a Prime sign-in |

## Either path

| You see | Do this |
|---|---|
| No network | Notes on disk still open. Chat can't answer until the network is back, unless you use a local model |
| The window disappeared | The red button quits Rhizome unless **Keep in taskbar** is on. Reopen the app, or click the Dock icon |
