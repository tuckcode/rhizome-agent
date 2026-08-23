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

`origin/main` is pushed through `aed471b`; local `main` is four commits ahead
with C43/C44, folder-boundary hardening, the dependency-security sweep (C45),
and the foreground-owned session decision (C47 / ADR-0167). Final dependency
scan has 0 Critical/High; frontend and Rust coverage pass. Prime **0.7.4** on Windows speaks
`\\.\pipe\prime-agent-daemon` — see `docs/WINDOWS-DEV.md`. On macOS/Linux the
daemon dies with whatever terminal starts it, so start it detached:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

A push runs the gates in ~2m16s (three parallel lanes; the frontend lane is the
critical path at ~120s, coverage 85s of it).

## Recent sessions

- [2026-08-23 · GPT-5.6 Sol](plans/handoffs/2026-08-23-1518-gpt-5-6-sol-mid-turn-and-folder-hardening.md) — C43/C44 and destructive folder paths fixed; Codacy activated and all High dependency findings patched; Switchyard evaluated behind Prime; foreground-owned sessions decided in ADR-0167
- [2026-08-22 (evening) · Grok 4.6](plans/handoffs/2026-08-22-2108-grok-4-6-window-navigation-guard.md) — #43 window-level navigation guard built on the Tauri 2.10 plugin `on_navigation` hook (config-declared main window, so no window rebuild); off-origin links route to the system browser, webview never leaves; 7 Rust unit tests on the centralized policy; Rust gates green at 85.57%
- [2026-08-22 · GPT-5.6 Luna](plans/handoffs/2026-08-22-2137-gpt-5.6-luna-recent-changes-review.md) — review of today's chat/native-chrome/pre-push changes; C43/C44 record two mid-turn message-loss paths, and the browser helper's repeated install check
- [2026-08-22 · Claude Opus 5](plans/handoffs/2026-08-22-1100-claude-opus-5-ux-sweep.md) — Windows pipe landed by Cursor then its roster hang fixed; the ignored live-daemon tests run for the first time; C32 closed; a UX sweep found a silent screen-reader bug, a dead button and a session-select regression; #31–#39 opened
- [2026-08-21 (evening) · Claude Opus 5](plans/handoffs/2026-08-21-1930-claude-opus-5-lazy-sessions.md) — #28's root cause: a vault attach creates no Prime session, verified against a live daemon; #28 closed, #30 opened and then finished (row labels, where a session ran, archiving); C33, test files typechecked behind a named exclusion list; and localization restated as decided
- [2026-08-21 · Claude Opus 5](plans/handoffs/2026-08-21-1640-claude-opus-5-push-gate.md) — confetti end to end (ADR-0164), Chat home's rail and sessions column, #28, and the push gate cut from ~4m30s to ~2m16s
- Everything before that: [handoff archive](plans/handoffs/archive-through-2026-08-20.md) — not in date order, search by date or issue number

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
- Force Welcome: wipe `~/Library/Application Support/ai.rhizome.desktop` (and/or move vault).

**Key decisions (locked, don't re-litigate):**
- Research panel yes, MCP bridge deferred (browser-extension bridge is a separate shipped lane)

**Git state** (verified 2026-07-27):
- `origin` = `git@github.com:knispo/rhizome.git` (**PUBLIC** — AGPL-3.0-or-later). Push blocked until account unsuspended.
- Local `tolaria` remote exists for cherry-picks only — not pushed to.
- Don't touch `.claude/settings.local.json`, `Fable-5s-one-brain-architecture-rhizome.md`

**Reading order for a fresh session:**
0. If non-Anthropic model: `docs/CROSS-MODEL-HANDOFF.md`
1. This file
2. `docs/plans/*-session-status.md` with latest date
3. `docs/ARCHITECTURE.md`
4. `docs/plans/2026-07-10-rhizome-desktop-alpha-roadmap.md`
5. `AGENTS.md` at repo root
## Open threads

- **C47-DECIDED (2026-08-23, implementation pending): Prime sessions are
  foreground-owned by default; background work is an explicit grant.** Atticus
  does not want closing Rhizome to imply indefinite agent autonomy. Prime's
  daemon remains shared infrastructure and may stay available, but availability
  is not activity.

  Prime 0.7.4 already supports the required lifecycle:
  `DaemonSessionLifecycle = "resident" | "client_owned"`. A client-owned worker
  is stopped 30 seconds after its owning protocol client disconnects, while
  `promote_owned_session` makes explicitly approved work resident. Rhizome
  currently omits the `client_owned_sessions` capability and creates every
  session as resident, so orderly Quit is safe only because the exit handler
  sends `kill`; crash/force-quit can still leave work alive.

  Decided UX: new sessions client-owned; idle close detaches; active close asks
  with **Stop and close** as default and **Keep working** as explicit promotion;
  schedules/heartbeats may survive because creating one is already an explicit
  grant and they remain visible/cancellable. Remove or migrate the global
  `keep_sessions_running_on_quit` preference. ADR-0167 supersedes ADR-0163's
  unconditional session-survival policy while retaining its daemon-client
  transport decision. The implementation is the next separate lifecycle slice;
  the full evidence and transition notes are in the latest handoff.

- **C45-RESOLVED (2026-08-23): the Codacy gate was runnable all along,
  and its first run refuted a security review.** `codacy-cli` analyses locally
  with no account and no payment; only the MCP server needs a paid token for a
  private repo, and that server just shells out to the same CLI. AGENTS.md had
  told every session the paid tier blocked the whole gate, so it was skipped for
  months. Setup and the trimmed tool set are documented in AGENTS.md's Codacy
  section.

  First run: **95 advisories** across `pnpm-lock.yaml` (63), `mcp-server/package-lock.json`
  (23), and `src-tauri/Cargo.lock` (9). No criticals. Two mattered because they
  contradicted the 2026-08-22 review's reasoning, and both are **fixed in this
  working tree**:
  - `tauri` 2.10.2 → **2.11.1** (CVE-2026-42184, origin confusion). `is_local_url()`
    compared only the first domain label, so `http://asset.attacker.com/` was
    classified as a local origin and could invoke IPC. The review had ruled the
    unguarded folder commands unreachable *because* "Tauri IPC is only callable
    from the app's own webview" — and that premise, as a property of Tauri, was
    false on Windows and Android for every version from 2.0 up.

    **This app was not exploitable, but not for the reason the review gave.**
    Three independent things had to hold, and the framework guarantee was the
    one that didn't: #43's navigation guard sends any off-origin top-level
    navigation to the system browser (`navigation_decision`, 2026-08-22), the
    production CSP declares no `frame-src` so subframes inherit
    `default-src 'self'` and cannot load an attacker host, and C42 means the app
    has never launched on Windows at all. The lesson is about the review, not the
    patch: a reachability argument resting on one framework guarantee is one CVE
    away from wrong, and the two controls that actually held were never cited.

    The bump carries the webview stack with it: wry 0.54→0.55, tao 0.34→0.35,
    muda 0.17→0.19, tray-icon 0.21→0.23. **1631 Rust tests, clippy, and fmt
    pass; tray/menu/window behaviour has not had native QA.** Do that before
    trusting a release build — and re-check the #43 guard specifically, since it
    hooks a plugin API in the layer that just moved.
  - `dompurify` 3.4.2 → **3.4.13** and `mermaid` 11.14.0 → **11.17.0** patch
    the XSS/CSS-injection advisories on `SafeMarkup.tsx`, the one raw-markup path
    the review cited as the reason no XSS could reach IPC. The two arguments
    propped each other up.

  The remaining High findings were patchable transitive pins, including versions
  deliberately held in `pnpm-workspace.yaml` and `mcp-server/package.json`.
  Updated `@hono/node-server`, `fast-uri`, `hono`, `ip-address`, `js-yaml`,
  `linkify-it`, `nanoid`, `postcss`, `protobufjs`, `vite`, `quinn-proto`,
  `openssl`, and `tar`; also patched the reachable markdown-it quadratic parser
  path and serde_with's empty-map panic.

  Final Trivy scan: **0 Critical, 0 High; 9 lockfile occurrences remain** (two
  Medium advisories, four unique Low advisories, duplicated by versions/locks).
  The Mediums are reviewed:
  - `@opentelemetry/core` <2.8's unbounded W3C baggage-header parsing is under
    PostHog's browser telemetry SDK. Rhizome sends telemetry outbound and never
    parses attacker-controlled inbound HTTP baggage headers; overriding the core
    alone would also split it from the coordinated OpenTelemetry 2.2/2.6 stack.
  - `glib` 0.18's iterator unsoundness is Linux-only under Tauri's GTK 0.18
    stack. Rhizome does not call the affected iterator API; 0.20 is an ecosystem
    major that current Tauri/wry do not use.

  Remaining Low findings are `body-parser` invalid-limit DoS (Rhizome supplies
  fixed limits), dev-only `esbuild`, and transitive `lru`/old `rand` unsoundness
  paths not called by repo code. The gate is now usable as a no-new-High ratchet;
  do not require zero findings until those upstream stacks move.

- **C46-OPEN (2026-08-23): `AiPanel.tsx` measures CCN 50 across 447 lines.**
  Codacy's `lizard` is the first tool in this repo to say so — it was the only
  warning across the files this session touched (`src-tauri/src/vault/folders.rs`
  sits at avg CCN 2.5). Lizard aggregates a TSX module's top level into one
  `*global*` entry, so the number reads high by construction, but the direction
  is real: the C43 fix added a ref, a layout effect, and two send callbacks to a
  component that was already the largest in the panel. The natural seam is the
  mid-turn send policy — accepted / not-running / failed, plus the idle fallback
  — which is decision logic with no JSX and could move to a hook or module
  beside `primeTurnMessaging.ts`. Not attempted here: it would have meant
  refactoring the component in the same change as the race fix.

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

- **C34-OPEN (half done): the menu-bar roster's activity labels.** The eight
  statuses are no longer English literals in `primeRunningSessions.ts` — the
  module now returns a `RosterActivity` (`{kind:'summary'}` for the daemon's own
  prose, `{kind:'status', key}` for copy we own), the keys live in
  `menuBarCompanion.activity.*` in `en.json`, and `MenuBarCompanionApp` renders
  them through `t()`. **Two things remain:**

  1. **`pnpm l10n:translate` has never run for them.** It needs
     `LARA_ACCESS_KEY_ID` / `LARA_ACCESS_KEY_SECRET`, which are not set on this
     machine, so all 19 non-English locales are missing these 8 keys. That is
     C18's existing gap (272 missing per locale before this change, 280 after)
     — the change did not create the gap but did widen it by 8.
  2. **The companion window ignores the user's locale entirely.**
     `MenuBarCompanionApp.tsx:22` is `createTranslator(DEFAULT_APP_LOCALE)`,
     where `DEFAULT_APP_LOCALE = 'en'`. Every other component in the tree takes
     a `locale` prop. So even a fully translated locale file renders English in
     that window. It is a separate Tauri window without the settings context,
     which is presumably why — but until it is fixed, localizing anything in the
     companion is preparation, not a user-visible change.

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

  Note also that `src/lib/sensitiveTextRedaction.ts` already recognises `ghp_`/`gho_`/`github_pat_`/`sk-`/`xox*`, but is wired only into telemetry and feedback diagnostics — what leaves the machine. Nothing redacts what is written to conversation logs.

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
- **C23-OPEN (original finding): `get_messages` is not sufficient for transcript rehydration.** Found 2026-08-13 while verifying the newly-landed command against the live `prime-agent --mode rpc` binary. Within a **single** host process: send `prompt` → wait for `agent_end` → `agent_end` carries `messages` with **both** roles (`['user','assistant']`) → then `get_messages` on that same process returns **only the user message**. Reproduced across two runs. Not investigated further, so the cause is unknown — plausible readings are that `get_messages` reads a persisted store while `agent_end` reflects in-memory turn state, or that the assistant message commits on some later event. **Why it matters:** the roadmap recorded `get_messages` as the thing blocking the whole session story, which assumed it returns the conversation. It returns *a* conversation view that is missing the assistant side. Rehydration therefore needs a decision — capture `agent_end.messages` as the transcript source, find the persist trigger that makes `get_messages` complete, or reconstruct from the session `.jsonl` on disk (which `mycelium.rs` already reads). **Do not build the session list until this is settled**; all three options change its shape. The command itself is landed, tested and correct for what it returns — this is a sufficiency gap, not a defect in the parse.

- **C24-OPEN: `src/utils/primeSessionToMindwalk.ts` has three dead exports that now duplicate the Rust session reader.** Found 2026-08-13 by `pnpm deadcode` after building `prime_sessions.rs`. `listPrimeSessionCandidates` (filters `*.jsonl` and sorts) and `PRIME_SESSIONS_DIR_DEFAULT` (`'~/.prime/agent/sessions'`) are referenced by nothing — verified with a repo-wide grep excluding their own file — and both restate what `prime_sessions::session_files()` and `sessions_dir()` now do authoritatively in Rust. `BridgedSessionResult` is also unreferenced. **Not deleted here**: this session did not otherwise touch that file, and `AGENTS.md` says to fix what your change touches rather than mass-delete the backlog in an unrelated commit. The rest of the module is live (Mycelium's Mindwalk bridge), so this is a three-export removal, not a file deletion. Whoever next touches Mycelium should delete them and confirm the bridge still resolves its sessions directory — the constant is the one to check, since removing it means the bridge must get that path from somewhere. **Run `npx tsc -b` after deleting anything knip flagged**, per the ambient-declaration warning in `AGENTS.md`.

- **C25-OPEN: two `tests/smoke/` regression-lane specs fail on stale content expectations, unrelated to the launch change.** Found 2026-08-15 while repairing the notes-shell pin (below). `visible-type-property.spec.ts:11` asserts `labels.length > 3` for sidebar type sections and receives **1**; `type-create-note.spec.ts:32` ("clicking + in All Notes creates generic note") also fails. **Both fail with and without the notes-shell pin** — verified by stashing the pin and re-running: 3 failed before, 2 after, so the pin fixed one of the three and these two are a separate problem. The shell renders (the selector matches one label rather than none), so this is a stale expectation about mock-vault type sections, not a missing note list. **Neither is in the push gate** — `pnpm playwright:smoke` is the curated 13-spec lane and is fully green; these only run under `pnpm playwright:regression`. Whoever next touches the sidebar or the mock vault should re-baseline both, or delete them if the behaviour they pin is gone.

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

  **Also correct §13's snippet while here:** it gives
  `cargo llvm-cov clean --workspace`, which fails in this repo with
  `could not find Cargo.toml` — there is no root manifest. It needs
  `--manifest-path src-tauri/Cargo.toml`, same as every other cargo invocation
  in these docs.

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


- **C30-OPEN: `window.__tolariaFrontendReady` branding residue survived the C21 rename sweep.** Found 2026-08-16 while closing out the harness-surface session. Live sites: `src/utils/frontendReady.ts` (sets/reads the flag), `src/components/FrontendReadyMarker.tsx`, `src/main.tsx`, `src/main.test.ts`, `src/utils/frontendReady.test.ts`, and — load-bearing for CI — `tests/smoke/helpers.ts` waits on `window.__tolariaFrontendReady === true` before driving the app. **Correctly used today**; low priority to rename. The point of the number is that noting a residue without tracking it is what C21 existed to stop. When renamed, treat it like other window/localStorage renames: update the ambient `Window` typing, every reader/writer, smoke helpers, and tests in one commit; run `npx tsc --noEmit` and `pnpm playwright:smoke` because the smoke lane is a real consumer. Do not leave a dual-name fallback unless a released build is known to depend on the old flag across an upgrade boundary (smoke runs against the build under test, so a hard rename is usually enough).

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
