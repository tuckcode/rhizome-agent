---
type: ADR
id: "0051"
title: "Shared shortcut manifest for testable routing"
status: active
date: 2026-04-11
---

## Context

ADR 0050 moved renderer shortcuts and native menu events onto the same command dispatcher, but shortcut ownership still drifted across multiple places: `appKeyboardShortcuts.ts`, `appCommandDispatcher.ts`, command-palette metadata, and `menu.rs`. That made shortcut regressions easy to reintroduce because the same facts had to be updated manually in several files.

The riskiest failures were exactly the native-owned commands that matter most in a keyboard-first app: `Cmd+\` for raw editor, `Cmd+Shift+I` for properties, and `Cmd+Shift+L` for the AI panel. We need one declarative place that says which command owns which shortcut, whether the shortcut is renderer-owned or native-menu-owned, and how tests should trigger it.

## Decision

**Shortcut-capable app commands are now defined in a shared frontend manifest that owns command IDs, routing semantics, and shortcut ownership. Renderer keyboard handling resolves commands from that manifest, native menu routing dispatches the same command IDs, and deterministic QA for native-owned shortcuts targets those IDs rather than duplicating shortcut facts in ad hoc code paths.**

## Options considered

- **Option A** (chosen): Shared shortcut manifest plus shared dispatcher and deterministic menu-command QA. This reduces drift, improves CodeScene on the command router, and makes native-owned shortcuts provable without flaky macOS key synthesis. Downside: one more manifest to maintain.
- **Option B**: Keep the shared dispatcher from ADR 0050 but continue storing shortcut ownership in separate key maps and menu lists. Lower churn, but it keeps the exact source of the regressions we reopened.
- **Option C**: Move all shortcuts into renderer-only handlers. Easier to test, but weaker macOS menu-bar parity and worse native desktop UX.

## Consequences

- `appCommandCatalog.ts` is now the frontend source of truth for shortcut-capable command IDs, ownership, modifier rules, and dispatch kind.
- `appCommandDispatcher.ts` is reduced to route execution instead of carrying a large switch plus duplicated ownership metadata.
- `useAppKeyboard.ts` resolves shortcuts from the shared manifest, including the distinction between `Cmd+Shift+L` (macOS-only) and `CmdOrCtrl+Shift+I/F/O`.
- Native-menu smoke tests should use `window.__rhizomeTest.triggerMenuCommand()` or the Tauri `trigger_menu_command` bridge to prove the native command path. Renderer-only commands may still be proven with direct keyboard events.
- This ADR supersedes ADR 0050 by replacing “shared command IDs are enough” with “shared command IDs plus shared shortcut ownership metadata are required.”
