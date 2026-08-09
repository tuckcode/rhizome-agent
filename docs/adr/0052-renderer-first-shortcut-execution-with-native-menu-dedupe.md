---
type: ADR
id: "0052"
title: "Renderer-first shortcut execution with native-menu dedupe"
status: active
date: 2026-04-11
---

## Context

ADR 0051 gave Laputa a shared shortcut manifest and shared command IDs, but it still treated many shortcuts as native-menu-owned at execution time. In practice that meant `useAppKeyboard` deferred commands like `Cmd+Shift+I`, `Cmd+Shift+L`, and `Cmd+\` whenever the app ran under Tauri, and automated QA had to prove those flows by injecting menu-command IDs instead of pressing the real keys.

That is not a strong enough QA story for a keyboard-first app. If a user presses a shortcut while the editor is focused, we need a deterministic way to prove the actual key combo works. At the same time, we still want a native macOS menu bar with working menu items and accelerators.

## Decision

**Renderer keyboard handling is now the primary execution path for all shortcut-capable app commands, including commands that also have native menu accelerators. Native menu clicks and accelerators still emit the same command IDs, but the shared dispatcher suppresses the duplicate native/renderer echo from a single keypress so the command runs exactly once.**

## Options considered

- **Option A** (chosen): Renderer-first shortcut execution plus native-menu dedupe. This keeps shortcuts testable with real key events in a Tauri-like environment while preserving menu-bar parity and clickable native menu items. Downside: the dispatcher has to understand and suppress paired native/renderer echoes.
- **Option B**: Keep deferring native-owned shortcuts out of the renderer and prove them only through `trigger_menu_command`. Lower implementation churn, but it still leaves the real keystroke path unproven.
- **Option C**: Remove native accelerators entirely and keep shortcuts renderer-only. Simplest to reason about, but weaker desktop UX and poorer macOS menu discoverability.

## Consequences

- `appCommandCatalog.ts` remains the single manifest for command IDs and shortcut combos, but keyboard execution no longer depends on a separate owner flag.
- `useAppKeyboard` handles the actual key event for every shortcut-capable command, even in Tauri mode.
- `useMenuEvents` still handles menu clicks and test-triggered native command IDs, but shared dispatcher dedupe prevents a focused keypress from firing twice when the native menu accelerator also echoes back into the renderer.
- Deterministic QA now has two complementary proofs:
  - real keyboard events in a Tauri-like environment for the actual shortcut combo
  - `trigger_menu_command` for the native menu click/accelerator command path
- This ADR supersedes ADR 0051 by replacing “execution ownership lives in the manifest” with “shortcut combos live in the manifest, while execution is renderer-first and native menu dispatch is deduped.”
