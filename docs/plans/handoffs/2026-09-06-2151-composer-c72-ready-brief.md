---
session: 2026-09-06-2151
model: Composer
description: >-
  C72 remainder — Inbox rename / discoverability. Notes panel shipped;
  do not edit ADR-0166 or ADR-0170 for rail polish.
---

# C72 remainder — Inbox rename / discoverability

**Origin:** Composer · 2026-09-06 · **remainder corrected 2026-09-13** against HANDOFF/BOARD.  
Settled stack: [ADR-0170](../../adr/0170-notes-heavy-right-panel.md). Graph on Changes: ADR-0171.  
Park detail: [2026-09-06-1814](2026-09-06-1814-composer-c72-side-panel-session.md).

---

## Done / now / next

**Shipped (do not re-open as “panel gone”):**

- Right Notes **default open** (`editor-list` on fresh vaults).
- Shut Notes = **46px** restore rail, **Show Notes** strip (32px hit).
- Rail control is **Notes**. Inbox is a **folder inside** the list, not the rail destination.
- Chat stays the canvas. Graph/Mycelium only on Changes.
- On top / Beside for the open note.

**Now:** Inbox **inside the list** is still easy to misread. Rail polish leftovers belong in a **new ADR**, not edits to ADR-0166 or ADR-0170.

**Next:** one rename/discoverability pass, then stop.

**Done when:** Atticus can find Notes without a scavenger hunt, and “Inbox” means the folder (or has a new name everywhere it still appears).

---

## Current map (plain)

- Chat middle. Sessions left.
- Right column: Notes list on top; Graph/Mycelium below **only on Changes**.
- Opening a note puts the **body** beside/on Chat — that is not the right column.
- Narrow windows: vault becomes an overlay.

## Remainder (Atticus)

1. **Inbox rename inside the list** — keep as a folder name, or rename so it is not confused with the old rail toggle.
2. **Discoverability** of shut Notes (Show Notes strip is the current answer; only change it with a new ADR).
3. **Right icon rail** — still undecided in ADR-0170. Do not add icons in a drive-by.

Do not flip launch default again mid daily-drive.

## Acceptance

- Fresh launch: Notes column matches the shipped default; Show Notes restores it.
- Inbox (folder) does not steal Chat or hide Notes.
- No third way to show the same panel.

## Risks

- Renaming Inbox without Settings / org / badges creates two Inboxes.
- Editing ADR-0166 or ADR-0170 for rail polish — BOARD forbids that; write a **new** ADR.
