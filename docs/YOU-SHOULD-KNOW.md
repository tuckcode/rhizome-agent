# You should know

**Origin:** Grok 4.6 · 2026-08-26 night. Briefing for the next session —
especially Claude coming back after several days of Grok / GPT-5.6 Sol work.

This is **not** `HANDOFF.md` (index of what is true) and **not**
`NEXT.md` (unclaimed work). Those stay the daily files. This is the
multi-day picture they do not carry: what the product is now, what
shipped after Claude last owned a session, what GitHub still says is
open that is already built, and the decisions you will otherwise
re-litigate.

**Living-docs stamp 2026-09-19:** local = origin **`35f217f`**. Packaged
app **`712024d`** (2026-09-17 17:23) — C75 boot + traffic lights `x: 14`
are in that `.app`. Tray Done / empty-rejection labels are tree-only
until rebuild. God plan: [`ASTRA_GOD_PLAN.md`](ASTRA_GOD_PLAN.md).
Morning pickup:
[`2026-09-14-1115`](plans/handoffs/2026-09-14-1115-cursor-grok-4-6-morning-pickup.md).
Tonight’s picture: [`BOARD.md`](BOARD.md). Confirm with `git log -1` and
`git log origin/main..HEAD`.

Last Claude-owned session on this repo: **2026-08-24**
([shell dock + ADR-0166 + NEXT.md](plans/handoffs/2026-08-24-2122-claude-opus-5-shell-dock-and-next-index.md)).
Claude’s last *code* was **2026-08-22** (right-dock + ADR-0166).
`origin/main` at writing was **`80fa720`**. **Corrected 2026-09-08:**
confirm with `git log origin/main -1` (this briefing is not the daily
index — `HANDOFF.md` holds the tip). Do not treat the shell map below as
current without reading §2’s correction block.

---

## 1. What this product is

This is **Rhizome Agent** (`tuckcode/rhizome-agent`, `ai.rhizome.agent`).
It is **not** Rhizome Desktop (`knispo/rhizome`). Do not “fix branding
back to Desktop.” Details: [`IDENTITY.md`](IDENTITY.md).

**Rhizome is the desk and durable memory. Prime is the engine.**
Chat first, vault on purpose. Memory is gated; execution is not.

If Prime already has a mechanism, use Prime’s. Do not build a Rhizome
twin beside it. Vault knowledge still lands as markdown — Prime’s
`~/.prime/agent` is harness state, not the memory store.

This machine’s Prime is **0.9.3** (106 public daemon commands). Recheck
with `pnpm prime:surface` / `pnpm prime:surface:github`. Snapshot:
`docs/prime-adapter-surface.json`. Do not clone upstream Prime.

---

## 2. The shell, as shipped (not as ADR-0166 first drafted it)

**Origin:** Cursor Grok 4.6 · 2026-09-08 — §2 corrected against `App.tsx`
/ ADR-0170 / ADR-0171. The 2026-08-26 “Graph replaces Chat” map is stale.

```
rail | sessions | CHAT | Notes (default open; 46px rail when shut)
Changes only:          | Graph / Mycelium under Notes
Research:              | still a center-canvas pane (not Chat)
```

Claude left ADR-0166 with three questions open (what ⌘1/2/3 mean, whether
Graph/Mycelium take the canvas, right-panel exclusivity). Those are no
longer open the way the ADR text still sounds.

| Question | Now |
|---|---|
| ⌘1 / ⌘2 / ⌘3 | **Settled 2026-08-25.** Labels in tree 2026-09-14: ⌘1 Chat only. ⌘2 **Notes, Browse closed**. ⌘3 **Notes, Browse open**. Stored `viewMode` values unchanged (`editor-only` / `editor-list` / `all`). Fresh vaults default to `editor-list` (C72). Inbox stays the folder. Packaged app **`712024d`**. |
| Right panel | **Settled 2026-08-25, refined 2026-09-12.** One Notes panel. Compact nav above the selected list. Rail control is **Notes** (Inbox is a folder in the list). Shut Notes leaves a 46px restore rail. No Inbox/Notes tabs, no second right column. |
| Canvas destinations | **Corrected 2026-09-07.** Chat stays the centre. Graph/Mycelium are a Changes-only cell under Notes (ADR-0171), not a place you go instead of chatting (`App.layout-edges.test.ts` 14:33). Research is still a centre pane (Chat `display: none`, not an overlay). #39 (graph as an *agent tool*) is still open. |
| Open note vs Chat | **Shipped 2026-09-12.** Notes header **On top / Beside**. Beside folds Sessions/Notes. Hover must not collapse the note. Highlight → Copy, or **Ask Chat about this** (same thread; `App.layout-edges.test.ts` 14:00). Right-click a list row → **Ask the agent about this note** keeps Chat and opens that note (`App.test.tsx` 13:50). Note lock is ephemeral and per-note — locked notes are read-only (`EditorContentLayout.test.tsx` 13:51). Not vault `editor_mode`. |
| Latest reply | Green start marker on the newest assistant turn. Moves when a newer reply starts. |
| Session click | Transcript **clears on the click**, then rehydrates. Leaving the old chat up is the switch beachball. |
| Settings cost | Model catalog and provider status wait until **Agents** is visible. Packages catalog waits until **Packages**. |
| Hide vs quit | Red button hides (C22) and stops **ws-bridge + Mindwalk**. Spawned Prime stays warm (C75). Cmd+Q quits. Never Prime `shutdown`. |
| Tray finish | Running rows say `{title} · {activity}` (same words as the popover, plus helper count). A drop-off stays `Done: {title}` for 45s. Tooltip `Rhizome — session finished` only when nothing is running. Failed roster read does not invent finishes. Click clears that Done row. Do not close #52 from units. Tree `35f217f`; not in `/Applications` yet. |
| Empty rejection | Empty assistant turn with `usage.input == 0` → `{provider} rejected this request before it ran (no input tokens).` Input tokens > 0 still use the old placeholder. |
| Traffic lights | Overlay `{ x: 14, y: 16 }` (`trafficLights.ts` / `tauri.conf.json`). Insets come from that constant. |
| First-run vault | Local scaffold. Only `RHIZOME_GETTING_STARTED_REPO_URL` clones. `TOLARIA_*` / `LAPUTA_*` env names do nothing. |
| Cold restore | `BootSplash` while `App` lazy-loads. Idle Chat uses `latest_prime_session_for_restore`, not the full list. |

**Do not** make nav and the note list exclusive. Claude tried; it broke
Cmd+N, inbox auto-advance, and note selection. Keep them mounted
together (`AGENTS.md` learned facts).

**Do not** put `data-tauri-drag-region` on the breadcrumb or Prime
subhead. Titlebar drag is `useDragRegion` only, and only after pointer
*move*. Mousedown-start races double-click maximize and snaps the
window to half height. Native QA only; Playwright cannot see it.

Closing a note is the breadcrumb **X** (`breadcrumb-close-note`). The
sidebar-looking header control is Properties.

Width-aware collapse: sessions overlay first, then the vault panel
(`src/hooks/useShellCompactLayout.ts`). Dragging a panel does not
enter or leave compact mode — that is window width only. The overlay
Notes panel stays resizable.

---

## 3. What shipped after Claude (grouped, not a commit dump)

About 30 commits, 2026-08-24 evening through 2026-08-26. Grok 4.6 did
the product surface. GPT-5.6 Sol did doctrine, mid-turn, folder
hardening, traffic-light QA. Session files live in
[`docs/plans/handoffs/`](plans/handoffs/) — do not re-read all of them
unless a row below is the task.

### Harness doctrine (Sol, then Grok notes)

- **ADR-0168** / [`harness-doctrine.md`](design/harness-doctrine.md):
  selective doctrine. Borrow contracts and artifacts. Never a second
  runtime or memory store. Option 2 is the intended shape (Rhizome
  harness, Prime engine) and is **not ratified** as composition.
- Working notes: [`harness-composition.md`](design/harness-composition.md).
  Proposed first slice if ratified: native Prime `extension_ui`
  (select / confirm / input — Rhizome auto-cancels those today).
  Closing **#40** against the filter is not “composition done.”
- Hermes Agent is its own runtime, **not** built on OpenCode. OpenCode
  stays reject-as-backend. DeepSeek Cordis is reject-as-kernel; take
  the *idea* (hook a turn / block a tool) on Prime’s existing seams.
- Prime has no security sandbox. Do not invent one. Kern is Linux/WSL2
  only. C57: CLI default **Limited tools**; Prime toggle stays hidden
  (always Power User). English tooltips say instruction, not a lock.
  Do not restore “Vault Safe.”
- **Do not start grafting** until option 2 + first slice are ratified.

### Sessions are furniture, not an overlay

- Left column of Chat. Always on in the chat-centered shell. **#27 closed.**
  When this column is the top band (no Prime subhead), the header clears
  the traffic lights and is a `useDragRegion` drag surface
  (`PrimeSessionList.test.tsx` / `AiPanel.test.tsx`). Native drag NOT RUN.
- Filter matches **title / cwd / git branch**, not transcript. Archived
  rows included; a hit expands that section. **#34 closed.**
- Named at creation: `Rhizome · {Mon D} · {h:mm}{a|p} · {vault} · {id-tail}`
  via `set_session_name` (clock first so quit/reopen can find the latest).
  The older `Rhizome · {vault} · {id-tail}` shape is still a replaceable
  placeholder. Rename speaks `rename_saved_session`
  (`sessionPath` + `name`) and must **not** create a session. **#31 closed.**
- Session switch skips `ensure_prime_session_host` when the host is
  already running (`usePrimeSessionSwitcher` `hostRunning`).
- New sessions are Prime `client_owned` (ADR-0167 / C47). Idle close
  detaches. Active close defaults to **stop**, with Keep working as an
  explicit promote to `resident`. Quit follows ownership.
- Rhizome starts the Prime supervisor on connect
  (`prime-agent --mode daemon --daemon-socket <path>`). Do not spawn
  when `RHIZOME_PRIME_DAEMON_SOCKET` is set. If the host is down, **retry
  `ensure_prime_session_host` on the status poll** — a one-shot connect
  at launch loses the race and freezes the model chip, session switch,
  and rename.

### Composer strip (one surface, four issues)

`ChatComposerDeck` is the live control strip. **#38 / #9 / #35 / #21**
are **closed** on GitHub (2026-08-29). Do not redesign the strip again.

- Pills are live, not inert.
- Model + thinking live on the strip (moved off the Prime subhead).
- Thinking is a **menu of the levels the model can run**
  (`get_prime_thinking_levels` filtered by
  `get_prime_supported_thinking_levels`; on `deepseek-v4-flash` that is Off /
  High / X-High, and the menu says "Limited by this model" when it is short).
  Do not restore a binary quiet/loud toggle. The model picker lists the same
  set.
- **#51 Case 1 shipped:** Tab ghost-text and reply pills are rules-first
  (`suggestReply`). Options win over completion. Case 2 (model-backed) is
  not built.
- Assistant message actions are icon-only with hover tooltips (regenerate,
  copy, save to vault, fork).
- Command argument hints were already in the slash menu.

### Packages hub (2026-09-12)

Settings → **Packages** (nav label, not "Extensions") is the Pi catalog.
Install is `prime-agent package install`, then reload. The daemon has no
install command. Confirm full system access once. Chat is the fallback
when the CLI is missing.

### Prime verbs that landed in Chat

Implemented on main. **#14 / #17 / #18 closed tonight** (2026-09-13):

| Issue | What landed |
|---|---|
| #17 | `get_session_tree` / `navigate_tree` in Chat |
| #14 | Create via `heartbeat_set` / `cron_add` (see/pause/cancel UI is thinner) |
| #18 | Compact / fork / model markers in the transcript |
| (no issue) | Live RLM children from the `list` roster + `cancel_rlm_child`. That is **not** #17. |
| (no issue) | Chat shows Prime `get_queue`; Clear → `clear_queue`. Not a local follow-up list. |

**#41** (steer / queue path wired to nothing) is still a real gap for
*steering*. The queue *display* is not that issue.

### Memory loop (partial)

- **#29 closed** (`a8f83de`): tokens-only `redactCredentialTokens` before
  distill; Save-to-vault refuses. Detector was telemetry-only. Prime
  session jsonl is out of scope.
- **#24 closed 2026-08-28.** Promote writes
  `raw/inbox/{YYYYMMDD}-{slug}.md`. Title from first `#`/`##` or first
  sentence, never a raw timestamp. Frontmatter: `title`, `is_a: Note`,
  `created`, `source: prime-chat-promote`, plus `session` when Chat can
  pass Prime session id/path. Existing `[[wikilinks]]` kept; none
  invented. Same-path refuse + toast
  (`ai.message.saveToVaultDuplicate`). #29 check still runs first.
- **#25 closed 2026-09-04.** Retrieval provenance on main. Index:
  [`design/memory-loop.md`](design/memory-loop.md). Consolidation sketch
  remains [`automatic-memory-consolidation.md`](design/automatic-memory-consolidation.md).
- Vault `Imports/` writer shipped. Prime **session-list rows stay blocked**
  until Atticus types **`1`**. Do not speak `import_jsonl`. Silence is not
  approval.

### Research as canvas

Not a dialog. `ResearchPanel` `variant="pane"` in the editor slot.
No Chat overlay inside it (no second conversation). Graph and Mycelium
do **not** take the Chat canvas (ADR-0171); Research still does. Book →
Skill is a Generate format (`book-to-skill`) — produces a SKILL.md-shaped
wiki page; does not vendor the upstream repo.

### Mycelium (#11 / #22) — in-app, not a browser

On main. **#11 / #22 closed** 2026-08-27. M4 restyle not started.

- Mindwalk runs as a local sidecar (`serve` / `open --no-open`).
- View is an iframe at `127.0.0.1`. CSP `frame-src` allows loopback.
- PATH empty-state is **gone**. Sidecar miss = Retry, not a blank pane.
- **Rail** = all sessions (overview). **This run** on the Prime subhead
  (`prime-session-footprint`) = this session only.
- Rhizome chrome (header, list, footer). Engine is still Mindwalk’s
  React/Three.js page. Footer: Mindwalk (MIT) © 2026 Ricko Yu.
- **M4 not started:** a Rhizome-themed client against Mindwalk’s
  `schema/` / `/api/*`, so engine bumps keep the lipstick. Iframe CSS
  is not that. MIT *allows* absorb; we chose chrome-now, fork-later.
- C24 resolved: the TS `primeSessionToMindwalk.ts` duplicate is gone
  (area B). Listing and bridging stay in Rust `prime_sessions`.

### Tool cards

**#42 closed.** Expandable “Tool use” group. `ipython` + `%%bash`
shows the recovered command, not “ipython” five times.

### Hardening you should not re-open

- C43 / C44: mid-turn is tri-state (accepted / no longer running /
  transport). Follow-ups propagate Prime’s `data.queued`. Fallback
  starts a new turn only from the latest idle UI state.
- Folder mutations stay inside registered vaults (`2d12ca5`).
- #43 window-level navigation guard: off-origin links go to the
  system browser; the webview never leaves. Built on Tauri 2.10
  `on_navigation`. **GitHub #43 closed** 2026-09-13 / confirmed
  2026-09-14 (`gh issue view 43`). Do not reopen.
- Traffic-light clearance native-verified (Sol). Mycelium “white
  screen” was a Suspense flash, not a blank view (C49).
- On macOS, restoring a hidden main window: `app.show()` first, then
  unminimize / show / focus. `lib.rs::focus_main_window` is the path.

---

## 4. GitHub is behind the tree

Close-on-live-check is the house rule. **Do not re-implement an open
issue.** Check `main` and the handoff first.

**Closed (do not reopen):** #9 #11 #14 #17 #18 #21 #22 #24 #25 #27 #29
#31 #34 #35 #37 #38 #42 #43 #44 #47 #55, plus earlier #1–#8, #10, #12,
#15 #16 #19 #20 #28 #30 #33.

**Still OPEN (live `gh` 2026-09-14, 17 issues):**
#5 #13 #23 #26 #32 #36 #39 #40 #41 #45 #46 #48 #50 #51 #52 #56 #57.

| Still open | Honest read |
|---|---|
| #40 | Filter answered (ADR-0168); composition not ratified |
| #41 | Source `onSteer` is wired. Leftover is native Enter-queue / Steer plus unspoken `mutate_queued_message`. Do not close from units. |
| #5 | Spec skeleton: [`design/prime-agent-surface.md`](design/prime-agent-surface.md) |
| #46 | Source refuses HOME as a vault (`4416411`). Leftover is live Chat-without-vault. Do not close from units. |
| #51 | Case 1 shipped; Case 2 deferred |

**Unbuilt / blocked, not “GitHub forgot”:** #32/C42 Windows never launched;
#50 plan awaiting surface; #56 doctrine honesty.

⚠️ **C-numbers and issue numbers collide.** C40 ≠ #40. C34 ≠ #34.
Always write `C40` or `#40`.

---

## 5. TokenJuice and Switchyard — wanted later, not a build

Both, stacked, behind Prime. **Not a Rhizome organ. Do not vendor
either in this tree.**

- TokenJuice-shaped: tool result → compressor. Prime owns what the
  model sees. Rhizome may render breadcrumbs; it must not compact.
- Switchyard-shaped: request → model. Sidecar behind Prime. Halfway
  house already in Prime: `set_scoped_models`.

Write-up: [`token-routing-and-compression.md`](design/token-routing-and-compression.md).
Vault twins exist as notes, not code.

---

## 6. How this repo expects you to work

- **`git status` and `git log origin/main..HEAD` first.** Stranded
  work has bitten three times. Uncommitted files are the last
  session’s unfinished commit.
- **Commit = local save. Push = GitHub.** User said this in so many
  words. Pre-push is ~3 min, three parallel lanes (frontend is the
  critical path). Do not `--no-verify`.
- **Sign commits** `Co-Authored-By: Grok 4.6 <noreply@x.ai>` (or the
  model that did the work).
- **English only in `en.json`.** C18: do **not** run
  `pnpm l10n:translate`. `pnpm l10n:validate` failing is expected.
  #22’s AC asked for translate — C18 overrides it.
- **Do not start a plugin kernel.** Do not start harness composition
  without ratifying option 2.
- Living docs are palimpsests. `NEXT.md` was Claude `b8dc8fb`, then
  Grok `2b5daba` inserted composition. Read **Origin:** lines. `rg`
  cannot attribute a section.
- Session handoffs: one new file in `docs/plans/handoffs/`, one line
  in `HANDOFF.md` Recent sessions. Do not paste the session into
  `HANDOFF.md`.
- After a named handoff task, pick next work from `NEXT.md`. Do not
  invent a Prime verb because the surface is nearby.

---

## 7. Traps from this stretch (short)

Full landmine file: [`CROSS-MODEL-HANDOFF.md`](CROSS-MODEL-HANDOFF.md).
These are the ones this week added or re-proved:

- **knip** flags ambient `declare global` files. Run `pnpm typecheck`
  (`tsc -b`, not `tsc --noEmit`) before deleting.
- **Listen outside Tauri:** Prime close `listen` must be skipped in
  the browser / mock or frontend coverage / Playwright die (`b064272`).
- **Replay-card types:** transcript helper tools need `detail?: string`
  or `tsc -b` fails (`80fa720`).
- **rustfmt** on new Tauri commands or the rust lane fails the push.
- **Titlebar drag** — see §2. Do not “restore” `data-tauri-drag-region`.
- **Notes nav + list exclusivity** — see §2. Do not retry it.
- **Mycelium iframe** is Mindwalk’s UI. Restyle is M4 (JSON client),
  not CSS-on-iframe.
- **Inverted Dock icon** is `stash@{0}`, parked. Do not pop it into
  an unrelated commit.

---

## 8. What to do next (if no one named a task)

User leftover, in this order:

1. Morning pickup landed — read
   [`2026-09-14-1115`](plans/handoffs/2026-09-14-1115-cursor-grok-4-6-morning-pickup.md)
   then [`ASTRA_GOD_PLAN.md`](ASTRA_GOD_PLAN.md) and [`BOARD.md`](BOARD.md).
2. **Do not** start TokenJuice, Switchyard, or harness composition.
3. If choosing freely: **#46** (security), C64 verify, hide-on-close
   helpers, #41 steer honesty. Do not re-close #11 / #22 / #24 / #47.
4. C28 / C31 whenever the push gate flakes — re-run-and-move-on is
   how they stay unfixed.

---

## 9. Pointers

| Want | Open |
|---|---|
| What is true right now | [`HANDOFF.md`](HANDOFF.md) |
| Tonight’s board | [`BOARD.md`](BOARD.md) |
| God plan (execute) | [`ASTRA_GOD_PLAN.md`](ASTRA_GOD_PLAN.md) |
| God-plan input | [`ASTRA_PACKET.md`](ASTRA_PACKET.md) |
| Morning pickup | [`2026-09-14-1115`](plans/handoffs/2026-09-14-1115-cursor-grok-4-6-morning-pickup.md) |
| Unclaimed work | [`NEXT.md`](NEXT.md) |
| Traps | [`CROSS-MODEL-HANDOFF.md`](CROSS-MODEL-HANDOFF.md) |
| Identity / Prime-first | [`IDENTITY.md`](IDENTITY.md) |
| Shell ADR (Chat centre; canvas Qs superseded) | [`adr/0166-chat-centered-shell.md`](adr/0166-chat-centered-shell.md) · [0170](adr/0170-notes-heavy-right-panel.md) · [0171](adr/0171-graph-on-changes-only.md) |
| Doctrine | [`design/harness-doctrine.md`](design/harness-doctrine.md) · ADR-0168 |
| Composition (unratified) | [`design/harness-composition.md`](design/harness-composition.md) |
| Token routing (discuss only) | [`design/token-routing-and-compression.md`](design/token-routing-and-compression.md) |
| Afternoon wrap (now on origin) | [`plans/handoffs/2026-08-26-1718-grok-4-6-research-mycelium-canvas.md`](plans/handoffs/2026-08-26-1718-grok-4-6-research-mycelium-canvas.md) |
| Claude’s last session | [`plans/handoffs/2026-08-24-2122-claude-opus-5-shell-dock-and-next-index.md`](plans/handoffs/2026-08-24-2122-claude-opus-5-shell-dock-and-next-index.md) |
