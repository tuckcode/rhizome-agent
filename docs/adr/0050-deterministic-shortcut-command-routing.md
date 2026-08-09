---
type: ADR
id: "0050"
title: "Deterministic shortcut command routing"
status: active
date: 2026-04-11
---

## Context

Laputa is keyboard-first, but shortcut execution had split ownership: `useAppKeyboard` handled some shortcuts in the renderer while `menu.rs` owned others as native Tauri menu accelerators. That split made QA unreliable. Browser tests could prove the renderer path, but not the native menu path, and flaky macOS key synthesis made `Cmd+Shift+L`, `Cmd+Shift+I`, and `Cmd+N` regressions easy to miss.

## Decision

**Keyboard shortcuts and native menu accelerators now dispatch through the same canonical app command IDs. Renderer-owned shortcuts call the shared dispatcher directly; native menu items emit the same IDs into the frontend, and tests get a deterministic menu-command trigger that exercises that route without relying on synthesized native keystrokes.**

## Options considered

- **Option A** (chosen): Shared command IDs plus deterministic menu-command trigger — keeps native desktop UX while making menu-owned commands testable in unit tests, Playwright, and native QA. Downside: one more command layer to maintain.
- **Option B**: Move every shortcut to the renderer — simpler automated testing, but worse macOS menu-bar parity and weaker native UX.
- **Option C**: Keep renderer and native shortcuts separate — lowest code churn, but continues to produce false confidence and shortcut regressions.

## Consequences

- `appCommandDispatcher.ts` owns the canonical shortcut command IDs and the shared execution path used by `useAppKeyboard` and `useMenuEvents`.
- Native menu routing remains explicit in `menu.rs`; adding or changing a native shortcut now requires wiring the accelerator and the matching command ID in one place.
- Automated QA can trigger menu-owned commands deterministically through the shared `window.__rhizomeTest.triggerMenuCommand()` bridge in browser runs and through the native `trigger_menu_command` Tauri command in desktop runs.
- Keyboard QA should prefer real menu selection or the deterministic menu-command trigger for native-owned shortcuts, and reserve synthesized keystrokes for renderer-owned shortcuts or true end-to-end spot checks.
- This decision supersedes the blanket assumption in ADR 0020 that all shortcut verification can be treated as plain keyboard-event testing.
