---
title: Coming from another harness
description: Map what you know from Claude Code, Hermes Agent, Cursor and Prime onto Rhizome.
---

If you already use Claude Code, Hermes Agent, Cursor or Prime, a lot of what you know carries over. This page maps your habits onto Rhizome, and shows what's different: memory lives in a folder you can read, and you can see where a run went.

## The one big difference

In most harnesses, memory is a file or store that belongs to the tool: `MEMORY.md`, `USER.md`, a database, a cloud account. In Rhizome, memory is your **vault**, a folder of Markdown notes. You choose what's saved with **Save to vault**. With Prime, answers that use a note say it came from your vault. With Git, every change can be diffed and reverted. See [Your vault is the agent's memory](../concepts/vault-as-memory.md).

## From Claude Code

| In Claude Code | In Rhizome |
|---|---|
| Your past sessions | Settings → AI Agents → **Import chat history** brings them into the vault as notes under `Imports/claude-code/`. See [Import Claude Code history](import-a-session.md) |
| `CLAUDE.md` | The vault's `AGENTS.md`. Rhizome keeps a `CLAUDE.md` alongside it for compatibility |
| MCP servers | Rhizome is an MCP server too. **Set Up External AI Tools…** (⌘K) adds it to Claude Code's config, so Claude Code can read and write your vault from the terminal |
| Claude models | Prime, signed in on the Anthropic card in Settings → AI Agents → Local agent. Rhizome's own engine doesn't offer Anthropic models yet |
| Permission prompts | Permission modes, **Limited tools** and **Power User**, set per vault |
| `/resume` | The sessions list. See [Sessions](sessions.md) |

Rhizome doesn't run Claude Code inside Chat. Keep using Claude Code in the terminal, connected to your vault through MCP.

## From Hermes Agent

| In Hermes | In Rhizome |
|---|---|
| `MEMORY.md` / `USER.md` | Vault notes you save on purpose. Automatic saving exists but is off by default |
| Memory writes you approve | **Save to vault** is an explicit click. It writes straight away, so review the note after, or undo with Git |
| Observable, interruptible runs | Stop any run; with Prime, send a follow-up while it works; see a Prime run's file footprint in [Mycelium](../concepts/mycelium.md) |
| Skills | Prime CLI packages (`prime-agent package install`) when Prime is the engine. There is no in-app Packages marketplace. Rhizome's own plugin system is planned |
| Your choice of provider | Your own providers, local models or **Taproot**. Keys live in the system keychain |

## From Cursor

| In Cursor | In Rhizome |
|---|---|
| Agent chat beside your files | Chat with notes beside it (⌘2 shows Notes) |
| Cursor's MCP settings | **Set Up External AI Tools…** (⌘K) writes Rhizome's MCP entry into `~/.cursor/mcp.json`, so Cursor's agent can use your vault |
| Rules files | The vault's `AGENTS.md` |
| Model picker | Prime's models, your own providers, or **Taproot** |

Rhizome isn't a code editor. Keep Cursor for code, and use Rhizome as the place where what you and your agents learn is kept, reviewed and found again.

## From Prime Agent

Chat starts on Rhizome's own engine. Prime is still there if you turn **Chat engine** off:

- Your sessions stay in `~/.prime/agent/sessions/`. Rhizome lists them, lets you switch, fork and archive, and draws their footprint in Mycelium.
- Your login stays with Prime (`/login` in a terminal, or **Sign in** on a provider card in Settings → AI Agents → Local agent).
- Prime packages install from the Prime CLI (`prime-agent package install`). They have full system access. There is no in-app Packages marketplace.
- Rhizome connects to Prime's background service.

What Rhizome adds is the vault: Save to vault, recall with its source, Git history, the Graph view and Mycelium.

## Bring your own model

Rhizome's engine is the default. Add a provider, or use **Taproot**. It works without Prime installed. It can read, search, edit and create notes in the open vault. Power User can run one approved shell command in the vault folder. Anthropic models still need Prime. See [Set up models and keys](configure-ai-models.md).

## Plugins

Rhizome's own plugin system is planned, not shipped. Today you can extend Prime with CLI packages, and other apps can reach your vault through MCP.
