---
title: Rhizome
description: Rhizome is a desktop app for an AI agent whose memory is a folder of Markdown notes you own.
---

Rhizome is a desktop app for working with an AI agent. What's worth keeping ends up as plain Markdown notes in a folder on your disk, called your **vault**. You can open, edit, diff and revert those notes like any other file.

> **Developer preview.** Rhizome runs on macOS, built from source. There is no signed download yet. See [Install](start/install.md).

## What you get

- **Memory you can read.** Save an answer to the vault with one click. It becomes a Markdown file. In a Git repository, every change is a commit you can undo. [Your vault is the agent's memory](concepts/vault-as-memory.md)
- **A replay of where the agent went.** Mycelium draws the folder a Prime run worked in as a map, and lights up each file the agent searched, read or edited. [Mycelium](concepts/mycelium.md)
- **Free models that switch for you.** With **Free tier (auto)**, Rhizome routes a chat across free hosted models. When a provider fails or runs out, it moves to the next one. [Free models and routing](concepts/free-models-and-routing.md)
- **Its own agent loop, or Prime.** Rhizome has its own agent loop: it sends your message to a model, runs the tools the model asks for, and repeats until the answer is done. Prime Agent is still the default engine for Chat. [Agents, engines and models](concepts/ai.md)

It also has what you'd expect from a harness and a notes app: sessions you can resume, permission modes for tools, your choice of model, a rich Markdown editor, PDF and image previews, a wiki graph, and Git built in.

## Where to go next

| If you want to… | Read |
|---|---|
| Decide whether Rhizome is for you | [Why Rhizome](start/why-rhizome.md) |
| Try it | [Install](start/install.md), then [First launch](start/first-launch.md) |
| Move over from Claude Code, Hermes Agent, Cursor or Prime | [Coming from another harness](guides/coming-from-other-harnesses.md) |
| Chat and keep what matters | [Chat with the agent](guides/use-ai-panel.md) |
| Fix something | [Chat doesn't answer](troubleshooting/chat-doesnt-answer.md) |

## Origins

Rhizome is a modified version of [Tolaria](https://github.com/refactoringhq/tolaria) by Luca Rossi (AGPL-3.0). Rhizome is AGPL-3.0-or-later. Mycelium uses [Mindwalk](https://github.com/cosmtrek/mindwalk) (MIT) © 2026 Ricko Yu. Free tier (auto) builds on [OmniRoute](https://github.com/diegosouzapw/OmniRoute) and [freellmapi](https://github.com/tashfeenahmed/freellmapi) (both MIT). See [Credits and licences](reference/credits.md).
