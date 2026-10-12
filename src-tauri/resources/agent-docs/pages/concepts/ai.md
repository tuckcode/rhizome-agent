# Agents, engines and models

Source: concepts/ai.md
URL: /concepts/ai

Rhizome lets you choose what runs Chat: Prime Agent or Rhizome's own engine. Whichever you use, the vault, the permissions and the saved memory stay the same.

## Terms on this page

- **Agent loop:** the cycle that sends your message to a model, runs the tools the model asks for, and repeats until the answer is done.
- **Engine:** what runs that loop for Chat.
- **Model:** the language model the engine talks to, hosted or running locally.
- **Tool:** an action the agent can take, such as creating a note or running a command.

## Engines for Chat

| Engine | What it is | Good for |
|---|---|---|
| **Prime Agent** (default) | A separate harness Rhizome connects to. It runs sessions, tools, skills and provider login | Real agent work today: reading, searching and editing files, long runs, Prime packages |
| **Rhizome's engine** | Rhizome's own loop, built into the app. It doesn't need Prime | Choosing your own providers, including free models. Early: it can create notes, but can't read, search or edit files yet |

Switch with **Chat engine** in Settings → AI Agents. When it's on, new chats use Rhizome's engine and never call Prime, even if Prime isn't installed. The switch is only in Settings, not in the message box.

### Rhizome's engine

- **Models:** pick a catalog model, or **Free tier (auto)**. See [Free models and routing](free-models-and-routing.md). Anthropic models aren't offered here yet.
- **Tools:** `echo` and `create_note`. Power User adds `bash`. Rhizome asks you to approve each `bash` call, but `bash` doesn't run a shell yet. There are no tools to read, search or edit files, and the agent can't search the vault or old sessions.
- **Saved chats:** each chat is saved as it goes and can be reopened after you quit. Chats get a title automatically from the first exchange.
- **Errors:** a problem that doesn't stop the turn shows as a notice in the chat. A problem that does stop it, such as a missing key, ends the turn with a message that says what to fix.

### Prime Agent

Prime runs as a background service (a daemon) that Rhizome connects to. Prime owns its sessions (`~/.prime/agent/sessions/`) and its packages (Settings → Packages). Packages can use the whole machine; a vault isn't a sandbox for them.

Prime handles its own provider login. Sign in from Settings → AI Agents → Local agent, where each provider card (Anthropic, OpenAI Codex, xAI, DeepSeek and others) has a **Sign in** or **Reconnect** button. Or run `prime-agent` in a terminal and use `/login`. Prime's model list includes Anthropic models.

The same tab lists **Recognized local agents**, Prime's default model, and which models Prime may use.

## Permission modes

A **permission mode** decides what the agent may do without asking. It's set per vault.

| Mode | Rhizome's engine |
|---|---|
| **Limited tools** | `echo` and `create_note`. Asks before each note it creates |
| **Power User** | Creates notes without asking. Adds `bash`, which asks every time and doesn't run a shell yet |

Prime has no sandbox, so Prime chats always run as Power User. While Prime is the default AI target, chats on Rhizome's engine also run as Power User.

## Plugins

Rhizome will have its own plugin system: add a tool, hook into a turn, or block a tool call. It's planned, not shipped. Today, Prime packages extend Prime, and MCP lets other apps use your vault.

## Let other apps use your vault (MCP)

**MCP** (Model Context Protocol) lets other AI apps call Rhizome's tools. With it, an MCP client such as Claude Code or Cursor can read and write your vault.

Run **Set Up External AI Tools…** from the command palette (⌘K). Rhizome shows which config files it will change (for example `~/.claude.json` and `~/.cursor/mcp.json`) and writes nothing until you confirm. It needs Node.js 18 or newer, or Bun, on your `PATH`. To paste the entry yourself, use **Copy MCP config** in Settings → AI Agents → Local agent.

## Review what the agent changed

Agent edits are file edits. In a Git-backed vault, review them in the Changes view, look at the diff, and commit or revert. Save chat results you want to keep with **Save to vault**. See [Your vault is the agent's memory](vault-as-memory.md).