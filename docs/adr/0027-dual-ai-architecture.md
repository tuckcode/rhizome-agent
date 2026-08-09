---
type: ADR
id: "0027"
title: "Dual AI architecture (API chat + CLI agent)"
status: superseded
superseded_by: "0028"
date: 2026-03-01
---

## Context

Laputa needs two distinct AI interaction modes: a lightweight chat for quick questions about the current note (no tool access, fast responses), and a full agent that can search, read, create, and modify vault notes via MCP tools. These have fundamentally different requirements — the chat needs low latency and simple streaming, while the agent needs tool calling, conversation state, and MCP integration.

## Decision

**Maintain two separate AI interfaces: AI Chat (AIChatPanel) uses the Anthropic API directly via Rust for simple streaming responses. AI Agent (AiPanel) spawns Claude CLI as a subprocess with MCP vault integration for full tool access.** Both share a context builder (`ai-context.ts`) that provides the active note and linked entries.

## Options considered

- **Option A** (chosen): Dual architecture — optimized for each use case. Chat is fast and simple; agent is powerful with tool access. Downside: two codepaths to maintain.
- **Option B**: Single agent for both — always use Claude CLI. Downside: overkill for simple questions, slower startup, unnecessary tool overhead.
- **Option C**: Single API-based chat with manual tool calling — unified codebase. Downside: complex tool-calling loop implementation, no MCP integration.

## Consequences

- AI Chat: `AIChatPanel` + `useAIChat` hook → Rust `ai_chat` command → Anthropic API. Default model: Haiku 3.5 (fast, cheap).
- AI Agent: `AiPanel` + `useAiAgent` hook → Rust `claude_cli.rs` → Claude CLI subprocess with MCP config.
- Both panels share a toggle in the breadcrumb bar (Sparkle icon).
- Context builder (`ai-context.ts`) provides structured JSON with active note, linked notes, open tabs, vault metadata.
- Token budget: 60% of 180k context limit (~108k tokens max).
- Chat requires an Anthropic API key in settings; agent uses Claude CLI's own authentication.
- Re-evaluation trigger: if Anthropic releases an SDK that handles both simple chat and tool calling efficiently.
