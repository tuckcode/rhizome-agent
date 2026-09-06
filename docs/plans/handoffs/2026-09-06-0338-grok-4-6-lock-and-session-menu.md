---
session: 2026-09-06T03:38Z
model: Grok 4.6 (Cursor)
description: >-
  Captured two product notes, not built: restore note lock/view (default stays
  editable) as C68, and a sessions-list context menu like the note one (incl.
  Mycelium/codebase) as C67. Confirmed lock is gone, not hidden.
---

# Lock + sessions context menu — on paper

Atticus: capture, no immediate build unless it fits the session. It did not.
This file is the detail; `HANDOFF.md` holds C67 / C68.

## C68 — restore note lock; default stays editable

Tolaria / Desktop had edit vs view (lock). Agent still has **raw Markdown vs
formatted BlockNote**. Both stay editable. Lock is gone, not hidden.

Settled 2026-09-06:

- Put lock back.
- **Default: editable.** Atticus: "we can keep it editable by default. That's
  fine."
- The lock/edit control must be easy to find. Not a buried menu item.

Build notes for whoever claims this:

- Breadcrumb, same family as raw / favorite / organized
  (`src/components/BreadcrumbBar.tsx` `TOGGLE_ACTION_CONFIGS`). Plus command
  palette (`buildViewCommands`). Copy in `en.json`.
- `editable={false}` on BlockNote (`EditorContentLayout` today only locks a
  deleted-note preview) and read-only on CodeMirror when locked.
- **Do not reuse** vault `editor_mode` (`preview` | `raw`). That `preview`
  already means BlockNote, not lock. `tests/smoke/persist-editor-mode.spec.ts`
  is misnamed the same way.
- View state, not a note property. New notes stay editable.
- PostHog: one event when lock toggles, no note content.

## C67 — sessions list context menu

Right-click a session row the way you right-click a note. Same snappy menu
(`NoteListContextMenuView` + `getContextMenuPositionStyle`), different items.

Today `PrimeSessionList` has hover-only rename + archive/restore. No
`onContextMenu`. Mycelium for *this* session is the footprint chip on
`PrimeSessionSubhead`, which only exists for the attached session —
`connectionsPanelRef.openView('mycelium', { focusPath })`.

Wanted (not a closed list):

- Rename, archive / restore (already exist as hover)
- Open / switch to this session
- View this session in Mycelium — including the Mindwalk **codebase** citymap,
  not only the Rhizome action list. `MyceliumView` with `focusSessionPath`
  is the embed; Connections mycelium is `SessionActivityHistory`.
- Relatable extras (reveal jsonl, copy path) if they stay cheap

Do not copy note actions (favorite, organized, PDF, ask-agent-about-note).

## Also true this session, not claimed here

Right-panel stack (Notes over Graph/Mycelium) is on
`cursor/right-panel-graph-stack-a0b0` as `44634d9` (ADR-0170). Status-bar /
composer-pill shuffle was agreed earlier and is still unbuilt. Two UI
subagents Atticus saw "starting up" are not this run — do not wait on them
for the layout; this branch already has it.
