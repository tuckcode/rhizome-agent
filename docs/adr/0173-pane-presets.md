---
type: ADR
id: "0173"
title: "Four pane presets are the shell layout contract"
status: active
date: 2026-09-19
supersedes: "the C72 fresh-launch-opens-Notes default"
---

## Context

ADR-0166 keeps Chat as the centre canvas. C72 then opened Notes on a fresh
launch (`editor-list`) so the vault list was findable. The shell still stored
three separate switches: `view_mode`, `chatNoteSplit`, and ad-hoc column
widths. Those switches could combine into a clipped window.

Atticus asked for four named layouts with remembered widths, a 420px Chat
floor, and Chat as the fresh-launch default. This does not reopen ADR-0166.
It does not copy Hermes Desktop's free layout tree.

## Decision

1. **`PanePresetState` is the runtime source of truth.** The legal ids are
   `chat`, `notes`, `read`, and `workbench`. There is no fifth preset.
2. **Legacy mirrors stay.** `view_mode` (`editor-only` / `editor-list` /
   `all`) and `chatNoteSplit` (`stacked` / `side-by-side`) remain
   compatibility writes so older vault config and leftover tests still round
   trip. They are not the layout the shell fits.
3. **Fresh launch is Chat.** Notes is shut. Browse is shut. The Show Notes
   restore strip stays. A stored preset for that vault still wins.
4. **Widths are per preset and per vault.** Storage key
   `rhizome:pane-presets:v1:<vault path>`. A drag that would take Chat under
   420px clamps or folds Browse, then Notes, then the pinned rail. Temporary
   folds do not overwrite saved widths.
5. **View names are Chat, Notes, Read, Workbench, and Reset layout.** Old
   command ids stay for Chat, Notes, and Workbench. Read and Reset layout
   are new ids.

## Consequences

- C72's "fresh launch opens Notes" sentence is superseded. Inbox remains a
  folder. ADR-0166 still holds for Chat-as-centre.
- The packaged `/Applications` app does not change until a rebuild.
- Read hides the Notes list for a new Read. A migrated Read with the list
  open may keep it (`readNotes`).
