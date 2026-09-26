# Handoff archive — through 2026-08-20

Every session handoff written before `docs/plans/handoffs/` existed, moved here
verbatim on 2026-08-21 when `HANDOFF.md` was cut back to current state.

**These are not in date order.** Sessions used to insert next to whichever
heading they happened to be reading, which is the reason the split happened:
the newest entry had drifted to third place in a 2156-line file, so "read the
latest handoff" pointed at the wrong one. Nothing has been edited — the order
is preserved exactly as it was, because reordering history to look tidy would
hide how it actually accumulated.

To find something here, search for the date or the issue number. For anything
current, read `docs/HANDOFF.md`.

---

## Session handoff — 2026-08-20d (visual frontend audit)

**State:** `main` was `98bff09` at session start (`origin/main`). Prime
**0.7.4**. Daemon was restarted off `orphan-file` before the walk. Tree
should only gain the audit doc + this header.

**Shipped this session:** the punch list, not code.
`docs/plans/2026-08-20-frontend-ui-audit.md`.

Walked `pnpm tauri dev` with cua-driver (Cursor IDE cannot see the window).
Atticus's glance was right: no sessions column on Chat home, Goal jumps to
the far right on a live session, traffic lights share a vertical band with
the Chat rail icon, and the 46px rail is icon-only with no expand.

**Next session: one visible chrome fix**, not candidate 4. Ranked in the
audit: (1) expandable rail or labels, (2) sessions list as the default left
column (#27), (3) traffic-light y, (4) Goal not `justify-between` against
the meter. #28 (Untitled) and #26 (no `prime-agent update` button) confirmed.
grok-4.6 shows in the live strip; jsonl `xai/grok-4.6`.

Menu-bar roster was not visually re-checked (companion window off-screen).
Do not build on `observe`. Do not start candidate 4 until the column exists
or is explicitly deferred.

**Then:** candidate 4, attached `get_model_catalog` probe, C34, #26–#29.

---

## Session handoff — 2026-08-20c (frontend UI audit is next)

**State:** `main` in sync with `origin/main` at `34b840e`. Tree clean (ignore
`.cursor/`). All six commits from 2026-08-20b **were pushed** — the header
below still says they were not; that is stale. Gates: 5482 frontend tests,
88.05% lines; 1534 Rust tests, 85.29% lines; 26 Playwright smoke. Prime
**0.7.4**.

**Daemon when this was written:** `orphan-file` — restart before anything
that talks to Prime:

```bash
prime-agent shutdown --force
prime-agent --mode daemon >/dev/null 2>&1 &
sleep 2 && prime-agent status
```

**Shipped today (already on origin):** candidate 3 (`e276738`), Prime surface
gap analysis + probe corrections (`ad27041` `870aedf` `da02b96`), roster
title + waiting-label fix (`34b840e`). Outside the repo:
`~/.prime/agent/extensions/xai-oauth.ts` now lists `grok-4.6` at 500k/500k.

**Next session: visual frontend audit**, not candidate 4. **Done 2026-08-20d**
— see the header above and `docs/plans/2026-08-20-frontend-ui-audit.md`.

Atticus's goal is eyes on the running app so we know what is broken,
half-done, or missing — especially the Prime / chat surface. Playbook:
`docs/plans/2026-08-20-frontend-ui-audit-pickup.md`. Launch `pnpm tauri dev`
with the screen unlocked, walk AI panel → roster → history → vault sanity →
agent settings, score each screen, write
`docs/plans/YYYY-MM-DD-frontend-ui-audit.md`. Do not fix-as-you-go unless
the screen is lying in one line.

Cursor IDE chat cannot see the Rhizome window. SuperGrok Heavy / Cursor Ultra
does not change that. Use computer-use. Grok Bot is a separate app with its
own cloud computer; it is not the audit tool.

**Do not start from `observe`.** Probed: `Unknown daemon command`. The
replacement for live-row status is already on the `list` payload; `34b840e`
fixed the two actual defects. Read the gap doc before inventing transport.

**Then** (after the punch list exists): candidate 4, attached
`get_model_catalog` probe, C34, #26–#29.

---

## Session handoff — 2026-08-20e (Claude Opus 5: unattended run)

**State:** all gates green, pushed. Rust coverage **85.34%**. Prime 0.7.4,
daemon running **detached** (pid 76297) — the previous one was started in a
foreground terminal and died when that window closed. Start it with
`(prime-agent --mode daemon >/dev/null 2>&1 &)`, not in the foreground.

**Shipped:** C34 (roster statuses are keys now, view supplies the words),
**#28 fixed**, the frontend audit committed, the containerized-workers
proposal recorded, and `get_model_catalog` probed attached.

### #28 was never a naming problem

41 of 91 session logs on the real store held **no message of any kind** — five
lines of header, model, thinking level, tier, state. Rhizome opens a session
whenever it attaches to a vault, so every unused launch leaves one. They were
half the history list. `list_sessions` now drops them.

**The root cause is still there:** Rhizome creates a session it may never use.
Creating it lazily — on first prompt rather than on attach — is what stops the
litter, and it changes attach behaviour, so it wants its own change and its own
probe. Filtering the display was the safe half.

### The model picker is not capped

Probed attached: `get_available_models` (ours) returns **185** models for the 4
providers with credentials; `get_model_catalog` returns **1252** across 20+
including `openrouter` 289 and `vercel-ai-gateway` 220, plus
`configuredProviders`. The two answer different questions and ours is the right
one. The opportunity is showing what connecting a provider would unlock — a
BYO-model surface, not a wider list.

### Chat home has a left column now (#27, first half)

`sessionsOpen` defaults to open and the choice persists per machine
(`rhizome:chat-sessions-open`). Atticus chose sessions-open over an expandable
icon rail when asked.

**Verified in a browser, not just in tests.** `pnpm dev` serves the whole app
against `mock-tauri`, so Chat home can be driven without the native window —
this is a much cheaper verification loop than `pnpm tauri dev` + cua-driver and
nothing in this repo's docs mentioned it. Confirmed on screen: no stored
preference lands with the SESSIONS column beside the transcript; closing it
writes `0`, survives a full reload, and Chat home honours it; clearing the key
returns to open.

Still true from the audit and visible in those screenshots: the rail is
icon-only (item 1), and the Goal button sits far right of the composer row
against the context meter (item 4).

### Next, and why not most of it

Untouched: traffic-light `y` (audit item 3) and the Goal button's two homes
(item 4). Both are visual judgements about a native window — the traffic lights
do not exist in the browser preview at all, so the cheap loop above cannot
settle either one.

The rail (audit item 1) is still icon-only. With the sessions column now
carrying the left side of Chat home, labelling the rail is a smaller and less
urgent change than it was when it was the only chrome there.

---

## Session handoff — 2026-08-20b (Claude Opus 5: candidate 3 finished)

**State:** this header was written before push. The work **did land** as
`6ce86d1..34b840e` on origin. Rust coverage **85.29%**. Prime **0.7.4**.

**Shipped:** `e276738` — the remaining fifteen envelope sites folded onto
`PrimeHost::call`. Candidate 3 is **done**; nothing is left of it but the
deliberate exclusions listed below, which are policy sites and should stay.

Five error-path tests were written first as a safety net (refused model list,
refused command list, refused compact, successful compact, refused
auto-compaction toggle). Characterization, not red-green: the refactor changed
no behaviour, so there was no failing state to start from. **12 of 24 envelope
sites still have no error-path test** — was 16.

**Next:** read `docs/plans/2026-08-20-prime-surface-gap.md` before more harness
work. Prime ships 35 docs with every install
(`~/.local/lib/node_modules/prime-agent/docs/`), verified current against
upstream `main` on 2026-08-20. Reading them turned up an `observe`/`unobserve`
command that is the missing half of #13 and #27, a #14 that can watch and
cancel scheduled work but never create it, and agent-to-agent messaging and
autonomous mode with no desktop surface at all.

**Two recorded findings were wrong** and are corrected in that doc: 0.7.4
*does* ship `xai/grok-4.6` (an extension's `registerProvider` replaces the
provider's built-in model list — that was the bug, since fixed locally), and
`sessionName` is not "never sent" — it is omitted until `set_session_name` is
called, which nothing in our tree does.

Then candidate 4, revised — one producer for `thinking_level`, detailed under
"Ranked pickup" below (that list's item 1 is now done).

---

## Session handoff — 2026-08-20 (Claude Opus 5: architecture review, verified)

**State:** `main` in sync, tree clean, all gates green. Rust coverage **85.12%**
(up from 85.03% two sessions ago). Prime **0.7.4**, daemon restarted onto it.

**Shipped:** `53e8131` (review candidate 1 — `src/lib/callHost.ts`) and
`41bb8cb` (candidate 3, first half — five sites where a daemon refusal read as
an empty answer).

### The method that mattered: verify a review before building on it

Atticus ran an architecture review over the Prime harness surface (report in
`$TMPDIR/architecture-review-*.html`). Before implementing, three independent
agents re-derived candidates 3, 4 and 5 **from the code, without being told what
the review concluded**. All three disagreed materially, and every correction made
the work smaller and safer:

- **Candidate 3** — 24 envelope sites, not the 18 I had grepped. Plus five that
  never check `success` at all, which nobody had surfaced. And a warning that
  mechanically folding `refresh_session_id` / `cron_list` would turn a
  deliberately degraded section into a hard error across a panel.
- **Candidate 4 — reversed.** Do **not** merge the three poll commands.
  `get_status` does *no daemon RPC* (cached fields); `agent_activity` does two
  round-trips. Merging makes the cheapest, most-watched signal hostage to the
  slowest — at a 30s timeout the strip freezes for the length of a stall.
  *Differing rates is a weak argument; differing failure blast radius is the
  strong one.*
- **Candidate 5 — reversed.** Do **not** extract the panel handlers yet.
  Moving ~110 lines with zero tests is refactoring with no safety net. Write
  ~120 test lines first using the harness that already exists
  (`AiPanelView` takes `controller`; `QueuedPromptTargetHarness` at
  `AiPanel.test.tsx:88-137`; `mock-handlers.ts:567-601` already implements all
  seven commands).

**Do this again.** A review with no independent check has soft numbers — this
one said "40 times" (41), "five sites skip mockInvoke" (its own markup drew
seven), and called a Tauri-only component "divergent" when it matched its
neighbours. Structurally it was right every time; its counts were not.

### What is left of candidate 3

`PrimeHost::call` exists and is used by the five fixed sites. **~15 repetitive
sites remain to fold onto it** — a mechanical follow-up. Do **not** convert:
`abort_turn` (manual slot lock, returns bool), `read_roster_over` (no host
exists), both `run_prompt_stream` paths (emit events; one runs outside
`with_host_mut`), `switch_session` (maps `session_already_active` to real user
advice), or `connect`'s shutdown-then-error (a resource decision). In each, the
error *policy* is the point.

**Still uncovered: 16 of 24 envelope sites have no error-path test.**

### Ranked pickup

1. **Candidate 3, second half** — fold the ~15 remaining sites onto
   `PrimeHost::call`. Mechanical, Rust-only.
2. **Candidate 4, revised** — one producer for `thinking_level`. It exists twice:
   `PrimeHostStatus.thinking_level` (cached, written only via
   `refresh_session_id`, i.e. after a turn or explicit set) and
   `PrimeAgentActivity.thinking_level` (live, every 15s). They diverge on any
   agent-initiated change, second client, or in-prompt directive — the band
   updates, **the picker label stays stale until the next turn ends**. `7c5f7c9`
   only fixed the explicit-set path. Cheapest fix: have `agent_activity` write
   its live value into the host cache, then delete `7c5f7c9`'s forced refresh.
   Also: `usePrimeHostStatus` is mounted by **three** components
   (`ChatHome.tsx:59`, `AiPanel.tsx:225`, `App.tsx:1253`) — three 4s timers on
   one mutex. Put it behind context.
3. **Candidate 5, revised** — the ~120 test lines described above.
4. **#26 / #28 / #27 / #29**, then candidate 2 (last, reduced scope).

Full detail: `docs/plans/2026-08-19-harness-surface-and-architecture-review-session-status.md`
and the plan at `~/.claude/plans/unified-splashing-puddle.md`.

---

## Session handoff — 2026-08-19b (Claude Opus 5: #9, #14, C12, architecture review)

**If you are not Claude, read `docs/CROSS-MODEL-HANDOFF.md` first.** Then this entry.

**State:** `main` in sync with `origin/main`, tree clean, all gates green.
13 commits, `e75a161..53e8131`. Prime is on **0.7.4** and the daemon was
restarted onto it.

**Shipped:** C29 (verified independently before landing), **#13**, **#9**,
**#14**, and architecture-review candidate 1 (`src/lib/callHost.ts`).
**#19/#20** closed. **C12 closed** — the PAT is revoked and all 78 local
copies across 11 transcripts were redacted.

### Read this before writing a feature

**Every real bug this session was found by Atticus using the app; none by the
suite.** Three for three — #13 shipped with two rows both reading `dtc`, #9
shipped where picking a thinking level never updated the strip, and #14's read
path had been broken since it was written. The shape is always the same: **the
tests assert the right request went out on the wire, never that the resulting
screen is one a person can act on.** #9 even had a passing test proving the
command was sent with the right level. Write at least one assertion per feature
about what the user ends up seeing.

**Probe-first paid for itself four separate times** (§18 of
CROSS-MODEL-HANDOFF, now with a fifth and sixth instance). `sessionName` is
declared and never sent; `heartbeats_list` wraps jobs in a `{"job": …}`
envelope; `schedule` is an object not a string; and `model_catalog` is
advertised in `serverCapabilities` but answers `Unknown daemon command`.
**Advertised is not routable — check `daemon-mode.js` for a real `case`.**

### Architecture review — candidate 1 done, do 3 then 4

Atticus ran a review over the last 60 commits of the Prime harness surface.
Candidate 1 (one adapter seam) shipped as `53e8131`. Next, in its recommended
order: **3 — absorb the daemon envelope** (self-contained, Rust-only, the
`success`/`response_error`/`data` triple repeats verbatim in 18 functions),
then **4 — one harness snapshot, one poll** (three pollers, one global mutex,
and `thinkingLevel` served by two commands — which is the structural cause of
the bug `7c5f7c9` patched symptomatically). Full detail in the session-status
doc.

### Environment traps that cost real time

- **`prime-agent update` does not restart the daemon.** The CLI reports the
  new version while `status` shows the old one flagged `stale`. Use
  `prime-agent shutdown --force` (plain `shutdown` refuses without a TTY).
- **The model catalog is baked into the installed bundle**, so the picker is
  capped by the installed Prime version.
- **Model and thinking level are per-session**; new sessions start from
  `~/.prime/agent/settings.json`.
- **Agent-driven native QA needs the screen unlocked.** cua-driver reporting
  `desktop_unlocked: false` means capture returns black while `list_windows`
  still works — it reads as a code failure and is not one.
- **Never ask a model what model it is.** It claimed to be Claude while served
  by `big-pickle`. Read `provider`/`model` off the assistant message in
  `~/.prime/agent/sessions/*.jsonl` instead.

### Ranked pickup

1. **Architecture candidate 3** — absorb the daemon envelope. Rust-only, no
   cross-cutting risk, and it shrinks the file that dominates uncovered lines.
2. **#26** — update Prime from inside Rhizome. `prime-agent update` already
   exists; only the button is missing.
3. **#28 / #27** — the history list is half empty sessions all rendering
   "Untitled"; #27's filter dissolves most of it.
4. **#29** — redact credentials before chat content is committed to the vault
   and pushed. The detector exists; it is wired only to telemetry.
5. **C33** — `npx tsc --noEmit` typechecks no test file at all.

Detail: `docs/plans/2026-08-19-harness-surface-and-architecture-review-session-status.md`.

---

## Session handoff — 2026-08-19 (Claude Opus 5: #13 menu bar roster)

**If you are not Claude, read `docs/CROSS-MODEL-HANDOFF.md` first.** Then this entry.

**State:** `main` in sync with `origin/main`, tree clean, all gates green.
`stash@{0}` from C29 was dropped; the stash list is empty.

**Closed this session:** #19 and #20 (both shipped earlier but left open —
closed with commit evidence), and **#13**, the menu-bar running-session list.

**#13 is DONE, native demo included.** The popover was run for real and
rendered the RUNNING section beneath quick capture with four live sessions.
(An agent-driven attempt had failed first with `ScreenCaptureKit ...
audio/video capture failure` and a black desktop grab while both TCC grants
showed present — a locked or sleeping display. Check the screen is awake
before spending anything on agent-driven native QA.)

**That first real screenshot immediately found a defect the whole test suite
had missed:** every row rendered a *cwd folder name* instead of a title,
because none of the running sessions had a `firstMessage` (a session with no
messages has none) — and two shared `~`, so two rows both read
"dtc", identical and impossible to tell apart. Colliding titles now get the
short session id appended. The lesson is cheap to reuse: the fixtures all set
`firstMessage` because that is the interesting case to write, so the fallback
path — the only one production actually took — was never exercised for
uniqueness.

**#13's shipped behaviour.** Quick capture is
unchanged and still first; running sessions list beneath it with what each is
doing; subagents are a count, not a tree; clicking a row opens the main window
onto that session; nothing running renders nothing at all — no heading, no
empty frame. **Not demonstrated: the popover driven natively with the main
window closed and real work running.** Everything else is covered by unit,
component and live-daemon tests. Do that demo before calling #13 closed.

**The probe rule paid for itself again (§16).** `sessionName` is declared in
`daemon-session-list.d.ts` and is **never sent** by a live daemon — a row title
built on it renders blank for every real session. Titles fall back to
`firstMessage`. See `docs/plans/2026-08-19-menu-bar-running-sessions-session-status.md`.

**⚠️ Rust coverage is at 85.03% against an 85% gate** — down from 85.26%,
roughly five lines of headroom. New `#[cfg(desktop)]` command wrappers are not
unit-testable and ate the margin. Budget tests with any new Rust or you will
break the push gate for everyone, exactly as C27 did for weeks.

**One thing standing on read source, not a probe:** subagent parentage
(`parentActiveSessionId`). No subagents were running to observe, so the counts
follow the daemon's `buildRlmChildSnapshots`. First place to look if counts
read wrong.

### Ranked pickup for the next model

1. ~~C12~~ — **resolved 2026-08-19**: revoked server-side, and all 78 local copies
   across 11 transcripts redacted. See the C12 entry below.
2. **#14** — schedules and heartbeats. `heartbeat_catalog` /
   `heartbeat_management` are already advertised as daemon server capabilities,
   and `heartbeats_list` / `cron_list` are already spoken by the client.
3. **#14** — schedules and heartbeats. `heartbeat_catalog` /
   `heartbeat_management` are already advertised as daemon server capabilities,
   and `heartbeats_list` / `cron_list` are already spoken by the client.
4. **#21** stays blocked until Prime supplies skill argument hints.

---

## Session handoff — 2026-08-16g (Grok 4.6: C29 Cmd+N note list)

**If you are not Claude, read `docs/CROSS-MODEL-HANDOFF.md` first.** Then this entry.

**State:** C29 shipped and pushed; tree clean, all gates green. No Rust changed.
`stash@{0}` ("C29 partial") is superseded by this commit and safe to drop --
left in place deliberately so a human decides, not an agent.

Independently re-verified 2026-08-19 (Claude Opus 5) before the push: the
18/18 claim below reproduces. One environment trap on the way -- Playwright
had been updated without its browser binary, so the whole spec failed 18/18
with `Executable doesn't exist ... chrome-headless-shell` and looked exactly
like a total C29 regression. It is not one. Run `pnpm exec playwright install
chromium` and re-run before believing a uniform smoke failure.

**C29 is RESOLVED.** `tests/smoke/fix-crash-create-note.spec.ts` went
**18/18** across 6 consecutive isolated runs with `--retries=0` (Cmd+N,
type-section +, command palette). Unit coverage: 101 vault-loader tests.

The stashed "protected paths" lead was right about the stale scan, and
incomplete in two ways that kept the ~33% flake after the first attempt:

1. **Load-reset cleared the protection set.** `resetInitialVaultLoadState`
   called `tracker.clear()` on every vaults-arrived effect re-run, so the
   reconcile step had no paths left to keep. It now skips that clear when
   workspace entries are being preserved.
2. **Restore only looked at current `entries`.** If a reset emptied the
   list first, there was no dropped row to put back. `addEntry` now stores
   the optimistic `VaultEntry` in a ref; reconcile restores from that map
   when the stale snapshot is missing the path. Restore is scoped to the
   workspace being replaced so a note in workspace B is not duplicated
   when workspace A's scan resolves.

A third, smoke-only, trap: Vite fixture timestamps were `mtimeMs` (ms).
Inbox sorts `createdAt` desc, so fixture notes landed in year ~58595 and
a correctly-seconded new note sank off the Virtuoso viewport — the list
looked unchanged even when the entry was present. `vite.config.ts` and
`scripts/serve-demo.mjs` now emit unix seconds, matching Tauri.

**Do not drop the `@smoke` tag or widen the wait.** The spec was right.

### Ranked pickup for the next model

1. **C12 — rotate the exposed GitHub PAT.** Security; needs a human.
2. **#13 / #14** — menu bar dropdown, schedules + heartbeats.
3. **#21** stays blocked until Prime supplies skill argument hints.
4. Drop `stash@{0} "C29 partial"` — superseded.

Detail: `docs/plans/2026-08-16-c29-note-list-session-status.md`.

---

## Session handoff — 2026-08-16f (docs handoff close-out; next model picks up C29)

**If you are not Claude, read `docs/CROSS-MODEL-HANDOFF.md` first** — especially
§18 (probe-first against Prime). Then this entry.

**State:** `main` in sync with `origin/main` after this docs push, tree clean.
Top of history before the docs commit was `e518b0c`. All pre-push gates were
green on that tip. `git stash list` still holds
`stash@{0} "C29 partial (debug logs, unverified)"` — deliberately not shipped.

### What the previous coding session actually closed

- **#10** and **#16** are **CLOSED** on the tracker with live-daemon evidence
  (slash menu + origin filter excluding ~89 personal skills).
- **#20** goal set/replace/clear and the **#15** goal-band data-source fix
  shipped (`a816dba`). #15 had been silently dead: it read `get_state.goal`,
  which the daemon never sets; correct source is `get_connection_state`.
- **#19** version indicator shipped (`f8f7fe5` + null-guard `5ad4de7`). Issue
  may still show OPEN on the tracker until closed with evidence — the code is
  on `main`.
- **#21** argument hints were **built but left OPEN on purpose**: on Prime
  0.7.2 the daemon supplies no `argumentHint` for skills, so the UI correctly
  renders nothing. Blocked on Prime, or on Rhizome ingesting prompt templates
  as a second command surface.
- **C27** (Rust coverage floor failing on `origin/main`) and **C28** (smoke
  auto-navigation race) are **RESOLVED**.
- **C29** (Cmd+N note list never refreshes) is **OPEN** with a known root
  cause and a stashed partial fix — see the C29 entry and ranked pickup below.

### Two things dormant, not broken

- Rhizome's updater is a stub: `app_updater.rs` returns `Ok(None)` — no
  signing key / release feed. #19's Rhizome half cannot fire until signing
  exists.
- `prime-agent` is not on npm (`registry.npmjs.org/prime-agent` 404s). #19's
  Prime signal uses GitHub releases instead.

### Follow-ups recorded this close-out (not decisions to re-litigate)

- **#19 PostHog gap.** The version indicator shipped without instrumentation.
  The implementing subagent flagged this rather than hiding it. Add an event
  when someone next touches that surface; do not mistake the omission for a
  product decision.
- **C30** — `window.__tolariaFrontendReady` residue (see Open threads). Live
  and correctly used by smoke helpers; tracked so it stops being rediscovered
  as an unnumbered leftover from the C21 rename sweep.

### Ranked pickup for the next model

1. **C12 — rotate the exposed GitHub PAT.** Security; needs a human.
2. **C29 — Cmd+N note list.** Root cause in HANDOFF Open threads; partial fix
   in `git stash@{0}`. Strip `console.debug`, verify across **≥6 consecutive**
   runs of `tests/smoke/fix-crash-create-note.spec.ts` (bug is ~30–40%
   intermittent — one green run proves nothing).
3. **#13 menu bar dropdown / #14 schedules + heartbeats.** Remaining harness
   surface bulk.
4. **#21** stays blocked until Prime supplies skill argument hints (or Rhizome
   grows a second command surface from prompt templates).

### Standing rules (do not relearn)

- Never `--no-verify`. Probe Prime live before building against it (§18).
- Localization **waived for v0** (C18) — do not run `pnpm l10n:translate`;
  English copy still goes in `en.json`.
- This is **Rhizome Agent** (`ai.rhizome.agent`), not Desktop.
- Vite mock returns one canned reply for every prompt — use `pnpm tauri dev`.
- Subagent "tests pass" is not evidence; demand full `pnpm test` +
  `cargo fmt --check`.
- Rust coverage headroom above 85% is ~40 lines — do not add untested Rust
  casually.
- Export `LLVM_COV` / `LLVM_PROFDATA` before any push (Homebrew llvm; no rustup).

Detail: `docs/plans/2026-08-16-harness-surface-session-status.md`.

---

## Session handoff — 2026-08-16e (Claude Opus 5: full pre-push, C27, pushed)

**State:** `main` = `6c1edcc`, **pushed — `origin/main` in sync, ahead 0**,
tree clean. The 08-16d entry below is still the reference for *what the slash
menu does*; its "ahead 6, not pushed" line is now historical.

**The full pre-push suite ran for the first time in several sessions** and all
six steps passed (5m26s): lint, `tsc --noEmit`, 5342 frontend tests @ 84.65%,
13 MCP tests, 1449 Rust lib tests @ **85.09%**, 26 Playwright smoke @ 1.8m.
CodeScene step self-skips (no PAT — expected, dropped 2026-07-09).

**Two real problems found, both fixed:**

1. **C27 — the Rust coverage gate was already failing on `origin/main`**
   (84.87%), blocking every push regardless of what a session changed. Proven
   by building and covering a detached worktree at `origin/main`, not assumed.
   The slash-menu branch was **not** the cause — it added 88 executable lines
   with 72 covered, above repo average, moving the total 0.01pp. Fixed to
   85.09% in `c1d28c8`. **Headroom is ~36 lines** — see the C27 entry.
2. **`cargo fmt --check` failed** on 08-16d's `get_prime_commands` in
   `commands/ai.rs`. Single missed `cargo fmt`, nothing else in `src-tauri/`
   was unformatted. Fixed in `3639dad`. That session's Rust *logic* is sound:
   `get_commands()` matches its sibling `get_available_models()` structurally,
   and clippy is clean at `-D warnings`.

**Do not diagnose a coverage failure via `CROSS-MODEL-HANDOFF` §13 without
re-measuring.** §13 was the first explanation reached for here and it was
wrong — it describes `--no-clean` reporting *falsely* low, but clean and
`--no-clean` agreed to within 0.02pp. §13 has been amended, and its snippet
fixed (it omitted `--manifest-path` and simply errored).

**Unchanged, still not done — #10 and #16 remain OPEN** (verified via `gh`,
not inferred): export unwired, no live native demo against a real Prime
daemon, fork-from-menu unproven end-to-end, #21 not started, C18 unchanged.
Nothing about this session's gate work advances that acceptance.

Detail: `docs/plans/2026-08-16-coverage-gate-session-status.md`.

---

## Session handoff — 2026-08-16d (Hermes: #10 + #16 slash menu — partial)

**If you are not Claude, read `docs/CROSS-MODEL-HANDOFF.md` first.** Then this
entry. Claude's 08-16c Hermes-research block below still holds for architecture
context; its "concrete next task" for #10+#16 is what this session started.

**State:** `main` = `10b4cd3`, tree clean, **ahead 6 of `origin/main` — not
pushed.** Full pre-push was **not** run this session (focused vitest + eslint
only). #6/#7/#8/#12 status unchanged. Tracker issues **#10 and #16 still OPEN**
— do not close them from this handoff alone.

### What shipped (REAL)

Six local commits after Claude's docs handoff `2272492`:

| SHA | What |
|---|---|
| `a5598f1` | Origin filter: keep `sourceInfo.source === builtin` and `auto`+`project`; drop user auto skills; fail closed if no `sourceInfo` |
| `e934441` | `/` token detector (not dates/paths); match; seed fork+compact as instant |
| `f7c94df` | Apply pick / Escape leave slash |
| `e9f40e5` | Host `get_commands` parser + Tauri `get_prime_commands` + mock |
| `175472b` | Composer overlay: `ChatCommandMenu`, wire through `InlineWikilinkInput` → composer → `AiPanel` |
| `10b4cd3` | Fix: menu reopens after a pick (dismiss-key collision on bare `/`) |

**Live probe (isolated daemon, not default service):** Prime **0.7.2**, protocol
7. `get_commands` → **101** skills: **89** `auto`+`user` under
`~/.agents/skills`, **11** `builtin`, **1** project `skill:rhizome-vault`.
Shape is `sourceInfo.{path,source,scope,origin}` — **not** the flatter
`source`/`location` still in Prime's docs. Dump was at
`/tmp/rhizome-get-commands-probe.json` (ephemeral).

**Product behavior now:**

- `/` anywhere as its **own token** opens the menu (not only position 0).
- Dates (`2026/08/16`) and paths (`src/lib/foo`, `/usr/bin`) do **not** open it.
- Menu = protocol **fork** + **compact** + filtered skills (builtins + project
  rhizome-vault). User personal skills excluded.
- Skills → send as prompt text `/name` (clears the composer token).
- **Compact** → `compact_prime_session` IPC + local transcript marker.
- **Fork** → listed, **disabled** until a replayed turn has `primeEntryId`
  ("Needs a past message to branch from").
- Escape dismisses menu, leaves `/`, does **not** close the AI panel
  (`defaultPrevented` on panel Escape handler).
- Skills vs instant visually distinct (Skill / Command labels).
- `en.json` keys under `ai.command.*` — **English only**, LARA unfunded (C18).

**Key files:**

- `src/lib/primeCommandMenu.ts` — filter, trigger, match, apply
- `src/hooks/usePrimeCommandMenu.ts` — loads `get_prime_commands`
- `src/components/ChatCommandMenu.tsx` — overlay list
- `src/components/InlineWikilinkInput.tsx` — shares cursor with `[[`
- `src/components/AiPanel.tsx` — run compact / skill send / fork gate
- `src-tauri/src/prime_session_host.rs` — `get_commands` / types
- `src-tauri/src/commands/ai.rs` — `get_prime_commands`

### What is NOT done

- **#10 / #16 acceptance incomplete.** Issues still open. Missing:
  - **Export** — ticket named it; no host `export_html` wiring; deliberately
    dropped from the menu this session so we don't ship a dead entry.
  - **Live native demo** against real Prime (daemon). Vite mock only.
  - Full pre-push (tsc -b, cargo coverage, playwright smoke) + **push**.
  - Closing GH issues with evidence.
- **Fork click path** not proven end-to-end from the menu (disabled until
  rehydrate brings a `primeEntryId`).
- Argument hints (#21) not started.
- Locale translate not run (C18).

### Critical gotcha — Vite vs real Prime (user hit this)

Vite preview (`pnpm dev` / `:5202`) uses **`streamAiAgent` mock**. Every
skill/prompt returns the same canned line:

`[mock-prime agent] You said: "/whatever" — This note is related to [[Build Laputa App]] and [[Matteo Cellini]].`

That is **not** skill execution. Proving skills/commands need **`pnpm tauri
dev`** (or the built app) with Prime's daemon up. Do not diagnose "skills
broken" from mock replies.

### Bug fixed mid-session (do not reintroduce)

After picking a command from a bare `/`, dismiss state was keyed `0:`. The
next bare `/` is the same key → menu stayed closed. Fix: clear token on pick
**and** reset dismiss state (`10b4cd3`). Regression test: *opens again on a
new slash after a command ran*.

### Process notes for the next agent

- Session started from Claude's handoff paste; intake verified
  `2272492` then built. Early stretch was library-only without UI — recovered
  into overlay + host IPC. User asked for a break; stop here.
- **Do not claim #10/#16 closed.** Partial surface + mock QA only.
- Push when ready: set `LLVM_COV` / `LLVM_PROFDATA`, full pre-push, then push.
  Standing rule: push when gates pass; no ask required.
- Optional next: native look (compact + fork after reattach), wire export, or
  Tier 1 rest (#13 menu bar) / Tier 2 #24 promote quality.

### Still true, unchanged

C18 LARA. Transcript read no retry (#7). Uptime/#8 never by eye. C24/C25 open.
#12 menu-bar half still open. Hermes research / ADR-0163 asymmetry still
valid (see 08-16c below).

---

## Session handoff — 2026-08-16c (Hermes research; next agent may not be Claude)

**If you are not Claude, read `docs/CROSS-MODEL-HANDOFF.md` first** — it lists
traps a prior session already hit here. Then this entry, then the plan of
record below it.

**State:** `main` = `901c324`, tree clean, nothing unpushed. #6, #7, #8 closed
on the tracker with evidence. #12 partly shipped (open for its menu-bar half
only). #23/#24/#25 opened for memory. Vocabulary reversed in `CONTEXT.md` —
**agent now means Prime**, the runtime; Rhizome is named, never called "the
agent".

### Hermes research — the comparison that matters

Wiki page: **`sources/repos/nousresearch-hermes-agent.md`** in the Rhizome
Vault ("Reusable Patterns from Hermes Agent's Multi-Surface Architecture", 7
patterns). Generated by `rhizome_repo_research` mode=reusable-patterns
depth=fast — `regular` depth timed out (`spawnSync ETIMEDOUT`). A full clone
sits at `.rhizome/repo-cache/nousresearch-hermes-agent` for verification; four
claims were spot-checked against it and held.

**⚠️ The wiki page's own caveat:** the agent loop internals
(`run_conversation()`, `handle_function_call()`) were **not read directly** —
those descriptions reflect Hermes's `AGENTS.md`, not verified code. Verify
before acting on patterns that depend on them.

**Architecturally Hermes Desktop is what we built today**, which is a useful
confirmation of ADR-0163:

| | Hermes Desktop | Rhizome |
|---|---|---|
| Shell | Electron + React | Tauri + React |
| Runtime | `hermes serve` subprocess | Prime daemon |
| Wire | JSON-RPC / WebSocket (`tui_gateway`) | JSONL over unix socket |
| Coupling | **Same monorepo, lockstep** | **Third-party, BYO** |

**The asymmetry is the finding: Hermes does not have our problem.** Desktop
lives at `apps/desktop` in the CLI's own repo and ships in lockstep — *"the
desktop is not a fork, it is another surface over one shared agent core."* No
version skew is possible. Ours is a real, permanent problem, which makes **#8
and #19 load-bearing here in a way their equivalents are not there.**

**Two things they do that we do not:**

1. **A richer resolution ladder** — env var → local dev checkout → managed
   install in `HERMES_HOME` → `PATH` → *bootstrap installer*. Ours stops at
   "tell the user to install it" (`prime_session_host::daemon_socket_path`).
2. **Managed install into the standard location.** The desktop can install the
   runtime itself, *into the same layout a CLI install uses*, **"which is why
   the two are interchangeable."** BYO and managed converge instead of forking.
   This is the concrete steal: it turns #8's worst first-run state from a dead
   end into one click. It **collides with #5's out-of-scope line** ("Bundling
   Node or `prime-agent` in the installer. BYO Prime stands") — but
   install-on-demand is not bundling, and it needs a decision, not a silent
   reinterpretation.

**Where we deliberately differ, and it is correct.** Hermes degrades
gracefully: *"runtimes older than the `serve` command fall back to a headless
`dashboard --no-open` automatically, so an app update never outruns its
backend."* We hard-refuse below protocol 7 (#8). Not a contradiction — **they
can degrade because they own both sides**; their fallback is an older API of
their own product and preserves function. Ours would have been RPC mode, a
different transport missing two-thirds of the harness. ADR-0163 stands.

**Patterns that map onto queued tickets:**

- **Patterns 1 + 3 are close to a spec for #16.** (1) A *footprint ladder* —
  new capability escalates through cheap rungs before touching the shared tool
  schema. (3) *Decentralized registration, centralized exposure* — a tool may
  **exist** via auto-discovery but is only **live** on a surface via one
  explicit, human-edited wiring file. That is the mechanical form of "Prime's
  commands + Rhizome skills, never the user's" — a greppable file instead of a
  rule in prose.
- **Pattern 2 is C26, independently arrived at.** Hermes treats prompt-cache
  stability as a hard invariant with exactly one sanctioned mutation path. We
  just fixed a bug from treating the composed prompt as disposable. Worth
  writing our own version down before someone breaks it differently.
- **Pattern 6 → #14.** Per-subsystem isolation invariants: a hanging heartbeat
  and a double-firing cron job are different failures wanting different
  guards, not one shared "automation safety" rule.
- **Pattern 4** warns against splitting extension points preemptively — keep
  in mind before #11/#22 gets designed.

### Concrete next task for a coding agent

**#10 + #16 together** (Tier 1 below). They are one piece of work: build the
slash menu without the filter and it renders ~89 of Atticus's personal skills
into the product. Only ~11 of the ~100 `get_commands` entries are Prime's own.

The filter is mechanical, not a judgement call. A personal skill arrives as:

```json
{"name": "skill:ask-matt",
 "sourceInfo": {"path": "~/.agents/skills/ask-matt/SKILL.md",
                "source": "auto", "scope": "user"}}
```

Drop `source: "auto"` + `scope: "user"` under `~/.agents/skills`. Keep Prime's
built-ins and the `rhizome-vault` skill Rhizome seeds. **Probe
`get_commands` against the live daemon before coding** — the shape above is
from a real probe, but Prime's docs lag its build and this repo has been
bitten by that four times.

**Alternative if you want the differentiated half:** **#24** (promote
quality). Editorial, not mechanical — promote three real conversations, read
what lands, judge whether they are notes you would have written. No test suite
can answer that.

### Still true, unchanged

Six locale keys English-only (C18, deferred). Transcript read has no retry
(#7). Uptime strip and #8's copy verified by tests and data path but **never
by eye**. C24/C25 open from earlier sessions.

---

## Plan of record — 2026-08-16 (re-ordered under the reframe)

**Tracker is now accurate.** #6, #7, #8 closed with evidence. #12 annotated —
partly shipped, open only for its menu-bar half, and its first acceptance
criterion is recorded as *wrong* rather than outstanding. Open: #5 (spec),
#9–#22, plus **#23–#25 (memory, new)**.

**The gap the reframe exposed.** Every one of the 13 remaining #5 tickets is
harness *surface* — rendering Prime's controls in a window, which Prime's own
TUI already does. Meanwhile the differentiator had **no forward roadmap**:
#1–#4 shipped the memory loop on 2026-08-09 and nothing has been ticketed
since. "The overcoat of tooling and really good memory" had thirteen tickets
for the tooling half and zero for the memory half. Hence #23–#25.

**Vocabulary settled (`CONTEXT.md`).** **Agent** now means the runtime that
does the work — **Prime**. It previously meant the Rhizome product, which put
the shell where the figure belongs. Rhizome is referred to by name, never as
"the agent". `Session` still means a running unit; `worker` stays in the
transport; the legacy `agent backend` row is the last competing sense and is
renamed on contact. The word "Agent" in the *app's name* is a separate open
naming question and does not govern the common noun.

### Order of work

**Tier 1 — the shell must not be worse than the terminal**
- **#10 + #16 together.** The slash menu is the biggest "worse than the TUI"
  gap, and #16 is not optional alongside it: without the origin filter, #10
  leaks ~89 of Atticus's personal `~/.agents/skills` into the product. Only
  11 of the ~100 `get_commands` entries are Prime's own.
- **#13, which also closes #12.** A menu bar dropdown is genuinely
  desktop-native — the one thing a terminal cannot do — and it is the surface
  #12's remaining half needs.

**Tier 2 — memory, the differentiated half**
- **#24 promote quality.** Editorial, not mechanical: promote three real
  conversations and read what lands. A test suite cannot tell you the notes
  are bad.
- **#23 session search.** The largest body of knowledge the product generates
  is currently unfindable.

**Tier 3 — integrity and supervisor visibility**
- #18 transcript markers (cheap, high integrity), #19 version indicator (pairs
  with the finished #8), #14 schedules visible — which #12 now *needs*, since
  a user can keep sessions alive for scheduled work but cannot see it.

**Tier 4 — the RLM story**
- #15/#20 goals, #17 branch navigation, #9 model+thinking consolidation (lower
  than it looks — a working model picker already ships).

**Tier 5 — deferred**
- #11/#22 Mycelium, #21 argument hints, #25 retrieval provenance (triage
  first — the design question decides whether it is a day or a week).
  **Note:** #23 may be the better answer to the question #11/#22 were asked
  to solve; settle that before building Mycelium twice.

---

## Session handoff — 2026-08-16b (#12 quit semantics; and a product reframe that outranks it)

**Next: #13 (menu bar dropdown) or the branding mechanism below.** #6, #7, #8
are closed. #12 is closed except its menu-bar half.

### The reframe — read this before picking up any remaining #5 ticket

Atticus, verbatim: *"Rhizome is really just a convenient app that I already
have built that kind of works as a shell for an agent harness like prime
agent. Prime agent as a harness should be the primary figure. Rhizome is just
going to be the nice extra overcoat of tooling and really good memory."*

Consequences that are **not** yet reflected in `CONTEXT.md` or the #5 spec:

- **`CONTEXT.md` reserves "agent" for the Rhizome product.** Under this framing
  that is backwards — the agent is Prime; Rhizome is the shell. The vocabulary
  rule is load-bearing across the whole ticket set. Decide it deliberately.
- **The spec has Rhizome reimplementing Prime's built-in commands.** Forced by
  the protocol (forwarded text no-ops), but the instinct behind it — "Rhizome
  owns the surface" — is inverted by this framing.
- **Most of #9–#22 is rendering Prime's harness in a window, which Prime's own
  TUI already does.** The differentiated work is the memory loop (vault as
  source of truth, promote, retrieve). Worth asking whether those tickets
  outrank memory work rather than working the list in order.

### #12 — quit semantics, reframed mid-ticket

The ticket said quitting should *"shut the service down cleanly"*. **That was
wrong and is not what shipped.** Prime's own `daemon.md`: the supervisor is
internal infrastructure that starts itself and is restarted by a worker if it
dies, and `prime-agent shutdown` stops **every agent on the machine** — it has
no `--daemon-socket` flag, so the CLI always hits the default service. Killing
it would have taken out terminal sessions belonging to other clients.

Atticus's framing settled it: when you exit Claude Code, *your agent* stops —
it does not shut down a shared background service. So quitting now sends
`kill` for **our own `activeSessionId`** only. The daemon is never ours to
stop. `78c6131` shipped the machine-wide version; `2a5e857` replaced it.

**Setting:** `keep_sessions_running_on_quit`, default **off**, toggle in
Settings → AI Agents (`84c3e56`). Off = agents stop when Rhizome is fully
closed. On = session outlives the app so heartbeats still fire.

**Demonstrated both ways against real isolated daemons** started with
`prime-agent --mode daemon --daemon-socket <path>` — never the developer's
default service. Default quit stopped the session and it left the resident
list; opted-in kept it alive.

**⚠️ Interaction worth knowing:** with the default on, **#7's reattach only
helps after closing the *window*, not after quitting.** Quit ends the session
by design, so reopening starts fresh and the prior conversation is
history-on-disk. That makes #7 narrower than its ticket sounds. Observed
unplanned: `tauri dev` restarting the app fired `RunEvent::Exit` and ended a
live 10-message session, transcript intact on disk.

### Naming — do not standardise on a name yet

**`prime-agent` is Prime Intellect's** (`PrimeIntellect-ai/prime-agent`, MIT,
author Mario Zechner). Atticus holds an account with them. MIT licenses the
*code*, not the *name* — putting "Prime" in the product name risks reading as
an official Prime Intellect product. **Put it in a descriptor, never the
product name.**

A `/adhd` divergence run (8 frames, 48 ideas) produced one finding that
outranks every candidate name: **make the rename cheap rather than correct.**
This repo already ran the experiment — ADR-0162 renamed tolaria→rhizome and
**C19/C20/C21 record eight live residues found weeks later**. Proposed:
`brand/brand.json` normative, everything else generated; `build.rs` emits
`BRAND_DISPLAY_NAME` so a literal in `.rs` is an anomaly; locale values carry
`{appName}` so a rename never touches 19 files. **Critical distinction the run
surfaced:** `displayName` is cheap; `identifier` (`ai.rhizome.agent`) is also
the data directory, keychain service and URL scheme — changing it **orphans
every user's sessions**. Freeze the identifier behind its own gate.

Best name candidate was **Hypha** (singular; extends the owned botanical
family, maps onto `rlm(...)` recursion, contains neither Prime nor Agent). Its
own branch found the flaw: *Rhizome / Rhizome Desktop / Hypha* is three
filament-network names in one family, and two are already confused enough that
`AGENTS.md` opens with a wrong-tree STOP block. **Ship the mechanism first,
then test the name.**

### Debt

- **Six locale keys are English-only** (#8's four, #12's two). `pnpm
  l10n:translate` needs `LARA_ACCESS_KEY_ID`/`SECRET` — C18, deferred by
  Atticus. Missing keys fall back to English, so nothing renders a raw key.
- **A failed transcript read does not retry** (#7). Panel would sit empty over
  a live session until the session changes or the app restarts. Documented in
  the hook rather than claimed and not built.
- **#12's menu-bar half** is unbuilt. It now has a coherent trigger it lacked
  before: the toggle being on.

### The pattern this session kept proving

Four defects were invisible to green tests and caught only by looking at the
artefact: `create` silently ignoring a top-level `cwd`; the system-prompt wall
(spotted by Atticus in a screenshot); a title fix that was a **silent no-op**
because normalisation ran before the strip; and `prime-agent daemon` shipped
in #8's error copy as a command that **does not exist**. Verify against the
binary, and look at the running app.

---

## Session handoff — 2026-08-16 (#6, #7 and #8 shipped; Rhizome is a window onto Prime)

**#8 shipped: the version floor and the unreachable-service states.** Three
typed states, kept separate because the action differs — Prime not installed
(install it), service not answering (start it), service too old (update it). A
missing binary and a stopped daemon look identical to a socket call, so they
are classified rather than collapsed into one useless "unavailable".

The floor is enforced **at the handshake**, the only place the answer is known:
`daemon_hello` carries the protocol version, and anything below 7 is refused
before a session is created. Surfaced to the user as a version number, because
"update to 0.7.1" is an instruction and "protocol 7" is not. **Newer daemons
are accepted** — a floor must not become a ceiling that breaks on every Prime
release.

**No RPC fallback, verified structurally rather than asserted:** `--mode rpc`
appears nowhere in `src-tauri` since #6 removed it.

The state is *remembered* from the last connect attempt rather than recomputed
per poll — the version case can only be learned from a handshake, and
re-handshaking every four seconds to answer a question that changes only when
the daemon restarts is waste. It clears on a successful connect, so the app
stops telling users to fix what they have fixed.

**Demonstrated with a forced failure** (`live_unreachable_service_is_actionable_and_recovers`):
real daemon reports nothing, a socket with no listener yields "Prime's
background service is not running. Start it with `prime-agent daemon`.", and
reconnecting clears it. **The too-old case was not forced live** — proving it
would mean downgrading the developer's `prime-agent`, a worse trade than the
fake daemon reporting protocol 6 that covers it. Stated rather than implied.

---

## Session handoff — 2026-08-16 (#6 and #7 shipped; Rhizome is a window onto Prime)

**Next: #8 (version floor and unreachable-service states), or #12 (quit
semantics).** #6 and #7 are both closed and pushed. The transport and its
continuity story are done; what is left in the #5 set is the surface on top.

**#7 shipped in three slices**, each demonstrated against a real daemon:

- **Rejoin on open.** Opening looks for work already running in this directory
  and attaches to it; creating is the no-candidate path. Selection is a pure
  function — same cwd, nobody else holding it, most recently active wins.
  `lastActivityAt` is ISO-8601 UTC so lexicographic order is chronological.
  Enumeration is an optimisation, not a precondition: a daemon that cannot
  `list` still opens a session. **This also closed the accumulation leak logged
  against #6** — relaunching reuses rather than stranding one session per launch.
- **Transcript on rejoin.** The panel shows the rejoined conversation instead of
  an empty box over a live session. Reads the session's own log file
  (`sessionPath` on host status) rather than matching an id against a disk scan.
  Guarded to run once per session path — status polls every few seconds and
  would otherwise fight the live stream for the conversation.
- **Uptime.** Minutes, then hours, then days, hidden when the host is not live.
  No timer of its own; the status poll re-renders it often enough.

**Proof, not argument:** quit the app on an 8-message conversation, relaunched,
watched it log `Reattaching to Prime session 7373ae48ae6a`, and the transcript
came back with tool cards and reasoning intact. The daemon confirmed
`attachedClients` 0 → 1 and no new session.

**C26 found and fixed, and it was two bugs.** A replayed user turn rendered the
entire composed system prompt — "hi" became a screenful of instructions — and
the session-list title had the same defect, which would have given every
session an identical name. **The fix direction first recorded for C26 was
wrong**: it proposed moving the system prompt to `create`'s
`config.systemPrompt`, but the context block is rebuilt every turn from the
active note and open tabs, so that would have frozen it. The composition was
correct; only its display was not. See the C26 entry for what shipped.

**Three defects this session were invisible to green tests and were caught by
looking at the artefact.** Worth internalising, because it is now a pattern
rather than an anecdote:

- `create` silently ignores a top-level `cwd` — the session lands in the
  daemon's directory and the vault tools read the wrong tree.
- The system-prompt wall was found by *looking at the running app*. Every test
  was green and the logs said `Reattaching`.
- The C26 title fix was briefly a **silent no-op**, because whitespace
  normalisation ran before the strip and collapsed the newline-delimited
  markers. Its test passed either way.

**Known limitation, deliberately not built:** a failed transcript read does not
retry. The session is attached and live regardless, but the panel would sit
empty over it until the session changes or the app restarts. Documented in the
hook and its test rather than claimed and not built. Revisit if seen in practice.

**Localization is behind.** `ai.subhead.uptime` is in `en.json` only —
`pnpm l10n:translate` fails for want of `LARA_ACCESS_KEY_ID`/`SECRET` (C18,
not new). Missing keys fall back to the English catalog, so nothing renders a
raw key, but 18 locales need a run with credentials.

**Gates:** five pushes, all six gates green each time. `cargo test --lib` 1437;
`pnpm test` 5308 across 508 files; Rust coverage above the 85 floor; Playwright
core smoke green. Codacy: not run — no MCP tool and no `.codacy/`, as ever.

---

## Session handoff — 2026-08-15e (#6 shipped: Rhizome is a client of the daemon)

**Next: #7 (detach on close, reattach on open).** #6 is done and pushed. The
transport is no longer the blocker for anything in the #5 set.

**The assumption under ADR-0163 and 16 tickets was tested first, and it
holds.** An external client — a Python script using nothing of Prime's own JS —
opened the socket, completed `daemon_hello`, attached with `slim_attach`, read
session state, drove a streamed turn, and the session outlived the client
disconnecting. That check took twenty minutes and would have redrawn the spec
at ticket one if it had failed.

**Shipped:** `prime_session_host` rewritten against the daemon socket. Public
functions unchanged, frontend untouched. Sessions are created with
`lifecycle: "resident"` and closing detaches — it never kills.

**Three things the type declarations would not have told you.** All three were
found by probing the live 0.7.1 binary, and each would have shipped as a quiet
wrong behaviour rather than an error:

- **`create` has no top-level `cwd`.** It rides inside `config`. Sent at the
  top level it is accepted and ignored, and the session lands in the daemon's
  own directory — so the vault tools would have been reading the wrong tree
  with everything apparently working.
- **Scheduled work is `heartbeats_list` / `cron_list`.** The RPC spellings
  (`list_heartbeats`, `list_schedules`) answer `Unknown daemon command`, and
  `agent_activity` degrades a failed sub-request to empty — the wrong names
  would have emptied the activity band in silence.
- **Agent events arrive wrapped in `session_event`, but the inner object is
  byte-identical to RPC mode's.** Unwrapping exactly one layer in the reader is
  the whole reason `prime_events` needed no change.

**A failure mode that did not exist before.** A session log can only be live in
one worker, and the daemon holds every client's, so switching into a session
another client has open is refused (`errorInfo.code =
"session_already_active"`). Switching into an unheld session rehydrates
normally — verified live. Rhizome now explains the conflict instead of
surfacing Prime's wording, which names an internal worker id and a file path.

**Two corrections to this repo's own lore, both from watching rather than
reading:**

- **ADR-0163 says the daemon protocol declares "roughly three times" the RPC
  surface. Measured, it is twice: 96 commands against 48.** The conclusion is
  untouched — the harness commands really are daemon-only — but the ratio is
  wrong and should not be requoted.
- **`AGENTS.md` warns that editing `src-tauri/` while `tauri dev` runs does not
  rebuild.** It did, three times, unprompted (`Info File … changed. Rebuilding
  application…`). Do not rely on the old binary sticking around. The related
  half of that trap is still worth heeding: each restart is a fresh connection.

**Sessions accumulate, one per app launch.** Every start creates a session;
quitting leaves it resident. Sessions with no messages are `lifecycle: draft`
and the ones carrying work are `live`, which is the distinction #7 and #12 will
need. Three empty drafts from this session's rebuilds are still resident — they
were left rather than deleted, since culling state in the user's runtime is not
this ticket's call.

**Two lifecycle leaks found reviewing the diff, both left for #7/#12 rather
than widening #6.** Neither is a regression; both are reachable in ways they
were not before:

- **A lost race in `ensure_host` orphans a draft.** Two concurrent calls with
  different cwds both connect; the loser is now *detached* rather than killed,
  so its empty session lingers in the daemon. Owning a child process meant the
  loser died.
- **A dropped connection silently reconnects into a new session mid-
  conversation.** RPC mode did the same on respawn, so the behaviour is
  unchanged — but a shared daemon disconnects more plausibly than a child did
  (Prime self-updating, for one), so the path is far more reachable. This
  belongs with #8's unreachable-service states: the user should be told, not
  quietly moved to a fresh session.

**Demonstrated against real Prime, not a fixture**, which is the
non-negotiable bar in every ticket of this set:

- `live_daemon_round_trip` (`cargo test --lib prime_session_host::tests::live_daemon -- --ignored`)
  — streamed text, real stats (500k window, real cost), history, detach then
  reconnect. Ignored by default; it needs a running daemon and spends tokens.
- In the running app: a real conversation with real tool calls, in a session
  whose cwd was correctly the vault. **The app was then quit and the session
  survived with all eight messages, `lifecycle: live`.** That is user story #1,
  observed rather than argued.

**Gates:** `cargo test --lib` 1422 passed; coverage TOTAL 85.24% (gate 85);
`pnpm test` 5294 passed across 507 files; `npx tsc -b` clean; clippy
`-D warnings` clean; `cargo fmt` clean. Codacy: not run — no MCP tool and no
`.codacy/` directory, as on every prior session.

---

## Session handoff — 2026-08-15d (the surface is specced; the transport it assumed was wrong)

**Next agent: read `docs/adr/0163-connect-to-the-prime-daemon.md`, then issue
#5.** Together they supersede the "next build" section of
`docs/plans/2026-08-15-harness-surface-pickup.md`. The rest of that pickup — the
reframe, the three confused counts, the traps — is still accurate and still
worth reading.

**The correction.** 08-15c said the next build was a slash-command palette, and
scoped it against the RPC transport. Verified against installed `prime-agent`
0.7.1 rather than its docs: **RPC mode declares 48 commands; the daemon
protocol declares roughly three times that**, and the harness commands the
palette existed to carry — `get_session_tree`, `navigate_tree`,
`start_side_question`, `set_rlm_max_depth`, `get_context_tree`,
`get_system_prompt`, `set_scoped_models`, `cron_*` — are **daemon-only**.
Prime's own `rpc.md` closes the workaround: built-in commands are excluded from
`get_commands` and do not execute when sent via `prompt`. A palette on RPC
would have been roughly one-third inert, and would have looked like it worked.

**Two live findings settled the lifecycle**, both from probing rather than
reading:

- **A Prime daemon was already running on this machine** — `prime-agent status`
  reports it at `$TMPDIR/prime-agent-501/daemon.sock`, marked *default
  background service*. Rhizome has never been able to see it.
- **Detaching is Prime's designed behaviour**, not a feature to add. Closing a
  client detaches; `prime-agent agents` / `attach` / `stop` exist to rejoin
  running work.

So owning the process and killing it on exit was working against the runtime.
**Rhizome becomes a window onto Prime, not the thing that runs it** (ADR-0163).

**Shipped:** ADR-0163; `CONTEXT.md` rewritten where the decision made it wrong
(the `Session host` entry, plus the three-way collision on "agent" — the
product, the legacy Desktop backends, and a running unit of work); the spec at
`docs/plans/2026-08-15-harness-surface-spec.md`, published as **issue #5**, with
**17 tickets at #6–#22** wired in dependency order.

**Vocabulary is now binding.** `session` is the only user-facing noun for a
running thing; `worker` stays inside the transport layer; `subagent` for
children; `agent` means the product. This follows **Hermes Agent**, which meets
the identical collision and never introduces the third sense — there is no
`hermes agents` command; the unit a user lists, names and resumes is a session.

**Next: `/implement` on #6 or #11.** They are the only two takeable now and they
are independent — #6 is the daemon connection and gates everything else; #11 is
Mycelium moving in-app, which touches nothing #6 touches. `/clear` between
tickets; each is written to stand alone.

**Two things this session got wrong, recorded so they are not re-learned:**

- I "corrected" the pickup doc's "11 bundled skills" to 13 by listing the
  package directory. A live `get_commands` probe settles it: **13 ship, 11
  load** — `linear` and `notion` do not. The doc was right. This is the repo's
  own standing lesson (*verify against the artefact*) applied to itself, and it
  was made while quoting that lesson.
- I twice recommended staying on RPC mode on the grounds that a transport swap
  would swallow the feature work. That weighed the migration cost without
  having established that the feature was **impossible** on RPC. Establish
  reachability before estimating effort.

**The docs push ran no gates.** The pre-push hook skipped app checks
(docs-only diff) and reported "passed in 0s". That is correct behaviour and
**not** evidence of a healthy tree — the first ticket touching code is where
the suite gets its say.

**Loose end:** a research file was expected this session and never appeared.
The spec notes that nothing in it depends on one; if a file lands and
contradicts the transport finding, the spec loses to it.

**Still open, unchanged:** C24, C25 and the status-bar green flash, all as
recorded in the 08-15 pickup. None were touched.

---

## Session handoff — 2026-08-15c (harness reframe; next is the slash-command surface)

> **Superseded in part by 08-15d above.** The "next build" section below scopes
> the slash-command surface against the RPC transport; ADR-0163 replaces that.
> Everything else here — the reframe, the three counts, the traps — still holds.

**Next agent: read `docs/plans/2026-08-15-harness-surface-pickup.md` first.**
It supersedes both earlier 08-15 pickups as "what is true now".

**The reframe:** Prime is a supervisor, not a model in a chat box — persistent
goals with budgets, self-scheduled heartbeats, programmatically-invoked
subagents, daemon continuity, and a continual harness that `/refine` updates
with evidence. Rhizome renders almost none of it.

**Three counts got confused and must not be again:** the "~16 of ~45 RPC" score
is JSONL protocol verbs; `get_commands` returns 100 *skills* of which 89 are
Atticus's own installs, not Prime capability; Prime's actual surface is 11
bundled skills plus its slash commands plus RLM. Only the third is the harness.

**Next build: the slash-command surface** (`/goal`, `/heartbeat`,
`/autonomous`, `/rlm-max-depth`, `/refine`, `/fork`, `/tree`, `/model`,
`/effort`, `/skill:name`), documented in
`~/.local/lib/node_modules/prime-agent/docs/usage.md`. Rhizome offers none of
them. **Spec it** — `/grill-with-docs` → `/to-spec` → `/to-tickets` in one
window — rather than slicing at it.

**Shipped today:** tool cards now name the real vault tool behind `ipython` and
offer Open; transcript replay no longer drops every tool card (`toolCall`, not
`tool_use`); `fork` wired; `AgentActivityBand`; C22 closed and verified; status
colour decoupled from the user's brand accent; Playwright smoke lane green.

**Model picker verified end to end** — `set_model` to another provider and the
next turn was answered by that model. Grok 4.6 is absent from Prime's 78-model
catalog; that is Prime's list, not ours.

---

## Session handoff — 2026-08-15b (Claude review + push blocker cleared)

**Next agent: read `docs/plans/2026-08-15-claude-review-of-native-loop.md`,
then `docs/plans/2026-08-15-native-loop-handoff-for-claude.md`** (still accurate
for the native loop itself). 08-14 leftover plan and 08-14-evening pickup are
historical.

**Reviewed the Hermes/Grok stretch as the original author of the Frame A and
session-list slices. The work is sound** — every product file has a matching
test, A4-skip and C24-log were both the right calls, and the two easy-to-get-
wrong details (host spawned once outside the poll interval; absolute-path guard
before `joinVaultPath`) are both correct.

**One incomplete fix found and closed — it is why both pushes failed.**
`0b94652` pinned the notes shell inside `installFixtureVaultInitScript`, which
only reaches specs calling `openFixtureVault`. 41 specs navigate with a bare
`page.goto('/')`. The curated lane runs 13 of them, so exactly one surfaced and
stopped pre-push at step 5/6 both times. `de1a437` exports
`pinNotesShellLaunch(page)` and applies it to the 22 bare-goto specs that assert
on notes-shell selectors. **`pnpm playwright:smoke` 26 passed** — the push gate
is green for the first time since `15a8448`.

**Still not pushed.** Count the ahead-number yourself.

**C25 opened:** two regression-lane specs fail on stale content expectations,
verified independent of the pin (3 failures before it, 2 after). Not in the
push gate.

**Next:** re-check Frame B natively (the `0b44e5f` wikilink-title fix was never
re-dogfooded — Vite cannot prove it), then push if asked.

**Unpushed — count them:** `git rev-list --count origin/main..HEAD`.
Atticus asked to push. It did **not** land. `origin/main` still the
pre-stretch SHA until a green pre-push succeeds.

**Do not:** rebuild A4; start Frame D; fill remaining Prime RPCs;
hardcode a model; treat Notes-rail as ChatHome; resume 08-09
push-unblock; claim the push succeeded.

**Next:** native re-check of `[[Promote loop check]]` body after
`0b44e5f`, or push again if asked. Not both at once.


---

## Session handoff — 2026-08-09 (push-unblock: A1 — historical, superseded)

**Where we are:** first `git push` attempt since the fork ran the pre-push gates for the first time on **30 unpushed commits** (the Agent-fork → Prime-harness-chat arc). Build is fixed; **19 frontend tests still fail → push stays blocked**. See **A1-OPEN** in Open threads below.

**Fixed (build, same day):**
- `tsc -b` 4 errors — Mycelium rail missing `RailDestination` + label map; `onKeyboardShortcuts` missing from 2 `Pick<>` unions (`76539bd`)
- Clippy 3 pre-existing `-D warnings` — `mycelium.rs`, `rhizome_distill.rs` (`e89e8cd`)
- Prime RPC host failure/lifecycle test coverage (`7e820c7`); AGENTS.md origin/visibility residues (`cb3a299`)

**⛔ A1 — next action, blocks push:** `pnpm test` = 5168 pass / **19 fail** across App(5), ResearchPanel(4), SettingsPanel(3), AiAgentsOnboardingPrompt(2), AiWorkspaceFloatingButton(2), useAiAgentPreferences(2), aiAgentStreamCallbacks(1). Hypothesis: inherited Desktop tests still asserting the multi-agent UI the Prime-only fork removed (`204822a`/`fa230a6`) — not yet confirmed per-test. Fix/update → `pnpm test` green → re-attempt push.

**⚠️ Gate gotchas:** the gate runs `tsc -b` — `tsc --noEmit` is NOT proof the build passes. `cargo fmt --check` only runs in pre-push — run it manually before committing Rust.

**Arc context for a fresh model:** this repo is the Prime-harness-chat fork of Desktop. Read `docs/IDENTITY.md`; roadmap `docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md` (9/9 v0 exit criteria eng-shipped); UI-2 brief `docs/design/2026-08-09-opendesign-harness-desktop-prompt.md`; session detail `docs/plans/2026-08-09-*-session-status.md`. Product decisions: Prime-only UI (no Safe/Power, default toolkit), MCP via skill+CLI not host HTTP, Mycelium = Mindwalk bridge (BYO `mindwalk`).

**After push:** native dogfood sign-off (promote→open loop), in-app model picker, collapse vault chrome by default, wiki triage (intake audit stale 14d; wiki repo has uncommitted dirt).

---

## Session handoff — 2026-08-10 (Prime harness: context meter + steering)

**Full detail: `docs/plans/2026-08-10-prime-harness-session-status.md`. Read that first.**

**Shipped** — 7 pushes, all six gates green. `main` had a broken build that no
gate had ever run (the push had never succeeded since the fork), fixed first.

- Prime RPC coverage **7 → 12 of ~45**: session stats, compact,
  set_auto_compaction, **steer**, follow_up, plus `Compaction` and
  `QueueUpdate` events
- **Context meter** above the composer — `62.0k / 200.0k (31%)`, pressure-coloured
- **Steering** — composer stays live during a turn; typed text = "Steer
  response", empty = "Stop response"
- `prime_session_host.rs` 67.23% → 81.53% coverage (4 tests → 15, plus a
  TEST_LOCK for the process-global host the old tests raced on)
- Chat-primary regression fixed (`absolute inset-0` was painting over the editor)
- File → New Folder + fresh-vault fix; 19 pre-existing test failures cleared

**Next**: `get_messages` (blocks the whole session-list story) → session list →
surface QueueUpdate → in-app Mycelium via `mindwalk serve` sidecar.

**Traps, do not relearn** — `npx tsc --noEmit` is NOT the build gate (`tsc -b`
is, and they disagree); Desktop and Agent have diverged so Desktop knowledge
does not transfer (`consolidation.rs`/ADR-0163 exist there, not here;
auto-distill defaults ON there, OFF here); zsh does not word-split unquoted
`$VAR`; the manifest can declare a handler a `Pick<>` union silently lacks.

---

## Session handoff — 2026-08-13 (get_messages + a roadmap correction)

**Shipped:** `get_messages` (Prime RPC **13 of ~45**) + `get_prime_session_messages`
Tauri command. `PrimeMessage` keeps `content` as raw JSON — Prime discriminates
blocks by `type` and a Rust enum would silently drop kinds we did not anticipate,
which is exactly what a rehydrated transcript needs. Derived `text` field
flattens text blocks. 4 new tests, `cargo test --lib` 1361 (was 1357).

**⛔ The roadmap premise was wrong — see C23.** `get_messages` was recorded as
"blocks everything in the session story." It is necessary but **not sufficient**:
`agent_end` carries the full transcript while `get_messages` returned only the
user message on the same host process. Rehydration needs a decision, not just
this command.

**Capability probe against the live binary — these all exist and answer**
(argument errors, not `Unknown command`): `switch_session`, `fork`,
`set_session_name`, `observe`, `set_thinking_level`, `set_model`,
`get_available_models`, `cycle_model`. **`list_sessions` does NOT exist** —
session *enumeration* is a disk scan of `~/.prime/agent/sessions/*.jsonl`
(`mycelium.rs:34`), already consumed by `MyceliumView.tsx:47`. So the session
list is a **hybrid**: disk for the list, RPC for the actions, and it overlaps a
component that already exists. That overlap is a design question — spec it
before building. `clone` was not cleanly verified either way.

**Model defaults are not a product concern.** BYO-model: users connect any
OAuth / API / OpenAI-compatible provider. Do not record or "correct" whichever
model a dev machine happens to default to. (The 2026-08-09 entry below carries a
`xai/grok-4.5` preference note — that is a dev preference, not a product fact.)

**Session list — slices 1, 2 and the bridge are landed.** Spec:
`docs/plans/2026-08-13-prime-session-list-spec.md`. `prime_sessions` owns
enumeration + transcript replay; `list_prime_session_summaries` and
`read_prime_session_transcript` are registered Tauri commands.
**Next is slice 3, the UI** (grouped list, rehydrate on select), then slice 4
(`switch_session`, which takes `sessionPath` = the full log file path).

⚠️ **Slice 3 is the first slice with product-rule surface area** — slices 1–2
had none. It triggers localization (`en.json` + `pnpm l10n:translate`, and
C18 means `l10n:validate` already fails on all 19 locales for want of
credentials), shadcn/ui-only components, a PostHog event for session switch,
and `mockCommandResults` entries for anything `<App/>` renders.

**Verify against the real thing, not your reading of it.** Two defects this
session were invisible to passing fixture tests: a `model_change` parse that
invented a nested object no real log contains, and a C23 finding that was a
misread of a fresh session. Both were caught by probing the live binary and a
real log. `PRIME_SESSION_LOG=<path> cargo test --lib prime_sessions --
--ignored` exists for exactly this. The model picker is closer than recorded —
`get_available_models` + `set_model` + `cycle_model` all answer live, and
BYO-model makes that surface load-bearing rather than second-tier.

---

## Session handoff — 2026-08-13b (Frame A: chat owns the window)

**Next agent: Frame A leftover is closed except an optional New-chat
affordance.** Launch now opens ChatHome (not the side AI panel). The dated
plan still has the traps. Do not build A4 titlebar chips — skipped below.

**Shipped** — session list slices 1–4, then Frame A slices A1–A3 plus the
composer foot row (`aeee08c`, `7f7f19a`).

- **Chat is a rail destination that owns the window** — no sidebar, no note
  list, no editor. First surface where "conversation owns the room" is true.
- **Telemetry subhead** — live · sess_xxxx · model · vault, mono and muted.
- **Composer control deck** — Prime · model ▾ · vault · Skills, with a
  **working model picker** (`get_available_prime_models` / `set_prime_model`,
  78 models grouped by provider, fetched on open).
- **Composer foot row** — `Working · last tool {name}` / `Idle · ready`, with
  Esc stop · ⌘. vs ⌘↵ send. Last-tool name is a pure function
  (`lastToolName`) rendered inside `AiPanel`, not the deck.
- **Session list** — enumerate from disk, replay a transcript, `switch_session`,
  rehydrate the panel with tool cards intact.
- **Launch = ChatHome** — `useAgentDefaultOpenChat` selects `filter: 'chat'`
  after the vault switcher loads (so persist `onSwitch` cannot clobber it).
  Note windows suppressed. Side panel still opens from status bar / events.

**A4-SKIPPED (2026-08-14):** do not build Frame A titlebar chips. This app has
no custom Frame A titlebar — status bar is the bottom strip, subhead is the
top strip. Artboard chips are already covered: vault (subhead + deck +
status-bar pill), last tool (composer foot). `Running tools · N` is the only
new datum and is not worth a third chrome band. **Real leftover, not A4:**
New chat is on `AiPanelHeader`, which ChatHome mounts with `showHeader={false}`,
so Frame A only has New chat inside the sessions drawer. If that gap hurts,
put a button on the subhead — do not invent a titlebar.

**The design system is authoritative for UI:**
`~/Desktop/rhizome-agent-design-system/`, artboards in
`rhizome-agent-desktop-ui.html` (Frame A at line 1642, Frame F at 2139). It
corrected three decisions already shipped this session. **Model names in the
artboards are examples only** — Rhizome Agent is BYO-model, so never hardcode
one.

**The browser preview found three bugs no test caught:** a toggle rendered into
a header the workspace mounts with `showHeader={false}` (unreachable, tests
green — the `AiAgentsBadge` failure again); a list rendering 102px inside its
228px column; and Radix menus opening on `pointerdown`, so a synthetic
`.click()` did nothing. Look at UI before shipping it.

---

## Session handoff — 2026-08-09 (UI-2 chat-primary slice)

**Shipped**
- Feature flag `chat_primary_shell` (default ON): side AI workspace starts **expanded** (fills editor column); user restore/expand persisted
- Default side width 420; fix stored-width reader so missing localStorage does not clamp to MIN (Number(null)===0 bug)
- role=main when expanded; data-chat-primary marker

**Dogfood:** launch → chat open + expanded over editor; header "Restore panel" to rail width; Mycelium still on rail.

**Next:** fuller chat-primary (collapse vault chrome by default); Open Design mocks optional.

---

## Session handoff — 2026-08-09 (chat default-open + Phase 3 closed)

**Shipped**
- Prime panel tests updated for harness chrome (no Safe/Power)
- Onboarding AI copy → Prime-only
- Auto-open AI chat once per app session (`useAgentDefaultOpenChat`) for harness-first launch
- GH #1–#4 closed (MCP via skill+CLI documented on #1)

**Next**
- UI-2 chat-primary layout (main column = conversation) — Open Design brief ready
- Native dogfood: promote, open-note, Mycelium→Mindwalk, chat opens on launch

---

## Session handoff — 2026-08-09 (harness chrome + Mycelium M1)

**Shipped**
- Prime harness chrome: hide Safe/Power for Prime; skills chip (`rhizome-vault`); harness empty-state copy
- Mycelium M1: `primeSessionToMindwalk` + Rust `bridge_and_open_prime_session` (ipython %%bash → bash); rail destination + `MyceliumView`; `mindwalk open` BYO
- Prior: promote/save (`2381f68`), open-note tools (`e2cd77f`), Open Design brief (`ca708ef`)

**Dogfood**
- `pnpm tauri dev` → Prime header shows model + Skills, no Vault Safe
- Rail → Mycelium → pick session → Open in Mindwalk (needs `mindwalk` on PATH)

**Next**
- UI-2 chat-primary layout spike (use Open Design brief)
- Native dogfood promote/open
- Close GH #1 after MCP dogfood note

---

## Session handoff — 2026-08-09 (Phase 3 #2–#4 promote + open-note)

**Shipped**
- `2381f68` feat: promote chat to vault + default rhizome-vault toolkit (Save-to-vault UI, skill without Safe/Power, Rust r## fix)
- Open-note from tool cards: `notePathFromToolInput` on tool start; always-visible **Open** on action cards when path known; create/get/open_note + Write/Edit/Read

**Next**
- Dogfood promote + Open in `pnpm tauri dev`
- UI-2 chat-primary spike (optional Open Design later — not a model)
- Mycelium M1 bridge (parallel)

**Model note:** prefer `xai/grok-4.5` for hard product work; `grok-build-0.1` is cheaper coding build.

---

## Session handoff — 2026-08-09 (Mycelium named)

**Product:** **Mycelium** = agent run footprint lens on the command rail **with Graph** (node map).  
Mindwalk (MIT) as engine; Prime-on-Pi sessions already parse; need `ipython`/`%%bash` bridge for glow.  
Track: `docs/plans/2026-08-09-mycelium-run-map.md`. Parallel to memory loop — does not block #3 promote/save.

**Also locked:** No Safe/Power product mode for circle v0 — default toolkit + install more skills.

---

## Session handoff — 2026-08-09 (Prime dogfood PASS + UI chrome)

**Dogfood (vault tools / session) — COMPLETE PASS**
- CLI vault tools: list/context/search/get_note; VAULT_PATH required (negative control OK)
- Multi-turn continuity, abort+recover, Prime identity OK
- New-session isolation PASS when active note ≠ dogfood; active-note injection and wiki-read path both healthy
- Product win: clean chat memory + smarter via vault retrieve — not silent thread bleed

**UI chrome (0213a17 + 7b520a9)**
- Breadcrumb vault reload (⌘⇧R) + View → Keyboard Shortcuts (⌘/)
- Dogfood Playwright 4/4; fixed Editor drop of `onReloadVault` and palette registration

**Next eng:** Phase 3 **#2 Safe vs Power tool policy** for Prime vault tools  
Then #3 promote/save UX, #4 open-note from tools.  
Optional UI-2 chat-primary spike (parallel).

---

## Session handoff — 2026-08-09 (Phase 3 #1 vault tools for Prime)

**Done**
- `mcp-server/cli-call.mjs` one-shot tool CLI (stdio MCP client)
- `prime_vault_skill` seeds project skill + settings on Prime host spawn
- Live-seeded `~/Documents/Rhizome Vault/.prime/agent/skills/rhizome-vault/`
- search_notes smoke OK against real vault

**Dogfood:** New Prime session after attach vault; ask to search vault via rhizome-vault skill.
**Next:** #2 Safe/Power policy; #3 promote/save.

---

## Session handoff — 2026-08-09 (frontend design roadmap)

**Added** `docs/plans/2026-08-09-rhizome-agent-frontend-design-roadmap.md`

- Dogfood: Agent still reads as Desktop shell + Prime rail; chat path works
- Target: chat-primary harness desktop; Desktop network-shell spec is not Agent destination
- UI milestones UI-0…UI-4 aligned to product phases; Prime icon = UI-0 leftover
- Open Design optional for prototypes later — not a gate

**Next UI:** Prime icon (UI-0) → harness chrome (UI-1) → chat-primary spike (UI-2).  
**Next eng capability:** issue #1 MCP (parallel).

---

## Session handoff — 2026-08-09 (Phase 1 Prime chat path)

**Done**
- Product AI target is **Prime only** (`DEFAULT_AI_AGENT = prime`, product-visible definitions).
- Frontend `streamAiAgent` routes `prime` → `stream_prime_session` / `abort_prime_session_turn`.
- Chat allowed without vault for Prime (cwd falls back to home on host).
- Legacy backends remain in status/types but hidden from pickers.
- Phase 3 memory tickets filed: issues #1–#4 (see `docs/plans/2026-08-09-phase-3-memory-tickets.md`).

**Next**
1. Dogfood Phase 1 in `pnpm tauri dev` (multi-turn, abort, new session).
2. Frontier ticket: #1 MCP injection into Prime.

---

## Session handoff — 2026-08-09 (v0 brief + roadmap)

**Product direction locked** via `/grill-with-docs`. Read:

- `docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md` — brief, phases, exit checklist
- `CONTEXT.md` — glossary (Prime-only harness, vault SoT, promote loop, Safe/Power)

**Next eng:** Phase 1 — frontend Prime target + Prime-only UI (see roadmap §8–9).

---

## Session handoff — 2026-08-09 (Prime RPC session-host spike)

**Done**
- `pnpm install` clean on this machine.
- Slice 1 of `docs/plans/2026-08-09-prime-harness-chat-spike.md`: long-lived `prime-agent --mode rpc` host.
  - `src-tauri/src/prime_discovery.rs` — binary discovery (`prime-agent` on PATH + common install locations).
  - `src-tauri/src/prime_events.rs` — RPC event → `AiAgentStreamEvent` (same shapes as Pi for text/thinking/tools).
  - `src-tauri/src/prime_session_host.rs` — spawn once, JSONL stdin/stdout, prompt / abort / new_session, multi-turn.
  - Tauri commands registered: `get_prime_session_host_status`, `ensure_prime_session_host`, `shutdown_prime_session_host`, `prime_session_new_session`, `abort_prime_session_turn`, `stream_prime_session`.
- Tests: `cargo test --lib prime_` → 9 passed. Live smoke against installed `prime-agent` (`get_state` + `abort`) OK; local default model observed as xAI `grok-4.5`.

**Next**
1. Frontend AI target “Prime” that calls `stream_prime_session` (multi-turn, same host).
2. Do not store API keys in app settings — rely on `~/.prime` OAuth/login.
3. Rhizome MCP injection + Safe/Power tool policy.
4. Only then prune unused desktop panels.

**Not done / out of scope this session**
- No frontend wiring, no MCP injection, no DMG bundling of Node/Prime.
- Codacy: not run — no MCP tool, no `.codacy/` directory in this session.
- Localization: no UI copy changes.
- PostHog: no event needed (backend host only).

---

## Session handoff — 2026-08-02

**Pushing is still blocked — GitHub account `knispo` is suspended (appeal filed 2026-07-31, not yet resolved).** SSH auth itself succeeds (`ssh -T` → "Hi knispo!"); it's an account-level block, so `git push` is refused and `api.github.com/users/knispo` + the repo both 404 to anonymous callers (expected hide). The `gh` CLI's "token in keyring is invalid" is *downstream* of the suspension — don't burn time re-authing it. Commit locally as normal; only push and CI are blocked.

**⚠️ A GitHub Personal Access Token was exposed in a prior session's `ps aux` output** (the `tolaria`/`rhizome` MCP server's `GITHUB_PERSONAL_ACCESS_TOKEN` env var, inlined into the process command line and therefore world-readable via `ps`, and captured into that session's transcript). **Rotate it** at github.com/settings/tokens once the account is unsuspended. Consider whether your MCP client can read secrets from a file or keychain instead of an inline `env` block — every session currently re-broadcasts it.

**Local-only backup: find it, don't trust this line** — `ls ~/rhizome-backup-*.bundle`. The filename carries the HEAD it was cut at, so naming a sha here goes stale on the very next commit (last re-cut 2026-08-02: 94 MB, `--all`, `git bundle verify` exit 0, 1534 refs, "records a complete history"). Point-in-time — after further commits:
```bash
git bundle create ~/rhizome-backup-$(git rev-parse --short HEAD).bundle --all
git bundle verify ~/rhizome-backup-<new>.bundle          # expect "complete history", exit 0
git merge-base --is-ancestor <old-sha> HEAD              # only then delete the old one
```
The ancestry check matters: "delete the superseded one" is only safe once you've established the new bundle actually contains the old one.

**Unpushed commits: count them, don't trust this line** — `git rev-list --count origin/main..main`. Once unsuspended, push needs the LLVM env vars or the Rust coverage gate fails at step 4/6 **without naming the missing variable**:
```bash
export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov" \
       LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
git push origin main
```

**~~⚠️ `.deepsec/` staging hazard~~ — RESOLVED 2026-07-31.** The directory was moved out of the repo to `~/deepsec-scan/` (DeepSec = `deepsec` v2.2.4, vercel-labs' Apache-2.0 AI vulnerability scanner; its `.env.local` lives there now, outside the public repo). Never committed — `git log --all -- .deepsec` is still empty. `.deepsec/` is now in `.gitignore` as insurance against a re-init, and the stale `.deepsec/deepsec.config.ts` entry point was removed from `knip.json`.

**Start here:** `~/.claude/plans/were-using-usage-credits-inherited-cosmos.md` is the consolidated plan with verified ground truth and remaining workstreams. **Workstream A (the end-to-end save-path audit) is fully closed as of 2026-08-02** — all 10 findings fixed. What the audit could *not* settle is still open: it was a static trace with no native run. Of the user's original question's three legs, (b) competitor research is now also done (2026-08-02); only (a) — testing the full save loop against a blank vault — remains, and it needs a human at `pnpm tauri dev`. See TOP PRIORITY below.

**⚠️ STANDING HAZARD while push is blocked — `cargo fmt` is not gated on commit.** `cargo fmt --check` runs in `.husky/pre-push` and *only* there; `pre-commit` is a lint gate that never invokes cargo. With push blocked since 2026-07-27, **every commit made in this window is un-fmt-gated**, and four of them had already drifted (`8b76d8f5`, `e2d13448`, `9489b2ab`, `f550ba7b` — caught and fixed 2026-08-02 in `a1f2d64c`). Until push works, run this yourself before committing Rust:
```bash
cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check
```
Note what this implies about the record: sessions in this window that report "all gates green" mean *the gates that ran*. `cargo fmt` was not among them. Same lesson as the self-reported-metrics trap below, one level up — verify which checks actually executed, not just that they passed.

**Two traps that cost real time this session:**
- **The browser preview (`pnpm dev`, port 5202) cannot show real vault data.** It serves a hardcoded 4-node graph fixture (`src/mock-tauri/mock-handlers.ts:427`) while `MOCK_ENTRIES` generates thousands of notes. A session read the preview and concluded the vault was nearly empty; the real vault has **125 nodes / 158 edges / 31 ghosts**. Only `pnpm tauri dev` exercises real data.
- **Verify a delegated agent's self-reported metrics.** Four self-reports were wrong in the 2026-07-26 session, each caught only by re-checking — including "265 frontend tests pass". Re-run the measurement rather than recording the summary. **This applies to the numbers in this file too:** the recorded baseline drifted from 5131/482 (2026-07-26) to 5148/483 (2026-07-31) to **5158/484 (2026-08-02)** within one week. Treat any test/coverage figure here as a stamp with a date on it, not a current fact.

**Identity rename `tolaria`→`rhizome` — DONE 2026-08-02, ADR-0162.** Closed a real gap: the app was still registering its MCP server and several localStorage keys under the pre-rename product name. Landed as 5 commits:
1. Core MCP registration engine (`mcp.rs` + friends) — `MCP_SERVER_NAME` now `"rhizome"`, `LEGACY_MCP_SERVER_NAMES` generalized to a list so both `tolaria` and `laputa` entries get cleaned up in one pass.
2. Every CLI integration (Claude Code, Kiro, Antigravity, Codex, Pi, OpenCode) — includes `claude_invocation.rs`'s `mcp__rhizome__*` allowlist, which had to move with the key or the in-app AI chat would have silently lost tool access. Kiro/Antigravity/Pi's config writers had **no legacy-key cleanup at all** before this — fixed.
3. Frontend localStorage identity (`appStorage.ts` + several files) — primary keys now `rhizome:*`, one fallback generation kept. **`useVaultConfig.ts`'s per-vault prefix had never been migrated even once** (still `laputa:vault-config:` through the whole prior rename) — found and fixed here.
4. **A real, previously-broken bug, found auditing rather than being the point of the rename:** `deepLinks.ts`'s scheme said `"tolaria"` while `tauri.conf.json` already registers `"rhizome"` — every real deep link was being silently rejected. Fixed; native confirmation (open a `rhizome://` link) still outstanding.
5. Docs (this entry + ADR-0162 + ARCHITECTURE.md/ABSTRACTIONS.md corrections).

**Both items originally deferred out of this rename are now also resolved, same day.** `src/components/tolariaEditorFormatting.tsx` + 5 siblings → C14, `5e40fd02`. `src/types/laputaTestBridge.ts` + `window.__laputaTest` → C15, `8733163b`. See their entries in Open threads below and the reasoning in ADR-0162 for why both shipped as separate commits rather than folded into the series above.
