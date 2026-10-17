---
session: 2026-10-17T17:55:00Z
model: Grok 4.7 (Cursor)
description: >-
  Settings and the composer chip share one active-model label. The browser
  build no longer calls native window sizing or opens the UI bridge socket.
commits: 4e7773ee
---

# Model chip and page-load console

**Origin:** Cursor Grok 4.7 · 2026-10-17 · browser audit of latest main.

## What changed

- Settings passes the chat engine into `NativeChatModelPicker`. The row and the composer chip both render that picker's active label (`Provider · model` on Rhizome, the Prime host name on Prime).
- `applyMainWindowSizeConstraints` returns before `invoke` when `isTauri()` is false. The browser has no `__TAURI_INTERNALS__.invoke`, which threw `TypeError: Cannot read properties of undefined (reading 'invoke')` and was logged as "Size constraints failed".
- `useAiActivity` opens `ws://localhost:9711` only inside the desktop app. A failed socket logs at debug and reconnects with exponential backoff from 3s.

## Not in this change

Hot files held by other PRs stayed untouched: `src/App.tsx`, `src/lib/locales/en.json`, `src/types.ts`, `src-tauri/src/rhizome_loop/mod.rs`, `src-tauri/src/rhizome_loop/tools/mod.rs`, `AiMessage.tsx`, `ChatHome.tsx`.
