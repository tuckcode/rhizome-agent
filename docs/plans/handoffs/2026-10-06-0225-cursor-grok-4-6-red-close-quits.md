---
session: 2026-10-06T02:25Z
model: Grok 4.6 (Cursor)
description: >-
  ADR-0179: red X quits and stops Rhizome-owned helpers unless Settings
  Keep in taskbar is on. C22 hide is opt-in. Never Prime shutdown.
---

# Red close quits unless keep in taskbar

**Origin:** Cursor Grok 4.6 · 2026-10-06 · Atticus: close app-related helpers

## Decision

Default red X is a full quit (`app.exit(0)`). `release_helpers_on_quit`
stops ws-bridge, Mindwalk, and a Prime daemon this process spawned.
Keep in taskbar restores C22 hide and C75 warm spawned Prime. Keep
working still leaves that daemon so resident work can live. A
user-started shared Prime daemon is never sent `shutdown`.

## Files

- `src-tauri/src/lib.rs` — `window_hides_instead_of_closing(label, keep)`
- `src-tauri/src/settings.rs` — `keep_in_taskbar_on_close`
- `src-tauri/src/commands/system.rs` — `finish_main_window_close`
- Settings switch in Appearance; PostHog `keep_in_taskbar_on_close_changed`
- [ADR-0179](../../adr/0179-red-close-quits-unless-keep-in-taskbar.md)

## Not run

Native live-check of red X / Keep in taskbar / Dock restore.
