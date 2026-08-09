---
type: ADR
id: "0012"
title: "Claude CLI subprocess for AI agent (replacing direct API)"
status: active
date: 2026-03-01
---

## Context

The AI agent panel initially called the Anthropic API directly from Rust, managing tool calling loops manually. This required implementing tool execution, conversation state, and streaming — all complex to maintain. Claude CLI (`claude` binary) handles all of this natively, including MCP tool integration, conversation history, and streaming NDJSON output.

## Decision

**The AI agent panel spawns Claude CLI as a subprocess via `claude_cli.rs`, passing messages with `--output-format stream-json` and vault MCP config via `--mcp-config`. The frontend parses the NDJSON event stream (Init, TextDelta, ThinkingDelta, ToolStart, ToolDone, Result, Done) for real-time display.**

## Options considered

- **Option A** (chosen): Claude CLI subprocess with NDJSON streaming — built-in tool calling, MCP integration, conversation management, no API key needed (CLI handles auth). Downside: requires Claude CLI installed, subprocess management complexity.
- **Option B**: Direct Anthropic API with manual tool loop — full control, no external dependency. Downside: must implement tool calling, retries, conversation state, MCP tool bridging.
- **Option C**: Use Anthropic Agent SDK from Rust — structured agent framework. Downside: SDK is Python/TypeScript, no Rust support.

## Consequences

- The AI agent gets full tool access (MCP vault tools + shell access) without custom tool-calling code.
- `claude_cli.rs` manages subprocess lifecycle: spawn, stream events, kill on cancel.
- The frontend (`useAiAgent` hook) processes NDJSON events for reasoning blocks, tool action cards, and response display.
- File operation detection (from Write/Edit tool inputs) triggers automatic vault reload.
- The simpler AI Chat panel still uses the Anthropic API directly for lightweight, no-tools conversations.
- Re-evaluation trigger: if Anthropic releases a Rust Agent SDK or if Claude CLI streaming format changes significantly.
