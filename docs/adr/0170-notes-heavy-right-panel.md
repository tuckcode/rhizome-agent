---
type: ADR
id: "0170"
title: "Notes is the heavy right panel; Graph and Mycelium sit under it"
status: active
date: 2026-09-06
supersedes: "the Graph/Mycelium canvas and no-second-column clauses of ADR-0166"
---
## Context

ADR-0166 put Chat in the centre and one Notes panel on the right. Graph and
Mycelium still took the whole canvas, and a later Connections edge strip
added a third column of its own. Atticus's verdict, 2026-09-05: too many
panels, nothing wide enough, and "where is my vault notes inbox" when the
right side was the editor with Notes hidden.

## Decision

**When the right column is open, Notes (inbox and list) is the heavy top
half. Graph and Mycelium share a resizable sub-panel below it — bottom half
to bottom quarter. The Connections edge strip is gone.**

Inbox still toggles the column. Opening Graph or a session footprint opens
that column if it was closed, then shows the requested view. Expanding Graph
or Mycelium is an overlay you can leave; it does not replace Chat.

A matching right-hand icon rail (toggle icons so surfaces stack) stays
undecided.

## Consequences

* Chat stays the centre canvas. Notes stays optional. Graph is no longer a
  place you go instead of chatting.
* Classic shell (`ff_shell_command_rail=false`) is unchanged.
* ADR-0166 still holds for Chat-as-centre, the Inbox toggle, and ⌘1/⌘2/⌘3.

[[shell-final-direction]]
