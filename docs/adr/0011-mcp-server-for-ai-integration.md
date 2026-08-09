---
type: ADR
id: "0011"
title: "MCP server for AI tool integration"
status: active
date: 2026-02-28
---

## Context

Laputa's AI features (agent panel, chat) need structured access to vault data — searching notes, reading content, editing frontmatter, and steering the UI. Rather than building a bespoke API, the Model Context Protocol (MCP) provides a standardized tool interface that works with Claude Code, Cursor, and any MCP-compatible client.

## Decision

**Laputa ships a Node.js MCP server (`mcp-server/`) that exposes vault operations as 14 tools. It runs on stdio for external clients and on two WebSocket ports (9710 for tool calls, 9711 for UI actions) for the embedded Laputa frontend. Tauri spawns the server on startup and auto-registers it in Claude Code and Cursor configs.**

## Options considered

- **Option A** (chosen): Node.js MCP server with stdio + WebSocket dual transport — standard MCP compatibility, works with Claude Code/Cursor out of the box, WebSocket enables real-time UI steering. Downside: Node.js dependency, two extra ports.
- **Option B**: Rust-native MCP server — no Node.js dependency. Downside: MCP SDK is JavaScript-first, Rust implementation would be custom and harder to maintain.
- **Option C**: Custom REST/gRPC API — full control. Downside: no compatibility with existing AI tool ecosystems, each client needs a custom integration.

## Consequences

- Vault tools (search, read, create, edit, delete, link) are available to any MCP-compatible client.
- Auto-registration in `~/.claude/mcp.json` and `~/.cursor/mcp.json` means zero setup for users.
- The WebSocket bridge enables real-time UI actions (highlight elements, open notes, set filters) from AI tools.
- `mcp-server/` is bundled into release builds and spawned as a child process by `mcp.rs`.
- Port conflicts on 9710/9711 are handled gracefully (EADDRINUSE tolerance).
- Re-evaluation trigger: if MCP SDK gains a Rust implementation that eliminates the Node.js dependency.
