---
type: ADR
id: "0053"
title: "Webview-init prevention for browser-reserved shortcuts"
status: active
date: 2026-04-11
---

## Context

ADR 0052 made renderer-first shortcut handling the primary path for command execution, with native menu accelerators deduped afterward. That works for normal shortcuts, but native QA on macOS showed that `Cmd+Shift+L` still failed to reach the app even though the shared command path and the Note menu item both worked.

The gap is WKWebView itself: some browser-reserved chords are swallowed by the webview before the renderer-level shortcut listener can execute. That makes the shortcut untestable with the real native keypress even though the command bus is correct.

## Decision

**Laputa will keep renderer-first shortcut execution, but for macOS browser-reserved chords we will add a narrow Tauri webview-init prevention layer using `tauri-plugin-prevent-default` so the real keystroke reaches the shared command path.**

## Options considered

- **Option A** (chosen): Add a narrow `tauri-plugin-prevent-default` registration for only the known browser-reserved chords we actually use. This preserves ADR 0052, keeps the command bus unified, and fixes the real native keystroke path without broad shortcut capture.
- **Option B**: Keep relying on renderer capture listeners alone. Simpler, but it fails for chords that WKWebView consumes before renderer code sees them.
- **Option C**: Use a global shortcut plugin as the fallback path. This would catch the keystroke natively, but it reserves the chord outside Laputa and is too heavy for app-local shortcuts.

## Consequences

- Shortcut ownership stays unified: command IDs and execution still live in the shared renderer/native command bus.
- macOS-only browser-reserved chords now have one extra declaration point in `src-tauri/src/lib.rs`, and that list must stay intentionally small.
- Native QA remains mandatory for any shortcut added to that list, because browser dev and mocked Tauri tests do not exercise the webview-init layer.
- Re-evaluate this decision if Tauri/WKWebView exposes a better app-local native shortcut hook that does not require browser-reserved-key workarounds.
