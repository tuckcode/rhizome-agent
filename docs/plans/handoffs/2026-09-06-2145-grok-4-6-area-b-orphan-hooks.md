---
session: 2026-09-06T21:45Z
model: Grok 4.6 (Cursor)
description: >-
  Area B subtraction: deleted unused hooks (useMcpBridge, Claude onboarding/
  status, useNoteLayout), the TS Mindwalk duplicate, unused Claude CLI
  wrappers, and confirmed-dead app-core exports. UI leftovers left for area C.
---

# Area B — orphan hooks and Claude leftovers

**Origin:** Grok 4.6 (Cursor) · 2026-09-06

Nightly-style subtraction under `src/`. Grep showed zero production
importers before each delete. Live MCP path is still
`useMcpBridgeVaultSync` in the vault switcher.

Deleted:

- `useMcpBridge.ts` (+ vite coverage exclude)
- `useClaudeCodeOnboarding.ts` + test
- `useClaudeCodeStatus` hook + test; `ClaudeCodeStatus` type moved to
  `src/types.ts` because badge/onboarding UI (area C) still import it
- `useNoteLayout.ts` + test; dropped unread `note_layout` from VaultConfig
- `primeSessionToMindwalk.ts` + test (Rust bridge is the live path)
- unused Claude CLI wrappers in `ai-chat.ts`; token/history helpers kept
- confirmed-dead app-core exports listed in the area B brief
- unreachable `aiWorkspaceWindow === false` hardcode branch in `MainApp`

Not touched: Claude onboarding/badge UI (area C), e2e/scripts (A),
Tolaria archive (D), Tauri IPC (E), MCP grok tools (F), dual-shell / #56.
