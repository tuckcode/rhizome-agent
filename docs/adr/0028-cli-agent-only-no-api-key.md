---
type: ADR
id: "0028"
title: "CLI agent only — no direct Anthropic API key"
status: active
date: 2026-03-29
supersedes: "0027"
---

## Context

ADR-0027 introduced a dual AI architecture: a lightweight API-based chat (AIChatPanel) using the Anthropic API directly, and a full CLI agent (AiPanel) spawning Claude CLI as a subprocess with MCP tool access. In practice, the API chat was never shipped to users — the CLI agent covered all use cases and provided a superior experience through tool access and MCP integration. Maintaining two codepaths added complexity, and requiring users to manage an Anthropic API key created friction.

## Decision

**Remove the direct Anthropic API integration entirely. AI is available exclusively via CLI agent subprocesses (Claude Code, and in the future Codex or other CLI agents).** No API key field in settings. The CLI agent authenticates via its own mechanism (e.g. `claude` CLI login).

Removed:
- `AIChatPanel` component, `useAIChat` hook
- Rust `ai_chat` command and `ai_chat.rs` module
- `anthropic_key` field from Settings (Rust and TypeScript)
- Vite dev-server Anthropic API proxy (`aiChatProxyPlugin`, `aiAgentProxyPlugin`)

Kept:
- `AiPanel` + `useAiAgent` — Claude CLI subprocess with MCP vault integration
- Shared utilities in `ai-chat.ts` (`trimHistory`, `formatMessageWithHistory`, `streamClaudeChat`, etc.)
- `Cmd+I` keyboard shortcut and menu item for toggling the AI panel

## Options considered

- **Option A** (chosen): Remove API chat, keep CLI agent only. Simplifies codebase, removes API key management, single codepath.
- **Option B**: Keep both but hide API chat behind feature flag. Adds dead code weight without benefit.
- **Option C**: Replace CLI agent with API chat + manual tool calling. Loses MCP integration and Claude CLI features.

## Consequences

- Users no longer need to obtain or manage an Anthropic API key
- Existing saved API keys are silently ignored (the field no longer exists in the Settings struct; serde skips unknown fields on deserialization)
- Future CLI agents (Codex, etc.) can plug into the same `AiPanel` architecture
- If a lightweight chat mode is needed later, it should be built as a CLI agent mode, not a separate API integration
