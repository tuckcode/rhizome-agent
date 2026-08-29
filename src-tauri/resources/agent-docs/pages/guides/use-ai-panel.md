# Use The AI

Source: guides/use-ai-panel.md
URL: /guides/use-ai-panel

# Use The AI

Rhizome gives you two ways to ask for AI help: open the AI panel for an ongoing conversation, or prompt directly from the editor with `Cmd+K` followed by a space.

## Choose How To Prompt

- **AI panel** is best for longer conversations, agent work, and requests that need visible back-and-forth.
- **Inline prompt** is best when you are already writing. Press `Cmd+K`, type a space, then write the prompt you want the AI to handle from the current note context.

## Choose A Target

Open Settings and choose the default AI target:

- **Coding agent** for tool-backed vault editing through Claude Code, Codex, OpenCode, Pi, or Antigravity CLI.
- **Local model** for Ollama or LM Studio chat over note context.
- **API model** for OpenAI, Anthropic, Gemini, OpenRouter, or an OpenAI-compatible endpoint.

If a coding agent is missing, install it and reopen Rhizome or switch to another target.

## Permission Mode

Prime (Chat) always runs with local tools available. It has no sandbox, so the old Vault Safe prompt is not sent — that text only asked the model not to use shell, and the model obeyed.

Claude Code and Antigravity still enforce a per-vault mode:

- **Limited tools** blocks shell commands.
- **Power User** allows local shell commands for this vault.

Other CLI agents are asked to follow the same labels; enforcement depends on the adapter.

Direct model targets always stay in chat mode. They can use note context, but they cannot edit vault files through tools.

## Good Requests

- "Find notes related to this project."
- "Summarize what changed in this note."
- "Draft a weekly review from these linked notes."
- "Update this checklist based on the current project status."

## Review Changes

AI edits are file edits. Review them with Rhizome's diff and Git history before committing.