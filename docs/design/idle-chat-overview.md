# Idle Chat overview + board + launcher

**Status:** parked product UI. Enough talk to execute after the God plan. **Not tonight’s north star.**  
**Origin:** 2026-09-07 evening dump + `NEXT.md` §0 parked.  
**Full ramble:** [`../plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md`](../plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md).  
**Chart:** [`../plans/handoffs/2026-09-07-2216-cursor-grok-4-6-next-agent-paste.md`](../plans/handoffs/2026-09-07-2216-cursor-grok-4-6-next-agent-paste.md).

Chat ↔ Prime still first. Do not start this while C64 / Chat reliability leftovers are the live daily-drive task.

---

## Done / now / next

- **Done:** Chat is the centre. Notes default open. Graph/Mycelium only on Changes (ADR-0170 / ADR-0171).
- **Now:** this file is the executable card. Talk is no longer only in NEXT/dump.
- **Next:** build only when claimed. One extra surface at a time.

**Done when:** idle Chat shows a real portfolio (not a blank canvas), Board is a vault view, launcher is one bottom control, and Chat still sends to Prime.

---

## Hard no

- Do not replace Chat.
- Do not invent the briefing. Bind to git / vault / session facts.
- Do not expand two big overlays at once.
- Do not hover-open top or bottom overlays (TV above the monitor). Click only.
- Do not add Hermes `kanban.db`.
- Do not keep half the window as a permanent board.

---

## 1. Portfolio overview (idle / new Session)

Composer stays at the bottom.

On a new or idle Session the **chat scroll** shows a **portfolio overview**:

- projects touched in about the **last two weeks**
- plus **pinned** projects that may stay longer
- full width, not a dead-center “start a conversation” page

Keep a **small** “start a conversation” hint **just above the composer**.

Replies push the overview up like a message. As it leaves, it docks into a thin **Today** strip in the chat column — about `COMMAND_RAIL_WIDTH_PX` tall (maybe thinner). **Click to open. Not hover.** Settings can hide the strip.

**Per-project yesterday:** a few bullets (or one short paragraph) per project that moved. Facts only.

---

## 2. Board / kanban

Cards = **vault notes with `status`**. App draws columns later (`presentation.type: board`, [ADR-0144](../adr/0144-collections-and-presentations.md)). Today only `list` exists.

Two boards, do not mix:

| Board | Store |
|---|---|
| Human work | vault notes |
| Agent work | a **view** over Prime sessions ([`harness-composition.md`](harness-composition.md) Kanban) |

Agents get the vault view, not a second store.

Rail polish for Notes is a **new ADR**, not edits to ADR-0166 or ADR-0170.

---

## 3. Bottom-bar launcher

One small control, bottom bar, **middle-right**, opens **up** like the vault menu.

Neighbors in that menu: **board**, **scheduled work**, **in-flight**. Idle/working stays on the composer (next to thinking).

Choosing Board opens a **centered rising panel** (hotkey too) — full kanban, not a lopsided popover.

Overlays **react**: if Notes, Sessions, Today, or kanban is expanded, the others collapse or stay thin. Same family as Graph only on Changes.

---

## 4. Scheduled lint (report only)

Every other night: `rhizome_lint` (+ intake audit when due). Write a short note of new vs noise. **No auto-delete.** Visible and cancelable.

---

## Build order (when claimed)

1. Portfolio overview + Today strip (click). Completion: idle Session shows last-two-weeks + pinned from real data; a send docks the overview.
2. Launcher control (empty menu OK). Completion: one control, click, not hover.
3. Board panel as vault `status` columns (ADR-0144). Completion: no `kanban.db`; notes with `status` appear.
4. Lint schedule as a Prime/Rhizome schedule the user can cancel.

Do not ship fullscreen before Graph is useful. Do not put Graph back as the Chat canvas.
