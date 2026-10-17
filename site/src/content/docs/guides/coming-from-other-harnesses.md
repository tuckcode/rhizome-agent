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
| Claude models | Not on Rhizome's own engine yet; use another provider or Taproot |
| Permission prompts | Permission modes, **Limited tools** and **Power User**, set per vault |
| `/resume` | The sessions list. See [Sessions](sessions.md) |

Rhizome doesn't run Claude Code inside Chat. Keep using Claude Code in the terminal, connected to your vault through MCP.

## From Hermes Agent

| In Hermes | In Rhizome |
|---|---|
| `MEMORY.md` / `USER.md` | Vault notes you save on purpose. Automatic saving exists but is off by default |
| Memory writes you approve | **Save to vault** is an explicit click. It writes straight away, so review the note after, or undo with Git |
| Observable, interruptible runs | Stop any run; with Prime, send a follow-up while it works; see a Prime run's file footprint in [Mycelium](../concepts/mycelium.md) |
| Skills | Rhizome's own plugin system is planned |
| Your choice of provider | Your own providers, local models or **Taproot**. Keys live in the system keychain |

## From Cursor

| In Cursor | In Rhizome |
|---|---|
| Agent chat beside your files | Chat with notes beside it (⌘2 shows Notes) |
| Cursor's MCP settings | **Set Up External AI Tools…** (⌘K) writes Rhizome's MCP entry into `~/.cursor/mcp.json`, so Cursor's agent can use your vault |
| Rules files | The vault's `AGENTS.md` |
| Model picker | Your providers or **Taproot** |

Rhizome isn't a code editor. Keep Cursor for code, and use Rhizome as the place where what you and your agents learn is kept, reviewed and found again.

## Bring your own model

Add a provider or use **Taproot**. Rhizome's engine can read, search, edit, and create notes in the open vault. Power User can run one approved shell command in the vault folder. See [Set up models and keys](configure-ai-models.md).

## Plugins

Rhizome's own plugin system is planned, not shipped. Other apps can reach your vault through MCP.
