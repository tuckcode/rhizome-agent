---
session: 2026-09-19T10:41-05:00
model: Grok 4.6 (Cursor)
description: >-
  Removed the Notes/Inbox button from the left command rail. Notes stays a
  right panel, opened from Show Notes. Restore strip, Sidebar inbox count,
  and classic shell untouched. No commit, push, or rebuild.
commits: none
---

# Notes off the command rail

**Origin:** Cursor Grok 4.6 · 2026-09-19 10:41 · source only.

Spec:
[`/Users/dtc/.hermes/kanban/workspaces/t_5eb4062a/rhizome-agent-sol/docs/plans/handoffs/2026-09-19-cursor-remove-notes-rail.md`](/Users/dtc/.hermes/kanban/workspaces/t_5eb4062a/rhizome-agent-sol/docs/plans/handoffs/2026-09-19-cursor-remove-notes-rail.md).

## Done

- `CommandRail.tsx`: no Notebook button; dropped `notesOpen`, `inboxCount`,
  `onSelectInbox`; destination union is Chat / Research / Changes.
- `App.tsx`: those props gone; `handleRailSelectInbox` deleted.
  `inboxCount` still feeds Sidebar. Restore strip still calls
  `ensureNotesOpen`.
- Tests and leftover locks that named `command-rail-inbox` now use
  `vault-panel-restore` or assert the rail button is absent.
- Smoke helpers fall back to Show Notes, not a rail Inbox click.

## Guardrails held

Did not hide or restyle the Show Notes strip. Did not change Sidebar
inbox count. Did not touch the classic shell. Did not commit, push, or
rebuild.

## Why

The rail is destinations. Notes is a right panel. Two glowing rail items
(Chat + Notes) read as broken.

Localization: none — English only (C18).
PostHog: no event; this removes a control (`trackRailDestinationClicked('inbox')`
no longer fires).
ADRs: none. C72 updated in `HANDOFF.md`.
