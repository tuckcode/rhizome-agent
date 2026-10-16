---
session: 2026-10-16T20:00Z
model: Grok 4.6 (Cursor)
description: >-
  Right notes panel Auto / Rail / Open modes, mirroring CommandRail
  values, with per-window persistence and overlay rules.
commits: this slice
---

# Right notes panel modes

**Origin:** Grok 4.6 (Cursor) · 2026-10-16 · Critiquito brief

The right Notes column now has three modes:

- **Auto** — 46px rail (CommandRail collapsed width). Hover opens after
  150ms and closes after 300ms. The expanded panel overlays Chat
  (`bg-background`, left border, `shadow-md`) with no backdrop and no
  reflow. Focus, an open menu, or typing keeps it open. Esc collapses
  and returns focus to the mode button.
- **Rail** — the same 46px rail, pinned. No hover expand.
- **Open** — full panel in flow, resizable. Chat still keeps its
  existing 420px floor.

Default is **Open** because CommandRail defaults to pinned. A window
that cannot fit Open shows Auto without writing that fold. Only one
side overlays Chat: CommandRail `hoverDisabled` when Notes overlays,
and Notes Auto refuses hover when the Sessions drawer is up.

The 24px (`h-6`, 8px radius) ghost control sits at the top of the rail
or the top right of the Notes header. The menu lists icon +
sentence-case label + check. Tooltip is `Panel: Auto` with `⌘.` /
`Ctrl+.`. Unsaved rail dots use `--text-muted`, not mint.

PostHog: `notes_panel_mode_changed` `{ mode }`.
Localization: none — English only (C18).
---