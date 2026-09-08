---
type: ADR
id: "0171"
title: "Graph and Mycelium mount only on Changes"
status: active
date: 2026-09-08
supersedes: "the always-under-Notes Graph/Mycelium clause of ADR-0170"
---
## Context

ADR-0170 put Graph and Mycelium in a resizable cell under the right Notes
column whenever that column was open. Inbox then lost its tall notes list:
opening Notes to find a capture also mounted the 3D graph. Atticus's
daily-drive ask (C72 remainder, 2026-09-07): Inbox keeps the full list;
the cell is a Changes concern.

Verified in `App.tsx`: `ConnectionsPanel` renders only when
`chatCentered && isChangesSelection` inside `showVaultPanel`.

## Decision

**Graph and Mycelium mount only while Changes is the active Notes filter.**
Inbox, All Notes, Archive, types, and folders keep a tall notes list.

A Graph or session-footprint request still opens the Notes column if it
was shut (`editor-list`), then switches selection to Changes so the cell
can appear. Expanding the cell remains an overlay; it does not replace
Chat. The 46px Notes restore rail from the C72 slice stays.

## Consequences

* ADR-0170 still holds for Notes-heavy right column, no Connections edge
  strip, and Chat-as-centre.
* Do not remount `ConnectionsPanel` under Inbox to "make Graph findable."
  The findable surface is Changes, plus the restore rail when Notes is shut.
* Classic shell (`ff_shell_command_rail=false`) is unchanged.
* Inbox rename / a dedicated right icon rail remain undecided (C72).

[[shell-final-direction]]
