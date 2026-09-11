---
session: 2026-09-06-1814
model: Composer
description: Park C72 — Atticus cannot find right panel; needs dedicated side-panel layout session
---

# C72 — Side panels feel broken / need a design session

**Origin:** Composer · 2026-09-06 · Atticus: right panel gone unless opening Notes from the left; wants a real look at what populates each side and how they should be configured.

## What the code does today (chat-centered + command rail)

| Surface | Where | How you get it |
|---|---|---|
| Sessions | Left rail middle (or classic left column) | Always when Prime Chat |
| Chat | Center | Default |
| Notes + Graph/Mycelium stack | **Right** `VaultPanel` | Rail **Inbox** toggles `editor-only` ↔ open (`all` / `editor-list`). ADR-0170. |
| Open note body | Center, beside Chat | Selecting a note — **not** the same as the right vault column |

Hidden right column = `viewMode === 'editor-only'` (and/or narrow-window compact overlay closed).

Opening Graph / session footprint **forces** the right column open. Selecting Chat sets `editor-only` (hides it).

## Why it feels wrong

1. **Discoverability** — “Inbox” on the rail does not read as “show my notes column.”
2. **Two different “notes” places** — list/browse on the right vs note body in the center split.
3. **ADR-0170 left the right-hand icon rail undecided** — no obvious icons for Notes / Graph / Mycelium on the right edge.
4. **Narrow window** — compact vault becomes an overlay; easy to lose.
5. **Holes** — user has to open Notes somehow from “the left” to get the right stack back; that matches a mental model the UI does not teach.

## Dedicated session goals (do not drive-by)

1. Map every left / center / right surface and what populates it (Sessions, Chat, note editor, VaultPanel Browse+list, Graph, Mycelium, Changes, Research).
2. Decide default: Chat-only vs Notes column open on launch.
3. Decide right-edge controls (icon rail vs Inbox-only vs always-on strip).
4. Name/relabel Inbox if it stays the toggle.
5. Write or supersede ADR for the result; fix one coherent layout, not three half-states.

## Not fixing in this pass

No layout code change here — needs Atticus + a focused session (~1–2 hours), not a silent default flip mid daily-drive.
