# Handoff — read this first
**What is true right now.** Not a history log: per-session records live in
`docs/plans/handoffs/`, one file each, newest by filename.
```bash
ls docs/plans/handoffs | grep -v archive | tail -1    # the latest handoff
```
## Adding your session

Write **one new file** in `docs/plans/handoffs/`, named
`YYYY-MM-DD-HHMM-<model-slug>-<topic>.md`, with frontmatter:

```yaml
---
session: 2026-08-21T16:40Z
model: Claude Opus 5          # who wrote this handoff
also: [Grok 4.6 (Cursor)]     # anyone whose work it reports, if not you
description: >-
  One or two lines. This is what a future session reads to decide whether to
  open the file at all, so make it say what changed, not what the topic was.
commits: abc1234..def5678
---
```

Then update this file **in place**: the state line below, Open threads, and one
line in Recent sessions. Do not paste your session into this file.

**Why it works this way.** This file was 2156 lines of stacked sessions, always
loaded in full, mostly restating commit messages and `docs/plans/*-session-status.md`
files that already existed — and because sessions inserted next to whichever
heading they were reading, the newest handoff had drifted to third place. "Read
the latest handoff" pointed at the wrong one.

The shape is borrowed from how Claude's own tooling handles this, on this
machine: skills load a `name` + `description` and open the body only when
chosen; project memory keeps one file per fact with a two-line `MEMORY.md`
index; and the `claude-handoff` skill says outright — *"Do not duplicate
content already captured in other artifacts (specs, plans, ADRs, issues,
commits, diffs). Reference them by path or URL instead."* A small index that is
always read, content that is opened on demand, nothing duplicated from where it
already lives.

**Prune as you go.** An entry in Recent sessions that no longer tells anyone
anything should be deleted, not kept for the record — git has the record. A
`pnpm handoff:check` gate keeps session sections from creeping back into this
file.

---

## State
`main` is **`45562a5`**, with no local commits ahead of `origin/main` at the
2026-09-04 note-preview review. Preview and graph corrections remain
uncommitted: collapsed strip says Inbox; graph Open note exits Graph; Key is bounded.
97 tests and focused browser checks pass. Native blank painting recovered after a clean restart (C60). The user requires
approval before commit/push. #25 provenance, C23, and C25 fixes are committed;
the earlier C22 relaunch check passed 10/10. Confirm with `git status`.
Multi-day briefing: [`docs/YOU-SHOULD-KNOW.md`](YOU-SHOULD-KNOW.md) (check its own date first).

GitHub #27 #29 #31 #34 #42 closed 2026-08-26. **#11, #22, #24 and #25 closed** — C51 blocked #24 and is fixed
(`373ee1f`). Inverted Dock icon is
`stash@{4}` (`wip: inverted dock icon`), not in the tree.

Mycelium now renders with a Rhizome skin (`6377b04`): a loopback proxy
fronts the Mindwalk sidecar and injects one stylesheet, so the engine
stays upstream's and its updates keep arriving. M4 (a native client on
Mindwalk's `/api/sessions/{key}/snapshot`) is still unstarted and is
unblocked, not replaced, by this.

This machine's installed Prime is **0.8.0** (102 public daemon commands —
`docs/prime-adapter-surface.json`). GitHub latest is also `v0.8.0`.
`pnpm prime:surface` / `pnpm prime:surface:github` is the cheap re-check.

Prime **0.7.4+** on Windows speaks
`\\.\pipe\prime-agent-daemon` — see `docs/WINDOWS-DEV.md`. On macOS/Linux the
daemon dies with whatever terminal starts it, so start it detached:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

A push runs the gates in ~2m16s (three parallel lanes; the frontend lane is the
critical path at ~120s, coverage 85s of it).

## What to pick up next

`docs/NEXT.md` — unclaimed work in one place: open issues by theme, the
decisions that block some of them, the open C-numbers, and where the design
docs need filling. Read it when a handoff task is finished and the next one is
yours to choose.

## Recent sessions

- [2026-09-05 · Claude Opus 5](plans/handoffs/2026-09-05-0920-claude-opus-5-audit-findings.md) — closed the native audit's backlog: C62 (duplicate Inbox row — list mutations compared raw paths while the rename flow normalized them), C64 (first status poll's `not_installed` rendered as an install instruction for an engine still starting) and C63 (`zoomToFit` on a zero-size one-node bounding box). For **C60** found the leading mechanism — the saved window frame is applied twice at launch, and resizing an NSWindow mid-WKWebView-layout desyncs its compositing layer, which fits blank-DOM-but-WebGL-paints and quit-fixes-but-reload-doesn't — and skipped the redundant resize. **C60 is mitigated, not proven fixed.** 6002 frontend + 1706 Rust tests, lint, typecheck, clippy, fmt all pass; none of the four was verified natively.
- [2026-09-05 · Claude Sonnet 5](plans/handoffs/2026-09-05-0620-claude-sonnet-5-a1-connections-routing.md) — `ConnectionsPanel` gained a controlled `openView` API; the session-footprint chip and status-bar Graph pill now route through it in command-rail mode. 105 focused tests, lint, typecheck, diff-check, handoff:check pass. **Found the real cause of the multi-session native-attach blocker: the debug bundle shares a bundle identifier with the installed app, and single-instance enforcement silently kills the debug process on launch while the installed app is open** — not a Codex attachment quirk as previously assumed. After quitting the installed app (approved), verified Chat/Changes/Graph/Mycelium panel switching in the exact debug bundle is instant with no spinner and flat CPU/memory across 8 rapid toggles — could not reproduce the spinning-wheel hang Atticus saw, which was on the installed app. Precise ten-cycle timing still open. No commit/push.
- [2026-09-05 · GPT-5](plans/handoffs/2026-09-05-0535-gpt-5-a1-lifecycle-slice.md) — A1’s first slice stops inactive Graph/Mycelium renderers, retains lightweight panel state, removes duplicate rail entries, and fixes narrow-window panel reachability. 126 focused tests, lint, typecheck, detector, and debug build pass; ten-cycle native measurement remains open. No commit/push.
- [2026-09-04 · GPT-5.6 Sol](plans/handoffs/2026-09-04-1536-gpt-5-6-sol-native-provenance.md) — real-vault native QA found #25 missed Prime 0.8.0's `content` + Python argv wrapper; added a live-shape regression/fix and resolved stale C23/C25 tracking/tests. The source link now appears and opens the exact Tab-completion note, so #25 is closed. A controlled check retired the attempted C22 reopening after the exact debug bundle showed a visible window in 10/10 relaunches.
- [2026-09-03 · GPT-5.6 Sol](plans/handoffs/2026-09-03-1605-gpt-5-6-sol-retrieval-provenance.md) — built #25's trustworthy first slice in the worktree: only completed `get_note` calls become deduplicated, one-click `From your vault` links beneath the answer. Browser live-review proves click-through + neutral `release-plan.md` note body; fake model copy says `Mock model`, with no provider login/use. Empty/stalled reads no longer spin forever. Atticus chose Sessions in the Command Rail's middle (below every destination); the rail starts compact, expands as a whole on hover, and can be pinned open (C59 resolved). The macOS traffic-light audit keeps native clearance while removing a browser-only phantom gutter. No commit/push; native acceptance demo remains because Orca returned `runtime_open_timeout`.
- [2026-09-02 (late) · Claude Opus 5](plans/handoffs/2026-09-02-2200-claude-opus-5-pi-registry-items-7-10.md) — closed items 7–10 in `harness-composition.md`: `bash`-driven package install works (live-tested), subagent/session state is durable + externally observable so a task board is a view not a second store, the registry covers the profiles slice but not extension-UI or catalog, and `pi-hermes-memory` is rejected (default-on, no vault awareness) — do without, borrow only its correction-triggered-capture idea. Filed **C58** (broken symlink on this machine failed 3 Rust tests, blocking the push).
- [2026-09-02 · Claude Opus 5](plans/handoffs/2026-09-02-2028-claude-opus-5-impeccable-and-pi-registry.md) — **Prime Agent is a distribution of Pi (Earendil), and `pi.dev/packages` already lists ~5,000 installable extensions, skills, prompt templates and themes.** Verified against Prime's own `package.json` (`@earendil-works/pi-agent-core`) and its own `packages.md` ("the **inherited** extension ecosystem"), not a repo note — **search that registry before authoring any composition slice**; filter unchanged, install is CLI-only, packages run with full system access. Four new open questions as items 7–10 in [`harness-composition.md`](design/harness-composition.md). `/impeccable critique` on Settings scored **19/40** and found a **P0 silent data loss** — clicking a colour theme discarded every unsaved edit (`7eff708`) — plus an unconfirmed API-key delete (`56f5aef`) and six section descriptions that rendered nowhere including the telemetry privacy promise (`5b9e118`). Chat's composer advertised three shortcuts that did the opposite or did not exist, **and the existing test asserted the bug** (`44e06ce`). Hermes read at source for terminal / kanban / bots. Corrections: **OpenCode was never a decision** and **the NotebookLM exports are not a source** (both Atticus); Hermes's "Active now" is a 5s poll, not presence; C46 had been fixed a week and left open.
- [2026-08-29 · Grok 4.6](plans/handoffs/2026-08-29-0205-grok-4-6-prime-limited-tools.md) — Prime sessions always **Power User** (no sandbox; toggle hidden). CLI agents still honor stored vault mode; UI relabelled **Limited tools**. Open product choices tracked as **C57**.
- [2026-08-29 · Grok 4.6](plans/handoffs/2026-08-29-0158-grok-4-6-live-app-view-plan.md) — #50 plan only (not built): `pnpm live-ui` against the browser app, read + test-bridge steer, developer tooling not an in-app pane; scroll metrics required because `uiAudit` would have missed the missing transcript scroller. Awaiting Atticus. Writeup: [`docs/plans/2026-08-29-live-app-view-plan.md`](plans/2026-08-29-live-app-view-plan.md)
- [2026-08-29 · Claude Opus 5](plans/handoffs/2026-08-29-0100-claude-opus-5-session-naming.md) — #49 step 2: a session names itself from its first exchange and the name is **stored** through `set_session_name`, so every client reads the same one; a name a person chose is never overwritten; the list stops printing Rhizome's own `Rhizome · vault · id` placeholder as if it were a name, so old sessions read better with no backfill; fixed a full stop inside `0.8` being treated as a sentence break; Mycelium's session picker stopped listing Prime's uuids; Mycelium's Evaluation failure is the `claude` CLI's expired login (`claude login`), not our bug; filed #50 — let the agent see the running app instead of screenshots macOS keeps blocking; Vault Safe / Power User question **answered** in the 02:05 Grok handoff
- [2026-08-28 (afternoon) · Claude Opus 5](plans/handoffs/2026-08-28-1500-claude-opus-5-note-context.md) — Chat can see the note you have open (it passed nothing before), and any note can be handed to the agent by right-clicking it; both live-verified, the agent naming the note's contents with tools forbidden
- [2026-08-28 (early) · Claude Opus 5](plans/handoffs/2026-08-28-0300-claude-opus-5-model-allow-list.md) — Nous Portal **confirmed working** through the existing OpenAI-compatible path (200 + `OK` on `hermes-4-405b`), so #45's custom-provider work is not needed for chat; #45 step 1 shipped — persisted chat-model allow-list, editor in Settings → AI agents; fixed the chat transcript having no scroll box (`6c4d91d`, regression from `b9983ad`); C54: the documented Rust coverage command is missing the gate's `--ignore-filename-regex` and fails on a healthy tree
- [2026-08-28 · Claude Opus 5](plans/handoffs/2026-08-28-0010-claude-opus-5-model-settings-triage.md) — closed #24; specced model settings (#45); corrected a wrong “blocked upstream” call — Rhizome already supports OpenAI-compatible endpoints; filed #48 OmniRoute; Mycelium duplicate entry point still undecided
- [2026-08-26 · Grok 4.6](plans/handoffs/2026-08-26-1155-grok-4-6-housekeeping.md) — pushed Notes panel / #34 / #31; closed GitHub #27 #29 #31 #34; icon WIP on stash
- [2026-08-25 · Grok 4.6](plans/handoffs/2026-08-25-1430-grok-4-6-vault-credentials.md) — #29: tokens-only redaction before distill; Save to vault refuses. Detector was telemetry-only.
- [2026-08-25 · Grok 4.6](plans/handoffs/2026-08-25-1345-grok-4-6-branches-schedules-markers.md) — #17 `get_session_tree`/`navigate_tree` in Chat; #14 create via `heartbeat_set`/`cron_add`; #18 compact/fork/model markers. Issues not closed (no live-Prime demo).
- [2026-08-25 · Grok 4.6](plans/handoffs/2026-08-25-1255-grok-4-6-prime-queue.md) — Chat shows Prime `get_queue`; Clear → `clear_queue`. Not a local follow-up list
- [2026-08-25 · Grok 4.6](plans/handoffs/2026-08-25-1148-grok-4-6-prime-surface-check.md) — mechanical Prime adapter snapshot (`docs/prime-adapter-surface.json`); `pnpm prime:surface` / `--github`. Do not clone upstream.
- Everything from 2026-08-24 and earlier: individual files still in
  `docs/plans/handoffs/` (search by date), or for anything before
  2026-08-21, [the archive](plans/handoffs/archive-through-2026-08-20.md) —
  not in date order, search by date or issue number. Pruned from this index
  2026-09-02 per this section's own rule; nothing was deleted from disk.

## ⛔ Standing rule correction — pushing (2026-08-15)

**Push when the pre-push gates pass. You do not need to ask.** That is what
`AGENTS.md` §"Commits & pushes" says and always said: *"Commit locally, push to
origin main when pre-push gates pass."*

Session handoffs dated 08-14 and 08-15 carry a contradicting rule ("do not push
until asked"). **It is stale.** It began as a workaround while the **`knispo`**
GitHub account was suspended (C8) and every push errored, then propagated by
each handoff copying the previous one until it outranked the binding doc.

This repo's origin is **`tuckcode/rhizome-agent`** — a different account, which
pushed successfully twice on 2026-08-15. C8 never applied here; it is inherited
Desktop context, like the rest of the pre-fork history.

What it cost: 20 commits sat unpushed behind two failed attempts, and the
failure cause (an incomplete Playwright fixture pin) went undiagnosed until
someone ran the lane. Unpushed work also diverges quietly when more than one
agent is committing to the tree.

Still true, and not what this rule was about: **never `--no-verify`**, and a
push is not a release — releases are tagged builds with signed installers.

---

## Rhizome Agent — identity

**This is `tuckcode/rhizome-agent` (private), not `knispo/rhizome`.** See `docs/IDENTITY.md`. Desktop history below is inherited from the Option C bootstrap snapshot and is useful background; product direction here is Prime harness chat.

## Current state

**TOP PRIORITY (user, 2026-07-19): is there even a reliable trigger/save method for memories/wiki entries?** The user's framing (verbatim intent): "I'm just not sure we have a reliable trigger/save method for memories/wiki." This is an OPEN question, not a known bug — treat it as an investigation, not just a fix. Three concrete directions the user asked for:

- **(a) OPEN — test with a blank wiki.** Spin up an empty/fresh vault and try the full save loop (agent memory-save, Distill, menu-bar capture) — see what actually happens end to end with nothing pre-existing. Needs a human at `pnpm tauri dev`; the harness can't drive this.
- **(b) DONE 2026-08-02** → `docs/plans/2026-08-02-competitor-trigger-research.md`. Checked `docs/`, Portent's `portent.md` (a one-line stub, no design content — nothing to draw on there) and prior project notes first, then researched Mem0/OpenMemory, Letta/MemGPT, ChatGPT memory, Claude Code memory, and Obsidian's Templater as a structural analog. Four distinct "who decides a save happens" philosophies found (system-automatic, model-tool-call, user-explicit, deterministic-but-bypassable); Rhizome's six entry points already span three of them, so the research doesn't argue for adopting anyone else's model. What it does validate: none of the four leave a trigger as unread write-only metadata the way Rhizome did pre-finding-1, and the industry's answer to silent memory failure is auditability, which is what findings 7 and 8 (both closed 2026-08-02) were.
- **(c) DONE — audit our write path.** All 10 findings from the 2026-07-31 audit closed 2026-08-02. Key files: `create_note_content` (`commands/vault/file_cmds.rs`), distill writers (`rhizome_distill.rs`, `rhizome_api.rs`), `.rhizome/events.jsonl` append/read, and the agent-driven MCP/tool save path.

**Only (a) remains open on this question.** Closing the audit (c) is not the same as answering the user's original question — the research (b) explicitly does not substitute for actually running the save loop against a blank vault.

**Investigation done (2026-07-24).** Write path is mechanically sound; the *triggers* were not. Four gaps were identified — **status as of 2026-07-26, all verified in code:**

1. ~~Inbox automation defaults OFF~~ — **closed 2026-07-31.** Default is ON when unset (`src/utils/inboxAutomation.ts`, `value !== false`), and the missing migration now exists: `migrateInboxAutomationDefault` (`src/utils/configMigration.ts`) clears a stored `false` once per vault so existing vaults get the new default too. **Root cause found:** `SettingsPanel.handleSave` writes `inbox_automation_enabled` on *every* save (`SettingsPanel.tsx:488`), seeded from `Boolean(null)` === `false` — so the persisted `false` was an artifact of any unrelated Settings save, never a user choice. That is what makes clearing it safe. Flag is **per-vault** (`tolaria:inbox-automation-migrated:<path>`); a global flag would migrate only the first vault opened.
2. ~~Menu-bar capture doesn't log an event~~ — **fixed**, `menu_bar_capture.rs:129` calls `append_vault_event`. `create_note`/`save_note` also log now (`commands/vault/file_cmds.rs:158,182`).
3. ~~Distill-clipboard is an unwired stub~~ — **wired** (`5c208466`).
4. ~~No standing instruction nudges agents to save proactively~~ — **shipped** in the seeded `AGENTS_MD` (`vault/getting_started.rs`, "Saving durable knowledge" section).

**Workstream A audit DONE 2026-07-31, all 10 findings CLOSED 2026-08-02** → `docs/plans/2026-07-31-save-path-audit-session-status.md` (its status table is the per-finding source of truth). All six entry points (Research panel, menu-bar, inbox watcher, MCP, CLI, hand-edit) traced end to end.

**Audit verdict at the time: the write path is reliable; the trigger path was not — nothing read `trigger`.** Six sites carefully populated a write-only field, behind four independent writers with divergent field sets, five distinct field shapes in a single real 15-event log, and 33% of real events carrying no `trigger` at all.

**That gating decision was made — `trigger` got a reader, not the delete.** `sourceFor` (`src/utils/menuBarActivity.ts`) maps it to a label the activity feed renders, so the field now pays for itself. **All 10 findings are closed as of 2026-08-02**; the status table at the top of the audit doc is the source of truth per finding. The last to close was finding 7 — `let _ = append_vault_event(...)` at three sites, replaced by `append_vault_event_best_effort`, which still refuses to fail a save because logging failed but now logs a warning saying so. Swallowing there is deliberate, documented and regression-tested rather than implied by a bare `let _ =`.

**Still genuinely open from that area (not findings, noted in passing):** nothing rotates `.rhizome/events.jsonl`, and the reader caps at the newest 200 lines — so the file grows without bound. Native confirmation of the activity-feed source labels is C13.

**Menu-bar companion — capture/activity/vault-context WIRED + committed** (`11e7ca65`, 2026-07-19). Popover now works: quick-capture, activity feed, vault label. Distill-clipboard wired (`5c208466`, 2026-07-19) — reads clipboard, calls `start_rhizome_job` with `rhizome_distill`, sets flash, refreshes activity. Needs native QA (`pnpm tauri dev` → click tray mark → type → Enter). Detail: `docs/plans/2026-07-19-menu-bar-companion-skeleton-session-status.md`.

**Design specs banked** (Fable 5): `docs/design/onboarding-walkthrough.md` and `docs/design/shell-final-direction.md`. Spotlight walkthrough was **specced, never built** — Welcome + AI-agents onboarding exist; the in-app tour does not.

**Wave 5.3 — icon command rail — BUILT 2026-07-24 (Opus).** `src/components/CommandRail.tsx` (46px fixed left rail), gated on `useFeatureFlag('shell_command_rail')`. Default ON (`cce13385`). Detail: see HANDOFF items 4 and 4b.

**Wave 5.4a — node bullets + link-count chips — BUILT 2026-07-24 (Opus).** `LinkCountChip` in `NoteItem.tsx`. Sidebar node dots gated behind command-rail flag.

**Wave 5.4b — three-pill status bar — BUILT 2026-07-24 (Opus).** Committed `2a5b35c3` + `bbc3c154`.

**Wave 5 (brand/shell) — 5.0 done (2026-07-25 final state).** Canonical mark: 5-satellite asymmetric grayscale, cyber teal-green. `BrandMark.tsx` rewritten to brand-fixed hex. See `docs/adr/0157-canonical-brand-mark.md` for history.

**Wave 5.4 (AI bubble + Hermes icon) — done, 2 commits, native-verified live.** Floating button glyph no longer flickers on launch. Icon replaced off-brand Tolaria H-mark with LobeHub MIT-licensed mark.

**One Brain migration (Python CLI → Rust core) — steps 1-5 of 6 done.** All Research panel verbs route through Rust. `grok_import` ported as `rhizome_grok_import.rs`. MCP external agents route through Rust sidecar (`3a85397f`), not Python.

**Alpha roadmap — all of Alpha-1 through Alpha-5 shipped.**

**Wiki Graph view** — working; later adds include search/type filters/legend/key (`b5743997`, `d326cf2e`) and exit control / Escape (`e729fdaa`).

**Post-alpha product work landed on main (since `alpha-v2026.7.25-alpha.0001`, ~53 commits)** — not yet in a published GitHub Release while GH account is blocked (below):
- Vault access tiers (RW/RO/hidden) + ADR-0160; `ValidatedPathMode::Writable` on mutating cmds
- Browser-extension bridge auth + `rhizome_save_capture` + inbox_action frontmatter
- Menu-bar capture into active vault; network shell default ON
- Graph search/filters/legend; AGENTS.md refresh on vault open
- Crate rename `tolaria` → `rhizome` in logs (`rhizome_lib`)

### Session 2026-07-27 (Hermes)

**Shipped locally (commits on main, not pushed):**
- `7baec078` — fix: suppress AGENTS.md watcher flash on vault reload. `reload_vault` rewrote managed `AGENTS.md`; watcher treated it as external → second "Reloading vault..." flash. Frontend marks `AGENTS.md` as app-owned write before `reload_vault` (`src/utils/managedVaultReloadWrites.ts` + vaultLoaderCommands + useRecentVaultWrites).
- `04744c4b` — status-bar theme toggle under fixed color themes: leave pinned skin back to Rhizome so mode can change.
- **Theme toggle “does nothing” (follow-up):** real issue on Rhizome default too — status bar waited for `save_settings` before React state/`useThemeMode` updated (Settings already applied appearance immediately). Fix: (1) optimistic `setSettings` in `useSettings.saveSettings` before disk write + rollback on failure; (2) `handleToggleThemeMode` applies appearance + localStorage immediately like Settings. GraphView uncommitted `scopedData!` bangs cleaned to a proper null-guard (not a functional product change).

**Local package:**
- macOS DMG with post-alpha HEAD (pre theme-toggle commit unless rebuilt): `~/Downloads/Rhizome_0.1.0_aarch64.dmg` (unsigned aarch64). Built via `pnpm tauri build --target aarch64-apple-darwin --bundles dmg`.
- Windows NSIS **cannot** be built on this Mac; needs CI (`Release (Alpha)` workflow) once GitHub is unblocked.

**BLOCKER — GitHub account suspended (2026-07-27):**
- `gh` API + `git push` → `Sorry. Your account was suspended` / SSH fatal.
- Public pages for `knispo` / `knispo/rhizome` return 404 while suspended (expected hide).
- Likely security hold after new phone/device; login email is **`284109516+tuckcode@users.noreply.github.com`** (not the leftover git `user.email` `284109516+tuckcode@users.noreply.github.com`).
- Unblock path: browser login + security challenge → `gh auth login` → `git push origin main` → Actions → **Release (Alpha)** → Run workflow for Win+Mac installers.

**Onboarding (diagnosed, no product change yet):**
- Welcome already has **Open existing vault** (optional skip).
- Skipped when any remembered vault path `exists` on disk — DMG reinstall does **not** wipe app data or WebView `localStorage` (`tolaria_welcome_dismissed`, AI-agents dismissed keys).
- Spotlight walkthrough: planned/spec only, never shipped.
- Force Welcome: wipe `~/Library/Application Support/ai.rhizome.agent` (and/or move vault).

**Key decisions (locked, don't re-litigate):**
- Research panel yes, MCP bridge deferred (browser-extension bridge is a separate shipped lane)

**Git state** (verified 2026-08-29):
- `origin` = `https://github.com/tuckcode/rhizome-agent.git` (**PRIVATE**). Push when pre-push gates pass.
- Do not add `knispo/rhizome` as a remote — that is Rhizome Desktop. See `docs/IDENTITY.md`.
- Don't touch `.claude/settings.local.json`, `Fable-5s-one-brain-architecture-rhizome.md`

**Reading order for a fresh session:**
0. If non-Anthropic model: `docs/CROSS-MODEL-HANDOFF.md`
1. This file
2. `docs/plans/*-session-status.md` with latest date
3. `docs/ARCHITECTURE.md`
4. `docs/plans/2026-07-10-rhizome-desktop-alpha-roadmap.md`
5. `AGENTS.md` at repo root

## Open threads
- **C65-RESOLVED (2026-09-05): the debug bundle can't run natively while the installed app is open — diagnosed, not a defect to fix.** `tauri-plugin-single-instance` enforces one process per bundle identifier, and the debug bundle and `/Applications/Rhizome Agent.app` both carry `ai.rhizome.agent`. Launching the debug bundle (via `open -n` or its raw executable) while the installed app is running silently forwards to the installed instance and the new process exits instantly with no log output — it never stays alive to attach to. This is the actual mechanism behind two prior sessions' "Codex native controls select the wrong app by bundle ID" observations; it's not an attachment/selection quirk, the debug process is genuinely not there. **Workaround, verified working:** quit the installed app first (`osascript -e 'tell application id "ai.rhizome.agent" to quit'`), then launch the debug `.app` — it runs as its own process, confirmed by executable path (`ps aux`), and cua-driver attaches by pid normally. Always ask before quitting the installed app — it may hold unsaved chat/note state. Not filing this as a product bug to fix: single-instance-per-identifier is standard, intentional behavior; the fix is procedural (quit-then-launch), not code. Detail: [2026-09-05-0620](plans/handoffs/2026-09-05-0620-claude-sonnet-5-a1-connections-routing.md).
- **C61-VERIFY (2026-09-05): native Graph navigation discarded unsent drafts and hid current chat.** Reproduced twice; sent history recoverable from saved session. Regression failed before keep-mounted fix, then passed; focused panel browser check passed. Final Claude-edited source/native verification is separate. See latest GPT-6 handoff audit.
- **C62-FIXED-NOT-NATIVE-VERIFIED (2026-09-05): Inbox retained an old untitled row after automatic rename.** The list mutations in `useVaultLoader.ts` compared paths with raw `===` while the rename flow finds its entry with `notePathsMatch`, which normalizes separators and macOS's `/private/tmp` alias. A differently-spelled path made `replaceEntryByPath` silently no-op, so the old row survived while the post-rename reload added the renamed file — two rows for one file, cleared by a restart because that re-reads disk. `replaceEntryByPath`/`removeEntryByPath`/`removeEntriesByPath` now use the same normalized comparison, and replace drops a duplicate already sitting at the new path (a file watcher can list it first). Regressions in `useVaultLoader.extra.test.ts`. **Reproduced from source reasoning, not re-observed natively** — the original sighting was native, so a native re-check is still owed.
- **C63-FIXED-NOT-NATIVE-VERIFIED (2026-09-05): one-result graph search over-zoomed the node.** `zoomToFit` frames the graph's bounding box and a single node is a zero-size box, so the camera flew arbitrarily close and one note filled the canvas. `clampedCameraPosition` (`src/components/graph/cameraFraming.ts`, pure + unit-tested per that directory's "keep the WebGL file imperative" rule) pulls the camera back to `MIN_CAMERA_DISTANCE` while keeping its heading; all three `zoomToFit` sites route through it. The zero-vector case (a lone node sits at the origin, so the camera can land there too) falls back to a straight pull back rather than emitting NaN. **`MIN_CAMERA_DISTANCE = 180` is a first guess tuned by reading, not by looking at it** — expect to adjust it once someone sees a one-node graph natively.
- **C64-FIXED-NOT-NATIVE-VERIFIED (2026-09-05): startup transiently said Prime is not installed while the header said live.** The window is up before Prime's service is listening, so the first status poll can answer `not_installed` for an engine that is only still starting — and `PrimeSessionSubhead` renders that as "run npm i -g prime-agent", seconds before correcting itself. `usePrimeHostStatus` now withholds a problem until a second poll agrees with it; a genuinely missing install costs one extra poll (~4s) before the instruction appears. Regressions in `usePrimeHostStatus.test.ts`.
- **C60-MITIGATED-CAUSE-UNPROVEN (2026-09-04, mitigation 2026-09-05): native blank painting after rebuild/relaunch.** User saw white; Codex screenshot confirmed blank while accessibility controls remained live. Graph canvas drew but surrounding UI did not. Resize/reload/view switch did not restore it; full quit (process exit verified) and Finder relaunch did.

  **Leading mechanism, found 2026-09-05 and verified against source:** the saved window frame is restored **twice** at launch — `restore_main_window_state` from `lib.rs:435` during setup, then `restore_main_window_state_from_handle` again on `RunEvent::Ready` (`window_state.rs:56-59`) — and `apply_window_frame` called `set_size`/`set_position` unconditionally both times. Resizing an NSWindow while WKWebView is still doing its first layout is a documented way to desync its compositing layer, which fits every part of the report: it sits below the DOM (so a re-render into the same stale backing store cannot fix it), it spares independently-composited layers (so the WebGL graph canvas still painted while ordinary UI did not), and it needs a process restart rather than a reload. A rebuild is also more likely to produce a saved frame that differs from current geometry, forcing a real resize instead of a no-op — which fits the intermittency being tied to rebuild-and-relaunch.

  `frame_needs_applying` now skips a restore that would not move the window, removing the redundant second resize. **This is a mitigation for an unproven cause, not a confirmed fix.** Do not close this on the strength of a few clean launches — the bug was always intermittent, so absence of a repro is weak evidence. Two things also worth knowing before re-investigating: prior sessions' guesses were wrong, and **"reload didn't fix it" may never have tested a real page reload** — no `Cmd+R` binding was found in `useAppKeyboard.ts`, `lib.rs`, or `menu.rs`; the only in-app "reload" is `reload-vault`, which refetches files rather than reloading the document. Persisted zoom was investigated and ruled out (`useZoom.ts:11-26` clamps to 80–150 and falls back to 100).
- **C59-RESOLVED (2026-09-03, uncommitted): the 448px Chat note pane was almost entirely clipped at an 834px app width while Sessions occupied its own Chat column.** Atticus rejected the column: in Command-Rail mode, `PrimeSessionList` mounts into the rail's blank middle, below Chat/Inbox/Wiki Graph/Mycelium/Research/Changes and above rail controls. The rail starts compact and opens as a whole on hover; `Keep rail open` pins it, `Collapse rail` returns it to hover mode, and dragging its right edge resizes the remembered 180–360px open width. Classic-shell fallback keeps its prior column. Focused Playwright and visible-browser checks pass.

- **C58-OPEN (2026-09-02): 3 Rust tests fail from a broken symlink on this
  machine, not the repo.** `pi_cli::tests::run_agent_stream_*` `.unwrap()`
  on inspecting `~/.pi/agent/skills/hyperframes`, which resolves through
  `~/.claude/skills/hyperframes` to a **self-referential symlink** at
  `/Users/dtc/code/mods-plugins/agent-skills/claude/hyperframes` (points to
  itself, dated 2026-08-31 — pre-existing). Blocked a push for a docs-only
  commit. **Awaiting Atticus:** OK to delete that symlink, and should these
  tests stop depending on real `~/.pi/agent/` state?

- **C57-OPEN (2026-08-29): permission mode product choices after Prime fix.** Code shipped: Prime ignores vault-safe prompts and defaults new sessions to power user; Claude Code / Antigravity still enforce stored mode; UI copy is **Limited tools** / Power User. **Awaiting Atticus:** keep CLI agents defaulting to Limited tools (`safe`)? keep the Prime permission toggle hidden? final naming — "Limited tools" vs retaining "Vault Safe" with an honest tooltip.

- **#50 (2026-08-29): let the agent see the running app — plan ready, not built.**
  Three answers proposed: show `pnpm dev` (not native), read + steer through
  `__rhizomeTest` (not click/type), ship as `pnpm live-ui` beside `pnpm deadcode`
  (not a product pane). Awaiting Atticus.
  [plan](plans/2026-08-29-live-app-view-plan.md) ·
  [session](plans/handoffs/2026-08-29-0158-grok-4-6-live-app-view-plan.md).

- **C56-RESOLVED (2026-08-30): both live-daemon defects were the daemon
  treating a reconnecting Rhizome as a stranger, not a queued-input model
  Rhizome never spoke.** Root-caused against the installed `prime-agent`
  0.8.0's own bundled source (`~/.local/lib/node_modules/prime-agent/dist/bundle`),
  not guesswork:

  - **`live_daemon_round_trip`.** Every session Rhizome creates is
    `lifecycle: "client_owned"`, scoped to the daemon's per-connection
    `ownerClientId`. `command_envelope` never sent a `clientId`, so each
    reconnect got a fresh anonymous one from the daemon and could never see
    its own prior session again — and separately, `list` only reports the
    *visible* (non-owned) roster unless the caller passes
    `includeClientOwned: true`, which `find_resumable_session` never did.
    Either gap alone was enough to make `ensure_host()` after
    `shutdown_host()` return an empty session id. Fixed by generating one
    `clientId` per process (`client_id()`, a `OnceLock<String>`) and sending
    it on every envelope, adding `includeClientOwned: true` to the `list` in
    `find_resumable_session`, and making `shutdown()` wait for the daemon's
    `detach` response (via `send_bare_command` instead of a fire-and-forget
    `write_raw`) so the very next `list` doesn't race a `detach` the daemon
    hasn't processed yet and still see `attachedClients: 1`.
  - **`live_goal_round_trip`.** `send_goal_command` calls
    `abort_and_wait_for_idle()` to interrupt the goal's own continuation
    before replacing it; the daemon's `abort` (`requestAbort` internally)
    suspends the session's input pump as a side effect, and nothing in this
    module ever lifted that suspension — so the replacement `/goal` right
    after it was refused with "Cannot admit a session action while queued
    session input is suspended." `acquire_session_input_pause` /
    `release_session_input_pause` turned out to be a different, unrelated
    pause mechanism; the actual counterpart is `resume_queue`, confirmed
    against the daemon source. `abort_and_wait_for_idle` now calls
    `resume_session_input_pump()` once the session is confirmed idle, which
    sends `resume_queue` and tolerates its "No queued work to resume" answer
    (expected right after an abort — the pump is unsuspended as its side
    effect regardless of that response).

  Both fixes verified against the live daemon (`prime-agent status`
  reachable), not just read as "looking right": `live_daemon_round_trip` and
  `live_goal_round_trip` are green, and `cargo test --lib` is still
  1704 passed / 0 failed. `live_session_naming` and
  `live_quit_stops_our_session_by_default_and_keeps_it_when_asked` still fail
  — the former pre-dates this change (reproduced on a clean checkout before
  touching anything), the latter is the documented
  `RHIZOME_TEST_DAEMON_SOCKET` precondition — neither is C56.

  **A third failure looked like a product bug and is not.**
  `roster_against_the_live_daemon` reports "expected at least one session"
  while a Rhizome window is open, and a manual `list` over the daemon socket
  returns `{"sessions":[]}`. That is **#28 working as designed**: a vault
  attach creates no Prime session, and one is not created until the first
  prompt. An idle app legitimately has zero sessions, and `prime-agent
  status` agrees.

- **C55-RESOLVED (2026-08-29): the text-only-model warning did not fire when
  the daemon's `get_state` model omitted `input`.** RPC mode returns `input` on
  every model; the live daemon often sends id/name only, so
  `model_accepts_images` stayed `None` and the composer stayed silent. Restored
  a cached `get_available_models` lookup by provider+id when `get_state` omits
  `input` (`c423445`). Regression:
  `status_falls_back_to_the_catalog_when_get_state_omits_input`. Frontend path
  unchanged (`AiPanel.textOnlyModel.test.tsx` still green).

- **C54-RESOLVED (2026-08-29): the documented Rust coverage command was
  missing the gate's `--ignore-filename-regex "lib\.rs|main\.rs|menu\.rs"`**,
  so it reported 84.88% and exit 1 on a tree the hook passes at 85.68%.
  Without the flag, `lib.rs`/`main.rs`/`menu.rs` boilerplate drag the total
  below 85% even when product code passes. `AGENTS.md`, `GETTING-STARTED.md`,
  and `CROSS-MODEL-HANDOFF.md` §13 now match `.husky/pre-push` and
  `.chunk/run-rust-gate.sh`. Confirmed against a worktree at `087880d`, so it
  was never a regression. Full numbers and the shell-pipeline mistake that
  produced the first, wrong diagnosis:
  [2026-08-28-0300](plans/handoffs/2026-08-28-0300-claude-opus-5-model-allow-list.md).

- **C51-RESOLVED (2026-08-26, `373ee1f` / `2360cb5` / `9e50a8d`): Promote
  accepted the empty-turn placeholder as content.** Guarded with
  `isTransientAgentFailureText`, the predicate auto-distill already used —
  which widened the fix to error payloads and OAuth failures, equally
  promotable and equally not knowledge. **#24 closed.** Detail:
  [2026-08-26-2245](plans/handoffs/2026-08-26-2245-claude-opus-5-livecheck-and-mycelium-skin.md).
  **When citing it:** the empty turn was almost certainly C53's dying worker,
  not a flaky `stealth/ox-alpha`.

- **C53-RESOLVED (2026-08-27, fixed `be23da8`): a vault in `~/Documents`
  silently breaks every chat turn on macOS.** `Info.plist` declared no
  `NSDocumentsFolderUsageDescription`, so macOS never prompted and the app
  could not obtain access even when properly bundled; Prime's session worker
  then died at launch on `process.cwd()` (`EPERM … uv_cwd`) and Chat showed a
  generic 30s timeout. **It reads exactly like a model failure and is not
  one.** Keys added, guarded by `src/utils/macOsFolderAccessConfig.test.ts`.
  Chain and daemon-log evidence:
  [2026-08-27-2223](plans/handoffs/2026-08-27-2223-claude-opus-5-failure-legibility.md).

  **Still open:** (a) decide whether the session cwd should be the vault at all
  — `pick_resumable_session` keys sessions on cwd and Prime runs shell commands
  there, so changing it is ADR territory; (b) surface a real error instead of a
  30s generic timeout when a worker fails to start.

  **Every rebuild re-prompts** (confirmed repeatedly 2026-08-28): a fresh
  build's ad-hoc signature is a different app to macOS, so the grant is dropped
  and the window renders blank until the prompt is accepted. The dev binary has
  no bundle identifier and can never hold the grant at all — protected-folder
  behaviour is only testable from a bundled `.app`.

- **C52-RESOLVED (2026-08-30): the AI chat Playwright specs are stale against the
  chat-centered shell.** Fixed `tests/smoke/ai-chat-history.spec.ts` against the
  real current UI (`prime-session-subhead`'s **New chat** control, not the unused
  `ai.panel.newChat` string; no whole-panel close/reopen exists post-ADR-0166, so
  that scenario is now "switching sessions in the sidebar preserves each one's
  own history"). A first pass made two tests green by deleting the behavior they
  checked while keeping the old names — caught before commit, see `1f73a68`/
  next commit. All 4 pass, `--repeat-each=2` clean.

- **C50-DECIDED (2026-08-24): selective harness doctrine.** Rhizome absorbs
  contracts and artifacts from other harnesses, never their control loops or
  memory stores. Prime remains the only execution core. Coverage is by user
  job, not Prime command count. Ledger: `docs/design/harness-doctrine.md`,
  ADR-0168. Source reviews and divergence scoring are in `docs/plans/2026-08-24-*`.
  OpenHuman: TokenJuice compression path read 2026-08-26
  (`docs/design/token-routing-and-compression.md`); full stack still unread.
  Composition (option 2) is written but unratified:
  `docs/design/harness-composition.md`, pickup in `docs/NEXT.md` §1.

- **C49-RESOLVED (2026-08-23): Mycelium did not white-screen.** The original
  native audit clicked the wrong rail coordinate: its before/after screenshots
  are identical and Mycelium never became active. A precise browser click on
  the accessible `Mycelium` control showed the white-looking Suspense fallback
  immediately, then the full `MyceliumView` 1.5 seconds later. The view, empty
  session state, Refresh, Close, and disabled Open in Mindwalk control all
  rendered normally. This was a bad QA inference from an unverified pixel click
  plus an immediate screenshot, not a renderer fault.

- **C48-RESOLVED (2026-08-23): the two-model picker was the browser mock, not
  the native Prime catalog.** The screenshot showed exactly the two fixtures in
  `src/mock-tauri/mock-handlers.ts` (`Claude Fable 5`, `Grok 4.5`), including
  their provider grouping. The native command does not use that fixture:
  `get_available_prime_models` delegates to Prime's live
  `get_available_models`, which the same session probed at **501 models** across
  six configured providers. No model access was lost and no picker cache bug
  was demonstrated; the QA environment was misidentified. The adjacent Tauri
  package warning is fixed in the current working tree:
  `@tauri-apps/api` now matches Rust `tauri` at 2.11.1 and `pnpm tauri dev`
  launches without the mismatch.

- **C47-IMPLEMENTED (2026-08-24): Prime sessions are foreground-owned by
  default; background work is an explicit grant.** New sessions advertise
  `client_owned_sessions` and create with `lifecycle: "client_owned"`. Idle
  window close detaches (owned worker expires after Prime's grace). Active
  close asks, with **Stop and close** (`complete_owned_session`) as default and
  **Keep working** (`promote_owned_session` then detach). Full quit stops
  owned work and leaves explicitly promoted work resident. The global
  `keep_sessions_running_on_quit` toggle is gone; the settings field still
  parses so old files load. Daemon shutdown is still never sent. Remaining:
  native QA of the close dialog, and UI that distinguishes attached vs
  resident work.

- **C45-RESOLVED (2026-08-23): the Codacy gate was runnable all along, and its
  first run refuted a security review.** `codacy-cli` analyses locally with no
  account and no payment; only the MCP server needs a paid token for a private
  repo, and that server just shells out to the same CLI. AGENTS.md had told
  every session the paid tier blocked the whole gate, so it was skipped for
  months, and the first real run found 95 dependency advisories — two of which
  contradicted a prior review's reasoning. Setup, the trimmed tool set, and why
  Codacy's eslint is excluded are all in AGENTS.md's Codacy section; the
  advisory detail is in
  [2026-08-23-1518](plans/handoffs/2026-08-23-1518-gpt-5-6-sol-mid-turn-and-folder-hardening.md).

  **A gate nobody can run is indistinguishable from a gate that finds nothing.**
  That is the transferable part, and it is why C54 (the coverage command that
  fails on a healthy tree) reads as the same mistake in a different place.

- **C46-RESOLVED (2026-08-23 → verified resolved 2026-08-30): `AiPanel.tsx`
  measured CCN 50 across 447 lines.** The seam this entry named was taken: the
  mid-turn send policy now lives in `src/components/useAiPanelSendPolicy.ts`,
  whose docstring says so in as many words ("This is the seam C46 named
  directly"). Re-measured on 2026-08-30 with the same tool that raised it:

  ```
  codacy-cli analyze --tool lizard src/components/AiPanel.tsx
  NLOC 546 | Avg.NLOC 5.4 | AvgCCN 1.5 | function_cnt 26 | warnings 0
  ```

  Zero thresholds exceeded. Left open in this file for roughly a week after it
  was fixed, which is the failure mode the C-number convention exists to stop —
  a later session reading this list would have gone looking for a hotspot that
  is not there. Re-measure before reopening; do not restore this from the old
  wording.

  (Original 2026-08-23 detail on the lizard warning and the seam it named is
  in git history for this file, not repeated here — pruned per this file's
  own rule since C46 is resolved and re-verified.)

- **C44-RESOLVED (2026-08-23): Prime follow-up admission now
  propagates through Rust.** `queue_message` returns `data.queued` for
  `follow_up`, while a successful `steer` keeps its prior success semantics.
  Fake-daemon command-boundary tests cover accepted and declined follow-ups plus
  steer.

- **C43-RESOLVED (2026-08-23): mid-turn fallback no longer drops
  messages through stale state.** The frontend distinguishes accepted,
  no-longer-running, and transport-failure results. Fallback reads the latest
  controller state and starts a new turn only when it is idle; a transport
  failure keeps the draft. The regression starts active, resolves the follow-up
  after rerendering idle, and proves the latest send callback receives it.

- **C42-OPEN: Rhizome Agent has never been launched on Windows, and the docs
  said otherwise.** Atticus, 2026-08-22: *"i forgot it doesnt work on windows
  right this sec / never launched atleast."* That is a different and larger
  claim than #32, which scopes the Windows gap to the Prime daemon transport:
  if the app has never started there, the daemon is not the first thing
  blocking it, and #32's named-pipe work (`1922a27`, `326930b`) sits behind an
  unknown rather than being the last mile.

  `docs/WINDOWS-DEV.md` opened by asserting Rhizome Agent is "a first-class
  Windows app" whose "notes, editor, search, git, wiki, and MCP all work on
  Windows." **None of that had been observed by anyone.** It was written from
  what the code targets. Corrected in place — the doc now leads with the real
  status. This is the failure mode AGENTS.md already names: self-reported
  claims in this repo have a track record of not surviving verification, and a
  setup doc reads as a report even when it was only ever a plan.

  First action for whoever has a Windows machine: `pnpm tauri dev` and record
  what actually happens, before touching the daemon at all.

- **C41-RESOLVED (2026-08-22): `pnpm test:mcp` never ran `mcp-server/test.js`.**
  The script globbed `mcp-server/*.test.js`, which matches
  `tool-service.test.js` and `vault-events.test.js` but not `test.js` — so the
  stdio-lifecycle, vault, `vault-path`, `agent-instructions` and `ws-bridge`
  suites, **49 tests**, ran on no gate. This is the mirror image of the July
  finding that `tool-service.test.js` was ungated because vitest's `include`
  did not reach `mcp-server/`: both times the fix was to the glob, and both
  times everything was green while it was unreachable. The script now names
  `test.js` explicitly (`node --test mcp-server/test.js mcp-server/*.test.js`);
  `pnpm test:mcp` went from 16 tests to 67. Do **not** widen it to
  `mcp-server/*.js` — that imports `index.js`, which starts the server and
  hangs forever.

- **C40-OPEN: `rhizome_graph_summary` answers with a different graph than the
  app's own.** It shells out to the external `rhizome-graph` CLI. Measured
  2026-08-22 on `~/Documents/Rhizome Vault`, side by side with
  `vault::graph::build_graph`:

  | | `rhizome-graph` | in-repo `build_graph` |
  |---|---|---|
  | pages / notes | 144 | 155 |
  | edges | 84 (`summary`) / 64 (`export`) | 174 |
  | uncreated targets | dropped entirely | 37 |
  | dead links | underivable | 51 |

  Three separate defects: `summary` and `export` disagree with **each other**
  by 20 edges because the export collapses distinct slugs (`entities/rhizome`
  and any other `rhizome` become one node); uncreated wikilink targets are not
  emitted at all, so orphan and dead-link questions cannot be answered from it;
  and `communities` returns 112 groups for 144 pages, which is 107 singletons
  wearing a cluster label. The new `rhizome_graph_*` tools (#39) are built on
  the in-repo graph and deliberately have **no fallback** to the CLI — an agent
  quoting 144 notes at a user looking at 155 in the graph view is worse than a
  tool that says it needs `RHIZOME_TOOL_PATH`. What remains open is
  `rhizome_graph_summary` itself, which is still wired to the CLI in both
  `mcp-server/index.js` and `rhizome_commands.rs`. Retiring it in favour of
  `rhizome_graph_health` is the obvious move; it was left alone here because
  removing a tool agents may already be calling is its own change.

- **C39-OPEN: the live-daemon tests are not isolated, so running them litters
  the real session store.** Found 2026-08-22 by running the six `#[ignore]`d
  live tests for the first time. `RHIZOME_PRIME_DAEMON_SOCKET` isolates the
  *socket*, and an isolated daemon can run with a scratch `--session-dir`, but
  tests that reconnect fall back to the default daemon — one run left **six
  husk sessions** in `~/.prime/agent/sessions` with `tempfile::tempdir()`
  cwds. That is the exact litter #28 removed, so the lane is deliberately not
  scripted until this is fixed.

  **Starting an isolated daemon is itself non-obvious**, so record it here.
  Prime's supervisor `lstat`s the socket path *before* binding
  (`getDaemonSocketIdentity`), so it cannot cold-start on a path that has never
  existed — a real unix socket must be pre-created there. And the path must be
  short: `AF_UNIX` caps near 104 chars, which the scratchpad path exceeds.
  ```bash
  D=/tmp/rzlive/tmp/prime-agent-$(id -u); mkdir -p "$D" /tmp/rzlive/sessions
  python3 -c "import socket;s=socket.socket(socket.AF_UNIX);s.bind('$D/daemon.sock');s.close()"
  TMPDIR=/tmp/rzlive/tmp prime-agent --mode daemon --session-dir /tmp/rzlive/sessions &
  RHIZOME_PRIME_DAEMON_SOCKET=$D/daemon.sock cargo test --lib prime_session_host -- --ignored --test-threads=1
  ```
  5 of 6 pass. `scheduled_work_against_the_live_daemon` needs pre-existing
  scheduled work, which is its own documented precondition.

- **C38-RESOLVED (2026-08-22, code landed `1922a27`, Windows verification pending):**
  Prime harness connects on Windows via `\\.\pipe\prime-agent-daemon`
  (`connect_stream` in `prime_session_host.rs` — `File` + `WaitNamedPipeW`).
  **#32** closed in code; end-to-end proof still needs a Windows machine with
  `prime-agent --mode daemon` running. Setup: `docs/WINDOWS-DEV.md`.

- **C37-PARTLY-RESOLVED (2026-08-21): pushes were slow for two reasons; the
  local one is fixed.** Every pre-push printed `⚠️ Chunk sidecar unavailable`
  and then ran six gates serially — ~4.5 minutes a push.

  **Why the sidecar is unavailable, measured:**
  1. **The `chunk` CLI is not installed.** `resolve_chunk_bin` in
     `.chunk/run-sidecar-gates-local.sh` checks `$CHUNK_BIN`, `PATH` and
     `~/.local/bin/chunk`; none exist, so the script exits 86 and the hook
     falls back. Install is `brew install CircleCI-Public/circleci/chunk`
     plus `chunk auth set circleci`, which needs a CircleCI account — **a
     decision for Atticus, not something an agent should do.**
  2. **`.chunk/config.json` still points at the pre-fork project.** `vcs` is
     `refactoringhq/tolaria` and `orgID` is `39f93336-…`, from before this
     repo existed. Even with the CLI, remote sidecars would target an org this
     repo is not in. Same family as C11's `GETTING_STARTED_REPO_URL`. The
     correct org id for `tuckcode/rhizome-agent` is not known here, so it is
     recorded rather than guessed.

  **Fixed locally instead:** the fallback now runs its three independent lanes
  — frontend (lint, build, coverage, mcp), Rust (clippy, fmt, coverage), and
  Playwright smoke — **concurrently**, each to its own log, printing the
  failing lane's output in full. `LAPUTA_PREPUSH_SERIAL=1` restores the old
  behaviour. This machine has 15 cores; the lanes barely overlap in what they
  use.

  **The frontend lane is the critical path, and coverage is most of it.**
  Timed with the lanes running together: frontend **168s**, Rust 70s,
  Playwright 34s — so the push costs whatever the frontend lane costs. Inside
  it: lint 17s, build 18s, mcp <1s, and **coverage 124s**, because the hook
  pinned `FRONTEND_COVERAGE_CONCURRENCY=1`. Unpinned (the runner defaults to
  the shard count, 2) the same coverage takes **85s**. Four shards measured no
  better than two, so a fixed cost — vitest startup, instrumentation, merging
  — dominates below that. Cutting further means not running all 5482 tests on
  every push, which is a different decision than a knob.

  **The smoke lane was never about test count.** `playwright.smoke.config.ts`
  had `workers: 1`, so 26 tests ran strictly one at a time — ~110s on a
  15-core machine. At `workers: 4` the same 26 tests take **~34s**, verified
  stable across two runs with retries disabled. No test was cut: the lane was
  not too big, it was single-file. `PLAYWRIGHT_SMOKE_WORKERS` tunes it.

  Also fixed while in there: `.chunk/config.json`'s `typecheck` gate ran
  `npx tsc --noEmit`, which C35 proved typechecks **zero files**. It is
  `pnpm typecheck` now — so if the sidecar is ever revived, its typecheck lane
  will actually check something.

- **C36-RESOLVED (2026-08-21): a celebration's `message` now has somewhere to
  go.** `CelebrationToast` shows the agent's line for 4.5s with an optional
  "From <name>", dismissable early. It appears only when the celebration
  actually fires — a refusal is silent in both halves, since showing the words
  while suppressing the confetti would turn the cooldown into a second, quieter
  celebration. `role="status"` because the cannon's canvas is `aria-hidden`
  decoration, making the toast the only part of a celebration a screen reader
  can reach.

- **C34-RESOLVED (copy + locale wiring): the menu-bar roster's activity labels.**
  The eight statuses are no longer English literals in `primeRunningSessions.ts` —
  the module returns a `RosterActivity` (`{kind:'summary'}` for the daemon's own
  prose, `{kind:'status', key}` for copy we own), the keys live in
  `menuBarCompanion.activity.*` in `en.json`, and `MenuBarCompanionApp` renders
  them through `t()` using the user's locale from `get_settings` (same
  `resolveEffectiveLocale` path as the main app). **`pnpm l10n:translate` has
  never run for these keys** — it needs `LARA_ACCESS_KEY_ID` /
  `LARA_ACCESS_KEY_SECRET`, which are not set on this machine, so non-English
  locales fall back to English for the eight new keys until C18 is in scope.
  That is C18's existing gap (272 missing per locale before this change, 280
  after) — the change did not create the gap but did widen it by 8.

- ~~C4-OPEN: tolaria MCP server path mismatch across live configs~~ **RESOLVED `2fa620a5`**
- ~~C6-OPEN: inbox automation default~~ **RESOLVED 2026-07-31.** Default ON for new vaults, plus a one-time per-vault migration for existing ones. See "Investigation done" item 1 above.
- C7-OPEN: native QA for shell waves — requires a real `.app` bundle or Accessibility permission. Do not graduate shell flags without it.
- **C8-NOT-APPLICABLE-HERE: GitHub account suspended** — this is the **`knispo`** account, inherited from the pre-fork Desktop history. This repo pushes to **`tuckcode/rhizome-agent`**, which works (verified 2026-08-15, two successful pushes). Left in the list rather than deleted because it is still the origin of the stale "do not push until asked" rule corrected at the top of this file. Original entry: GitHub account suspended — blocks push + Windows CI release for friend build. Unblock tonight from home device/`284109516+tuckcode@users.noreply.github.com`.
- **C11-OPEN: `GETTING_STARTED_REPO_URL` still clones `refactoringhq/tolaria-getting-started.git`** (`src-tauri/src/vault/getting_started.rs:6`) — an unrelated upstream project. The seeded `AGENTS.md` link was removed 2026-07-31, but this one is a *functional* clone URL behind the Getting Started flow, so it can't just be deleted. Needs a replacement starter-vault repo under `knispo` — blocked on GitHub access. Full breakdown incl. what must NOT be renamed: CROSS-MODEL-HANDOFF §6.
- C9-OPEN: optional first-run Welcome even when a default vault already exists (user wants optional onboard with skip-to-existing). Product decision pending.
- C10-OPEN: spotlight onboarding walkthrough still unbuilt (`docs/design/onboarding-walkthrough.md`).
- **C12-RESOLVED (2026-08-19): the exposed GitHub PAT is revoked and no local copy remains.** A fine-grained PAT (`github_pat_…`) had been configured as `mcpServers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN`, captured into session transcripts.

  **How it actually leaked — measured, and not what this entry previously claimed.** The original note blamed `ps aux` making the env var world-readable. The redacted transcripts show otherwise: **76 of the 78 occurrences are the MCP config block itself**, in the form `"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_PERSONAL_ACCESS_TOKEN":"…"}`. The remaining 2 are later sessions discussing the leak. The vector was mundane — the secret lived in a file that agents routinely read (`~/.claude.json`), so every config inspection copied it into a transcript. `ps aux` exposure is real but is not what happened here, and the distinction matters because the prevention is different.

  **The controlled comparison is on the same machine.** Over the same period, with the same agents reading the same kinds of things:

  | Credential | Stored in | Occurrences in transcripts |
  |---|---|---|
  | the exposed PAT | `~/.claude.json`, plaintext | **78** |
  | the `gh` OAuth token | macOS keyring | **0** |

  **Rule: a secret in a config file will eventually reach a transcript; a secret in a keychain will not.** Point MCP servers at a wrapper that reads the credential at launch (e.g. `security find-generic-password -w -s <name>`) so the config holds a reference rather than the value. Plaintext `env` blocks are the *documented* MCP pattern, which is exactly why this needs saying — following the standard setup is what created the exposure.

  Note also that `src/lib/sensitiveTextRedaction.ts` recognises those prefixes.
  Telemetry still uses the diagnostic entry point (paths + whitespace collapse).
  **#29** added `redactCredentialTokens` for vault-bound chat: auto-distill /
  research / menu-bar distill redact-and-continue; explicit Save to vault
  refuses. Prime's `~/.prime/agent/sessions/*.jsonl` is still Prime's to write
  and is local-only.

  Closed on two independent axes, both verified:

  - **Server side:** github.com/settings/tokens shows *"No fine-grained tokens created"* **and** *"No personal access tokens created"* on `tuckcode`. Atticus had already revoked it; nothing is live.
  - **Local side:** the token no longer exists in plaintext anywhere on the machine. `~/.claude.json` was already clean (the 08-16 MCP cleanup); `~/.claude.json.backup` and `~/.claude.json.bak-20260802-154314` were deleted; a `-20260816` backup rotated away on its own; and **78 occurrences across 11 session transcripts** (Jul 24 – Aug 18, all under `rhizome-desktop`/`rhizome`/`Documents-Projects`) were replaced with `github_pat_REDACTED`. Each file was gated before writing: every line re-parsed as JSON and the line count matched, written temp-file-then-atomic-replace. No backups were taken — a backup of a secret recreates the exposure.
  - **This repo was never affected.** The only `github_pat_` match in the tree or in `git log --all -S` is `src/lib/sensitiveTextRedaction.ts`, which lists it as a prefix *to redact*.

  **The old "blocked on GitHub access / rotate once the account is unsuspended" wording was wrong** and stayed wrong for weeks. That precondition referred to `knispo`, the suspended Desktop account (C8). This repo's origin is `tuckcode`, which was never suspended. C12 read as un-actionable the entire time it was actionable — a stale reason copied forward is worse than no note at all.

  Residual, stated for completeness: if the PAT had belonged to `knispo` rather than `tuckcode`, that account's token list is not visible from here. `knispo` is suspended and no local copy survives, so there is nothing further to do without a specific reason to revisit.

  **Lesson worth keeping: revocation is the fix; deleting copies is hygiene.** This audit found the token in four separate places across two passes, and only caught the last two because an unrelated `rm` failed and prompted another look. A future session must not treat "I deleted the files I could find" as closing an exposure.

- **C18-DECIDED — OUT OF SCOPE FOR v0. Do not report this as a blocker, a gap, or a heads-up.** Atticus, 2026-08-16: *"If I go public and there's demand for multiple languages, then I'll consider it. Until then I'm not worried."* Restated 2026-08-21 after a session raised it again anyway. Still put user-facing copy in `en.json` — that is structure, and other code reads from it — say which keys you added in the completion comment, and stop there. `pnpm l10n:validate` failing is the expected state. The facts, kept for whenever it *is* in scope: `pnpm l10n:validate` fails on all 19 non-English locales — no `LARA_ACCESS_KEY_ID`/`SECRET` in any session's environment.** **Verified still present and worse 2026-08-02**: 172 missing keys per locale now, up from ~69 on 2026-07-10 — the gap accumulates every session that adds UI copy without a real translation pass. Named as a known gap in at least three prior docs (`2026-07-10-one-brain-step4c-session-status.md`, `2026-07-03-research-panel-handoff.md`, `docs/design/onboarding-walkthrough.md`) with no fix and no owner. Needs one translate run with real credentials (`pnpm l10n:translate`) — not code, an environment/access problem, but it should stop being silently re-discovered.

  **DECIDED 2026-08-16 — localization is deliberately out of scope for v0. Stop treating this as a blocker.** Atticus: *"If I go public and there's demand for multiple languages, then I'll consider it. Until then I'm not worried."* This is consistent with `CONTEXT.md`, which defines v0 as the **trusted circle** — "Atticus + small trusted users, not strangers-first." Nineteen locales is a strangers-first concern.

  **Consequences, so nobody re-litigates this:**
  - The `pnpm l10n:translate` acceptance box on **#10 and #16 is waived for v0**. Those issues may close with English-only copy. Say so on the issue rather than silently ticking it.
  - New UI copy still goes in `src/lib/locales/en.json`. That rule stands — it keeps strings out of components so a future translate run is one command, not an archaeology project.
  - Do **not** run `pnpm l10n:translate` speculatively.

  **Cost, priced 2026-08-16 so the next session doesn't re-research it:** Lara has a free tier of **10,000 characters/month**, no card required — *not* enough. `en.json` is 73KB across 1,189 keys; the ~172-key backfill across 19 locales is roughly **146,000 source characters** (Lara bills source only, per target language). That's ~$4 of usage on the $24.99-per-1M plan, but the plan is the minimum purchase. So: trivial money, real friction, zero v0 value.

  **Re-open when:** the app goes public *and* non-English demand actually shows up. Demand first, then the key.
- ~~C20-OPEN: global app-config directory still named `com.tolaria.app`/`com.laputa.app`.~~ **RESOLVED 2026-08-02.** `src-tauri/src/app_config.rs`'s `APP_CONFIG_DIR` (the literal OS folder name for global config — `settings.json`, `vaults.json`, `last-vault.txt`, `ai-provider-secrets.json`, `ai-workspace-sessions.json`) was still `"com.tolaria.app"` with `"com.laputa.app"` as a single legacy fallback; neither the tolaria→rhizome identity rename (ADR-0162) nor whatever produced "laputa" before it had ever reached this file. This is a config-dir *rename with fallback*, not a data migration: every write already went through `preferred_app_config_path()` and every read through `resolve_existing_or_preferred_app_config_path()`, so nothing needed an explicit copy step. Fixed: `APP_CONFIG_DIR` → `"com.rhizome.app"`; `LEGACY_APP_CONFIG_DIR` (single `&str`) generalized to `LEGACY_APP_CONFIG_DIRS: &[&str] = &["com.tolaria.app", "com.laputa.app"]` (most-recently-current name checked first), mirroring the `LEGACY_MCP_SERVER_NAMES` pattern already used in `mcp.rs`. `existing_or_preferred_path_in_dirs` now loops over the legacy list per config dir (preferred, then each legacy name in order, before moving to the next config dir) — `previous_platform_config_dir_is_read_when_primary_dir_is_empty` confirms the priority-across-dirs-then-within-dir behavior survived. Existing users' settings are found via the legacy chain on next read and land under `com.rhizome.app` automatically the next time anything saves (e.g. any settings change) — no migration code, no data copy. New test `older_legacy_path_is_read_when_preferred_and_newer_legacy_are_absent` (`app_config.rs`) proves the fallback chain covers *both* old names, not just the newer one — a user who hasn't opened the app since the "laputa" era (skipped "tolaria" entirely) still resolves correctly. `cargo test --lib`: 1317 passed, 0 failed. `cargo clippy -- -D warnings` and `cargo fmt -- --check` both clean.
- ~~C19-OPEN: `DEFAULT_GITIGNORE` seeded stale branding and a dead path.~~ **RESOLVED 2026-08-02.** `src-tauri/src/git/mod.rs`'s `DEFAULT_GITIGNORE` constant (used by `ensure_gitignore`, which only writes `.gitignore` for a vault that doesn't have one yet) had a `# Tolaria app files` comment and ignored `.laputa/settings.json` — neither term matches this app's current name or anything it actually writes; grepped `src-tauri/src/` for vault-scoped `settings.json` writers and found none, that concept is vestigial. Meanwhile the real per-vault data directory, `.rhizome/` (confirmed live via `rhizome_commands.rs:339`, `vault_events.rs:96`, `rhizome_write_location.rs:83/95`, `rhizome_repo_research.rs:141`), holding `events.jsonl` and full cloned-repo caches under `repo-cache/<slug>/`, wasn't ignored at all. Fixed: comment now says `# Rhizome app files`, ignore line is now `.rhizome/` (checked `grep -rn '"\.rhizome"' src-tauri/src/` first — every hit is cache/log/marker use, nothing meant to be shared across machines, so a blanket directory ignore is correct, no negation needed). New/updated tests in `src-tauri/src/git/mod.rs`: `test_ensure_gitignore_creates_file` now also asserts no `laputa`/`tolaria` residue, `test_init_repo_creates_gitignore` now asserts `.rhizome/` is present and no stale branding, and a new `test_default_gitignore_ignores_rhizome_dir_and_has_no_stale_branding` asserts the constant's own content directly. **Scope note — what this does NOT do:** `ensure_gitignore` is create-only, so this only changes what *new* vaults get; it does not retroactively fix any already-created vault's `.gitignore`, and it does not untrack anything already committed to a real vault's git history. One real vault outside this repo was found during this investigation with `.rhizome/events.jsonl`, multiple full `repo-cache/<repo>` clones, and `repo-runs/*.json` already tracked in its own git history — that needs its own separate `git rm --cached` pass, a decision for that vault's owner, not something to do automatically from here.

- **C21-OPEN: eight more live "tolaria" branding residues found and fixed 2026-08-02** — a follow-up sweep to the ADR-0162 identity rename (C19/C20 above) found several genuinely live, functional pieces of stale branding the original rename missed, scattered across unrelated subsystems. Each was individually verified against current code before being touched (not a blind grep-and-replace):
  1. `src-tauri/src/git/author.rs` — `FALLBACK_AUTHOR_EMAIL` (the git author email used when committing to a vault with no configured git identity) was `"vault@tolaria.default"`, writing "tolaria" into real commit metadata. Renamed to `"vault@rhizome.default"`. `LEGACY_FALLBACK_EMAIL` (a single old value, `"vault@tolaria.md"`, that `heal_legacy_local_identity` clears out of a vault's local `user.email` so it stops shadowing global config) generalized to `LEGACY_FALLBACK_EMAILS: &[&str] = &["vault@tolaria.default", "vault@tolaria.md"]`, most-recently-current first — mirroring `LEGACY_MCP_SERVER_NAMES`/`LEGACY_APP_CONFIG_DIRS`. This matters because `"vault@tolaria.default"` was itself a *live current* value until this commit, so once this rename ships it immediately becomes a value real vaults have written that needs healing too, not just the older `.md` one. Fixed hardcoded-literal test assertions that referenced the old value in `git/commit.rs:161,171`, `git/conflict.rs:333`, `git/connect.rs:500` (these check the string the fallback actually writes, so they had to move to `"vault@rhizome.default"` rather than becoming legacy-aware).
  2. `src-tauri/src/git/clone.rs` — test-fixture git identity (`"tolaria@app.local"` / `"Tolaria App"`, used only to seed a source repo for clone tests, not production fallback logic despite initially looking like one) renamed to `"rhizome@app.local"` / `"Rhizome App"` for consistency.
  3. `src-tauri/src/claude_cli.rs` — `LOCALIZED_ERROR_PREFIX = "tolaria:i18n-error:"` (tags localized error messages from the Claude CLI integration) renamed to `"rhizome:i18n-error:"`. **Found two more producers/consumers of the same prefix the brief didn't name**, all of which had to move together or the tag stops round-tripping: `src-tauri/src/pi_events.rs` (a second Rust producer, same constant name, independent definition) and the frontend consumer `src/lib/localizedStreamError.ts` (parses the prefix to recover localized error payloads) plus its test fixture in `src/lib/aiAgentStreamCallbacks.test.ts`.
  4. `src-tauri/src/codex_cli.rs` — temp-file prefix `"tolaria-codex-last-message-"` and literal path `/tmp/tolaria-codex-last-message.txt` (three sites: the real `tempfile::Builder` prefix plus two test-assertion literals) renamed to the `rhizome-codex-*` equivalents.
  5. `src-tauri/src/telemetry.rs` — Sentry tag names `"tolaria.build_version"` / `"tolaria.release_kind"`, sent on every crash report, renamed to `"rhizome.build_version"` / `"rhizome.release_kind"`. Old events keep the old tag name in the Sentry dashboard — expected, not fixed. **Found the same tag names duplicated on the frontend** (`src/lib/telemetry.ts`'s own `Sentry.setTag` calls, not the backend's) and fixed those too, plus their test in `src/lib/telemetry.test.ts`.
  6. `src-tauri/src/commands/git.rs` — the user-visible error shown when initializing git on a broad personal folder (e.g. home directory) suggested creating a `'Tolaria'` subfolder; now suggests `'Rhizome'`. `has_tolaria_vault_marker` → `has_rhizome_vault_marker`, pure identifier rename, logic unchanged.
  7. `src/utils/typeDefinitions.ts` — `NO_WORKSPACE_KEY = '__tolaria_no_workspace__'`. Verified this is a pure in-memory sentinel (built and consumed only within `typeWorkspaceKey`/`entryTypeWorkspaceKey`/`typeVisibility.ts`'s in-memory lookup map for the current session) — never persisted to localStorage, disk, or sent over IPC — so a straight rename to `'__rhizome_no_workspace__'` was safe with no fallback needed.
  8. `src/lib/themeMode.ts` — `COLOR_THEME_STORAGE_KEY`/`ACCENT_COLOR_STORAGE_KEY`, **real localStorage keys**, were still `'tolaria-color-theme'`/`'tolaria-accent'`. Treated with the same care as C19/C20: new keys `'rhizome-color-theme'`/`'rhizome-accent'`, with `LEGACY_COLOR_THEME_STORAGE_KEY`/`LEGACY_ACCENT_COLOR_STORAGE_KEY` (`'tolaria-color-theme'`/`'tolaria-accent'`) read as a fallback and copied forward onto the new key on next read — mirroring `readStoredThemeMode`'s existing migrate-on-read pattern already in the same file (not the batch `appStorage.ts` migration-flag pattern, since only two keys were involved and the file already had its own established per-key fallback shape). New regression tests in `themeMode.test.ts`: reads the legacy key when the current key is absent (and copies it forward via `setItem`), and confirms the current key wins when both are present — so an existing user's theme/accent choice is not silently reset on upgrade.

  **Out of scope, confirmed not bugs, left untouched:** `antigravity_config.rs`'s `["tolaria", "laputa"]` legacy-cleanup list; `git/mod.rs`'s `!lower.contains("tolaria")`-style protective regression assertions; `git/pulse.rs`'s `#[cfg(test)]`-only `LaputaVault` fixture; arbitrary test-fixture strings in `git/commit.rs:238`, `frontmatter/ops.rs`, `commands/pdf_export.rs`, `git/credentials.rs`; all ADRs/release-notes/README/trademarks/VISION.md/demo-vault-v2 historical content (never edited after the fact, by repo rule); and two internal test-only env-var sentinel names (`TOLARIA_STDIN_PROBE_CHILD` in `claude_cli.rs`, `TOLARIA_CODEX_STDIN_PROBE_PARENT_CHILD` in `codex_cli.rs`) that don't match the `tolaria-codex` literal-string pattern this pass was scoped to and carry no user- or dashboard-visible branding.

  `cargo test --lib`: 1317 passed, 0 failed, 10 ignored (baseline unchanged from C20's fix). `cargo clippy --manifest-path=src-tauri/Cargo.toml -- -D warnings`: clean. `cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check`: clean. `pnpm test`: 5160 passed / 484 files (baseline was 5158/484; +2 for the new themeMode fallback regression tests). `npx tsc --noEmit`: clean. `pnpm lint`: clean. Final `grep -rniE "tolaria|laputa"` over the 8 touched files shows only the intentional legacy-fallback constants/lists and their explanatory comments. Codacy: not run — no MCP tool, no `.codacy/` directory in this session (same standing gap noted in prior sessions).

- **C23-CORRECTED (2026-08-13, same day): `get_messages` is not broken — I misread a fresh session.** Probing after `switch_session` returned **125 messages**, a full conversation. The original finding (only the user message) was a fresh session **mid-turn**: `get_messages` reflects *persisted* history and a just-finished turn is not persisted at the moment you ask. The decision to read transcripts from disk still stands, but for a **different and better reason**: `get_messages` returns *post-compaction working history* while the disk log holds *everything* — the same session gives 125 via RPC and 375 message lines on disk. Those are two legitimate different things ("what the model still remembers" vs "what was actually said"), and a scrollback transcript wants the second. Recorded because the original C23 wording would have sent a future session hunting a bug that does not exist.
- **C23-RESOLVED (2026-08-13): the transcript comes from the on-disk `.jsonl`, not `get_messages`.** Decided in `docs/plans/2026-08-13-prime-session-list-spec.md`. The disk log is the only source describing a session the app is not currently running — the whole point of a switchable list — and is strictly richer (`parentId` fork lineage, `model_change`, `compaction`). `get_messages` stays as landed, correct for the live session, no longer load-bearing. Original finding retained below for the record.
- **C23-HISTORICAL (original finding; superseded by C23-CORRECTED and C23-RESOLVED above): `get_messages` appeared insufficient for transcript rehydration.** Found 2026-08-13 while verifying the newly-landed command against the live `prime-agent --mode rpc` binary. Within a **single** host process: send `prompt` → wait for `agent_end` → `agent_end` carries `messages` with **both** roles (`['user','assistant']`) → then `get_messages` on that same process returns **only the user message**. Reproduced across two runs. The later probe established that this was a fresh session mid-turn: `get_messages` reflects persisted, post-compaction working history. Session replay uses the richer on-disk `.jsonl` instead. The command itself remains correct for its live-session purpose.

- **C24-RESOLVED (2026-08-26): removed the three dead exports** (`listPrimeSessionCandidates`, `PRIME_SESSIONS_DIR_DEFAULT`, `BridgedSessionResult`) from `src/utils/primeSessionToMindwalk.ts`. Session listing stays in Rust (`prime_sessions::session_files` / `sessions_dir`). The Mindwalk rewrite helpers in that file remain live.

- **C25-RESOLVED (2026-09-04): stale regression specs now match the settled chat-centered shell.** The create-note spec opens the Notes panel through the rail's Inbox button and selects Projects / All Notes by accessible button name; both create flows pass. `visible-type-property.spec.ts` was deleted because it no longer installed a vault containing `visible: false`, targeted the removed `.app__sidebar` section controls, and only asserted label count/uniqueness—not its claimed behavior. The real behavior remains covered by 81 passing tests across `Sidebar.test.tsx` and `Sidebar.typeVisibilityWorkspaces.test.tsx`.

- **C22-RECHECKED (2026-09-04; reopening retired): the reported fresh-build relaunch failure does not reproduce under a process- and window-verified loop.** The earlier native check reported a running debug process with no attachable window, but it had no unattended visible-window assertion and this machine also had an older `/Applications/Rhizome Agent.app` with the same bundle identity. A CoreGraphics probe now checks the user's exact symptom without Accessibility access. After quitting the installed copy, launching `/Users/dtc/code/projects/rhizome-agent/src-tauri/target/debug/bundle/macos/Rhizome Agent.app` with `open -n`, and polling for a layer-0 Rhizome window, the exact debug bundle produced a visible window in **10/10** quit/relaunch cycles. Final verification showed the running executable was the exact debug-bundle path and the probe found one visible window. No window code changed because there is no red-capable current failure; the verified 2026-08-15 C22 fix below remains the settled state.

- **C26-RESOLVED (2026-08-15): a replayed user turn showed the whole composed system prompt.** Found by looking at the running app after #7 landed reattach-on-open — every test was green and the logs said nothing. A user turn is stored as Rhizome composed it, so a two-character message replayed as a screenful of "System instructions: You are working inside Rhizome… User request: hi". Pre-existing in the replay path, but #7 moved it from "only if you open an old session" to "every launch". **The fix direction originally recorded here was wrong** and is corrected for the record: it proposed moving the system prompt to `create`'s `config.systemPrompt`, but `contextPrompt` is rebuilt every turn from the active note, open tabs, note list and draft wikilinks (`useAiPanelContextSnapshot`), so pinning it at session creation would have frozen the context snapshot and broken active-note awareness. The composition is correct; only its *display* was wrong. **What shipped:** `build_prompt`'s two markers are now named constants, with `user_request_from_prompt` beside it decoding our own encoding — same module owns both halves so they cannot drift. Applied in `PrimeMessage::from_value` (the derived prose field; `content` stays verbatim, because the composition really happened) and in `summarize_lines` for the session-list title, which was the same bug in a second place and would have given every session an identical name. Splits on the **first** marker: a system prompt containing it leaks a little of itself, where splitting on the last would truncate a user who quoted it, and losing the user's own words is the worse failure. **Two traps worth keeping:** the title fix was briefly a silent no-op because `preview_text` whitespace-normalised *before* the strip, collapsing the newline-delimited markers — its test passed regardless, so the ordering is now pinned by `a_title_still_collapses_newlines_after_the_system_block_is_removed`; and the live-log assertion `markers * 10 < messages.max(10)` rejected a perfectly healthy 8-message session at exactly `10 < 10`, so it now only applies once there are 20+ messages to judge. Verified against a real log through the real code path: `title=Some("hi")` and `first user turn as displayed: "hi"`, where both previously began with the instruction block.

- **C22-RESOLVED (2026-08-15, verified): closing the main window left it unreachable. Two bugs, not one.** Logged 2026-08-02 as a Windows minimize/taskbar bug and never investigated; reproduced on **macOS**. **(1) The window was destroyed on close** while the app stayed alive for the menu-bar companion, so `focus_main_window`, the tray and single-instance activation all resolved `get_webview_window("main")` → `None` and silently no-opped. Fixed by preventing close and hiding instead (`a381b4d`). **(2) Hiding alone was not enough** — macOS treats the app as hidden once its last window hides, so `window.show()` left it off-screen and the dock and tray still looked dead. `focus_main_window` now calls `app.show()` first, and `RunEvent::Reopen` (the macOS dock click) is handled at all — previously nothing listened, and the only routes into `focus_main_window` were the tray and a second app instance, neither of which a dock click raises. **Verified 2026-08-15**: close hides, dock and tray both restore, confirmed by user and by the log line `main window close requested — hiding, not closing (C22)`. **Ruled out while diagnosing:** no `window-state.json` exists, so an off-screen restore was not the cause, and `fit_frame_to_screens` already clamps to a visible monitor. **Two gotchas that cost real time here:** editing `src-tauri/` while `tauri dev` runs did not trigger a rebuild, and killing only the vite port left the old binary alive so `tauri_plugin_single_instance` made each relaunch hand off and exit — both make a fix look absent when it is merely not loaded. Original entry: on Windows, minimizing Rhizome and then clicking the taskbar icon does not bring the window back. Logged 2026-08-02 as a Windows minimize/taskbar bug and never investigated; reproduced on **macOS** 2026-08-15 (app shows as running, no reachable window, menu-bar icon does nothing). Not platform-specific and not about minimizing. The main window was destroyed on close while the app stayed alive for the menu-bar companion, so `focus_main_window`, the tray double-click and single-instance activation all began with `get_webview_window("main")` → `None` and silently no-opped. Fixed in `a381b4d`: `main` now prevents close and hides, which makes every existing `show()` path correct instead of adding another. Scoped to `main` — note windows stay disposable. Cmd+Q is unaffected (`ExitRequested`, not `CloseRequested`). **Ruled out while diagnosing:** no `window-state.json` exists on this machine, so an off-screen restore was not the cause, and `fit_frame_to_screens` already clamps to a visible monitor. **Verifying gotcha:** editing `src-tauri/` while `tauri dev` runs did not trigger a rebuild — the old binary kept serving and the fix appeared absent until a full restart. Original entry: on Windows, minimizing Rhizome and then clicking the taskbar icon does not bring the window back. Reported directly by the user 2026-08-02, **not yet investigated or reproduced** — logged so it isn't lost, not because it's understood. Likely area: `src-tauri/src/lib.rs` and `src-tauri/src/window_state.rs` both reference tray/window-event handling and are the right starting point (found via a quick `grep -rln "tray\|minimize\|restore\|WindowEvent" src-tauri/src/*.rs`, not read yet). Windows-specific per the report — check whether the tray-click / taskbar-restore handler is platform-gated (`cfg(windows)` vs `cfg(desktop)`) and whether it's actually wired to a restore call, or only to show/hide on other platforms. No repro steps beyond "minimize, then try to click it back up" captured yet — get those from the user before starting, and check whether this reproduces on macOS too or is genuinely Windows-only (relevant since `linux_appimage.rs`/`window_state.rs` suggest per-platform window handling already exists and may just be incomplete for one target).

- **A1-CLOSED (2026-08-09): `main` did not build and 19 frontend tests failed — neither was introduced by the session that found them, and neither had ever been gated.** Found 2026-08-09 on the first `git push` attempt since the fork. The 29 unpushed commits were never *unpushable-by-accident*; the push had simply never succeeded, so pre-push (build + tests) had never run on any of them.
  **Build (FIXED 2026-08-09).** `tsc -b` failed with 4 errors. `204822a` (Mycelium rail) added `'mycelium'` to `SidebarFilter` (`src/types.ts:263`) and `CommandRailDestination` (`src/components/CommandRail.tsx:8`) but not to `RailDestination` (`src/lib/productAnalytics.ts:22`) or the `Record<SidebarFilter, string>` label map (`src/collections/collectionFromSelection.ts:10`). Separately, `onKeyboardShortcuts` existed on `AppCommandHandlers` and `CommandRegistryConfig` but was missing from two `Pick<>` unions in `src/hooks/useAppCommands.ts` (`CommandRegistryCoreActions` and the `createMenuEventHandlers` return type). All four added; `tsc -b` clean.
  **⚠️ `npx tsc --noEmit` did NOT catch this.** An earlier check in the same session reported clean while `tsc -b` failed — different tsconfig/project-reference behavior. Do not treat `--noEmit` as proof the build passes; the gate runs `tsc -b`.
  **Tests (FIXED 2026-08-09).** Was 5168 passed / **19 failed** / 5187. Now **`Test Files 488 passed (488)` / `Tests 5188 passed (5188)`** (+1: a new case pinning legacy-id → Prime coercion). Fixed in `d8421b5`, `7221f24`, `7565b3c` — **test-only; no `src/` product file was touched.** The Prime-only hypothesis held for **18 of 19**:
  - Stale agent id in a fixture. `resolveAiTarget()` coerces every non-`productVisible` id to Prime, so fixtures storing `claude_code`/`codex` produced Prime-resolved UI: `useAiAgentPreferences` (2), `AiWorkspaceFloatingButton` (2), `ResearchPanel` (4), 2 of the `App` failures. Note `getNextAiAgentId` now cycles a one-element list, so "cycle to the next agent" legitimately stays on Prime.
  - Stale onboarding/settings copy. `fa230a6` rewrote `onboarding.ai.*` in `en.json` ("Prime is ready", "Prime Agent is optional for first open", "Prime on this machine", "Models & providers"), and the settings agent card + default-agent dropdown both render `PRODUCT_AI_AGENT_DEFINITIONS`: `AiAgentsOnboardingPrompt` (2), `SettingsPanel` (3), 1 `App` failure.
  - **The 19th is not the Prime story:** `aiAgentStreamCallbacks.test.ts` expected the pre-`e2cd77f` tool-action shape, before tool cards carried `path` and a path-suffixed `label` for the "Open" affordance.
  **⚠️ Worth knowing (not a fix, no C-number opened — no product defect found).** 3 of the 5 `App.test.tsx` failures were one crash, not assertion drift: `useAgentDefaultOpenChat` (`fa230a6`) auto-opens the chat panel once per app *session* and guards it in **sessionStorage**, which `beforeEach`'s `localStorage.clear()` does not reset — so `AiPanelView` mounts only in the file's first `render(<App/>)` (plus the two tests that open the panel explicitly). It calls `usePrimeHostStatus`, whose command was missing from `mockCommandResults`; that table returns `result ?? null` for anything unlisted, and `primeModelLabel(null)` dereferenced `.modelName` and threw, unmounting the whole tree — which is why the failures read as "All Notes not found" / empty `<body>`. The real Tauri command returns a non-`Option` `PrimeHostStatus`, so the null is a property of the test double, not the product. Two standing implications: **(a)** any test that renders `<App/>` first in its file now mounts the AI panel, so its fake-IPC table must cover the panel's commands; **(b)** there is no error boundary above `AiPanelView`, so a malformed status payload blanks the app rather than degrading the panel.

- **~~C27-OPEN: the Rust coverage pre-push gate fails on `origin/main` itself~~ RESOLVED 2026-08-16 (`c1d28c8`) — now 85.09%, exit 0. Left in full because the diagnosis matters and the margin is thin.** Fixed by giving two pure-logic modules that had *no test module at all* real coverage: `view_relationships.rs` 57.94% → 100%, `view_value_conversions.rs` 53.85% → 100% (16 tests). **Headroom is only ~36 lines** — the next few hundred lines of untested Rust will drop it back under. Treat that as a live constraint, not a solved problem. Original entry follows.

  Measured 2026-08-16 with clean runs (not `--no-clean`), LLVM env vars exported:

  | Tree | Lines | Missed | Coverage | `--fail-under-lines 85` |
  |---|---|---|---|---|
  | `origin/main` (`2272492`) | 40293 | 6097 | **84.87%** | exit 1 |
  | `main` (`fc9a37d`, slash menu) | 40381 | 6113 | **84.86%** | exit 1 |

  **This is not the slash-menu branch's doing.** That branch added 88 executable
  Rust lines with 72 covered (~82%, *above* the repo average) and moved the
  total by 0.01pp. It was measured in a detached worktree at `origin/main` to
  prove the baseline rather than assert it — the branch inherits the failure,
  it does not cause it.

  `HANDOFF.md`'s 2026-08-09 entry records a passing run at **85.24%**, so this
  regressed somewhere between then and `2272492` and nobody's gate caught it,
  because the last several sessions all recorded "full pre-push **not** run"
  (see `2026-08-14-frame-a-session-status.md:155` and the 08-16d status doc).
  A gate nobody runs is a gate that rots.

  **Do not diagnose this via `docs/CROSS-MODEL-HANDOFF.md` §13.** That section
  is about `--no-clean` reporting a *falsely* low number, and it says a
  `--no-clean` failure is not evidence until re-run clean. That was checked
  here: `--no-clean` gave 84.88%, a full clean run gave 84.86%. The trap is
  real but it is **not** what is happening — §13 does not explain this one, and
  reaching for it will send the next session in a circle.

  **Deficit is ~56 lines** (need missed ≤ 6057 at the current line count).
  Fixing it means real tests, not padding. The genuinely under-covered pure
  logic worth aiming at, from the clean run: `view_relationships.rs` 57.94%
  (45 missed), `view_value_conversions.rs` 53.85% (12), `view_date_filters.rs`
  83.75% (13). Deliberately **not** on that list: `commands/ai.rs` (30.18%) and
  the daemon-touching arms of `prime_session_host.rs` — those are
  `#[tauri::command]` wrappers and live-socket paths that cannot be covered
  without a running daemon, which is why the existing `live_*` tests are
  `#[ignore]`. Padding those would be chasing the number, not the coverage.

  **Also correct §13's snippet while here:** the clean line lacked
  `--manifest-path src-tauri/Cargo.toml` (fixed 2026-08-16); the coverage
  line lacked `--ignore-filename-regex "lib\.rs|main\.rs|menu\.rs"` (fixed
  2026-08-29, C54). Both are required to match the pre-push gate.

- **C28-OPEN: three `@smoke` specs fail under CPU load — the pre-push Playwright lane is not deterministic.** Observed 2026-08-16 on one machine, twice, with a clean tree:

  | Run | Wall clock | Result |
  |---|---|---|
  | Full lane, machine idle (`6c1edcc`) | 1m48s | 26 passed |
  | Full lane, machine loaded (`f65ac10`) | **2m48s** | **3 failed**, 23 passed |
  | The 3 failures re-run in isolation | 14.6s | **all pass** |

  Failing specs, all keyboard-shortcut driven:

  - `example.spec.ts:16` — Cmd+K opens the command palette
  - `example.spec.ts:56` — Cmd+P opens quick open
  - `fix-crash-create-note.spec.ts:109` — Cmd+N creates a note

  **Not a product regression.** The change in the tree at the time
  (`f65ac10`) touches `AiPanel.tsx` and `primeCommandMenu.ts` only — nothing
  in keyboard routing, quick open, or note creation — and the captured
  `error-context.md` page snapshot shows the app fully rendered (sidebar,
  nav, Inbox). Nothing crashed; the synthesized shortcut just never
  registered. The 55% wall-clock increase is the tell: these fail on timing
  when the CPU is contended.

  **Why this is tracked rather than shrugged off.** `fix-crash-create-note`
  was *already* recorded as timing-flaky in `CROSS-MODEL-HANDOFF` §14, filed
  as a known annoyance and left there. The two `example.spec.ts` cases are
  new, which means the flaky surface is **wider than documented and
  growing** — and it sits on the one lane that gates every push. A gate that
  fails on machine load teaches people the failure is noise, which is
  precisely how a real failure gets waved through. `AGENTS.md` says "fix
  flaky tests first"; this is the entry that stops it being rediscovered per
  session.

  **Likely cause:** contention from concurrently running test processes. This
  machine had orphaned `run-vitest-coverage-shards.mjs` / `vitest --shard=2/2`
  processes alive during the failing run. Before rewriting waits, check whether
  the lane is simply racing another test run: `pgrep -fl vitest`. The clean
  push minutes later — with `pgrep -fl vitest` empty — came back 26/26 in
  1m48s, matching the idle baseline exactly.

  **Correction, same day — one lead in the original entry was wrong.** It
  flagged those processes as running under "a *different* runtime
  (`~/.hermes/node`), either a second agent or leaked shards." That inference
  was junk: `~/.hermes/node` is simply a node install on this machine
  (`prime-agent` itself runs on it, per the daemon's own
  `runtime.executablePath`). It is not evidence of another agent. The
  processes were almost certainly leaked shards from this session's own
  repeated coverage runs. **Do not go hunting for a second agent.**

  **Also ruled out: the hook is not fighting itself.** `.husky/pre-push` runs
  its six steps sequentially under `set -e` — no `&`, no `wait`, no
  `xargs -P`. Contention comes from *outside* the gate, so the fix is either
  killing stray runs before pushing or making the three specs wait on a
  settled condition instead of a timing window.

  Fixing it means making these three assert on a settled condition rather
  than an implicit timing window. Do not "fix" it by retrying harder or by
  dropping the `@smoke` tag — that removes the coverage instead of the
  flake.

- **C29-RESOLVED (2026-08-16g): after `Cmd+N`, the note list did not refresh.** A stale vault scan (or a load-reset that cleared the just-created protection set) overwrote `entries` with a pre-create snapshot. Fixed by keeping the optimistic `VaultEntry` in a ref, refusing to drop that path on reconcile, and not clearing the protection set when a load reset is preserving workspace entries. Vite fixture timestamps were also converted to unix seconds so a new note is not sorted off-screen behind year-58595 fixture dates. Verified: 18/18 on `fix-crash-create-note.spec.ts` × 6, `--retries=0`.

- **C30-RESOLVED (2026-08-29): `window.__tolariaFrontendReady` → `window.__rhizomeFrontendReady`.** Renamed in `src/utils/frontendReady.ts` (ambient `Window` typing + set/read), `index.html` (startup reload guard), `src/main.test.ts`, `src/utils/frontendReady.test.ts`, and `tests/smoke/helpers.ts`. Left `tolaria:frontend-ready` / `tolaria:startup-reload-attempted` sessionStorage keys unchanged — separate from the window flag. Verified: `pnpm lint`, `pnpm typecheck`, targeted vitest on touched tests.

- **C35-RESOLVED (2026-08-20): `npx tsc --noEmit` typechecked nothing at all.**
  Not "weaker than `tsc -b`" as first written — a no-op. Measured: appending
  `export const X: number = "nope"` to `src/lib/uiPreference.ts` and running
  `npx tsc --noEmit` exits **0**; `tsc -b` reports TS2322 on the same file. The
  root `tsconfig.json` is `"files": []` plus two project references, and
  `--noEmit` does not follow references.

  Every "tsc clean" this repo's sessions have reported from that command was
  evidence of nothing. It had already been noticed **three times** in this file
  (a gate gotcha at the 2026-08-06 and 2026-08-08 entries, and again when a
  push failed on `tsc -b` after `--noEmit` passed) and written down as a trap
  each time, while `AGENTS.md` kept documenting the broken command — which is
  precisely the failure mode the C-number rule exists to stop.

  Fixed by making the right command the easy one: **`pnpm typecheck`** (`tsc
  -b`), now what `AGENTS.md`, `CONTRIBUTING.md` and `CROSS-MODEL-HANDOFF.md`
  all tell you to run.

- **C33-PARTLY-RESOLVED (2026-08-21): test files are typechecked now, minus a
  named backlog.** Found 2026-08-19 while landing #9; **restated 2026-08-20**,
  because the original diagnosis was half the story. `tsconfig.app.json` sets
  `"exclude": ["src/**/*.test.ts", …]`, so test files were invisible even to a
  working typecheck — demonstrated by a prop deleted from
  `ChatComposerDeckProps` while `ChatComposerDeck.test.tsx` kept passing it,
  with nothing reporting the mismatch. The reason nobody caught it sooner was
  C35: the command being run typechecked **no** files, so "tests are not
  checked" was indistinguishable from "nothing is checked".

  The backlog turned out not to be a wall. Measured 2026-08-21: **386 of 533
  test files were already clean**, and of the 1458 errors a first run showed,
  698 came from `node_modules` — two regression tests import BlockNote's raw
  `.ts` source by relative path, and `skipLibCheck` skips `.d.ts`, not `.ts`.
  The real repo-side backlog is **668 errors across 143 files**, a third of it
  in five files.

  So `tsconfig.test.json` is a ratchet: the 386 clean files are gated by
  `pnpm typecheck` today (proven by appending a type error to a test file and
  watching `tsc -b` catch it), and the 150 dirty ones are listed by name in its
  `exclude`. A new test file is checked from the moment it is written.
  `pnpm typecheck:tests:backlog` prints what is left, worst file first;
  clearing one means deleting its line from `exclude`. It is deliberately not
  a gate, for the same reason `pnpm deadcode` is not.

  Two things fell out of this that are worth knowing. `ChatComposerDeck.test.tsx`
  — the file the original report was about — is in the clean set, so that
  specific hole is closed. And `src/types/mockTauriBridge.ts` is new: the
  `__mockContent` / `__mockHandlers` window augmentations lived inside
  `App.tsx`, which worked only while every project happened to include
  `App.tsx`. Giving tests their own project broke that, and `mock-tauri/index.ts`
  stopped being able to see globals it sets. Global augmentations belong in
  `src/types/` with the others — and, like `rhizomeTestBridge.ts`, in
  `knip.json`'s `ignore`, because nothing imports them by design.
- **C31-OPEN: `pnpm test` produced one unhandled error that would not reproduce.** Seen 2026-08-19 while landing #13: a full run reported `Tests 5433 passed` alongside `Errors 1` and exited non-zero. Three further full runs on the same tree exited 0 with no error line, and the error text was never captured — it did not appear in the tail, and greps for `Unhandled`/`rejection` came back empty on the clean runs. **Not attributed to that session's change and not shown to predate it either**; nobody has run this down. It matters because the push gate runs `pnpm test`: a 1-in-4 unhandled error is a push that fails for no visible reason, and the natural reaction — re-run and move on — is exactly how it stays unfixed. Next time it appears, capture the whole run to a file before doing anything else (`pnpm test > /tmp/t.txt 2>&1`), because the message is only in the block vitest prints between the file list and the summary.

- **C32-RESOLVED (2026-08-22): both docs cover Prime now.** `ARCHITECTURE.md`
  gained a *Prime Agent* section under AI System — that it is a **daemon
  client, not a subprocess** (so the `cli_agent_runtime.rs` mental model on the
  same page actively misleads), the `prime_session_host.rs` vs
  `prime_sessions.rs` split and why confusing them is the classic mistake, the
  lazy session lifecycle and its command order, a map of the eight `prime_*`
  modules and the frontend hooks, and what Rhizome does not own.
  `ABSTRACTIONS.md` gained a *Prime Session* section: the two data sources and
  the log-path join between them, `PrimeSessionStatus`, and the uuidv7 trap in
  session ids. Written from a session that had just re-derived all of it, which
  is the point — the original entry below is kept for the reasoning.

- **C32-WAS-OPEN: `ARCHITECTURE.md` and `ABSTRACTIONS.md` contain no mention of Prime at all.** Confirmed 2026-08-19 by grepping both files for `Prime` — zero hits in either, while `src-tauri/src/prime_session_host.rs` alone is ~4,600 lines and the daemon client, session host, goal, fork, compact, heartbeat and roster surfaces all live outside the docs. AGENTS.md requires updating these two after "any Tauri command, new component/hook, data model change, or new integration", so every harness session has been in technical violation of that rule and every one of them has let it pass. The practical cost: a new session has no structural map of the harness and re-derives it from source each time — this session spent a meaningful chunk of its budget rediscovering that `prime_session_host.rs` is a full daemon client and that `prime_sessions.rs` is a *disk* reader that cannot answer "what is running". Do not fix this as a side quest inside a feature commit; it is its own piece of work.
## Links out

- Prime harness coverage, quantified → `docs/plans/2026-08-22-prime-harness-coverage.md` (25% of the daemon surface; what is missing, and in what order)
- Full history + session details → `docs/plans/` (see classification in `docs/plans/handoff-classification.md`)
- Context retooling plan → `docs/plans/2026-07-25-context-retooling-plan.md`
- Duplication analysis → `docs/plans/duplication-analysis.md`
- Rules ledger → `docs/plans/context-rules-ledger.md`
- Cross-model traps → `docs/CROSS-MODEL-HANDOFF.md`
