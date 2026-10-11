---
title: Chat doesn't answer
description: What to do when a message gets no reply, for Prime and for Rhizome's own engine.
---

First check which engine runs Chat: Settings → AI Agents → **Chat engine**. Off means Prime Agent. On means Rhizome's own engine.

## Prime Agent

| You see | Do this |
|---|---|
| Prime is missing | Install Prime with `./install.sh`, run `prime-agent` once, and start the daemon (see [Install](../start/install.md#set-up-prime)). Or turn on **Chat engine** to use Rhizome's engine, which doesn't need Prime |
| Prime is installed, but Chat still says it's missing | Wait a few seconds. The check repeats. If it keeps failing, see [AI agent not found](ai-agent-not-found.md) |
| Chat stopped answering after you closed a terminal | Prime stops with the terminal that started it. Start it as a daemon: `(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status` |
| The provider login expired | Settings → AI Agents → Local agent → **Reconnect** on that provider. Or run `prime-agent`, then `/login` |

## Rhizome's engine

| You see | Do this |
|---|---|
| No key for the model | Add the key in Settings → AI Agents → API model (or Local model). Settings points you there |
| "No free-tier provider key is set." | Turn on at least one provider under **Free tier (auto)** and paste its key |
| A provider row says **Keychain error** | Unlock the keychain, or allow Rhizome to use it, then reopen Settings |
| A notice appears, but the reply goes on | Something went wrong that didn't stop the turn, such as part of the chat not being saved. Read the notice; the chat still works |
| The model can't be reached | Click **Test model** on the provider. See [Model provider connection](model-provider-connection.md) |
| Enter does nothing while a reply runs | Rhizome's engine takes one turn at a time. Wait for the reply, or press Stop |
| Another window is already running this chat | Only one turn can run at a time. Wait, or continue in that window |

## Either engine

| You see | Do this |
|---|---|
| No network | Notes on disk still open. Chat can't answer until the network is back, unless you use a local model |
| The window disappeared | The red button quits Rhizome unless **Keep in taskbar** is on. Reopen the app, or click the Dock icon |
