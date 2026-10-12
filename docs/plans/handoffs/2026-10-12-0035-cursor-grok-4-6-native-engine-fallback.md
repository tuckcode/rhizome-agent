---
session: 2026-10-12-0035
model: Cursor Grok 4.6
description: #155 follow-up — Prime-only native fallback, sticky engine, provider-id model keys
---

**Origin:** Cursor Grok 4.6 · 2026-10-12 · Ricky review of #155

## What was true

#155 sent every non-live-Prime chat through the native engine. Codex,
Claude Code, OpenCode, and direct-model chats were hijacked. EMPTY host
status (`installed: false` before the first poll) looked like “Prime is
down,” so the first message could land on `ollama/llama3.2` and drop
Prime history. Configured model ids used `kind/model`, so two OpenAI
accounts collapsed to the first saved provider of that kind.

## What changed

- Native fallback only for Prime-targeted chats, and only after a real
  status says `not_installed`. Unknown status stays on Prime.
- An open chat keeps the engine it started on. New Chat unlocks.
- Configured catalog ids use `provider.id/model`. Old `kind/model`
  selections still resolve when unique. Rust `catalog_provider` already
  preferred id; a test now locks that over first-of-kind.
- Chat engine switch copy rewritten to match.

## C-numbers

- **C95:** After #155, Playwright smoke `unified-shell-layout.spec.ts`
  failed because ChatHome passed `native` whenever Prime was not
  running, so `prime-session-list` never mounted on rail hover.
  mock-tauri reports `installed: true`, `running: false`, no
  `not_installed` problem. The follow-up keeps that chat on Prime, so
  the list mounts again. The smoke spec was not changed — that is the
  intended behavior. Only a corroborated `not_installed` falls back.
