---
session: 2026-08-22T21:08Z
model: Grok 4.6
description: >-
  #43 window-level navigation guard built on the Tauri 2.10 plugin on_navigation
  hook (the main window is config-declared, so the WebviewWindowBuilder method
  does not apply); off-origin links route to the system browser and the webview
  never leaves. Component-level half was already on main in b165e18.
commits: 6b5aada..(this branch)
---

# 2026-08-22 — The window can no longer leave the app (#43)

**State:** branch `no-window-level-navigation-guard-anything-that-s` at
`6b5aada`, rebased onto `origin/main` (`97ddb6e`), tree clean, Rust gates
green (clippy, fmt, `cargo test`, `cargo llvm-cov` **85.57%** ≥ 85%).

### The open design question, answered from source

The issue asked whether `on_navigation` can attach to a config-declared window
in Tauri 2.10, or whether the main window must be built in Rust instead.
**The plugin hook is the answer.** Read from the unpacked crate
(`~/.cargo/registry/src/.../tauri-2.10.2`):

- `WebviewManager`'s navigation handler
  (`src/manager/webview.rs:551`) calls `app_manager.plugins…on_navigation(&w, url)`
  for **every** webview it creates — config-declared windows included. The
  `WebviewWindowBuilder::on_navigation` method only sets the *per-window*
  `pending.navigation_handler`, which is a different, code-only path.
- `plugin::Builder::on_navigation` (`src/plugin.rs:458`) is the hook that runs
  for all windows. Returning `false` cancels the navigation.

So the main window stays declared in `tauri.conf.json`; a tiny plugin
(`src-tauri/src/navigation_guard.rs`) installs the guard. No window rebuild.

### What it does

`navigation_decision(url)` is the pure, unit-tested policy seam:

- **Allow** — app origin: `tauri://localhost`, `http(s)://tauri.localhost`,
  and any loopback address (dev servers). Covers the wry `tauri.localhost`
  workaround and IPv6 `[::1]` (brackets trimmed before compare).
- **OpenExternally** — off-origin `http(s)` and `mailto:`/`tel:`/`sms:`: the
  hook cancels the webview navigation and hands the URL to
  `tauri-plugin-opener` (`webview.opener().open_url(...)`), so the user's
  intent still happens and the webview never leaves.
- **Refuse** — `data:`/`javascript:`/`blob:`/`file:`/`asset:`/`ipc:` and any
  other scheme: cancel and do nothing (inert, like the component fix's
  fallback).

### Why the classic test trap is avoided

The component-level fix in `b165e18` had a test that added its own
`preventDefault` before clicking, so it green-lit a guarantee the component
never provided. The window guard's test hits the **centralized policy**, not a
component: 7 Rust unit tests in `navigation_guard::tests` assert that an
off-origin `http(s)` URL, a `mailto:`, and a `javascript:` are classified as
`OpenExternally`/`Refuse` — i.e. refused as a top-level webview action — by the
logic every webview now routes through.

### Not done here

- Native QA of an actual off-origin click in `pnpm tauri dev` (needs a human at
  the macOS app; the harness can drive Playwright against the dev server but not
  the native webview navigation event). The policy is unit-tested; the wiring
  is verified against Tauri source, not a live click.
- #41 (composer → stop button) is a separate, non-overlapping task and was not
  touched.

### Files

- `src-tauri/src/navigation_guard.rs` — new: policy + plugin.
- `src-tauri/src/lib.rs` — `mod navigation_guard;` + `builder.plugin(navigation_guard::init())`.
- `docs/ARCHITECTURE.md` — one paragraph on the guard.
