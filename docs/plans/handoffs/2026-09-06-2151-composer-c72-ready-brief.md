---
session: 2026-09-06-2151
model: Composer
description: C72 ready brief — side-panel layout session for Atticus (defaults, Inbox label, right icon rail)
---

# C72 ready brief — side-panel layout

**Origin:** Composer · 2026-09-06 · planning only (no product code)

Use this to start a dedicated ~1–2 hour layout session. Detail park:
[2026-09-06-1814](2026-09-06-1814-composer-c72-side-panel-session.md).
Settled stack: [ADR-0170](../../adr/0170-notes-heavy-right-panel.md).

## Current behavior (plain language)

- Chat stays in the middle. Sessions sit on the left.
- The right column (Notes list on top, Graph/Mycelium below) is optional.
- Rail **Inbox** shows or hides that right column (`editor-only` = hidden;
  `all` / `editor-list` = open). Click Chat → column hides.
- Opening a note puts the note body beside Chat in the center — that is not
  the same as opening the right Notes column.
- Opening Graph (or a session footprint) forces the right column open.
- Narrow windows turn the vault column into an overlay that is easy to lose.
- ADR-0170 left a matching **right-hand icon rail** undecided.

Default on launch is often Chat-only (`editor-only`), so the right stack can
feel “gone” until someone hits Inbox or opens Notes another way.

## Open decisions (Atticus)

1. **Default on launch** — Chat-only vs Notes column already open.
2. **Inbox label** — keep “Inbox” as the toggle, or rename (e.g. Notes / Vault)
   so it reads as “show the right column.”
3. **Right icon rail** — icons for Notes / Graph / Mycelium on the right edge,
   Inbox-only toggle, or always-on strip.
4. One coherent map of left / center / right (Sessions, Chat, note editor,
   VaultPanel, Graph, Mycelium, Changes, Research) — then ship that map, not
   three half-states.

## Suggested acceptance tests

- Fresh launch: right column matches the chosen default; Atticus can find Notes
  without opening something from “the left” first.
- Inbox (or new label) toggles the ADR-0170 stack open/closed; Chat still works.
- Selecting a note opens the body in center; right list can stay or hide per
  decided rule — both paths are taught by the UI.
- Graph / Mycelium open under Notes without replacing Chat; leave overlay works.
- Narrow window: compact overlay restore is obvious (not a blank right edge).
- If right icon rail ships: each icon reaches the right surface; no dead icons.

## Risks if drive-by fixed

- Flipping the default mid daily-drive confuses muscle memory and stored
  `view_mode` without a product call.
- Renaming Inbox without updating Settings / org workflow / badges creates
  two “Inboxes.”
- Adding a right rail without killing half-states leaves three ways to show
  the same panel.
- Do not touch layout code until defaults + labels + rail are decided; then
  one ADR (new or superseding) + one coherent layout pass.
