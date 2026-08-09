---
type: ADR
id: "0054"
title: "Deterministic shortcut QA matrix"
status: active
date: 2026-04-11
---

## Context

ADR 0052 made renderer-first shortcut execution the primary runtime path, and ADR 0053 added a narrow macOS webview-init prevent-default layer for browser-reserved chords such as `Cmd+Shift+L`. Those decisions improved behavior, but the automated QA story was still muddy:

- browser smoke tests were describing a mocked desktop harness as if it were native Tauri QA
- some tests used `page.keyboard.press()` for commands whose real desktop accelerators are intercepted or reserved by the browser shell
- native menu command coverage existed, but the catalog did not declare which deterministic proof path each shortcut should use

That made it too easy to ship a shortcut with passing automation while overstating what the automation had actually proven.

## Decision

**Laputa will treat shortcut QA as an explicit part of the shared command manifest. Every shortcut-capable command must have a deterministic automated proof path, and the test harness must distinguish renderer shortcut-event proof from native menu-command proof instead of calling the browser harness “native Tauri QA”.**

## Options considered

- **Option A** (chosen): Add a deterministic shortcut QA matrix to the shared command catalog. Renderer shortcut handling can be exercised through synthetic `keydown` events generated from the manifest, while native menu commands are exercised through `trigger_menu_command`. Pros: deterministic, explicit, and honest about what is being proved. Cons: still requires real native QA for exact accelerator delivery on macOS.
- **Option B**: Keep using ad hoc Playwright key presses and browser-side menu shims. Lower change cost, but still allows false claims about native coverage and still depends on browser-reserved shortcuts behaving nicely.
- **Option C**: Block all shortcut work until full native Tauri automation exists. Strongest eventual guarantee, but it would leave the keyboard-first app without a usable deterministic QA strategy today.

## Consequences

- `appCommandCatalog.ts` now owns not just command IDs and modifier rules, but also the deterministic QA mode for each shortcut-capable command.
- Browser harness smoke tests must describe themselves as a desktop command bridge, not native app QA.
- Renderer shortcut behavior can be verified deterministically without depending on browser chrome or flaky AppleScript key synthesis.
- Native menu-command behavior can be verified deterministically through the Tauri command bridge.
- Exact desktop accelerator delivery still requires real Tauri QA for commands flagged as needing manual native verification, especially browser-reserved macOS chords.
