# Context Rules Ledger

> Extracted on 2026-07-25 from Phase 0 baseline. Verdict column left blank for evaluation.

## claude doctor output

```
CLI version: 2.1.143 (Claude Code)
App version: 1.24012.9
Auto-updater plist: not found
Last update check: 2026-07-19T23:20:40.853Z — success, 2.1.207 → 2.1.215
Plugins: ponytail=false, i-have-adhd=false
Hooks: .orca/agent-hooks/claude-hook.sh
MCP servers: firecrawl, rhizome (local wiki), tolaria (mcp-server bridge)
```

| # | File | Line | Rule | Test A (inferable?) | Test B (contradicts?) | Verdict |
|---|------|------|------|---------------------|------------------------|--------|
| 1 | ~/.claude/CLAUDE.md (global) | 4 | `- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`` | | | |
| 2 | AGENTS.md (repo monolith) | 7 | `- Read task description and all comments fully` | | | |
| 3 | AGENTS.md (repo monolith) | 8 | `- **If you are not Claude (e.g. Nous Portal, Hermes Agent, or any non-Anthropic model), read `docs/CROSS-MODEL-HANDOFF.md` first** — a short, verified` | | | |
| 4 | AGENTS.md (repo monolith) | 9 | `- Read `docs/HANDOFF.md` first — living current-state doc, updated in place each session (not dated)` | | | |
| 5 | AGENTS.md (repo monolith) | 10 | `- Check `docs/plans/` for the most recent `*-session-status.md` (sort by date in the filename) — dated detail log behind the handoff summary: what's d` | | | |
| 6 | AGENTS.md (repo monolith) | 11 | `- For To Rework: the ❌ QA failed comment tells you exactly what to fix` | | | |
| 7 | AGENTS.md (repo monolith) | 12 | `- Check `docs/adr/` for relevant architecture decisions before structural choices` | | | |
| 8 | AGENTS.md (repo monolith) | 13 | `- Check `docs/ARCHITECTURE.md` and `docs/ABSTRACTIONS.md` for relevant structural information` | | | |
| 9 | AGENTS.md (repo monolith) | 14 | `- For UI tasks: study app visual language and components first. Prioritize reusing existing components, assets, and variables over recreating them.` | | | |
| 10 | AGENTS.md (repo monolith) | 15 | `- If working on a Todoist task, add a comment: `🚀 Starting work on this task. [Brief description of approach]`` | | | |
| 11 | AGENTS.md (repo monolith) | 19 | `- origin = git@github.com:knispo/rhizome.git (PUBLIC — AGPL-3.0-or-later). Commit locally, push to origin main when pre-push gates pass.` | | | |
| 12 | AGENTS.md (repo monolith) | 20 | `- Commit every 20–30 min: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`` | | | |
| 13 | AGENTS.md (repo monolith) | 21 | `- Pre-commit is a lightweight lint gate only. Pre-push runs the full check suite (build + tests + coverage + core Playwright smoke), preferably on thr` | | | |
| 14 | AGENTS.md (repo monolith) | 22 | `- **A task is NOT done until it is committed locally and pre-push checks pass locally (`git push --dry-run` style verification, or just running the ch` | | | |
| 15 | AGENTS.md (repo monolith) | 66 | `- Prefer the Codacy MCP inside Codex to inspect repository/file issues for every touched code file.` | | | |
| 16 | AGENTS.md (repo monolith) | 67 | `- If MCP is unavailable, use the local CLI wrapper, e.g. `.codacy/cli.sh analyze <path> --format sarif`; choose the relevant tool when useful (`eslint` | | | |
| 17 | AGENTS.md (repo monolith) | 68 | `- **Always fix Critical and High severity findings introduced by your change.** Do not move the task to In Review with new Critical/High Codacy issues` | | | |
| 18 | AGENTS.md (repo monolith) | 69 | `- Review Medium findings. Fix them when they are real defects or security-sensitive; otherwise explain why they are acceptable in the completion comme` | | | |
| 19 | AGENTS.md (repo monolith) | 70 | `- Never silence a Codacy rule just to pass the scan. Prefer small code changes that remove the finding.` | | | |
| 20 | AGENTS.md (repo monolith) | 79 | `- Frontend coverage must stay ≥70%.` | | | |
| 21 | AGENTS.md (repo monolith) | 80 | `- Rust line coverage must stay ≥85%.` | | | |
| 22 | AGENTS.md (repo monolith) | 81 | `- For bug fixes, add a regression test when practical.` | | | |
| 23 | AGENTS.md (repo monolith) | 82 | `- For new behavior, add targeted coverage close to the changed code; do not rely only on broad E2E coverage.` | | | |
| 24 | AGENTS.md (repo monolith) | 113 | `- What was implemented (a few lines covering logic and UX/UI).` | | | |
| 25 | AGENTS.md (repo monolith) | 114 | `- QA: what was tested and how (Playwright / native screenshot / osascript).` | | | |
| 26 | AGENTS.md (repo monolith) | 115 | `- Tests/coverage: commands run and final coverage result.` | | | |
| 27 | AGENTS.md (repo monolith) | 116 | `- Coverage commands passed (`pnpm test:coverage` and `cargo llvm-cov ... --fail-under-lines 85`) or the change is docs-only.` | | | |
| 28 | AGENTS.md (repo monolith) | 117 | `- Codacy: MCP/CLI scan summary; confirm no new Critical/High findings.` | | | |
| 29 | AGENTS.md (repo monolith) | 118 | `- Localization: any user-facing copy lives in `src/lib/locales/en.json`, `pnpm l10n:translate` was run, and `pnpm l10n:validate` passes. If no copy ch` | | | |
| 30 | AGENTS.md (repo monolith) | 119 | `- PostHog: meaningful new user actions/events are instrumented with safe metadata; noisy/minor changes explicitly say “PostHog: no event needed becaus` | | | |
| 31 | AGENTS.md (repo monolith) | 120 | `- Refactoring: any cleanup done on touched files, or "none needed".` | | | |
| 32 | AGENTS.md (repo monolith) | 121 | `- ADRs: any new/updated ADRs, or "none".` | | | |
| 33 | AGENTS.md (repo monolith) | 122 | `- Docs: any updated docs (`ARCHITECTURE.md`, `ABSTRACTIONS.md`, etc.), or "none".` | | | |
| 34 | AGENTS.md (repo monolith) | 123 | `- Demo vault dirt checked: `git status --short -- demo-vault demo-vault-v2` is empty unless fixture changes are intentional.` | | | |
| 35 | AGENTS.md (repo monolith) | 139 | `- Treat `demo-vault/` and `demo-vault-v2/` as disposable QA fixtures unless the task explicitly changes demo content.` | | | |
| 36 | AGENTS.md (repo monolith) | 140 | `- If you create untracked notes, attachments, or other temporary files there for testing, delete them before the task is complete.` | | | |
| 37 | AGENTS.md (repo monolith) | 141 | `- If you modify tracked demo-vault files only to test or QA behavior, revert those edits before the final commit.` | | | |
| 38 | AGENTS.md (repo monolith) | 142 | `- Before declaring a task done, make sure `git status --short -- demo-vault demo-vault-v2` is empty unless demo fixture changes are part of the task.` | | | |
| 39 | AGENTS.md (repo monolith) | 143 | `- If a fresh run starts and the only local dirt is inside `demo-vault/` or `demo-vault-v2/`, clean those paths first and continue. That case is recove` | | | |
| 40 | AGENTS.md (repo monolith) | 148 | `- **Never commit or push** any test notes to the remote vault` | | | |
| 41 | AGENTS.md (repo monolith) | 149 | `- **Delete all test notes from disk** when done — do not leave untitled or temporary notes on the filesystem. Run `cd ~/Laputa && git checkout -- . &&` | | | |
| 42 | AGENTS.md (repo monolith) | 150 | `- **Rationale:** test notes pollute the local vault over time, making it a collection of nonsensical untitled files. The vault must stay clean on disk` | | | |
| 43 | AGENTS.md (repo monolith) | 156 | `| Need | Use |` | | | |
| 44 | AGENTS.md (repo monolith) | 162 | `| Autocomplete/combobox | Reuse existing combobox components from the app (check `src/components/`) |` | | | |
| 45 | AGENTS.md (repo monolith) | 164 | `| Note/type icon field | `IconEditableValue` — a typeahead over Phosphor icon names that also accepts a pasted emoji or image URL. **There is no emoji` | | | |
| 46 | AGENTS.md (repo monolith) | 177 | `- `Option+N` → special chars on macOS. Use `e.code` or `Cmd+N`` | | | |
| 47 | AGENTS.md (repo monolith) | 178 | `- Tauri menu accelerators: `MenuItemBuilder::new(label).accelerator("CmdOrCtrl+1")`` | | | |
| 48 | AGENTS.md (repo monolith) | 179 | `- `app.set_menu()` replaces the ENTIRE menu bar — include all submenus` | | | |
| 49 | AGENTS.md (repo monolith) | 180 | `- `mock-tauri.ts` silently swallows Tauri calls — not a substitute for native testing` | | | |
| 50 | docs/HANDOFF.md (living state) | 22 | `- `082ab1c0` `inbox_action` frontmatter contract + save-only lane` | | | |
| 51 | docs/HANDOFF.md (living state) | 27 | `- **Verified end to end** against a real temp vault: a card lands in` | | | |
| 52 | docs/HANDOFF.md (living state) | 30 | `- **⚠️ Real bug found and fixed on the way (`aef0e8ef`): every optional` | | | |
| 53 | docs/HANDOFF.md (living state) | 42 | `- **Next: commit 7 — Settings UI showing the user their `bridge_token`.**` | | | |
| 54 | docs/HANDOFF.md (living state) | 49 | `- **Known limit, deliberate:** `RHIZOME_TOOL_PATH` resolves the sidecar` | | | |
| 55 | docs/HANDOFF.md (living state) | 60 | `- **(a) Test with a blank wiki.** Spin up an empty/fresh vault and try` | | | |
| 56 | docs/HANDOFF.md (living state) | 64 | `- **(b) Research competitors + existing docs.** Look at how comparable` | | | |
| 57 | docs/HANDOFF.md (living state) | 69 | `- **(c) Then audit our write path** and produce a plan: is the trigger` | | | |
| 58 | docs/HANDOFF.md (living state) | 80 | `- **(a) Blank-vault repro — done, both real write lanes checked out clean.**` | | | |
| 59 | docs/HANDOFF.md (living state) | 88 | `- **(b) Competitor research — `/last30days` was the wrong tool for this` | | | |
| 60 | docs/HANDOFF.md (living state) | 104 | `- **(c) Our write-path audit — mechanically solid, 4 real trigger-side` | | | |
| 61 | docs/HANDOFF.md (living state) | 129 | `- **Plan for next session, ranked by leverage:**` | | | |
| 62 | docs/HANDOFF.md (living state) | 151 | `- **Converging pattern across every repo checked: "agent decides when to` | | | |
| 63 | docs/HANDOFF.md (living state) | 169 | `- **Fix 1 shipped — gap 4 above, done and tested, NOT yet committed` | | | |
| 64 | docs/HANDOFF.md (living state) | 189 | `- **Fix 2 scoped, NOT built — architecture correction first, then the` | | | |
| 65 | docs/HANDOFF.md (living state) | 292 | `- **The rail is already ON natively** without any localStorage override —` | | | |
| 66 | docs/HANDOFF.md (living state) | 297 | `- **Traffic-light fix confirmed on a real window.** The macOS` | | | |
| 67 | docs/HANDOFF.md (living state) | 302 | `- **Both pills render correctly on the real vault:**` | | | |
| 68 | docs/HANDOFF.md (living state) | 305 | `- **Still NOT done — interactive native QA.** Clicking rail destinations` | | | |
| 69 | docs/HANDOFF.md (living state) | 318 | `- **Vault·git pill** — `● <vault> · <branch> · <n>△`, green dot when` | | | |
| 70 | docs/HANDOFF.md (living state) | 326 | `- **Agents pill** — "Agents idle" muted, or the running job's label in` | | | |
| 71 | docs/HANDOFF.md (living state) | 334 | `- **View group** — the rail owns Graph/Research/Settings, so all three` | | | |
| 72 | docs/HANDOFF.md (living state) | 336 | `- **Scope call (deliberate, user's explicit choice this session):**` | | | |
| 73 | docs/HANDOFF.md (living state) | 348 | `- Event `statusbar_pill_opened` (`vault` | `agents`) fired from both` | | | |
| 74 | docs/HANDOFF.md (living state) | 351 | `- **Not done:** native (non-browser) QA on the real vault; flag` | | | |
| 75 | docs/HANDOFF.md (living state) | 360 | `- **Link-count chip (additive, UNCONDITIONAL — no flag):** the note` | | | |
| 76 | docs/HANDOFF.md (living state) | 372 | `- **Sidebar type-row node dots (GATED behind `shell_command_rail`):**` | | | |
| 77 | docs/HANDOFF.md (living state) | 390 | `- **Wave 1 (quick-win bugs) — done, 5 commits, verified live natively:**` | | | |
| 78 | docs/HANDOFF.md (living state) | 393 | `- **Wave 2 (new-user readiness) — done, 4 commits, native-verified live**` | | | |
| 79 | docs/HANDOFF.md (living state) | 415 | `- **Wave 3 (direct-API save-to-wiki fallback) — done, 10 commits` | | | |
| 80 | docs/HANDOFF.md (living state) | 477 | `- **Wave 4 (AI bubble + Hermes icon) — done, 2 commits, native-verified` | | | |
| 81 | docs/HANDOFF.md (living state) | 501 | `- **Wave 5 (brand/shell conformance) — 5.0 done this session (went` | | | |
| 82 | docs/HANDOFF.md (living state) | 572 | `- `d8527965f` — Cargo `default-run` ambiguity (silently broke every` | | | |
| 83 | docs/HANDOFF.md (living state) | 575 | `- `26bfd1999` — icon recolored to true grayscale (luminance-preserving` | | | |
| 84 | docs/HANDOFF.md (living state) | 577 | `- `92a658bed` — moved `GraphView` out of the narrow note-list column` | | | |
| 85 | docs/HANDOFF.md (living state) | 581 | `- `52c71903e` — WebGL/3d-force-graph init failures now surface as a` | | | |
| 86 | docs/HANDOFF.md (living state) | 583 | `- `f5f73f7b8` — camera framing (`zoomToFit`) — turned out not to be the` | | | |
| 87 | docs/HANDOFF.md (living state) | 585 | `- `15b51e102` — **the actual root-cause fix**: a mount-order race meant` | | | |
| 88 | docs/HANDOFF.md (living state) | 595 | `- `f3deeda69` — **node colors fixed**: `getTypeColor`/`getTypeLightColor`` | | | |
| 89 | docs/HANDOFF.md (living state) | 601 | `- `aae8a2393` — **edge rendering fixed**: `ForceGraph3DCanvas` now sets` | | | |
| 90 | docs/HANDOFF.md (living state) | 609 | `- `c855b70af` — **docked resizable side panel**: replaced the small` | | | |
| 91 | docs/HANDOFF.md (living state) | 665 | `- Native QA step 4 from the prior checklist (build/install/screenshot` | | | |
| 92 | docs/HANDOFF.md (living state) | 667 | `- ~~**Hermes agent bubble / Claude bubble** — root cause diagnosed~~ —` | | | |
| 93 | docs/HANDOFF.md (living state) | 669 | `- **l10n blocked** — `pnpm l10n:translate` needs` | | | |
| 94 | docs/HANDOFF.md (living state) | 682 | `- **Pushed** — `origin/main` is caught up to local `HEAD` (`783a1ca8`)` | | | |
| 95 | docs/HANDOFF.md (living state) | 775 | `- Alpha-1: Search index + write location` | | | |
| 96 | docs/HANDOFF.md (living state) | 776 | `- Alpha-2: Virtual project tree` | | | |
| 97 | docs/HANDOFF.md (living state) | 777 | `- Alpha-3: Inbox automation` | | | |
| 98 | docs/HANDOFF.md (living state) | 778 | `- Alpha-4 (ADR-0153): Destination vault — Research panel writes target `agent_memory_vault_path` setting, per-session dropdown override, confirm-befor` | | | |
| 99 | docs/HANDOFF.md (living state) | 779 | `- Alpha-5 (commit `8447ef9a9`): Cancel affordance — Generate/Import/Distill run as cancellable async jobs via `start_rhizome_job`/`cancel_rhizome_job`` | | | |
| 100 | docs/HANDOFF.md (living state) | 782 | `- Update-checker fixed: no longer pings upstream Tolaria releases` | | | |
| 101 | docs/HANDOFF.md (living state) | 783 | `- 15 Tolaria cherry-picks backported (stability fixes only)` | | | |
| 102 | docs/HANDOFF.md (living state) | 784 | `- README/CONTRIBUTING rewritten for Rhizome identity` | | | |
| 103 | docs/HANDOFF.md (living state) | 813 | `- **No --no-verify ever**: Pre-push gates are the real check suite` | | | |
| 104 | docs/HANDOFF.md (living state) | 814 | `- **TDD mandatory**: Red → Green → Refactor → Commit` | | | |
| 105 | docs/HANDOFF.md (living state) | 815 | `- **Localization mandatory**: All UI copy in `src/lib/locales/en.json`` | | | |
| 106 | docs/HANDOFF.md (living state) | 816 | `- **Research panel yes, MCP bridge deferred**: The MCP server (`mcp-server/index.js`) still shells Python CLIs for external agents. That's the remaini` | | | |
| 107 | docs/HANDOFF.md (living state) | 820 | `- **pnpm 10 vs 11 lockfile mismatch**: CI pins pnpm 10. Local is pnpm 11. Regenerate with `CI=true npx pnpm@10 install --no-frozen-lockfile`` | | | |
| 108 | docs/HANDOFF.md (living state) | 821 | `- **GitHub Actions out of billing funds**: CI/Release fail in ~5s. Not a code bug.` | | | |
| 109 | docs/HANDOFF.md (living state) | 822 | `- **`tsc --noEmit` misses things `tsc -b` catches**: Verify frontend with `pnpm build`.` | | | |
| 110 | docs/HANDOFF.md (living state) | 827 | `- **LLVM_COV/LLVM_PROFDATA env vars needed**: For `cargo llvm-cov` and pre-push` | | | |
| 111 | docs/HANDOFF.md (living state) | 828 | `- **TAURI_SIGNING_PRIVATE_KEY missing**: Free Tauri updater key, not the paid Authenticode cert` | | | |
| 112 | docs/HANDOFF.md (living state) | 829 | `- **Local QA scripts don't exist**: `~/.openclaw/skills/tolaria-qa/scripts/` is a dead path` | | | |
| 113 | docs/HANDOFF.md (living state) | 830 | `- **Research panel needs agent CLI auth**: Defaults to `claude` CLI. Fix is `claude` re-login, not code` | | | |
| 114 | docs/HANDOFF.md (living state) | 831 | `- **Bundle IDs still say Tolaria**: `com.tolaria.app` etc. in some config files. The binary executable name and NSLocalNetworkUsageDescription are now` | | | |
| 115 | docs/HANDOFF.md (living state) | 832 | `- **Updater pubkey is empty**: `tauri.conf.json` — don't fix without a real signing keypair` | | | |
| 116 | docs/HANDOFF.md (living state) | 833 | `- **Dead-code backlog** — run `pnpm deadcode` (knip, added 2026-07-24).` | | | |
| 117 | docs/HANDOFF.md (living state) | 835 | `- **`EmojiPicker.tsx` deleted.** Git history shows it was never imported` | | | |
| 118 | docs/HANDOFF.md (living state) | 844 | `- **9 dependencies removed**: 8 `@radix-ui/react-*` leftovers from the` | | | |
| 119 | docs/HANDOFF.md (living state) | 849 | `- **Deleted 2026-07-24 after checking each one:** `hooks/commands/index.ts`` | | | |
| 120 | docs/HANDOFF.md (living state) | 853 | `- **`src/types/laputaTestBridge.ts` is NOT dead — knip false positive.** It` | | | |
| 121 | docs/HANDOFF.md (living state) | 861 | `- **`src/hooks/useMcpBridge.ts` — NOT deleted, suspected live bug.** See` | | | |
| 122 | docs/HANDOFF.md (living state) | 863 | `- Still open, low value: ~28 unused exports, most of them test-only.` | | | |
| 123 | docs/HANDOFF.md (living state) | 864 | `- **Suspected broken MCP live bridge — needs investigation, do not just` | | | |
| 124 | docs/HANDOFF.md (living state) | 879 | `- ~~**`AiAgentsBadge.tsx` is dead code**~~ **RESOLVED 2026-07-24** (landed` | | | |
| 125 | docs/HANDOFF.md (living state) | 893 | `- **`tests/smoke/fix-crash-create-note.spec.ts` is timing-flaky** (the` | | | |
| 126 | docs/HANDOFF.md (living state) | 896 | `- **Release pipeline (2026-07-25) — unsigned publish path unblocked; Intel` | | | |
| 127 | docs/HANDOFF.md (living state) | 923 | `- **Repo naming collision, found while chasing the above (2026-07-24):**` | | | |
| 128 | docs/HANDOFF.md (living state) | 938 | `- Repo: `git@github.com:knispo/rhizome-desktop.git` (PRIVATE)` | | | |
| 129 | docs/HANDOFF.md (living state) | 939 | `- Origin is the only remote. A local `tolaria` remote exists for upstream cherry-picks (not pushed)` | | | |
| 130 | docs/HANDOFF.md (living state) | 940 | `- Don't touch: `.claude/settings.local.json` (pre-existing local dirt), `Fable-5s-one-brain-architecture-rhizome.md` (untracked, not project)` | | | |
| 131 | docs/HANDOFF.md (living state) | 941 | `- The `knispo/rhizome` public repo is a **separate** Python CLI toolkit project — different repo, different codebase` | | | |
| 132 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 61 | `- `release.yml` / `release-stable.yml`: `.sig` optional; latest.json omits` | | | |
| 133 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 63 | `- macOS packages `.app.tar.gz` manually when Tauri does not` | | | |
| 134 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 65 | `- Intel Mac dropped; Linux unsigned + `ubuntu-24.04`; `fail-fast: false`.` | | | |
| 135 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 66 | `- Publish still needs **all remaining** build jobs green (aarch64 macOS +` | | | |
| 136 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 72 | `- **Linux `__isoc23_strtoll`**: runner moved to `ubuntu-24.04` (not yet` | | | |
| 137 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 74 | `- **macOS Intel**: removed from matrix (`ort-sys`/fastembed no prebuilt).` | | | |
| 138 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 75 | `- **fail-fast**: now `false`. aarch64 was previously cancelled by Intel` | | | |
| 139 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 95 | `- **The docs site + AI system prompt had ~450 real, substantive mentions**` | | | |
| 140 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 101 | `- **`site/public/CNAME` contains `tolaria.md`** — this is the actual **live,` | | | |
| 141 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 109 | `- **`github.com/refactoringhq/tolaria`** (Issues/PRs/Discussions/CONTRIBUTING` | | | |
| 142 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 116 | `- **`club.refactoring.tolaria`** — bundle identifier in` | | | |
| 143 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 253 | `- `--no-clean` reported **82.75%** (gate FAIL, `--fail-under-lines 85`).` | | | |
| 144 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 254 | `- A clean run on identical code reported **85.16%** (gate PASS).` | | | |
| 145 | docs/CROSS-MODEL-HANDOFF.md (gotchas) | 255 | `- The stale report was mixing std files from **two different rustc versions**` | | | |
