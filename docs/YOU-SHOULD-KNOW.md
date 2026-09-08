# You should know

**Origin:** Grok 4.6 · 2026-08-26 night. Briefing for the next session —
especially Claude coming back after several days of Grok / GPT-5.6 Sol work.

This is **not** `HANDOFF.md` (index of what is true) and **not**
`NEXT.md` (unclaimed work). Those stay the daily files. This is the
multi-day picture they do not carry: what the product is now, what
shipped after Claude last owned a session, what GitHub still says is
open that is already built, and the decisions you will otherwise
re-litigate.

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

This machine’s Prime is **0.8.0** (102 public daemon commands). Recheck
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
| ⌘1 / ⌘2 / ⌘3 | **Settled 2026-08-25.** ⌘1 Chat only. ⌘2 Notes panel, Browse collapsed. ⌘3 Notes panel, Browse expanded. Stored `viewMode` values unchanged (`editor-only` / `editor-list` / `all`). Fresh vaults default to `editor-list` (C72). |
| Right panel | **Settled 2026-08-25, refined 2026-09-07.** One Notes panel. Compact nav above the selected list. Rail **Inbox** toggles it. Shut Notes leaves a 46px restore rail. No Inbox/Notes tabs, no second right column. |
| Canvas destinations | **Corrected 2026-09-07.** Chat stays the centre. Graph/Mycelium are a Changes-only cell under Notes (ADR-0171), not a place you go instead of chatting. Research is still a centre pane. #39 (graph as an *agent tool*) is still open. |

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
  only.
- **Do not start grafting** until option 2 + first slice are ratified.

### Sessions are furniture, not an overlay

- Left column of Chat. Always on in the chat-centered shell. **#27 closed.**
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
are implemented on main. GitHub still open (no live Prime demo; C18).
Do not redesign the strip again.

- Pills are live, not inert.
- Model + thinking live on the strip (moved off the Prime subhead).
- Thinking is a **menu of every host level** (`get_prime_thinking_levels` →
  Off / Minimal / Low / Medium / High / X-High / Max as offered). Do not
  restore a binary quiet/loud toggle. The model picker lists the same scale.
- Assistant message actions are icon-only with hover tooltips (regenerate,
  copy, save to vault, fork).
- Command argument hints were already in the slash menu.

### Prime verbs that landed in Chat

Implemented on main; GitHub still open until a live Prime demo:

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
- **#24 implemented on main, live check leftover.** Promote writes
  `raw/inbox/{YYYYMMDD}-{slug}.md`. Title from first `#`/`##` or first
  sentence, never a raw timestamp. Frontmatter: `title`, `is_a: Note`,
  `created`, `source: prime-chat-promote`, plus `session` when Chat can
  pass Prime session id/path. Existing `[[wikilinks]]` kept; none
  invented. Same-path refuse + toast
  (`ai.message.saveToVaultDuplicate`). #29 check still runs first.
- **#25** retrieval provenance: still `needs-triage`. Thinnest design
  coverage of the product thesis. There is no memory-loop design doc
  yet (`automatic-memory-consolidation.md` is consolidation only).

### Research as canvas

Not a dialog. `ResearchPanel` `variant="pane"` in the editor slot.
No Chat overlay inside it (no second conversation). Graph and Mycelium
do **not** take the Chat canvas (ADR-0171); Research still does. Book →
Skill is a Generate format (`book-to-skill`) — produces a SKILL.md-shaped
wiki page; does not vendor the upstream repo.

### Mycelium (#11 / #22) — in-app, not a browser

On main. GitHub open until live check.

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
  `on_navigation`. **GitHub #43 still open.**
- Traffic-light clearance native-verified (Sol). Mycelium “white
  screen” was a Suspense flash, not a blank view (C49).
- On macOS, restoring a hidden main window: `app.show()` first, then
  unminimize / show / focus. `lib.rs::focus_main_window` is the path.

---

## 4. GitHub is behind the tree

Close-on-live-check is the house rule. **Do not re-implement an open
issue.** Check `main` and the handoff first.

**Closed on GitHub 2026-08-26:** #27, #29, #31, #34, #42.
(Earlier that window: #28, #30, #33.)

**Implemented on `main`, issue still OPEN:**

| Issue | Why it is still open |
|---|---|
| #11 / #22 | Mycelium live sidecar + real session leftover |
| #24 | Promote one real Chat turn leftover |
| #38 / #9 / #35 / #21 | Composer strip; no live Prime demo |
| #17 / #14 / #18 | Branches / schedules / markers; no live Prime demo |
| #43 | Guard built; issue not closed |
| #40 | Filter answered (ADR-0168); composition not ratified |

**Still actually unbuilt / undecided:** #5 (harness surface spec),
#25 (retrieval provenance), #37 (Save as custom), #39 (graph as tool),
#26 (update Prime in-app), #32 (Windows daemon — pipes exist in Prime
0.7.4+; see `WINDOWS-DEV.md`), #13 (menu-bar roster), #36 (timezone),
#23 (sessions as searchable knowledge), #41 (steer path).

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

1. **Live-check** promote one Chat turn; Research rail then ⌘1;
   Mycelium rail + This run (needs Mindwalk installed). Then close
   #11 / #22 / #24 if they hold.
2. **Do not** start TokenJuice, Switchyard, or harness composition.
3. If choosing freely: ratify composition (§1 of `NEXT.md`), or
   #25 retrieval, or close GitHub issues that are already built
   after a live Prime demo (composer / #17 / #14 / #18 / #43).
4. C28 / C31 whenever the push gate flakes — re-run-and-move-on is
   how they stay unfixed.

---

## 9. Pointers

| Want | Open |
|---|---|
| What is true right now | [`HANDOFF.md`](HANDOFF.md) |
| Unclaimed work | [`NEXT.md`](NEXT.md) |
| Traps | [`CROSS-MODEL-HANDOFF.md`](CROSS-MODEL-HANDOFF.md) |
| Identity / Prime-first | [`IDENTITY.md`](IDENTITY.md) |
| Shell ADR (Chat centre; canvas Qs superseded) | [`adr/0166-chat-centered-shell.md`](adr/0166-chat-centered-shell.md) · [0170](adr/0170-notes-heavy-right-panel.md) · [0171](adr/0171-graph-on-changes-only.md) |
| Doctrine | [`design/harness-doctrine.md`](design/harness-doctrine.md) · ADR-0168 |
| Composition (unratified) | [`design/harness-composition.md`](design/harness-composition.md) |
| Token routing (discuss only) | [`design/token-routing-and-compression.md`](design/token-routing-and-compression.md) |
| Afternoon wrap (now on origin) | [`plans/handoffs/2026-08-26-1718-grok-4-6-research-mycelium-canvas.md`](plans/handoffs/2026-08-26-1718-grok-4-6-research-mycelium-canvas.md) |
| Claude’s last session | [`plans/handoffs/2026-08-24-2122-claude-opus-5-shell-dock-and-next-index.md`](plans/handoffs/2026-08-24-2122-claude-opus-5-shell-dock-and-next-index.md) |
