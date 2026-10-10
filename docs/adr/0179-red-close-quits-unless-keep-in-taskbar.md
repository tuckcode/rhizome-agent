---
type: ADR
id: "0179"
title: "Red close quits unless keep in taskbar"
status: active
date: 2026-10-06
---

**Origin:** Cursor Grok 4.6 · 2026-10-06 · Atticus: red X closes app-related helpers

## Context

C22 hid the main window on the red close button so tray, dock, and
single-instance reopen could call `show()` on a window that still existed.
That fix was later treated as product law: hide, leave Rhizome in the Dock,
and (C75) leave a Prime daemon this process spawned warm for fast reopen.

Atticus reopened the product call on 2026-10-06: pressing the red X should
close background processes related to the app being closed, unless he opts
into staying in the taskbar.

[ADR-0163](0163-connect-to-the-prime-daemon.md) still stands: Rhizome never
sends Prime `shutdown`. A user-started shared daemon is not "related to the
app" and outlives quit. [ADR-0167](0167-client-owned-prime-sessions-by-default.md)
still stands: Keep working is an explicit session grant, not a hide grant.

## Decision

**The red close button quits Rhizome and stops helpers this process started,
unless Settings → Keep in taskbar is on.**

Keep in taskbar restores C22 hide. Off (the default, including an absent
setting) is a full quit: `app.exit(0)`, same cleanup as Cmd+Q.

## Ownership on quit

| Process | Default red X | Keep in taskbar | Keep working + quit |
|---|---|---|---|
| Main window | process exits | hide | process exits |
| ws-bridge, Mindwalk | stop | stop | stop |
| Prime daemon this process spawned | stop | stay warm (C75) | stay |
| User-started shared Prime daemon | leave; never `shutdown` | leave | leave |

Streaming still asks Stop vs Keep working vs Cancel. Stop then follows the
table. Keep working promotes the session to `resident`, then hide-or-quit
from the setting; a spawned daemon stays so that grant can live.

Do not destroy `main` while the process stays alive. That is the C22
engineering constraint, separate from "hide is the product."

## Options considered

- **Quit by default, hide opt-in** (chosen): matches the red-X expectation.
  Helpers this process started go away. Shared Prime stays.
- **Keep hide as the product:** rejected. C22 was a reopen bug fix, not a
  forever UX law.
- **Quit and send Prime `shutdown`:** rejected. Other clients share that
  daemon (ADR-0163).

## Consequences

Reopen after a default red X is a new launch, not `show()` on a hidden
window. Keep in taskbar is the path that keeps Dock/tray restore and a warm
spawned Prime. Cmd+Q is unchanged.

## Advice

Atticus, 2026-10-06: close all background processes related to the app unless
he clicks keep in taskbar (or something like it).
