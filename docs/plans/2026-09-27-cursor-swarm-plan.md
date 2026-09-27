# Cursor swarm plan — finish everything open, ask about everything parked

**Origin:** Claude Opus 5.5 · 2026-09-27 · Claude Code Mac session "STE-100 skill pack research", approved by Atticus

## Context

Atticus wants one Cursor run (lead: Grok 4.7) to close every open and queued item across `rhizome-agent`, `stepack` and the Windows machine. The lead must also ask him about each parked or shelved idea from past plans and handoffs. Nothing parked gets built without his answer.

The inventory comes from two read-only audits run on 2026-09-27:

- 17 open GitHub issues.
- About 27 open C-numbers.
- About 30 other open items in the docs.
- About 60 parked ideas.

After approval, this file is saved to `rhizome-agent/docs/plans/2026-09-27-cursor-swarm-plan.md`, replacing the short draft. It is committed as docs only. Atticus then pastes one line into Cursor.

## Verified state (2026-09-27)

- `rhizome-agent`: `origin/main` = `b2c306e`. Nothing is unpushed.
  - BlockNote 0.55.0 and tiptap 3.31.3 are in `c13d5b6`.
  - 6856 unit tests pass.
  - Smoke results: 23 passed, 7 flaky, 0 failed.
  - Native QA of 0.55 is **not done**.
  - `/Applications` still runs build `d0a55f8`. Everything after it exists in source only.
- `docs/HANDOFF.md` State line is **stale**. It says `835c5bb` with unpushed work. `docs/BOARD.md` and `docs/NEXT.md` date from 2026-09-20 and are stale too.
- `stepack`: `origin/master` = `0e48633`, 6 skills. The Mac checkout may be behind.
  - Benchmarks: 15 of 120 calls done on `gemini-3.5-flash`. The Gemini free quota blocks the rest.
- Windows: C80 and C82 are fixed. C81 is open. Hermes on Windows still has the `rhizome` MCP enabled.

---

## Part 1 — Operating rules for the lead (Grok 4.7)

1. **Ask first, in one batch.** Before any task that is marked **ASK**, put the questions from Part 3 to Atticus. Ask at most 4 questions per round, and give each one a recommended option.
   - Record every answer in `docs/plans/2026-09-27-parked-decisions.md`: ID, question, answer, date.
   - Silence is not yes. An "ASK" item with no answer stays parked.
2. **Hard stops. Never cross these without the exact words from Atticus.**
   - `import_jsonl` (Prime session-list import): only after Atticus types `1`.
   - Rebuild `/Applications`: only when Atticus says "rebuild" and will launch the app. Commit, push and rebuild are three separate verbs (`.cursor/skills/rhizome-ship/SKILL.md`).
   - Git history rewrite (Gmail on 530 commits): only on an explicit yes. It breaks about 30 worktrees.
   - C58 `~/.pi/agent/skills/hyperframes` self-symlink: do not delete it.
   - Do not edit `~/.hermes/SOUL.md`. Do not print or move any `.env` value.
   - Leave `docs/plans/handoffs/2026-09-12-1714-…thinking-pill.md` (BOARD pile 9) alone.
3. **Model per task.** Grok 4.7 is the default for lead and judgment work. Use a cheaper model for mechanical tasks. Use a stronger model only when debugging or design judgment decides the result. Every sub-agent report names its model and the reason for the choice.
4. **Isolation.** Each writing sub-agent gets its own git worktree (`isolation: worktree` or `git worktree add`). Read-only agents may share the main tree. Only one agent drives the native app at a time.
5. **Rules for every sub-agent brief.** Paste these into each brief.
   - Stage files by name. Commit with `git commit -- <paths>`. Never use `git add -A` or `git add .`, and never use `--no-verify`.
   - Sign commits: `Co-Authored-By: <model> <noreply@…>`.
   - Bugs follow TDD: red, then green, then commit.
   - Hardcode English strings inline. Do no `en.json` work (C18).
   - If you write "pre-existing", open or update a C-number in `docs/HANDOFF.md`.
   - Do not push. The lead pushes `main` once per wave, through the full pre-push suite.
   - Report what changed, the commits, the test commands with their results, and what stays open.
6. **Trust order for external behaviour:** live daemon, then Prime's own docs (`~/.local/lib/node_modules/prime-agent/docs/`), then repo notes. Repo docs are not primary sources.
7. **Before deleting anything knip flags,** grep the whole repo for the filename, including `src-tauri/` and `docs/`. Run `pnpm typecheck` afterwards.

---

## Part 2 — Work that needs no decision

Run the waves in order. Tasks inside one wave run in parallel.

### Wave 0 — Preflight (lead, Grok 4.7)

- `git fetch`. Check that `main` = `origin/main`, then run `git status --short`.
- Check `stepack` against its remote.
- Run `git worktree list` and `git stash list`.
- Ask the Part 3 decisions in batches. While Atticus answers, start Waves 1 to 3.

### Wave 1 — Docs truth (cheap model)

| ID | Task | Done when |
|---|---|---|
| D-1 | Fix the `docs/HANDOFF.md` State line to `b2c306e` and "installed app = `d0a55f8`". Refresh the `docs/BOARD.md` and `docs/NEXT.md` headers and their stale SHAs. | `pnpm handoff:check` passes. |
| D-2 | Write the handoff file for session 2026-09-27: BlockNote 0.55, Dependabot, C80/C82, stepack v1, Hermes MCP. Source: the `/handy` block from that session. | The file is in `docs/plans/handoffs/` with frontmatter. |
| D-3 | C79 esbuild: the lockfile resolves only `0.28.2`. Check that `vite build` works, then mark the esbuild part fixed. Record `glib`/`lru`/`rand` with the reason each stays open. | C79 text matches the lockfile. |
| D-4 | C21: the heading says OPEN, but the body says all 8 residues were fixed. Grep for the residues, then mark it fixed or reopen it with evidence. Update NEXT §3. | There is no contradiction left. |
| D-5 | C73 and C74 are not in any doc. Grep the git log and the handoffs. Record what they were, or note "number unused". | HANDOFF says what they were. |
| D-6 | NEXT §4: cross-reference the issues into ADR-0166 and close its open questions. | ADR-0166 is updated with a new ADR, if the rules require one. |

### Wave 2 — Security, gates, hygiene (cheap to medium)

| ID | Task | Tier | Done when |
|---|---|---|---|
| S-1 | The Codacy worktree exclude (`a4eeda6`) does not reach Trivy. Find where `codacy-cli` takes Trivy skip-dirs. Read its own docs first. Exclude `.worktrees/**` and `.claude/worktrees/**`. | cheap | The SARIF has no `.worktrees/` path. |
| S-2 | Rust Sentry does not scrub `ghr_`, `sk_live_` or `sk_test_`. Un-park the test at `src-tauri/src/telemetry.rs:381` as the red test, then fix it. | medium | The test is green and `cargo llvm-cov` stays at 85% or higher. |
| S-3 | Remove the dead CodeScene block in `.husky/pre-push` (line 413 and after). | cheap | The hook still passes. |
| S-4 | C81: in the pre-push hook, stop sending `ensure_playwright_browser` output to `/dev/null`. Add a timeout, and make it fail clearly with the browser build and the cache path. Test with a stub. | medium | C81 is fixed and macOS behaves the same. |
| S-5 | Assess Rust `lru` and `rand`: can `cargo update -p` raise them without a Tauri upgrade? Do it if safe. `glib` stays tied to a Tauri upgrade, so record that. | medium | C79 is updated. |
| S-6 | The Trivy HIGH "Slack token" in `telemetry.rs` is a false positive (test fixtures). Make the fixture not look like a token, or add an inline Trivy ignore with its reason. | cheap | Trivy is clean for `src-tauri/`. |

### Wave 3 — Code backlog that is already agreed (Grok 4.7 unless noted)

| ID | Task | Source | Done when |
|---|---|---|---|
| B-1 | Rotate `.rhizome/events.jsonl`, which grows without a limit. Add a size cap with rollover. | HANDOFF "still genuinely open" | Tests prove the cap. |
| B-2 | Add an error boundary above `AiPanelView`, so a bad status payload no longer blanks the app. | HANDOFF A1 note | A test renders a bad payload without blanking. |
| B-3 | Add the junk-title guard to Import and repo research. Reuse `is_junk_distill_title` from `src-tauri/src/rhizome_distill.rs`. | 0425 handoff | Tests cover both writers. |
| B-4 | #57: delete compatibility code for users who don't exist (`ready-for-agent`). Follow `docs/plans/issue-57-ghost-compat.md`. Follow Part 1 rule 7. | #57 | knip passes, typecheck passes, the issue is closed. |
| B-5 | #36 timezone setting. Follow `docs/plans/issue-36-timezone-setting.md`. | #36 | Feature built, PostHog event added, issue closed. |
| B-6 | #45: the remainder of model settings (connect providers, curate the dropdown). | #45 | Remaining parts listed and built. |
| B-7 | #41: steer and queue UX while Prime works. Before wiring, read the Prime docs and probe the live daemon for `mutate_queued_message`. | #41 | Unit tests pass. Native check is in Wave 4. |
| B-8 | #39: graph as an agent tool. First settle C40: plan the retirement of `rhizome_graph_summary` for `rhizome_graph_health`. Removing that tool is an **ASK** (Q-A6). | #39, C40 | Built up to the ASK line. |
| B-9 | #23: sessions as searchable knowledge. Build only the part that does not need `import_jsonl`. | #23 | Issue updated with what shipped. |
| B-10 | C39: isolate the live-daemon tests so they leave no husk sessions. | C39 | `pnpm test:live-prime` leaves nothing behind. |
| B-11 | C28 and the 7 flaky smoke specs: find the shared cause (CPU load or timing) and fix the tests, not the gates. | C28 | 3 local smoke runs have 0 flaky. |
| B-12 | C31: try to reproduce the unhandled `pnpm test` error with a captured log. If it does not reproduce in 10 runs, record that. | C31 | Reproduced and fixed, or documented. |
| B-13 | C33: clear the typecheck backlog, worst file first (`pnpm typecheck:tests:backlog`). Cheap model. Stop after 25 files or 2 hours. | C33 | The exclude list is shorter. |
| B-14 | C53 residual (b): show a real error instead of a 30s timeout when a worker fails. | C53 | Test plus UI. |
| B-15 | C75: measure the cold-launch cost of the transcript remount and the Sessions-rail list, then reduce whichever is larger. | C75 | Before/after numbers in HANDOFF. |
| B-16 | Wire the Prime 0.9.3 daemon commands that make sense (`get_direct_worker_transport`, `list_agent_peers`, roster subscribe, `resume_queue`). Run `pnpm prime:surface` first. Do each only when a user-visible need exists. Otherwise list it for Q-B. | HANDOFF 84–88 | Wired, or listed for asking. |

### Wave 4 — Native QA (one agent, strong model, Mac only, serial)

Run with `pnpm tauri dev` and `demo-vault-v2/`. Test mouse first, then keyboard. Record ✅ or ❌ per item. A ❌ gets a failing test before the fix. Clean the demo vault at the end.

1. **BlockNote 0.55:**
   - Code-block languages (TypeScript, Go, PowerShell) in light and dark mode.
   - Checklist: toggle, then delete the item quickly.
   - Table handles: add, remove and drag a row, and reload the note while hovering.
   - A link opens through the guarded opener.
   - The slash menu and the `[[` menu.
   - The drag-handle menu shows its portal.
   - Copying a wikilink to plain text keeps `[[Target]]`.
2. **Astra redesign:** boot splash card, expanded rail, rail folding at 1100px, titlebar palette on the right, Prime Inference card.
3. **C47:** the close dialog, and attached versus resident work in the UI.
4. **C13:** labels in the activity-feed source.
5. **C64:** watch the first 2 seconds of launch 3 times for "Prime not installed".
6. **C60:** blank painting after relaunch. Record evidence only. Do not close it.
7. **Hide-on-close helpers** (BOARD pile 6). **#52 and #13 menu bar:** the Done row and the running state.
8. **#41 steer/queue** from B-7. **C72** side-panel discoverability.
9. **HANDOFF top priority (a):** the full save loop on a blank vault. Atticus must be at the keyboard, so schedule it with him.

### Wave 5 — Windows machine (the Windows Cursor or Claude session)

Brief the Windows session. The Mac lead does not run these.

| ID | Task |
|---|---|
| W-1 | Hermes: disable the `rhizome` MCP when Atticus types `yes, disable it` in that session. |
| W-2 | C42 and #32: the first launch of the app on Windows (`docs/WINDOWS-DEV.md`). Record every blocker. |
| W-3 | C38: end-to-end proof of the named pipe `\\.\pipe\prime-agent-daemon` with a live daemon. |
| W-4 | C80 residual: if Atticus turns on Developer Mode, run the 6 skipped symlink tests. |
| W-5 | C81: re-verify the Wave 2 fix on Windows with a real `playwright install`. |

### Wave 6 — stepack (cheap model)

| ID | Task |
|---|---|
| P-1 | Sync the Mac checkout to `origin/master`. |
| P-2 | Benchmarks (**ASK** Q-C1: rerun daily or enable billing). Then run `run.py --model gemini-3.5-flash`, which skips finished calls, until `completed=120`. Then run `judge.py --model gemini-3.5-flash` and `run.py --update-readme`. Name the model in the README, and say the numbers are not directly comparable with modpack's. Load the key from `.env` and never print it. |
| P-3 | README icons: **ASK** Q-C2. |
| P-4 | Roll `tally` out to every harness Atticus uses. He said "wanted everywhere" on 2026-09-20. First show the list of target files: `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.cursor/AGENTS.md`, `~/.hermes/SOUL.md` (**append only to its STE block, through `sync-ste.sh`; never edit the rest**), and the ChatGPT instructions. **ASK** Q-C3 before writing. |

### Wave 7 — Branch and worktree hygiene (cheap model, READ-ONLY report)

Report on each of these, with branch, last commit, unpushed commits, dirty files and a recommendation:

- The ~30 worktrees.
- The `prototype/session-list-scale` branch.
- `stash@{6}`, which holds the inverted dock icon.
- The untracked `brag-output/` and `.tmp-look/` folders.

Delete nothing until Atticus answers Q-A10.

### Wave 8 — Close out (lead)

1. Merge the worktree branches into `main` in dependency order, one wave at a time.
2. Push once per wave through the full suite (about 4.5 minutes). Fix any failure in the task that caused it.
3. Codacy: run `codacy-cli analyze --tool trivy|opengrep|lizard`. There must be no new Critical or High findings.
4. Write one handoff file: `docs/plans/handoffs/YYYY-MM-DD-HHMM-cursor-grok-4-7-swarm.md`. Update HANDOFF, NEXT and BOARD in place.
5. Rebuild only if Atticus says "rebuild".
6. Final report: ✅ or ❌ per ID, the model used per task, the answers from Part 3, and anything still open.

---

## Part 3 — The ask list. Ask before building. Silence means parked.

### Q-A — Decisions that block open items

| ID | Question | Blocks |
|---|---|---|
| A1 | #56: keep, remove, or amend the second provider path in `ai_models.rs`? This also unblocks #48 and ADR-0168. | #56, #48 |
| A2 | Harness composition: ratify option 2 and its first slice (native `extension_ui` dialogs)? And #40, harness or client of harnesses? | NEXT §1, #5, #40 |
| A3 | #50 live-app view: which surface? | #50 |
| A4 | C66 agent profile: one profile or one per agent, app-wide or per vault, and where in Settings? | C66 |
| A5 | C9 optional Welcome, and C10 Spotlight tour: build now or keep parked? | C9, C10 |
| A6 | C40: retire `rhizome_graph_summary` for `rhizome_graph_health`? Agents may call it. | C40, #39 |
| A7 | C53 (a): should the session cwd be the vault? This needs an ADR. | C53 |
| A8 | #26 update Prime in-app: what consent design? | #26 |
| A9 | C37: accept "no Chunk" for good, or buy CircleCI and supply the org id? | C37 |
| A10 | Worktree and branch cleanup: delete, keep, or land each item from the Wave 7 report? | Wave 7 |
| A11 | Public-release hygiene: rewrite history for the Gmail address or accept it; a human read of 58 files with `~` paths; `refactoringhq` in `.chunk/config.json` and the workflows. | Going public |
| A12 | C11: publish a Rhizome-owned starter-vault remote, and under `tuckcode` or `knispo`? | C11 |
| A13 | C19: `git rm --cached .rhizome/` in the affected real vault? | C19 |
| A14 | Duplicate "Notes" heading in VaultPanel: which one stays? | 0425 open |
| A15 | Right icon rail: yes or no? | NEXT §1 |
| A16 | File the session-import GitHub issue now? This does not unblock `import_jsonl`, which still needs `1`. | NEXT §2 |

### Q-B — Parked or shelved ideas: build, keep parked, or drop?

Ask by group. Record one answer per row.

- **Product surfaces**
  - "Saved to…" link beside a reply.
  - D2: failed turns recoverable in place.
  - R1: About shows the Prime version and Copy diagnostics.
  - R2: recovery keeps the draft.
  - R3: brand artwork out of work surfaces.
  - Delete a session.
  - Notification sound.
  - Auto-select the top-10 trending models.
  - Public name just "Rhizome".
  - Mouse back and forward across sessions.
- **Rail and layout**
  - Packages/skills shortcut with a market link.
  - Automations and kanban destinations.
  - Vault pop-out.
  - Portfolio overview, Today strip, bottom launcher and vault kanban.
  - Agent board over Prime sessions and subagents.
  - Tools chrome: a floating cluster or a top/bottom bar.
  - Inverted dock icon (`stash@{6}`).
  - BrandMark reconciliation (ADR-0157/0172).
  - Theme sun/moon and Settings skins.
- **Chat and harness**
  - #51 Case 2: model-backed Tab completion.
  - #52 job 2: global hotkey, screen capture, voice companion.
  - #48 OmniRoute (after A1).
  - TokenJuice and Switchyard.
  - Unspoken queue verbs (`abort_and_clear_queue`, `set_follow_up_mode`, `set_steering_mode`).
  - Tool-allowlist profiles.
  - RLM tree, observe and refine UX.
  - Skill and extension catalog with provenance.
  - Per-reply provider/model label and trajectory view.
  - Containerized Prime workers and a read-only agent terminal.
  - Streaming on the Anthropic direct-API path.
  - The remaining Prime 0.9.3 commands from B-16.
- **Memory and vault**
  - Automatic L0–L3 consolidation.
  - Memory mechanics: dedupe, supersession, two-stage gate, versioning, `expires:`.
  - The seven pi-hermes memory ideas.
  - Inspectable claims and correction history.
  - BM25-only fallback when the embedding download fails (ADR-0174).
  - Watcher refreshes the wiki index on vault edits.
  - Scheduled lint and intake audit.
  - Vault as the shared skill/memory home, with a drift check.
  - Doctor-door handoff (`door.md`).
  - Speech-to-text learned spellings.
  - Stuck-agent path through Mycelium, Graph and fullscreen.
  - ADR-0160 hidden tier and merging the two vaults.
  - ADR-0153 destination deferrals: first-run import-or-create, "+ New Vault…", and a Settings path.
  - Multi-destination send.
  - The folders design: path filter in views, per-vault hiding, `index.md` name and icon, drag a note to a folder.
  - Repo-research cache cap and tool allowlist (ADR-0151).
  - Mycelium: M4 native view, Mindwalk fork, run text digest.
  - TraderAlice patterns.
- **Delivery and experiments**
  - Bundled Prime/Node runtime (phase 4b), managed updates, signing and the Apple Developer Program.
  - Public-install dogfood of `PUBLIC-PREVIEW.md` on a clean account.
  - Jev auto-save-gate experiment, after going public.
  - Reproduce the live "High thinking never answers" case.
  - Human session titles.
  - The BRAG launch video (0835 handoff).
- **stepack**
  - A `why-this` Repowise skill.
  - Repowise MCP in the pack.
- **Other repo (TagTeamGPT, reminder only)**
  - Merge or close PR #3.
  - Rebase PR #5.

### Q-C — stepack

| ID | Question |
|---|---|
| C1 | Benchmarks: rerun daily for free, or enable billing (a few cents, about 10 minutes)? |
| C2 | README icons: keep ✈️ only, or add per-skill icons? |
| C3 | Roll `tally` into every harness file listed in P-4? |

---

## Critical files

- `docs/HANDOFF.md`, `docs/NEXT.md`, `docs/BOARD.md`, `docs/plans/handoffs/`
- `docs/plans/2026-09-20-public-readiness-inventory.md` and `docs/plans/2026-09-21-next-phase-plan.md` (the parked ledgers the Q-B rows come from)
- `.husky/pre-push` (`ensure_playwright_browser`, CodeScene block), `.codacy.yaml`, `.codacy/codacy.yaml`
- `src-tauri/src/telemetry.rs`, `src-tauri/src/rhizome_distill.rs`, `src-tauri/src/prime_session_host.rs`
- `patches/@blocknote__*@0.55.0.patch`, `src/components/{Editor.tsx,codeBlockOptions.ts,richEditorLinkOptions.ts}`
- `~/code/side-projects/stepack/benchmarks/`, `~/Documents/Rhizome Vault/agents/shared/sync-ste.sh`

## Verification

- Each ID ends ✅ or ❌ with its evidence: test names, command output, or a screenshot for native checks.
- `main` pushes pass the full pre-push suite. Frontend coverage stays at 70% or higher, Rust at 85% or higher.
- Codacy shows no new Critical or High findings.
- `pnpm handoff:check` passes.
- `docs/plans/2026-09-27-parked-decisions.md` holds one line per Part 3 ID: the answer, or "no answer — parked".
- `git status --short -- demo-vault demo-vault-v2` is empty.

## After approval (this Claude session)

1. Write this plan to `rhizome-agent/docs/plans/2026-09-27-cursor-swarm-plan.md`, replacing the draft.
2. Write this session's handoff file. Fix the HANDOFF State line and run `pnpm handoff:check`.
3. Commit both as docs only. Push, which runs the docs-only gate.
4. Give Atticus the one-line Cursor prompt:
   `Read docs/plans/2026-09-27-cursor-swarm-plan.md and AGENTS.md. You are the lead (Grok 4.7). Start with Wave 0 and the Part 3 questions.`
