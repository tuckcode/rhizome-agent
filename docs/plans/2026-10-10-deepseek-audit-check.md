# DeepSeek refactor survey: check against current `main`

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · read-only check of the DeepSeek Flash refactoring survey
**Status:** for Nightly to read before any issue is opened. Committed as a docs-only PR. No code or issue was made.

---

## Sources

| File | Read | Note |
|---|---|---|
| `docs/plans/2026-10-10-refactoring-survey.md` | all 516 lines | The only survey file. Uncommitted in the main checkout. |
| `src-tauri/target/rhizome-cov.lcov` | parsed | The survey's coverage output (§6). Gitignored. Built from `dbd94b96`. |
| `~/paste-claude-deepseek-audit.md` | all | The brief for this check. Not a survey. |

**Only one survey exists.** The brief said there are several. I searched these places:

- `git status` in the main checkout and in all 23 registered worktrees.
- Every `*.md` file in the repo that is newer than the remaining-threads plan.
- `~`, `~/Downloads`, `~/Desktop`, `~/code`, and `~/Documents`, for names with "survey", "audit", "refactor", or "deepseek" changed on 2026-10-10.

Nothing else turned up. If another survey exists on a different machine, this report does not cover it.

**Skipped, as the brief asked.** `docs/plans/2026-10-10-harness-remaining-threads.md` is untracked in the main checkout, but it is the copy that #109 merged. `docs/plans/paste-claude-plan-answers.md` was skipped by name.

**Baseline.** The survey read `dbd94b96`. This check reads `origin/main` at `df8841ea`. The main checkout is still at `dbd94b96`, so all reads used `git grep` and `git show` against `origin/main`. Between the two commits, only #109 (the plan doc) and #110 (the `create_note` helper) merged. Neither touches a file this survey cites.

**Open PRs.** #111 (1b) changes `ai_models.rs` only. #112 (1c) changes `rhizome_routing/mod.rs` and two docs. #113 (Cursor's 1a) changes `ai_model_tools.rs`, `lib.rs`, and four `rhizome_loop/` files. **None of the three fixes a survey finding**, and none conflicts with one.

---

## 1. Verdicts

Legend: **True** means still true on main. **Fixed** means already fixed. **Wrong** means the survey is wrong. "Re-checked" lists what I measured again, not what I took from the survey.

### Merged findings

- **IPC seam:** §3.1 (`callHost` bypassed) and §8.3 (14 shapes of the Tauri test mock) are the same seam: production code and test code. They are one finding below, F7.
- **ADR-0003:** §7.1 (the ADR says live code is deleted) and §7.3 (tab-era names) both lead to one superseding ADR. They are one finding below, F1.

| ID | Survey § | Finding | Verdict | Re-checked on `df8841ea` |
|---|---|---|---|---|
| F1 | 7.1 + 7.3 | ADR-0003 (`status: active`) says `useEditorTabSwap` and `useTabManagement` are removed | **True** | ADR-0003 lines 15 and 25. The two hooks are 1205 and 606 lines. No ADR supersedes 0003. |
| F2 | 6 | The Rust coverage gate counts inline test code | **True** | The gate total matches the lcov: 46,999 of 54,548 lines, 86.16%. My own split, using the first inline `mod tests` per file, gives production at **78.75%** and tests at 94.34%. The survey said 78.10%. The method differs, and the conclusion holds. |
| F3 | 3.2 | CLI discovery is copied, and the shared helper is behind one copy | **True** | `pi_discovery.rs:72` tries `-lc` then `-lic`. `cli_agent_runtime.rs:641` tries `-lc` only. `mcp/runtime.rs` uses `subprocess::command`. None of `antigravity_`, `opencode_`, or `pi_discovery`, `claude_cli`, or `codex_cli` calls `find_cli_binary`. `user_shell_candidates`, `path_from_successful_output`, and `first_existing_path` are each defined in 7 files. |
| F4 | 5.2 | Auth-error needle lists differ per CLI | **True** | `pi_events` has `api.key` and `401`. `opencode_events` has neither. 8 agent-side functions (`antigravity`, `claude`, `codex`, `hermes`, `kiro`, `opencode`, `pi`, `prime_events`). The 2 git functions are a separate domain. |
| F5 | 3.4 | `AppAiWorkspaceSurface` is a pass-through shim | **True** | 120 lines. 2 production importers (`App.tsx`, `AiWorkspaceWindowApp.tsx`). 0 tests name it. |
| F6 | 8.4 | Config entries point at nothing | **True** | `vite.config.ts:1070` excludes `src/hooks/useAiAgent.ts`, which does not exist. `knip.json:16` ignores `src/mock-tauri.ts`, which is now a directory. I did not run `knip`. |
| F7 | 3.1 + 8.3 | `callHost` is bypassed, with no lint rule, and test mocks are duplicated | **True** | 116 raw `invoke` sites in 74 non-test files. No `no-restricted-imports` in `eslint.config.js`. 97 test files mock `mock-tauri`, and 68 mock `@tauri-apps/api/core`. `src/test/` has only `setup.ts`. |
| F8 | 8.1 | `@smoke` tags that no gate runs | **True** | `playwright:smoke` names 15 files. 51 files carry `@smoke`. `ci.yml` names Playwright only in a comment. |
| F9 | 3.3 | Active vault is two states with unpaired writes | **True** | `useVaultSwitcher.ts:501-502`. 9 write sites at the cited lines. The last-vault branch (`:804-807`) nulls `selectedVaultPath`, never clears `vaultPath`, and returns. I did not test whether a user can see this. |
| F10 | 4.5 | Raw `<input>` and `<select>` outside `ui/` | **True** | 13 raw inputs in 10 files. 115 raw buttons in 57 files. The raw `<select>` is at `SessionActivityHistory.tsx:91`. `ui/input.tsx:11` turns off spellcheck and autocomplete, so raw inputs keep both. |
| F11 | 5.3 | Two public wrappers only `#[ignore]` tests call. 11 `too_many_arguments` allows. | **True** | `run_import_via_agent` (`rhizome_import.rs:376`) is called only at `:749`. `run_distill_via_agent` (`rhizome_distill.rs:272`) is called only at `:706`. Both are `#[ignore]` tests. 11 allows. |
| F12 | 5.7 | A parser that only tests use | **True** | `parse_json_line` and `parse_ai_agent_json_line` are `#[cfg(test)]`. Production uses `parse_process_stdout_line`, which also records ignored lines. |
| F13 | 8.2 | The vault write API in `vite.config.ts` has no tests and no scan | **True** | 1089 lines. `.codacy.yaml:19` excludes it. This API is in the dev server only (`pnpm dev`). |
| F14 | 4.4 | `StatusBarPrimaryFromFooter` re-lists props | **True** | `StatusBar.tsx:116`. I did not re-diff the 39 names. |
| F15 | 4.3 | `NoteListLayout` props are a hook's return type | **True** | `note-list/NoteListLayout.tsx:8`. |
| F16 | 5.8 | `run_blocking` is private while 25 sites copy it | **True** | `commands/ai.rs:370` is private. 25 `spawn_blocking` sites are in `commands/` outside `ai.rs`. |
| F17 | 5.5 | No Rust↔TS type generation or check | **True** | No `ts-rs` or `specta` in `Cargo.toml` or `package.json`. I did not re-count the 67 mirrored pairs. |
| F18 | 5.1 | `prime_session_host.rs` statics force `--test-threads=1` | **True** | 9859 lines. 8 production statics at the cited lines, plus `TEST_LOCK`. `.husky/pre-push:270` ends with `-- --test-threads=1`. |
| F19 | 4.1 | `SettingsPanel` god component | **True** | 1741 lines, 1 export. |
| F20 | 4.2 | `<Editor>` mounted twice in `App.tsx` | **True** | `App.tsx:2178` and `:2320`. I did not re-diff the 74 prop lines. |
| F21 | 3.5 | No `Combobox` primitive | **True** | No combobox in `src/components/ui/`. The 4 files are 496, 395, 410, and 378 lines. `stepHighlightedIndex` is in 4 files. |
| F22 | 5.6 | `claude_cli` has its own event type | **True** | `ClaudeStreamEvent` at `claude_cli.rs:46`. `map_claude_event` at `ai_agents.rs:323`. |
| F23 | 8.5 | Tests that assert fixture literals | **True (facts)** | 18 `.extra`, `.coverage`, or `.more` test files. The survey's keep or delete call is a judgement, and I did not re-make it. |
| F24 | 5.4a | `engines::Engine` is unwired. The survey says delete it or open a C-number. | **Wrong action** | It is unwired on main. But merged plan #109 wires it in step 2a (wider `EngineEvent`, event sink) and step 2b (native Chat commands). The shape mismatch the survey names is the 2a work item. **Do not delete `engines/`, and do not open a C-number for it.** |
| F25 | 5.4b | `stream_claude_chat` has no frontend listener | **True, owner call** | The only `src/` reference is `mock-tauri/mock-handlers.ts:951`. The single macro call site is `commands/ai.rs:172`. `ARCHITECTURE.md` still documents it. Whether to keep it is knispo's decision. |

**Small corrections to the survey, none of which changes a verdict:**

- §5.2 says "nine `is_auth_error` functions". Main has 10 with that shape. 8 are agent-side, and 2 are git (`git/connect.rs`, `git/remote.rs`).
- §2 says the remaining-threads plan "itself says Do not commit". That was true then. #109 has since merged it.

---

## 2. Ranking

Order: value to the product and to agents, divided by the risk of the change. "Collides with" names an open or planned harness step that edits the same files. Such a fix should wait for that step or join it.

| Rank | ID | Why it ranks here | Risk | Effort | Collides with |
|---|---|---|---|---|---|
| 1 | F1 | One superseding ADR removes a binding claim that 1811 live lines are deleted. An agent doing a dead-code sweep could delete the note-open path on that authority. | none (docs) | S | none |
| 2 | F6 | Two config entries point at nothing. Deleting them is near-free, and a small check stops new ones. | near-zero | S | none |
| 3 | F4 | The same auth failure gets a different message per CLI, and the user sees it. Ship the data-only spec first and the needle unification in a second commit. | low | S | none |
| 4 | F3 | A correctness fix: every adapter gets the `-lic` retry and the console-hiding command builder. It also removes about 450 copied lines. ADR-0093 needs a superseding ADR. | low | S–M | none |
| 5 | F2 | The gate reads 86% while production is about 79%. The fix is cheap, but it is a **policy change**: the threshold must move in the same change, or the next push fails. knispo decides the new bar. | low code, policy | S | Every Rust PR. It changes the bar 1a to 2c must pass. Land it between steps, not during one. |
| 6 | F5 | It removes a shim that silently drops any new optional prop. Two call sites. | low | S | none (step 4 edits `AiPanel` and `ChatHome`, not `AiWorkspace`) |
| 7 | F12 | Two lines, and the tests then test the parser production runs. | none | XS | none |
| 8 | F11 | It deletes 2 test-only public functions and 2 of the 11 allows. | low | S | **Step 6** moves `rhizome_import`/`rhizome_distill` callers. Do it in the step 6 PR. |
| 9 | F8 | 36 files claim pre-push protection they do not have. The cheap honest fix is to remove `@smoke` from them. Re-enabling them is a separate triage. | low (remove tags), medium (re-enable) | S | none |
| 10 | F9 | A possible real bug: removing the last vault leaves `vaultPath` set. First step: one red regression test for that branch. If it is red, it is a bug fix. The reducer comes after. | medium (reducer) | test S, reducer M | none |
| 11 | F7 | High value but a wide diff (74 files). The lint rule must land with it, or it erodes again. | low per site, wide | M | **Step 4** edits `aiAgentSession.ts`, `ChatHome.tsx`, `AiPanel.tsx`. Do it after step 4. Step 4's new `streamNativeChat.ts` should use `callHost` from the start. |
| 12 | F17 | Every Rust IPC change can break the UI with no compile error. A baselined checker is low risk. | low | S–M | **Step 2b** adds `native_chat_*` types. Decide before 2b whether those new types use `ts-rs`, so the new surface is not hand-mirrored. |
| 13 | F10 | A real gap (spellcheck and autocomplete stay on in raw inputs), 14 sites. Note: the shadcn rule is in AGENTS.md §2, which says it was inherited from Desktop and never re-decided. | low per site | S | none |
| 14 | F18 | Big payoff: the Rust suite could run in parallel. But it is the most-churned file, and `TEST_LOCK` must span both modules during the move. | medium | M | **Step 2b** edits the quit path in `lib.rs` next to the Prime settle. Do it after 2b. |
| 15 | F19 | Mechanical completion of a split already started. | medium-low | M | **Step 4** puts the engine toggle in Settings. Do it after step 4. |
| 16 | F13 | A dev-only server, but it writes to the vault with no tests and no scan. | low, wide diff | S–M | none. Run `pnpm playwright:regression` with it. |
| 17 | F16 | Mechanical, about 1 hour. | low | S | none |
| 18 | F14 | 90 lines to a spread. | low | XS | none |
| 19 | F15 | Removes a type alias that couples a component to a hook. | low | S | none |
| 20 | F20 | Two `<Editor>` mounts can drift. | medium | M | Check before step 4. The AI-surface props are the 4 lines that differ. |
| 21 | F21 | A real deep module, but medium work and a semantics hazard in the option builders. | low–medium | M | none |
| 22 | F22 | Low value now. | medium (40+ test asserts) | M | none |
| 23 | F23 | A judgement call. Measure before deleting. | low | S | none |

**Not ranked:**

- **F24 (wrong action).** `engines/` is planned work. Close it in the survey's terms with "wired by steps 2a and 2b of the remaining-threads plan".
- **F25 (owner call).** Ask knispo whether `stream_claude_chat` stays. If it goes, `ARCHITECTURE.md` changes in the same PR.

---

## 3. Notes for Nightly

- **Do not open an issue for F24.** It contradicts the merged plan.
- **F2 needs a decision issue,** not a tech-debt issue. It changes a release gate that AGENTS.md names, so knispo sets the new threshold.
- **F1 and F3 each need an ADR.** F1 supersedes ADR-0003. F3 refines ADR-0093. AGENTS.md says ADRs are superseded, never edited.
- **Five findings collide with harness steps:** F11 (step 6), F7 (step 4), F17 (step 2b), F18 (step 2b), and F19 (step 4). Their issues should name the step and wait for it.
- **F9's first move is a test,** and the test result decides if it is a bug or a refactor.
- The survey's §9 "healthy" list was not re-checked, apart from the coverage total in F2.
