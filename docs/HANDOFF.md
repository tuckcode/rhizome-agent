# Handoff — read this first

Living doc. Update in place each session. This file is "what's true right now," not a history log. Detailed per-session records go in `docs/plans/*-session-status.md`.

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

## Rhizome Agent — identity

**This is `tuckcode/rhizome-agent` (private), not `knispo/rhizome`.** See `docs/IDENTITY.md`. Desktop history below is inherited from the Option C bootstrap snapshot and is useful background; product direction here is Prime harness chat.

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
- Likely security hold after new phone/device; login email is **`knispo13@gmail.com`** (not the leftover git `user.email` `tuckchamlies13@gmail.com`).
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

- ~~C4-OPEN: tolaria MCP server path mismatch across live configs~~ **RESOLVED `2fa620a5`**
- ~~C6-OPEN: inbox automation default~~ **RESOLVED 2026-07-31.** Default ON for new vaults, plus a one-time per-vault migration for existing ones. See "Investigation done" item 1 above.
- C7-OPEN: native QA for shell waves — requires a real `.app` bundle or Accessibility permission. Do not graduate shell flags without it.
- **C8-OPEN: GitHub account suspended** — blocks push + Windows CI release for friend build. Unblock tonight from home device/`knispo13@gmail.com`.
- **C11-OPEN: `GETTING_STARTED_REPO_URL` still clones `refactoringhq/tolaria-getting-started.git`** (`src-tauri/src/vault/getting_started.rs:6`) — an unrelated upstream project. The seeded `AGENTS.md` link was removed 2026-07-31, but this one is a *functional* clone URL behind the Getting Started flow, so it can't just be deleted. Needs a replacement starter-vault repo under `knispo` — blocked on GitHub access. Full breakdown incl. what must NOT be renamed: CROSS-MODEL-HANDOFF §6.
- C9-OPEN: optional first-run Welcome even when a default vault already exists (user wants optional onboard with skip-to-existing). Product decision pending.
- C10-OPEN: spotlight onboarding walkthrough still unbuilt (`docs/design/onboarding-walkthrough.md`).
- **C12-OPEN: rotate the exposed GitHub PAT** — see the warning at the top of this file. Blocked on GitHub access to actually revoke it.
- C13-OPEN: native QA backlog from the 2026-08-02 identity rename — confirm the activity-feed source labels render correctly (queued since 2026-07-31, same blocker: macOS menu tracking ignores synthesized clicks, needs a human click), and confirm a `rhizome://` deep link actually reaches and opens the app now that the scheme matches `tauri.conf.json`. **Partial re-check 2026-08-02:** the "needs a human" assumption on this whole list was never actually re-tested against `computer-use`/`cua-driver` tooling, which wasn't available in earlier sessions. A quick live check found the *main window* launches and is fully screenshot/interaction-capable via `computer-use` (real vault data rendered, note list visible, both before and after a reload) — so C16 in particular may be reachable now. The tray/menu-bar-specific claim is still unconfirmed either way: a `cmd+m` minimize test produced an inconclusive result (window resized/floated rather than cleanly minimizing to the dock) and wasn't chased further (session ran out of context). Worth a real attempt before assuming C13/C16 are still blocked — start from a fresh `computer-use` session, not this note.
- ~~C14-OPEN: `tolariaEditorFormatting.tsx` file family~~ **RESOLVED 2026-08-02.** 11 files renamed (`git mv`, history preserved) — `rhizomeEditorFormatting.tsx` and 7 sibling modules, plus every import site, mocked module path, and the 2 CSS rule-groups (`Editor.css`, `EditorTheme.css`) that had to match. `tsc --noEmit` exit 0, full suite unchanged at 5158/484. See ADR-0162.
- ~~C15-OPEN: `src/types/laputaTestBridge.ts` + `window.__laputaTest`~~ **RESOLVED 2026-08-02.** `git mv` to `rhizomeTestBridge.ts` (history preserved), `LaputaTestBridge` → `RhizomeTestBridge`, `window.__laputaTest` → `window.__rhizomeTest` across app code, test helpers, and 5 Playwright smoke specs, plus `knip.json`'s ambient-declaration ignore entry updated to match. `tsc --noEmit` exit 0, `pnpm test` unchanged at 5158/484, `pnpm lint` clean, `pnpm playwright:smoke` run live (25 passed, 1 flaky unrelated to this change passed on retry). See ADR-0162 and `docs/CROSS-MODEL-HANDOFF.md` §6.
- C16-OPEN: leg (a) of the 2026-07-19 save/trigger question — test the full save loop against a blank vault. Legs (b) and (c) are done (2026-08-02); this is the one that needs a human at `pnpm tauri dev`, same blocker shape as C13.
- ~~C17-OPEN: Ask-tab vs. Library-panel path-prefix mismatch.~~ **RESOLVED 2026-08-02.** Fixed at the API boundary, not the index: `rhizome_search::wiki_root_prefix(vault_path)` (next to `wiki_root`, `rhizome_search/mod.rs`) returns `"wiki/"` on nested layout or `""` on flat, and `rhizome_api::format_search_hits` — the single point both `search_with_service` and `search_standalone_with_embedder` funnel through before crossing to the frontend — now re-prefixes `hit.id` with it before building `AskResultDto.path`. The tantivy index's own on-disk id format (wiki-root-relative) is untouched, so no reindex is forced. `mcp-server/`'s `search_notes` (JS-native) was checked and doesn't share the bug — it walks from `vaultPath` directly and computes `path.relative(vaultPath, ...)`, already vault-root-relative; `rhizome_search` (the other MCP tool) shells out to the same Rust `search` CLI path and inherits the fix for free. New tests: `wiki_root_prefix_is_wiki_slash_for_nested_and_empty_for_flat` (`rhizome_search/mod.rs`), `format_search_hits_serializes_path_title_snippet` (updated) + `format_search_hits_adds_no_prefix_on_flat_layout` (`rhizome_api.rs`), and `search_result_path_matches_library_scan_path_on_nested_layout` (`rhizome_commands.rs`) — the last asserts a search-result path and a `scan_vault_library` path for the same underlying file on a nested `wiki/`-layout vault are byte-identical (`"wiki/entities/alice.md"`), the contract that should have been asserted from the start.
- **C18-OPEN: `pnpm l10n:validate` fails on all 19 non-English locales — no `LARA_ACCESS_KEY_ID`/`SECRET` in any session's environment.** **Verified still present and worse 2026-08-02**: 172 missing keys per locale now, up from ~69 on 2026-07-10 — the gap accumulates every session that adds UI copy without a real translation pass. Named as a known gap in at least three prior docs (`2026-07-10-one-brain-step4c-session-status.md`, `2026-07-03-research-panel-handoff.md`, `docs/design/onboarding-walkthrough.md`) with no fix and no owner. Needs one translate run with real credentials (`pnpm l10n:translate`) — not code, an environment/access problem, but it should stop being silently re-discovered.
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

- **C22-OPEN: on Windows, minimizing Rhizome and then clicking the taskbar icon does not bring the window back.** Reported directly by the user 2026-08-02, **not yet investigated or reproduced** — logged so it isn't lost, not because it's understood. Likely area: `src-tauri/src/lib.rs` and `src-tauri/src/window_state.rs` both reference tray/window-event handling and are the right starting point (found via a quick `grep -rln "tray\|minimize\|restore\|WindowEvent" src-tauri/src/*.rs`, not read yet). Windows-specific per the report — check whether the tray-click / taskbar-restore handler is platform-gated (`cfg(windows)` vs `cfg(desktop)`) and whether it's actually wired to a restore call, or only to show/hide on other platforms. No repro steps beyond "minimize, then try to click it back up" captured yet — get those from the user before starting, and check whether this reproduces on macOS too or is genuinely Windows-only (relevant since `linux_appimage.rs`/`window_state.rs` suggest per-platform window handling already exists and may just be incomplete for one target).

## Links out

- Full history + session details → `docs/plans/` (see classification in `docs/plans/handoff-classification.md`)
- Context retooling plan → `docs/plans/2026-07-25-context-retooling-plan.md`
- Duplication analysis → `docs/plans/duplication-analysis.md`
- Rules ledger → `docs/plans/context-rules-ledger.md`
- Cross-model traps → `docs/CROSS-MODEL-HANDOFF.md`
