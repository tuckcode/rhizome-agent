---
session: 2026-10-17T14:05Z
model: Cursor Grok 4.6
description: >-
  Remove the Chat engine picker and Prime/Hermes Settings. Leftover
  engine strings migrate to native once. Ricky's #213 should-fixes
  are in this slice.
---

# Remove Chat engine picker (PR 1 of Prime/Hermes removal)

**Origin:** Cursor Grok 4.6 · 2026-10-17 · this session

Native is the only Chat engine. Settings, composer, and Cmd+K no longer
offer a Prime/Hermes engine switch. Prime and Hermes Settings sections
are gone. Engine crates stay for later PRs.

## Migration

On load, leftover `chat_engine` / agent / target strings map to native
and write back once. Garbage never throws. Codex, Claude Code, OpenCode,
Antigravity, and Kiro stay as CLI targets, not engines.

| Stored value | Result |
|---|---|
| `prime`, `hermes`, `agent:pi`, `gemini`, garbage | `native` (agent/target fields clear) |
| already `native` or absent `chat_engine` | native in memory; no persist |
| `codex`, `claude_code`, `agent:codex`, `model:…` | unchanged |

## Ricky #213 should-fixes

Cmd+K label and readiness come from the resolved target, not the raw
Chat engine. `streamWithSelectedTarget` resolves the target first. Tests
cover a `claude_code` row and a real controller+session path.

`ApprovalRequested.args` is still the literal bash command. This PR does
not parse it.

## Left as-is

- ChatHome.tsx except routing that App already owned
- ResearchPanel.tsx
- Free-tier → Taproot rename
- Onboarding still offers optional Prime Agent install (not an engine picker)
- NativeChatModelPicker (model picker, not engine)
- OpenCode / Antigravity / Kiro kept as CLI targets like Codex
