---
session: 2026-09-07-0110
model: Composer
description: C72 Atticus priorities — right Notes findable; launch default or Inbox rename; Mycelium chip label
---

# C72 — Atticus priorities for the layout session

**Origin:** Composer · 2026-09-07 · planning only (no product code)

Prior brief: [2026-09-06-2151](2026-09-06-2151-composer-c72-ready-brief.md).  
Park / why it feels wrong: [2026-09-06-1814](2026-09-06-1814-composer-c72-side-panel-session.md).  
Settled stack: [ADR-0170](../../adr/0170-notes-heavy-right-panel.md) (Notes heavy + Graph/Mycelium below; right icon rail still undecided).

## Atticus priority (do this first)

**Right Notes must be findable.** The Notes list/browse column on the right
must not depend on hunting through left-rail **Inbox** (or opening a note
from the left) just to discover it exists.

## Recommended default (pick one in session)

1. **Open the right Notes column on launch** (not Chat-only / `editor-only`),
   **or**
2. **Rename Inbox** to something that reads as “show Notes / the right
   column” (e.g. Notes / Vault) if the toggle stays left-rail-only.

Either path is fine; the product call is which one ships. Do not leave both
undecided while changing layout code.

## Mycelium CirclesThree chip

**Keep it.** If easy in the same pass: add a clear label or tooltip so the
three-circles control reads as Mycelium (not a mystery icon).

## Acceptance (layout session done when)

Fresh launch: Atticus can **see or open Notes on the right without hunting** —
no “where did my vault go?” and no requirement to poke left Inbox first.

Secondary checks from the ready brief still apply once defaults/labels are
chosen (toggle still works, Chat stays center, Graph/Mycelium under Notes,
narrow-window restore obvious).

## Still out of scope until decided

Right-hand icon rail (ADR-0170 left open). One coherent left/center/right map,
then one ADR + one layout pass — not drive-by default flips.
