---
type: ADR
id: "0020"
title: "Keyboard-first design principle"
status: active
date: 2026-03-01
---

## Context

Laputa is a productivity tool for knowledge workers who spend most of their time typing. Mouse-heavy interactions interrupt flow. Every feature should be reachable without touching the mouse, and the app must be fully testable via keyboard events (important for Playwright automation and accessibility).

## Decision

**Every feature must be reachable via keyboard. Every command palette entry must also appear in the macOS menu bar (File / Edit / View / Note / Vault / Window). This is both a design principle and a QA requirement.** Navigation, note switching, panel toggling, search, and all commands work via keyboard shortcuts or the Cmd+K command palette.

## Options considered

- **Option A** (chosen): Keyboard-first with menu bar parity — full keyboard accessibility, menu bar for discoverability, testable via Playwright keyboard events. Downside: more work per feature (must wire shortcut + menu item + command palette entry).
- **Option B**: Mouse-primary with some shortcuts — faster to implement. Downside: poor flow for power users, harder to automate testing.
- **Option C**: Keyboard-only (no menu bar) — simplest. Downside: poor discoverability, macOS HIG violation.

## Consequences

- `useCommandRegistry` + `useAppCommands` build a centralized command registry with labels, shortcuts, and handlers.
- `CommandPalette` (Cmd+K) fuzzy-searches all registered commands.
- `menu.rs` defines the native macOS menu bar with accelerators matching keyboard shortcuts.
- `useAppKeyboard` registers global keyboard shortcuts.
- `useMenuEvents` bridges menu bar clicks to command handlers.
- QA uses `osascript` keyboard events for native testing — no mouse, no `cliclick`.
- macOS gotcha: `Option+N` produces special characters — use `e.code` or `Cmd+N` instead.
- Re-evaluation trigger: if a non-macOS platform (Windows, Linux) is supported and needs different menu/shortcut conventions.
