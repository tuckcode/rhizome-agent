---
title: Agents, engines and models
description: The agent loop, Rhizome's chat engine, models, tools and permission modes.
---

Chat runs on Rhizome's own engine (ADR-0187). Prime and Hermes are being removed as chat engines. Open Prime-locked chats keep that lock until closed. The vault, permissions, and saved memory stay the same.

## Terms on this page

- **Agent loop:** the cycle that sends your message to a model, runs the tools the model asks for, and repeats until the answer is done.
- **Engine:** what runs that loop for Chat.
- **Model:** the language model the engine talks to, hosted or running locally.
- **Tool:** an action the agent can take, such as reading a note or running a command.

## Engine for Chat

New chats use **Rhizome's engine**: the loop built into the app. It does not need Prime. You pick catalog providers or **Taproot**, and the vault tools below run against the open vault.

### Rhizome's engine

- **Models:** pick a catalog model, or **Taproot**. See [Free models and routing](free-models-and-routing.md). Anthropic models aren't offered here yet.
- **Tools:** see the table below. Read and search tools run without asking. Edits and shell commands ask first.
- **Saved chats:** each chat is saved as it goes and can be reopened after you quit. Chats get a title automatically from the first exchange.
- **Errors:** a problem that doesn't stop the turn shows as a notice in the chat. A problem that does stop it, such as a missing key, ends the turn with a message that says what to fix.

| Tool | What it does | When it runs |
|---|---|---|
| `read_file`, `list_dir`, `grep`, `glob` | Read and search files in the open vault and workspace | Auto in both permission modes. Paths outside those roots are refused |
| `edit_file`, `write_file` | Change or create a file in those same roots | Asks every time unless you already allowed that tool and path for the session |
| `create_note` | Create a new Markdown note without overwriting | Asks in Limited tools. Auto in Power User |
| `bash` | Run one shell command with the vault as the working directory | Power User only. Asks every time. There is no session grant |
| `echo` | Return its arguments | Auto |

`bash` really runs the command (`sh -c` on macOS and Linux, `cmd /S /C` on Windows). Default timeout is 60 seconds, capped at 300. The working directory cannot be chosen by the model. stdin is closed. Output is capped. See the Chat **Run command** card for the full command, then stdout and stderr after it finishes.

Secret files (`.env*` except `.env.example`, `.git/`, key material) are blocked on the file tools. That denylist does not cover `bash`. Settings → AI Agents → Safety can turn the denylist off for **reads** only.

### Prime Agent

Prime runs as a background service (a daemon) that Rhizome connects to. Prime owns its sessions (`~/.prime/agent/sessions/`). Prime packages you install from the Prime CLI can use the whole machine; a vault isn't a sandbox for them. There is no in-app Packages marketplace. Settings → AI Agents → **Advanced Prime engine** shows whether Prime is installed and lets you copy MCP config.

Prime handles its own provider login. Sign in from Settings → AI Agents → Local agent, where each provider card (Anthropic, OpenAI Codex, xAI, DeepSeek and others) has a **Sign in** or **Reconnect** button. Or run `prime-agent` in a terminal and use `/login`. Prime's model list includes Anthropic models.

The same tab lists **Recognized local agents**, Prime's default model, and which models Prime may use.

## Permission modes

A **permission mode** decides what the agent may do without asking. It's set per vault.

| Mode | Rhizome's engine |
|---|---|
| **Limited tools** | Read and search auto-run. `create_note` asks. Edits ask. No `bash` |
| **Power User** | Read, search, and `create_note` auto-run. Edits still ask unless a session grant covers that path. `bash` is offered and asks every time |

Prime has no sandbox, so Prime chats always run as Power User.

## Plugins

Rhizome will have its own plugin system: add a tool, hook into a turn, or block a tool call. It's planned, not shipped. Today, Prime CLI packages extend Prime, and MCP lets other apps use your vault.

## Let other apps use your vault (MCP)

**MCP** (Model Context Protocol) lets other AI apps call Rhizome's tools. With it, an MCP client such as Claude Code or Cursor can read and write your vault.

Run **Set Up External AI Tools…** from the command palette (⌘K). Rhizome shows which config files it will change (for example `~/.claude.json` and `~/.cursor/mcp.json`) and writes nothing until you confirm. It needs Node.js 18 or newer, or Bun, on your `PATH`. To paste the entry yourself, use **Copy MCP config** in Settings → AI Agents → **Advanced Prime engine**.

## Review what the agent changed

Agent edits are file edits. In a Git-backed vault, review them in the Changes view, look at the diff, and commit or revert. Save chat results you want to keep with **Save to vault**. See [Your vault is the agent's memory](vault-as-memory.md).
