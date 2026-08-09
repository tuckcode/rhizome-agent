# HANDOFF.md History (2026-07-12 through 2026-07-25)

> Archive of history sections removed from HANDOFF.md on 2026-07-25.
> HANDOFF.md is now a router — current state, open threads, links out.
> These sections contain dates, commit hashes, and past-tense narration,
> so they belong in versioned plan files, not the living doc.

---

## Pickup checklist (any agent, next session)

**"Check the cracks" readiness audit + fix plan is in progress.** Full
plan (audit findings + 5 waves, Fable-5-designed): `/Users/dtc/.claude/plans/but-not-strictly-designed-foamy-cosmos.md`
(outside the repo — read it before continuing). Goal: get the app to
where a friend/second user can open it and use the core loop (open
vault → AI model saves notes to wiki → see them in wiki/graph) without
hitting silent failures. **Waves 1, 2, 3, and 4 of 5 are done; only 5
(optinal brand/shell) is not started.**

**Start here next session:**

0. **Browser extension — backend lane DONE 2026-07-25 (Opus), 5 commits,
   all pushed-ready but NOT pushed.** Plan +
   corrections: `docs/plans/2026-07-25-browser-extension-plan.md` (updated
   in place; its original "Transport — decided, already de-risked" section
   was **wrong** and is now annotated).
   - `082ab1c0` `inbox_action` frontmatter contract + save-only lane
     (ADR-0158) · `484caf3f` `rhizome_save_capture` verb ·
     `289280f9` bridge token auth (ADR-0159) ·
     `aef0e8ef` **frontmatter bug fix, see below** ·
     `5d734a27` verb exposed on the bridge via the `rhizome-tool` sidecar.
   - **Verified end to end** against a real temp vault: a card lands in
     `wiki/sources/documents/` and `.rhizome/events.jsonl` carries
     `{"type":"capture","trigger":"browser_extension"}`.
   - **⚠️ Real bug found and fixed on the way (`aef0e8ef`): every optional
     frontmatter key was landing in the note body.** `default_frontmatter`
     returns an already-closed block; `distill_frontmatter` and
     `import_frontmatter` `push_str`'d `kind:`/`project:`/`source:` onto the
     end, i.e. *after* the closing `---`. Every card Rhizome ever wrote with
     one of those keys has it as body text, invisible to every frontmatter
     parser. The suite could not see it — every assertion was
     `fm.contains("source: ...")`, true either way. **Follow-up worth doing:**
     `project:` was therefore never readable on a distilled card, so
     project-tree routing cannot have worked for them — check whether the
     routing fix in `bdd8ada6b` is actually complete, and whether existing
     vaults need a one-time repair pass for already-written cards.
   - **Next: commit 7 — Settings UI showing the user their `bridge_token`.**
     Nothing surfaces it, so pairing an extension means reading
     `settings.json` by hand. Then 8–19, the extension itself. Its contract
     with the app is fixed and small: connect `ws://localhost:9710`, send
     `{id, tool:"bridge_auth", args:{token}}`, then
     `{id, tool:"rhizome_save_capture", args:{vaultPath?, source, title?,
     context?, text?}}`.
   - **Known limit, deliberate:** `RHIZOME_TOOL_PATH` resolves the sidecar
     beside the running exe — works in `pnpm tauri dev`, **not** in a
     packaged build (needs Tauri `externalBin`, MCP bridge Phase 3). Chosen
     so the extension UX can be tried before touching the release pipeline.

1. **TOP PRIORITY (user, 2026-07-19): is there even a reliable trigger/save method for memories/wiki entries?** The user's framing (verbatim intent): "I'm just not sure we have a reliable trigger/save method for memories/wiki." This is an OPEN question, not a known bug — treat it as an investigation, not just a fix. Three concrete directions the user asked for:
   - **(a) Test with a blank wiki.** Spin up an empty/fresh vault and try the full save loop (agent memory-save, Distill, menu-bar capture) — see what actually happens end to end with nothing pre-existing. This is the primary reproduction path.
   - **(b) Research competitors + existing docs.** Look at how comparable local-first / AI-memory tools trigger and persist agent memories/wiki entries (and check `docs/`, Portent's `portent.md`, and any existing project notes that already discuss the save/trigger design) before designing our own — don't reinvent if a good pattern exists.
   - **(c) Then audit our write path** and produce a plan: is the trigger (how a save gets initiated) and the persistence (where/whether it lands) actually dependable? Key files: `create_note_content` (`commands/vault/file_cmds.rs`), distill writers (`rhizome_distill.rs`, `rhizome_api.rs`), `.rhizome/events.jsonl` append/read, and the agent-driven MCP/tool save path.
   Foundation for everything, incl. the menu-bar capture just shipped (same write path). Do this before resuming menu bar or shell waves.

   **Investigation done 2026-07-24 (Opus session, no code changes) — answer: mechanically reliable, trigger-wise NOT reliable.** The write path itself is not the problem. The four real gaps: (1) inbox automation defaults OFF for new vaults, (2) menu-bar quick-capture doesn't log an event, (3) menu-bar Distill-clipboard is an unwired stub, (4) no standing instruction nudges an external agent to proactively call `rhizome_distill`/`create_note`. Plan for next session ranked by leverage in docs/plans/2026-07-25-browser-extension-plan.md. Fix 1 (inboxAutomationEnabled default) not yet shipped. Fix 2 (menu-bar event logging) scoped but not built. Fix 3 (Distill-clipboard stub) deferred. Fix 4 (save criteria in vault AGENTS.md bundle) shipped 2026-07-24.

   **Follow-up session same day (2026-07-24, Opus) — real GitHub-repo research (mem0, Zep, Letta/MemGPT, basicmachines-co/basic-memory, Anthropic's own Claude memory tool, and Claude-Code-specific memory MCPs `mempalace`/`memory-mcp`) instead of social-buzz research.** `/last30days` was confirmed the wrong tool for this (zero relevant signal, pure noise). Findings + one fix shipped, one bigger feature scoped but not built. Converging pattern: "agent decides when to save" is universal — nobody has solved it with pure LLM judgment alone. The three real levers ranked by determinism: (1) system-prompt-injected criteria (mem0 MCP, Letta, basic-memory, Claude Code's own cross-session memory), (2) hook-enforced checkpoint (mempalace, memory-mcp), (3) host-owned automatic extraction (mem0 SDK, Zep). Fix 1 shipped (AGENTS_MD const in getting_started.rs). Fix 2 scoped, not built — architecture correction needed first.

2. **Menu-bar companion — capture/activity/vault-context WIRED + committed** (`11e7ca65`, 2026-07-19). Popover now: quick-capture Enter → real note in `raw/inbox/` via `create_note_content`; activity feed from `rhizome_read_events`; vault label/context via `load_vault_list`. 20 tests, tsc+lint clean. **NOT native-QA'd** — needs `pnpm tauri dev` → click tray mark → type → Enter → confirm note lands on disk + feed updates. **Still stubbed/deferred** (depends on distillation clipboard wiring, search→main window bridge, tray status-dot grammar, global shortcuts). Detail: `docs/plans/2026-07-19-menu-bar-companion-skeleton-session-status.md`.

3. **Design specs banked, buildable when ready** (Fable 5, all committed): `docs/design/onboarding-walkthrough.md` (10-step spotlight tour) and `docs/design/shell-final-direction.md` (converged network-shell direction). **Waves 5.3 (icon command rail, §2.2) and 5.4a (node bullets + link-count chips, §2.3/§2.7) are now BUILT.** Remaining phases from that spec still open: 5.4b (status-bar 3-pill consolidation), 5.4c (research dock), 5.4d (graph-canvas chrome), 5.4e (mini graph dock), plus the settings redesign (§4). No build sign-off gates left.

4. **Wave 5.3 — icon command rail — BUILT 2026-07-24 (Opus), behind `shell_command_rail`, NOT yet committed, browser-QA'd flag-on.** New `src/components/CommandRail.tsx` (46px fixed left rail): 4 destinations (Notes / Graph / Research / Changes) + agent avatar + settings gear. Wired into `App.tsx` as the first child of `.app`, gated on `useFeatureFlag('shell_command_rail')`. **COMMITTED `46ad5efd`** (post-writing the above bullet; local-only, not pushed). Part §2.6.3 partial dedup landed (status bar hides duplicate Research button + Settings gear when rail is active). Later, Graph-badge hiding also done. **COMMITTED `f7b4452e`, pushed.** Rail flag is OFF by default.

4c. **NATIVE QA — first ever run for the shell waves, 2026-07-24 (Opus).**
`pnpm tauri dev`, real Rhizome Vault (105 notes, `main`, 28 changes), dark theme.
- The rail is already ON natively without any localStorage override — `useFeatureFlag` falls through to `isFeatureEnabled`, and the alpha release channel returns true for every flag.
- Traffic-light fix confirmed on a real window.
- Both pills render correctly.
- **Not done:** interactive native QA (Accessibility permission for osascript blocked, or need a real `.app` bundle for computer-use). **Do the .app build before graduating any shell flag.**

4b. **Wave 5.4b — three-pill status bar — BUILT 2026-07-24 (Opus), committed `2a5b35c3` + `bbc3c154`.** Per shell-final-direction.md §2.6, gated on `commandRailActive`: Vault·git pill (green dot clean/orange dirty + git controls in VaultMenu dropdown), Agents pill (idle or running job label), View group (all three hidden in pill mode). 15 unit tests plus browser QA. Flag off by default — no smoke-selector rewrite needed. Not done: native QA, flag graduation.

5. **Wave 5.4a — node bullets + link-count chips — BUILT 2026-07-24 (Opus).** Link-count chip (additive, unconditional) in `NoteItem.tsx`. Sidebar type-row node dots gated behind `shell_command_rail`. tsc + eslint clean. Browser-QA'd.

6. **Wave 5.0 canonical mark (final state).** See `docs/adr/0157-canonical-brand-mark.md` for full history. 5-satellite asymmetric geometry unchanged from OS icon, recolored to cyber teal-green (`#E4E7E5` core, `#1FCFA8`/`#4CEFCB` satellites), thinner strokes (stroke-width 5). `BrandMark.tsx` rewritten to brand-fixed hex (was theme-reactive `var(--accent-blue)` core). All platform icons regenerated. Verified live at pixel level. 5.1–5.4 not started.

**Also landed this session, not part of the wave plan:** wiki-graph status-bar button toggle now works (click again while already in graph to return to previous view, `a9e160993`).

**Also landed 2026-07-19 (Hermes session), not part of the wave plan — uncommitted:** menu-bar companion skeleton — tray icon + popover webview (`menu-bar-companion` label) + FE shell matching `design/menu-bar-companion/index.html`. Capture/distill/search/activity are UI stubs only. Detail: `docs/plans/2026-07-19-menu-bar-companion-skeleton-session-status.md`.

---

## Where things stand (2026-07-12)

**Wiki Graph view shipped (Claude Fable 5 session):** optional GalaxyBrain-style 3D force-directed graph of the wiki vault — nodes are notes, edges are wikilinks/frontmatter relationships. New Rust module `src-tauri/src/vault/graph.rs` builds the graph from scanned `VaultEntry` values. Exposed via `rhizome_api::build_wiki_graph`, a `rhizome_wiki_graph` `call_rhizome_tool` arm, and a `graph <vault_path>` subcommand on the `rhizome-tool` sidecar. Frontend: `src/components/graph/GraphView.tsx` mounted as a top-level view. Clicking a node opens a docked preview panel. **Not done:** translation of `graph.*` locale keys into non-English languages (LARA needs `LARA_ACCESS_KEY_ID`/`LARA_ACCESS_KEY_SECRET`, not set). Also not done: native `pnpm tauri dev` smoke test.

**MCP bridge Phase 2 shipped:** `rhizome-tool` — a new Rust CLI sidecar binary (`src-tauri/src/bin/rhizome_tool.rs`) wraps all six `rhizome_api` research verbs. `mcp-server/index.js` now branches every handler on `RHIZOME_TOOL_PATH`. This closes the last save-lane gap from the alpha roadmap: Lane B (external MCP agents) now has a real Rust path. **Not done:** Phase 3 (Tauri `externalBin` packaging) and Phase 4 (full cutover + grep gate removing the Python fallback). 21 new Rust tests + 4 MCP stdio-integration tests, all green.

**Three fixes landed this session:**
1. **App icon transparency** — `qlmanage` stripped alpha from SVG renders. Switched to `rsvg-convert`. All 55 platform icons regenerated. Commit `ec06c4286`.
2. **Accent color picker now works** — `data-accent` attribute was set on `<html>` but no CSS rules consumed it. Added `:root[data-accent="<color>"]` blocks for all 8 picker colors in `src/index.css`. Commit `f9ef2d7c2`.
3. **macOS binary renamed to Rhizome** — `CFBundleExecutable` was `tolaria` → Dock tooltip said "tolaria." Added `[[bin]] name="Rhizome"` in Cargo.toml. Also fixed `NSLocalNetworkUsageDescription` in `Info.plist`. Commit `906816986`.

**Theme spot-check:** 7 of 15 themes verified (Dracula, Nord, Catppuccin Mocha, Tokyo Night, GitHub Light, Rosé Pine, Solarized Light). Mode toggle works. No regressions.

**One Brain migration (Python CLI → Rust core):** steps 1-5 of 6 done. All Research panel verbs route through Rust. `grok_import` ported as `rhizome_grok_import.rs`. External MCP agents still shell Python.

Grok-Wiki is a separate real app (not Rhizome's own Research panel). `grok_import` is a one-way adapter: if Grok-Wiki already generated a wiki JSON for a repo, this reads that file and converts it into a Rhizome vault page.

**Alpha roadmap — all of Alpha-1 through Alpha-5 shipped.** Alpha-1: Search index + write location. Alpha-2: Virtual project tree. Alpha-3: Inbox automation. Alpha-4 (ADR-0153): Destination vault. Alpha-5 (commit `8447ef9a9`): Cancel affordance — Generate/Import/Distill run as cancellable async jobs.

**Also shipped:** Update-checker fixed; 15 Tolaria cherry-picks backported; README/CONTRIBUTING rewritten for Rhizome identity.

**Phase 6 (Memory/step 6):** Not started. Roadmap lists it as optional/non-goal for alpha.

---

## What happened this session (2026-07-12)

**Hermes session — three fixes + theme QA:**

1. **Icon alpha fix:** `qlmanage` thumbnail generation stripped alpha channel from SVG renders. Switched to `rsvg-convert` (brew install librsvg). All 55 platform icons regenerated with proper corner transparency. `rx="230"` on SVG background rect is intentional — macOS applies its squircle mask on top. Commit `ec06c4286`.

2. **Accent color CSS:** `data-accent` attribute was set on `<html>` but no CSS rules consumed it. Added `:root[data-accent="<color>"]` blocks for all 8 picker colors in `src/index.css`. Verified in browser with `getComputedStyle`. Commit `f9ef2d7c2`.

3. **macOS binary name:** `CFBundleExecutable` was `tolaria` → Dock tooltip said "tolaria." Added `[[bin]] name="Rhizome"` in Cargo.toml. Also fixed `NSLocalNetworkUsageDescription` in `Info.plist`. Commit `906816986`.

4. **Theme spot-check:** 7/15 themes verified (Dracula, Nord, Catppuccin Mocha, Tokyo Night, GitHub Light, Rosé Pine, Solarized Light). Mode toggle works. No regressions.

**All three commits not pushed** — pre-push suite is heavy (coverage, Playwright, clippy). User can push or skip.

**Previous session (2026-07-11):**

Two distinct pieces of work landed today:
1. **Context recovery + doc cleanup** (deepseek, no code): audited local Ollama models, caught up on cross-session Rhizome history, rewrote HANDOFF.md to strip speculative future-phase content and describe only shipped code. See `docs/plans/2026-07-11-handoff-session-status.md`.
2. **`grok_import` Rust port** (Claude, real code): ported `rhizome/grok_import.py` to `rhizome_grok_import.rs` — commit `f1ef65c98`. 1167 tests pass (15 new), coverage gate 86.07% (≥85% required), clippy clean. See `docs/plans/2026-07-11-grok-import-port-session-status.md`.

A prior amend collapsed both into one commit and dropped the grok_import record — restored here as a plain new commit instead of another amend.

---

## Warnings and gotchas (must read before touching code)

These are pre-existing warnings about traps, broken paths, and confusing state — most documented with commit hashes so a fresh session can find the full story.

- **pnpm 10 vs 11 lockfile mismatch:** — *(moved to CROSS-MODEL-HANDOFF.md §13)*
- **GitHub Actions out of billing funds:** CI/Release fail in ~5s. Not a code bug.
- **`tsc --noEmit` misses things `tsc -b` catches:** Verify frontend with `pnpm build`. The root `tsconfig.json` has `files: []`, so `tsc --noEmit` type-checks *nothing* and exits 0 on a broken tree. Never treat `tsc --noEmit` as a green build.
- **LLVM_COV/LLVM_PROFDATA env vars needed** for `cargo llvm-cov` and pre-push Rust coverage gate. See [Commits & pushes](#commits--pushes) in AGENTS.md.
- **TAURI_SIGNING_PRIVATE_KEY missing:** — *(moved to CROSS-MODEL-HANDOFF.md §13)*
- **Local QA scripts don't exist** (`~/.openclaw/skills/tolaria-qa/scripts/` is a dead path). — *(moved to CROSS-MODEL-HANDOFF.md §13; see AGENTS.md § QA scripts for the path inconsistency fix)*
- **Research panel needs agent CLI auth** — defaults to `claude` CLI. Fix is `claude` re-login, not code.
- **Bundle IDs still say Tolaria** in some config files. Binary executable name and NSLocalNetworkUsageDescription are now "Rhizome." A full rename of remaining bundle identifiers is a separate task.
- **Updater pubkey is empty** in `tauri.conf.json` — don't fix without a real signing keypair. — *(moved to CROSS-MODEL-HANDOFF.md §13)*
- **Dead-code backlog** — run `pnpm deadcode` (knip, added 2026-07-24). Two decision-required items resolved the same day:
  - **`EmojiPicker.tsx` deleted** (395 lines, never imported — dead from birth). Dataset survives in `src/utils/emoji.ts` as test-only exports.
  - **9 dependencies removed**: 8 `@radix-ui/react-*` leftovers + `three` (redundant) + `@anthropic-ai/sdk` (zero references). Deleted `hooks/commands/index.ts` and `note-list/InboxFilterPill.tsx` too.
  - **`src/types/laputaTestBridge.ts` is NOT dead** — ambient `declare global` file, knip false positive. Now in `knip.json`'s ignore list. Always run `npx tsc --noEmit` after acting on a knip "unused file."
  - **`src/hooks/useMcpBridge.ts` — NOT deleted, suspected live bug.** `mcp-server/index.js:60` connects as WebSocket client to `ws://localhost:9711` but nothing runs that server. `useMcpBridge.ts` is imported by nobody. Open question: do the MCP tools that need the running app actually work? Test before deciding.
  - Still open, low value: ~28 unused exports, most test-only.
- **Suspected broken MCP live bridge** — needs investigation (described in useMcpBridge warning above). Do not just delete the orphan.
- **`AiAgentsBadge.tsx` was dead code** — RESOLVED 2026-07-24 (cherry-picked `11039d23`). Deleted along with test + 18 orphaned locale keys. Status now lives on `command-palette action` + `GuidanceWarning` banner. Smoke test rebuilt.
|- **`tests/smoke/fix-crash-create-note.spec.ts` is timing-flaky** — pre-existing. Worth a fix-flaky pass. — *(moved to CROSS-MODEL-HANDOFF.md §13)*
- **Release pipeline (2026-07-25) — unsigned publish path unblocked; Intel Mac dropped; Linux hardened.** `62be2cbc` made macOS/Windows builds unsigned. Key decisions encoded in workflows: `.sig` optional at publish, macOS packages a download `.app.tar.gz` manually, Intel Mac removed from build matrix, Linux runner moved to `ubuntu-24.04` (resolves `rust-lld` undefined symbol — may need glibc ≳ 2.38). Trade-off on older distros not verified in CI yet. Re-enable signed updater only when a verified keypair + live `updater.endpoints` exist.
- **Repo naming collision** — `~/code/projects/rhizome` (old CLI-era repo) and `~/code/projects/rhizome-desktop` (this app) both had `origin` pointing at `git@github.com:knispo/rhizome.git`. User is renaming `rhizome` → `rhizome-old` and `rhizome-desktop` → `rhizome` on disk. The old folder's `origin` still needs to be repointed or removed once renamed.

## Git state

- Repo: `git@github.com:knispo/rhizome-desktop.git` (PRIVATE)
- Origin is the only remote. A local `tolaria` remote exists for upstream cherry-picks (not pushed)
- Don't touch: `.claude/settings.local.json` (pre-existing local dirt), `Fable-5s-one-brain-architecture-rhizome.md` (untracked, not project)
- The `knispo/rhizome` public repo is a **separate** Python CLI toolkit project — different repo, different codebase
