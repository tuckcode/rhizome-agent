# Frontend UI audit — 2026-08-20 night

Eyes on `pnpm tauri dev` (pid 6641, window 1400×897) via cua-driver. Prime
**0.7.4**, daemon restarted onto a live socket before the walk. Repo at
`98bff09`. Screen was unlocked; captures were not black.

This is a punch list, not a fix session. One sentence of evidence per score.
Scores: **works** / **broken** / **missing** / **unclear**.

Product read used while scoring: Rhizome is a vault wiki (second brain) that is
becoming the desktop shell of Prime Agent. Chat is the primary window; Notes /
graph / mycelium are still the wiki. The chrome still looks like the wiki
shell with a chat pane dropped in, not a Prime desktop that happens to own a
vault.

## What a person notices first (ranked)

These are the items a glance already catches. Next session should pick **one**
of 1–4, not candidate 4 and not more harness plumbing.

1. **Command rail is icon-only and not expandable.** Chat home has no second
   column at all — only the 46px rail. Notes *does* have Expand sidebar (⌘2),
   but that expands the *wiki* sidebar, not the rail. `CommandRail.tsx` is
   hard-coded `width: 46`. The person using Chat cannot get labels.
2. **Sessions list is not the main sidebar.** Default Chat home is empty
   transcript + composer. Frame F lives behind a 22×22 clock at the far-right
   of a second header row (`Open sessions`, `sessionsOpen` starts `false`).
   #27's dockable sidebar is designed; the running app hides it.
3. **Traffic lights sit in the Chat icon's vertical band.** Configured
   `trafficLightPosition: { x: 58, y: 24 }`. AX puts the three 16px buttons at
   screen x=113/136/159, y=47; the Chat rail control is x=63, y=40, h=30. Clear
   of the rail horizontally, overlapping it vertically. Subhead text is inset,
   the lights themselves still look parked on the first destination.
4. **Goal is a stray control, not a toolbar.** With no live session the
   48px Goal button sits at x=115 (under where SESSIONS will open). With a live
   session and a context meter it jumps to x=1396, y=763 — far right of the
   composer row, `justify-between` against the meter. One control, two
   accidental homes; looks like two Goal buttons if you catch both states.

Then, still user-visible but less "glance":

5. History list is ~half `Untitled session` (#28). `set_session_name` is still
   never called.
6. Model + thinking strip is absent until a host session exists; idle Chat
   home showed only `Prime idle | vault …`.
7. No in-app `prime-agent update` (#26). Settings has Rhizome's own
   updater, not Prime's.
8. Scheduled-work band correctly hides when idle, and still cannot **create**
   a heartbeat or cron (#14).

Candidate 4 (stale thinking-level picker) was **not** visible this walk: the
strip showed `Grok 4.6` / Medium on a live session and jsonl for an earlier
turn was `xai/grok-4.6`. Leave it ranked under the architecture review, not
as tonight's visual remainder.

---

## 1. Chat home / AI panel

| Surface | Score | Evidence |
|---|---|---|
| Empty Chat home | **works** | "Message Prime Agent" + "Chat works without a note…" empty state; composer placeholder "Ask Prime Agent"; `Idle · ready`. |
| Live subhead (#9) | **works** (once attached) | After a host existed: `Prime session live` · `sess_04db` · `Model and thinking level` · `vault ~/Documents/Rhizome Vault` · `up 7m`. Picker aria-label is one control. UI label `xai / grok-4.6`; jsonl `01a0208e-3494-…jsonl` has `xai/grok-4.6`. Newest `sess_04db` log is 5 lines (no message yet). |
| Model strip when idle | **broken** | First snapshot, daemon at 0 sessions: subhead was only `Prime idle` + vault path. No picker, no thinking level, no way to choose grok-4.6 before a session exists. |
| Duplicate model line | **unclear** | Live Chat also rendered `model · xai / grok-4.6` at y=110 in the empty transcript well, *and* the strip picker. Two places to read the model; #9 was supposed to leave one. |
| Context meter | **works** | Live: `CONTEXT WINDOW 0 / 500.0k (0%)` — 500k matches the local `xai-oauth.ts` grok-4.6 cap. |
| Goal trigger | **broken** (layout) | One AX `Goal` button. Idle/no-meter: x=115 under the sessions column. Live: x=1396 on the right of the composer. Dialog itself **works**: "Set a goal", "No active goal.", Objective + optional token budget, Cancel / Set goal. Pause/resume of a running goal: **missing** (gap doc item 5; not on this dialog). |
| Scheduled-work band (#14) | **works** as a viewer, **missing** create | Band hidden on an idle session with no heartbeats (correct). No UI to `set_heartbeat` / add a schedule. |
| Sessions toggle | **unclear** as IA, **works** as a click | Clock at x=1424, y=68 opens a 228px `SESSIONS` column. Default off. `+` New chat exists twice (subhead and list header). |
| Prompt / send | **works** | `AXTextArea` "Ask Prime Agent", Send message, `⌘↵ send`. Steer / follow-up / abort not exercised (session was idle). |
| Fork / compact / export / switch | **missing** on this empty home | No chrome for them on the empty transcript. Compact/export live on commands (`/` menu) not walked. |

## 2. Command rail (the "tiny icons")

| Surface | Score | Evidence |
|---|---|---|
| Rail as Chat chrome | **broken** for a Prime desktop | Six destinations + Settings, all 30×30, no labels, no expand, no hover-required to *know* they exist if you do not already. Chat / Notes / Wiki Graph / Mycelium / Research / Changes / Settings. Spec (`shell-final-direction.md` §2.2) *chose* 46px fixed — that choice is now wrong for the window people land on. |
| Rail as Notes chrome | **works** as a switcher | Notes click selected the wiki three-pane. Graph / Mycelium / Research / Changes not walked beyond presence. |
| Settings gear | **unclear** | AX `Settings` at y=863. Background and foreground presses from Notes did not put a Settings dialog in the AX tree. `⌘,` is the documented shortcut. Did not block the rest of the walk. |

## 3. History / session list (#27 / #28)

| Surface | Score | Evidence |
|---|---|---|
| List opens | **works** | Clock → `SESSIONS` header, rows with first-message titles when they exist (`testing to see if we are actually running grok 4.6 now`, `Pickup — Rhizome Agent…`). |
| Default visibility | **missing** | Not on screen until the clock is clicked. Chat home therefore has no session sidebar. |
| Titles | **broken** (#28) | Of the listed rows, about half are the literal `Untitled session`. Mechanism is `set_session_name`; nothing in the tree calls it. |
| Rename / pin / archive | **missing** | List is select + New chat only. |

## 4. Menu-bar roster (#13, `34b840e`)

| Surface | Score | Evidence |
|---|---|---|
| This walk | **unclear** | Companion window 550 is 500×500, `is_on_screen: false`. Snapshot returned 0 AX nodes. Did not click the tray. Titles + "Waiting for you" were the 34b840e fix; not re-verified visually tonight. |
| Activity labels | **broken** if still English-only | C34 still open: eight activity strings are literals. Not re-checked in the popover. |

## 5. Vault sanity (wiki side still a product)

| Surface | Score | Evidence |
|---|---|---|
| Notes destination | **works** | Inbox 88 / All Notes 153 / Archive; projects `rhizome`, `cereus`, …; `UNASSIGNED 132`. |
| Wiki sidebar collapse | **works** | `Expand sidebar` / `Collapse sidebar (⌘2)` toggles the taxonomy column. This is **not** an expand of the 46px rail. |
| Note list | **works** | Cards with title, snippet, created date. Click opened `2026-08-16 — Rhizome Agent: C29 Cmd+N note list` in the editor. |
| Editor | **works** | Title, body, favorite / organize / reload / raw / width / TOC / Finder / copy path. Empty state when nothing selected: "Select a note to start editing" + `⌘P / ⌘O` / `⌘N`. |
| Search affordance | **works** as a button | `Search notes` in the Inbox header. Query not typed this walk. |
| Status bar | **works** | `Rhizome Vault` · `main` · `8Δ` · `dev` · `Agents idle`. Vault is dirty (8 deltas) — QA residue, not a UI bug. |

## 6. Agent settings (#26)

| Surface | Score | Evidence |
|---|---|---|
| Rhizome updater | **works** (code + status bar) | Status bar `Check for updates`. Settings copy (from a later overlay read) has Sync & Updates: pull interval, release channel, auto-check — **Rhizome's** updater. |
| Update Prime from inside the app | **missing** (#26) | `SettingsPanel.tsx` has AI Agents / default target / keep-sessions-running. No `prime-agent update` button. `prime-agent update` exists on the CLI. |
| Pause/resume goal, autonomous, agent-to-agent, image prompt, `export_html` | **missing** | Gap doc items 3–6. None appeared on Chat home or the Goal dialog. |

## 7. Traffic lights

| Surface | Score | Evidence |
|---|---|---|
| Horizontal vs rail | **works** by the unit test | `x=58` ≥ 46px rail. `CommandRail.trafficLights.test.tsx` encodes that. |
| Vertical vs Chat / subhead | **broken** | Lights at y=47 overlap the Chat control's y=40–70 box. On Chat home they share the telemetry strip; on Notes they share the sidebar header with Collapse / wordmark. Overlay titlebar + `y: 24` is the knob. |

---

## Backlog ticks (from the pickup — confirmed or dropped)

| Item | Tonight |
|---|---|
| #14 cannot create scheduled work | **still missing** |
| Agent-to-agent / autonomous / goal pause | **still missing** |
| `export_html`, image prompt, `get_fork_messages` | **still missing** |
| Live roster unused `list` fields | not visually checked (popover off-screen) |
| `observe` | do not build — already probed |
| Candidate 4 thinkingLevel dual pollers | **not user-visible** this walk |
| Candidate 5 AiPanel tests | not this session |
| #26 | **confirmed missing** |
| #27 | **confirmed**: list exists, not the main sidebar |
| #28 | **confirmed**: ~half Untitled |
| C34 English activity literals | not re-checked on the tray |
| grok-4.6 in picker | **works** once a session is live (extension outside the repo) |

## Method notes

- Cursor IDE chat cannot see the Rhizome window. cua-driver `get_window_state` +
  `click` by `element_token`. Daemon: `0.7.4`, `status current`.
- Did not send a prompt. Did not ask the model what it is; model came from the
  strip + `~/.prime/agent/sessions/*.jsonl`.
- Settings gear click from Notes did not produce an AX Settings tree; treat as
  an automation miss unless a person also cannot open Settings.
- Demo/user vault: `~/Documents/Rhizome Vault` was already the attached vault.
  No notes created. `8Δ` was already dirty.

## Suggested next visible fix (not started)

**Make Chat home have a real left column** — either an expandable rail with
labels, or Frame F sessions open by default (or both: rail destinations with
words, sessions as the column beside the transcript). That is the product
premise ("desktop Prime + the vault") colliding with a 46px wiki-era rail
and a clock-toggled history list.

Do not start candidate 4 until that column exists or is explicitly deferred.
