---
session: 2026-09-07T22:21-05:00
model: Cursor Grok 4.6
description: >-
  Next-agent dock (the chart). Doctor-door hanging is parked. Full pickup,
  not a chat paste. Origin at write: 2871fc3.
commits: 2871fc3
---

# Dock — 2026-09-07

**This file is the chart.** Hanging it on a waiting Session’s door is parked
(see 2208). For now, a new Session still has to be pointed at this path.
Read this dock and the [2208 dump](2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md).

---

## Who / where

You are in **Rhizome Agent** (`tuckcode/rhizome-agent`, `ai.rhizome.agent`).
This is **not** Rhizome Desktop (`knispo/rhizome`). Do not push to Desktop.
Do not “fix branding back to Desktop.” Read [`docs/IDENTITY.md`](../../IDENTITY.md).

**Owner:** Atticus. Not an engineer. Speech-to-text: odd spellings and
spelled-out numbers are dictation, not new product names. Infer the usual
term. Temporary until the dictation tool learns words or he adds overrides
(digits like `23`). He interrupts mid-read — lead with the answer; first and
last line must stand alone. Translate a technical word the first time.

**Voice:** STE-100 in Rhizome Vault, not a skill in this repo.
`~/Documents/Rhizome Vault/agents/shared/mode` is `ste`.
Read `.../agents/shared/voice-ste.md`. Sync is `.../agents/shared/sync-voice.sh`
(accepts `ste`, `normal`, leftover `adhd`). Personal voice stays out of this
tree. If it is ever productized, it belongs as a Settings option, not a default.

**North star:** Chat ↔ Prime must work. Do **not** start the parked UI
until Atticus picks that job. Do **not** rebuild `/Applications` over a live
Rhizome. Prefer the packaged app for daily drive. Quit it before replacing
(installing while it is open leaves the old binary).

**Git (2026-09-07 ~22:21 Chicago):** `main` on origin is **`2871fc3`**.
Docs-only after feature `0fa00a2`. `HANDOFF.md` State still names `0fa00a2`
for the last *app* build — do not treat that as “no later commits.”

```
9f07f60  STE-100 as global voice, keep it out of this repo
87e05f0  park evening design dump
2871fc3  Mac-first daily drive + click-not-hover learned bullets
```

Uncommitted at dock write: this file, a magnet paragraph on 2208, and a
`NEXT.md` pointer. Commit when Atticus asks.

## Read in this order

1. [`docs/IDENTITY.md`](../../IDENTITY.md)
2. [`docs/CROSS-MODEL-HANDOFF.md`](../../CROSS-MODEL-HANDOFF.md) — if you are not
   the Cursor Session that wrote tonight
3. [`docs/HANDOFF.md`](../../HANDOFF.md) — current state (index only)
4. [`docs/NEXT.md`](../../NEXT.md) — unclaimed work; stamp **Latest 2026-09-07 22:08**
5. **Tonight’s dump (do not miss):**
   [2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md](2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md)
6. [`docs/YOU-SHOULD-KNOW.md`](../../YOU-SHOULD-KNOW.md) if you will claim a GitHub issue
7. [`AGENTS.md`](../../../AGENTS.md) Learned sections (Mac-first, portfolio,
   click-not-hover, dictation)

Then only the ADRs you need:

| ADR | Why |
|---|---|
| [0144](../../adr/0144-collections-and-presentations.md) | Board = `presentation.type: board` over vault notes. Today only `list`. |
| [0166](../../adr/0166-chat-first-layout.md) | Chat-first; rail Inbox toggles the right column. |
| [0167](../../adr/0167-client-owned-sessions.md) | `client_owned` sessions; idle close vs Keep working. |
| [0168](../../adr/0168-selective-harness.md) | Doctrine **intent**, not settled. Issue **#56**. Do not cite as decided. |
| [0170](../../adr/0170-notes-graph-stack.md) | Notes default open; Graph/Mycelium only on Changes. |

## What happened tonight (no product UI)

Parked a design. Atticus said yes to the park prompts, then corrected wording
(“empty canvas” meant no messages, **not** a blank home). Wrote the 2208 dump.
Taught `sync-voice.sh` `ste` and ran it so Cursor was not still on an old
short-reply block labeled STE. Did **not** implement kanban, briefing,
CC Switch, or a mega instruction rewrite.

Sun/moon = the light/dark **icons** in the corner, not a metaphor.

## Hard no (from Atticus)

- No Hermes `kanban.db`. Board = vault notes with `status`. App draws columns
  later (ADR-0144). Two boards, do not mix: human work = vault notes; agent
  work = a view over Prime sessions.
- Do not invent the briefing. Bind to real git / vault / session facts.
- Do not expand two big overlays at once. Same family as Graph only on
  Changes (ADR-0170): one big extra surface at a time. Panels react to each
  other (Notes, Sessions, Today strip, kanban).
- Top and bottom overlays: **click, not hover**. Hover is too sensitive, worse
  when the app lags, and a display **above** the window (TV / second monitor)
  makes accidental hover open a full overlay. Prefer click for right Notes too.
  Left command rail may stay hover-expand (Claude-like collapse). No
  drag-to-reposition that rail.
- Do **not** port **CC Switch** (`farion1231/cc-switch`, already on this Mac at
  `~/.cc-switch`) into Rhizome Agent or Prime. Take copy/symlink + backup as an
  idea only. His CC Switch app list is Claude / Codex / Hermes / Pi — **not
  Cursor**. Skip “Claude inside Codex.” Keys stay in that app’s backups, never
  in git.
- Continual-learning is a **Cursor** plugin. It mines Cursor chats and writes
  Learned bullets in this repo’s `AGENTS.md`. It is not Rhizome, not Prime.
  Keep the job (durable prefs/facts). Steal: after a Session, incremental
  index, two buckets, cap, dedupe, skip secrets. Writer should later target
  vault `agents/shared/`, then sync. It must **not** own voice.
- First public **may be Mac-only**. Windows last check: unbootable (`C42`).
  Keep Windows *paths* in tooling (named pipe, `rhizome-tool.exe`,
  `resources/mcp-server`). No combined Mac+Windows polish plan.
- Do not let vault source and tool copies **drift**. That already happened
  tonight (`mode` was `ste`, sync only knew `adhd`/`normal`). Avoid at all
  costs.

## Parked product (not tonight’s build)

**Boot:** Chat shows a **portfolio overview** of projects touched in about the
last **two weeks**, plus **pinned** projects that stay longer. Composer stays
at the bottom. That is the point of the board. It is **not** a blank “start
chatting” screen.

Keep a **small hint** of the old start-conversation line (same style, or a
light redesign) **just above the composer**, not dead-center in the window.

Replies push the overview up like a message. It docks to a thin **Today**
strip in the chat column — about as tall as the left/right rails
(`COMMAND_RAIL_WIDTH_PX`, maybe a little thinner). **Click to open.** Settings
can hide the strip. Do not keep half the window. Do not delete it.

**Launcher:** one small control, bottom bar, middle-right, opens **up** like
the vault menu. Neighbors: board, scheduled work, work-in-flight.
Idle/working stays on the composer (next to thinking). Choosing Board opens a
**centered rising panel** (hotkey too) — full kanban, not a lopsided popover.
Do not fully expand Today and the kanban at once. The strip may stay; the
kanban overlay is on-demand.

**Lint:** every other night run `rhizome_lint` (and the intake audit when due).
Write a short note of what is new vs noise. **No auto-delete.** Visible and
cancelable.

**Theme:** keep the corner light/dark icons. Color skins live in Settings. A
pinned skin (e.g. Dracula) currently resets to Rhizome when that control flips.
Later polish (tooltip or short upward menu). Not north star.

**Reply shape:** STE-100 stays the voice. Useful short-reply quirks (answer
first, short blocks, stop then offer more, first and last line stand alone)
may fold into `voice-ste.md` later. Do **not** reinstall the ADHD plugin or
copy it into this repo.

## Instruction architecture (parked)

**App** here means the **coding tool**: Cursor, Claude Code, Codex, Hermes.
Not a git repo. Not Rhizome Agent the product.

1. **Vault `agents/shared/`** — voice, learned prefs that apply everywhere.
   One source. Sync **copies** into each tool’s must-load file.
2. **Repo `AGENTS.md`** — product rules for *this* tree only. ~560 lines is the
   Cursor tax. Do not paste STE into every repo. Do not paste this file into
   CodexGPT or Cereus.
3. Tools only auto-read **must-load** files (Cursor: `~/.cursor/AGENTS.md` +
   repo `AGENTS.md`; Claude Code: `~/CLAUDE.md` then the start-chain; Codex:
   `~/.codex/AGENTS.md`; Prime in Chat: vault/Prime **skills**, not those files).
   A pointer (“go read the vault”) often loses. A paste into the must-load file
   wins. That is why Atticus over-copied `AGENTS.md`.

Later: audit living docs (`HANDOFF`, `NEXT`, `ARCHITECTURE`, ADRs,
`WINDOWS-DEV`) for stale or false claims. Same failure as C42’s old
“first-class Windows app” line. Origin tags stay. Not a mass rewrite tonight.

**Rhizome as harness:** Prime today seeds
`<vault>/.prime/agent/skills/rhizome-vault/` (three hidden folders). Atticus:
Rhizome should house skills, memory, and “all the above” **in the vault we
already made** (markdown first; the vault can hold other files). Searchable.
One place. Prime stays the engine and may **read or link** those files. It is
not a second home. Do not copy CC Switch’s SQLite store into the product.

**Doctor-door handoff (parked):** while you wrap up, a helper hangs this
chart on the next Session’s door (Claude-style: sub-agent *starts* the
Session, you stay in the loop). Not `@` a file — Atticus already does that.
Not “go finish the work.” Cursor has no door-holder yet. Do not build
tonight.

## Other handoffs (same day / daily-drive)

Tonight:

- [2208 evening dump](2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md)
- [0351 ADHD off / `0fa00a2` on origin](2026-09-07-0351-cursor-grok-4-6-push-and-adhd-off.md)

Same calendar day — do **not** re-claim shipped work:

- [0324 Graph/Mycelium on Changes](2026-09-07-0324-composer-graph-on-changes.md)
- [0308 lag audit pickup](2026-09-07-0308-composer-lag-audit-pickup.md)
- [0003 beachball diagnosis](2026-09-07-0003-composer-beachball-lag.md)
- [2245 native Chat glance PASS](2026-09-06-2245-composer-native-chat-glance.md)
- [2241 north-star push landed](2026-09-06-2241-composer-push-landed.md)
- [1819 park Grokbot audits](2026-09-06-1819-composer-park-grokbot-audits-tonight.md)
- [2154 shower brief index](2026-09-06-2154-composer-shower-brief-index.md)

Design notes if you discuss harness (working notes, not shipped):

- [`docs/design/harness-doctrine.md`](../../design/harness-doctrine.md)
- [`docs/design/harness-composition.md`](../../design/harness-composition.md)

Prime adapter: [`docs/prime-adapter-surface.json`](../../prime-adapter-surface.json).
Do **not** clone `PrimeIntellect-ai/prime-agent`. `pnpm prime:surface` /
`pnpm prime:surface:github` if you touch the host. Order of trust: live daemon
> Prime’s own docs (`~/.local/lib/node_modules/prime-agent/docs/`) > this
repo’s notes.

## Still open (do not confuse with tonight’s park)

C72 Inbox rename · Prime list-import · #51 Tab remainder · C64 native verify ·
#47 confirm-close · Grokbot #60/#61/#62 · C9 first-run import · C42 Windows
never launched · in-app updater stub.

Chat ↔ Prime leftovers are the job if Atticus wants code. Parked
board/briefing/vault-skills is **not** that job until he says so.

## First reply to Atticus

Confirm you read **this dock** and the **2208 dump**. Ask: session handoff
(Chat ↔ Prime leftover) or stay on the parked design. Do not start UI until
he picks.
