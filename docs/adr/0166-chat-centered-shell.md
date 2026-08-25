---
type: ADR
id: "0166"
title: "Chat-centered shell: one panel on each side of the conversation"
status: active
date: 2026-08-22
---
## Context

`docs/design/shell-final-direction.md` (2026, "decided design spec, ready to
build") fixed the region map as:

```
rail | sidebar | note list | editor | research dock
```

That map is a note-taking app's map. It was written for Rhizome Desktop's
problem — a vault browser where the editor is the point and everything else
feeds it — and this repo inherited it wholesale at the fork.

Rhizome Agent's problem is different. Per `docs/IDENTITY.md` this product is a
chat UI plus the Prime Agent harness: the conversation is the thing the user
came for, and the vault is what the agent reads and writes on their behalf. The
shipped shell contradicted that in two ways. Chat was a rail *destination* that
replaced the entire surface, so it could not coexist with anything; and the
note tree occupied the left edge, the position the eye reads as the spine of the
window, for a panel most sessions never open.

The spec's own §2.3 makes the mismatch concrete: it reserves the left edge for
the sidebar and its brand lockup, and states the rail "does not take over brand
duty." Once the command rail shipped (`shell_command_rail`, default on) the rail
already held the left edge and the macOS traffic lights with it, so the sidebar's
250px floor was clearing a gutter it no longer owned.

## Decision

**Chat is the center canvas, permanently. One panel docks on each side of it,
and the command rail splits into two groups by which panel a destination
drives.**

```
┌──────────────────────────────────────────────────────────────┐
│ titlebar (macOS overlay / LinuxTitlebar — unchanged)         │
├────┬────────────┬──────────────────────────┬────────────────┤
│rail│  sessions  │          CHAT            │  inbox (list)  │
│    │            │                          │  notes (tree)  │
│    │            │      (the canvas)        │    Changes     │
├────┴────────────┴──────────────────────────┴────────────────┤
│ status bar                                                   │
└──────────────────────────────────────────────────────────────┘
```

- **Chat never closes and never moves.** It is not a destination competing with
  the others; it is what the others are arranged around. Sessions live as a
  collapsible column on its left. Inbox (note list) and notes (tree) dock on
  the right and collapse independently (⌘1 Chat only, ⌘2 Chat + Inbox, ⌘3 Chat
  + Notes).
- **Both right-hand vault panels may be open together.** Exclusive Inbox *or*
  Notes *or* Changes was tried and reverted: Cmd+N, inbox auto-advance, and
  note selection need the list visible. Changes is a filter on that list, not
  a third exclusive occupant.
- **Graph and Mycelium still take the canvas.** That remains the open question
  for #39 / #11 / #22; this ADR does not turn them into side panels.
- **Panels are optional.** Rail Chat / ⌘1 collapses the vault so Chat is
  full-width, which is a focused posture, not a degraded one.

This supersedes `docs/design/shell-final-direction.md` §2.1 (region map) and
§2.3 (sidebar position and brand duty). The rest of that document — status-bar
pill clusters, graph-canvas chrome, settings redesign, theme token discipline —
is unaffected and still stands.

## Options considered

* **Option A** (chosen): Chat center, one panel per side. The layout states the
  product thesis — the conversation is the work, the vault is reference. Downside:
  the largest change to `App.tsx`'s shell, and Chat's own furniture (session
  list, subhead, composer deck) has to survive a narrower center than the
  full-surface destination it was designed for.
* **Option B**: Keep the spec's map, move only the note tree to the right. Cheap
  and reversible — this is what landed first (`43008f4`) — but it leaves Chat as
  a full-surface destination that cannot coexist with a panel, so the user still
  chooses between talking to the agent and seeing their notes.
* **Option C**: A user preference for panel side, defaulting to the old map. Avoids
  taking a position. Rejected: a layout preference is a way of not deciding what
  the product is, and doubles the states every shell change must be verified in.
* **Option D**: Chat as a dock alongside the editor, editor still center. Preserves
  the note-taking map and adds chat to it. Rejected for the same reason the fork
  happened — it makes the agent an accessory to a vault browser rather than the
  product.

## Consequences

* The sidebar docks right and is gated on the command rail: with the classic
  shell (`ff_shell_command_rail=false`) nothing reserves the traffic-light
  gutter, so it stays left. `Sidebar`/`SidebarTitleBar` take a `dock` prop; the
  right dock drops the 90px traffic-light inset, mirrors the collapse glyph, and
  moves its divider to the leading edge.
* `ResizeHandle` takes `edge="trailing"` for right-docked panels: the drag delta
  inverts and the negative margin flips. `useLayoutPanels` already negated the
  delta in the hook for the inspector and graph-preview docks — two idioms for
  one problem now exist, and the hook-level negation should migrate to the prop.
* `ViewMode`'s ladder is now Chat-centric, not editor-centric: `editor-only`
  is Chat only (⌘1), `editor-list` is Chat + Inbox (⌘2), `all` is Chat +
  Notes tree and list (⌘3). The stored values are unchanged so existing vault
  configs keep working.
* `isChatDestination` remains only for the classic shell
  (`ff_shell_command_rail=false`). With the rail on, Chat is furniture: the
  branches that used to hide every panel when Chat was the destination no
  longer run.
* The 250px sidebar floor and `.app__sidebar` min-width stay in sync as before,
  but the reason changes: it is the wordmark lockup alone, no longer the lockup
  plus a traffic-light gutter.
* Rail Chat focuses the conversation (collapses the vault). Rail Notes opens
  both right-hand vault panels. Changes is a filter on the list, not a canvas
  replacement. Graph and Mycelium still take the canvas.

[[shell-final-direction]]
