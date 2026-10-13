---
session: 2026-10-13T00:21Z
model: Cursor Grok 4.6
description: >-
  PR 1 of the G-baby blockers: selected sessions no longer flash the
  new-chat empty state, and Save to vault becomes a disabled Saved
  control with a toast that names the folder and offers Open.
commits:
---

# Agent window states (D-B1, D-B2)

Verified on main `de00429`. B1 live status, B5 model chip, and the first
half of D-B2 (toast uses `result.note.title`) were already on main.

## D-B1

`AiPanelMessageHistory` treated `messages.length === 0 && !isActive` as a
new chat. `usePrimeSessionSwitcher` clears the transcript on the same
click as the row highlight, so a picked session showed "Message Prime"
until the host returned.

`transcriptState` is now `new | loading | ready | error`. Empty pane
shows a loading notice, an empty-session notice, or a load-failed notice
instead of the new-chat empty state. New chat calls
`resetSessionSelection()` so that empty state is only for a genuine new
chat. Messages already on screen still win (D-W9).

## D-B2 second half

A successful promote returns `true`. That message's Save control becomes
a disabled **Saved** label. The toast names the note and folder
(`Saved “Title” to raw/inbox`) and offers **Open**, which opens the note.

Colors and contrast were left alone.

## QA (Bubs)

1. Pick an older session in the sidebar. Its transcript shows. Never the
   "start a chat" / "Message …" empty screen, including on a slow load.
2. Save a reply to the vault. The toast names that exact note and folder.
   Open goes to it. The button now reads Saved and cannot be clicked again.
