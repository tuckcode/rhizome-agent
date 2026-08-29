# AI

Source: concepts/ai.md
URL: /concepts/ai

# AI

Rhizome has two AI paths: coding agents that can use tools to inspect and edit a vault, and direct model targets that answer in chat mode from note context.

## Coding Agents

The AI panel can stream supported local CLI agents through Rhizome's normalized event layer. Current targets include Claude Code, Codex, OpenCode, Pi, and Antigravity CLI when they are installed on the machine.

Prime (Chat) always has local tools available. It has no sandbox; the old Vault Safe prompt is not sent.

Claude Code and Antigravity still enforce a per-vault mode:

- **Limited tools** blocks shell commands.
- **Power User** allows local shell commands scoped to the active vault.

Other CLI agents are asked to follow the same labels; enforcement depends on the adapter.

## Direct Models

Direct model targets run in chat mode. They receive the active note, linked context, and conversation history, but they do not receive vault-write tools or shell access.

Supported provider shapes include:

- Local models through Ollama or LM Studio.
- Hosted providers such as OpenAI, Anthropic, Gemini, and OpenRouter.
- Custom OpenAI-compatible endpoints.

## External MCP Setup

Rhizome exposes an MCP server for external tools. The setup flow can write Rhizome's MCP entry into Claude Code, Antigravity CLI, Cursor, and a generic MCP config path, and it can also copy the exact JSON snippet for manual setup.

MCP setup is explicit. Closing the dialog leaves third-party config files untouched.

## Why Git Matters For AI

AI-generated changes should be inspectable. Git gives you diffs, history, rollback, and a clear boundary between suggestions and committed work.