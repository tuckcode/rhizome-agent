# Long-haul plan: finish Rhizome as its own harness

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · read-only planning session
**Status:** proposed. Read with the remaining-threads plan (D1 to D13), ADR-0182, and ADR-0183 (#117).

## Context

The remaining-threads plan fixed the step order and owners. This plan turns it into long runs: queues per agent, file lanes that never collide, a session rhythm, and rules for running while knispo is away. Ground truth checked on `origin/main` at `aa803b35` (#114 merged).

---

## 1. Inventory

Tier: **A** = Claude (Opus) or a ChatGPT/Codex-class model. **B** = Cursor cheap/fast model. **B+A** = B builds, A reviews before Ricky.

| # | Item | State on 2026-10-10 | Depends on | Done means | Tier | Lane |
|---|---|---|---|---|---|---|
| 1 | Steps 1a, 1b, 1c | **Merged** (#110 to #113) | none | none | none | none |
| 2 | Step 2a, wider engine | **Merged** (#114) | none | none | none | none |
| 3 | Step 2b, native Chat commands | **PR #116 open**, CI 9 green, mergeable, no review yet. It also edits `rhizome_routing/mod.rs` and `model_events.rs` (outside Cursor's lane). | none | Ricky review done, Claude reviews the threads and quit-bound code, knispo merges | A (review) | K |
| 4 | ADR-0183 plus the 6a plan | **PR #117 open**, docs only, green | none | knispo merges | none | D |
| 5 | Docs after 1a to 1c | **PR #115 draft**, green, edits `HANDOFF.md` and the remaining-threads plan (both also in #117) | #117 | rebased after #117, knispo merges | B | D |
| 6 | Step 2c: durable log and resume | Not started. ADR-0183 decides format, recovery, two windows, damage, 100 MiB/1 MiB limits, credential filter. | #116, #117 | Native session reopens and continues after restart. All ADR-0183 rules have a test. | **A** | K |
| 7 | Step 3: keychain `KeyStore`, migration, free-tier settings | Not started. `keyring` approved (D8). 3 real keys on disk. | none (parallel to 2b, 2c) | Keys in keychain. Write-verify-remove migration (ADR-0183). Settings rows, Cloudflare warning, strict mode, read-only order. ADR for `keyring`. | **A** backend, B UI | C |
| 8 | Keychain migration on knispo's real keys | Part of 7, but it runs on his Mac | 7 merged | knispo starts the app once and confirms the 3 keys still work | knispo | none |
| 9 | Step 4: Settings toggle, native picker, lock updates | Not started | 1a, 2b, 2c, 3 | Prime stays default. One Settings toggle. Picker per D2/D11. Locks updated with the quote. `chat_native_turn_started`. Bubs QA on a real `.app`. | **B+A** | U |
| 10 | Step 5a: approval prompt and dismiss | Not started | 2b | Prompt clears on cancel and quit. A late click runs nothing. Resumed session shows no old prompt. | B | U |
| 11 | Step 5c: loop activity rows | Not started | 2b, 1c | Tool rows and one provider line per turn. Nothing enters model view. | B | U |
| 12 | Step 6: move callers, delete old path | Not started | 4 for the `api_model` move | Batch callers on `complete_text`. OpenAI-compatible `api_model` Chat on native. Old path deleted when the last caller is gone (D12). | A backend, B frontend | C + U |
| 13 | Step 6a: Anthropic streaming | Plan in #117. After launch. | 2b | Native Anthropic passes the 6a tests. Then `send_anthropic_message` and the Anthropic arm of `stream_ai_model` are deleted. | **A** | C |
| 14 | Thread 1: plugin seam (plan Phase 3) | Expected skip: 2b composes persona in the command layer | 2b merged | A docs line records "skipped: one hook" | B | D |
| 15 | #50 `pnpm live-ui` | **PR #118 draft**, pre-push green, Auto-fix on | none | CI green, out of draft, knispo merges | B (done) | C |
| 16 | #39 knowledge graph as an agent tool | Open. Graph summary tool exists (B-8). Composition and UI open. | 4 (the tool runs in the native loop) | Design note first. Then one read-only graph query tool offered by the loop. | A design, B build | C then U |
| 17 | #45 model settings: connect and curate | Open. Prime-side default model and filter built (B-6). Native-side not built. | 3 | Step 3 covers keys. A follow-up adds connection status and a curated native picker list. | B | U |
| 18 | #48 OmniRoute gateway | Open | none | Closed under ADR-0182 (knispo) | none | none |
| 19 | #100 worktree hooks run the main checkout's hook | Open | none | Each worktree runs its own branch's pre-push. A check fails loudly when it does not. | A (gates) | N |
| 20 | Refactor audit, group 1 | Uncommitted report `2026-10-10-deepseek-audit-check.md` | none | ADR-0003 superseded. Dead config entries removed. Auth needles unified. Discovery shared. The ui-audit "Changes" screen fixed. | B (ADR, config), A (needles, discovery) | D / C |
| 21 | Rust coverage gate measures test code | Report F2 | knispo picks a threshold | Gate measures production lines at a threshold knispo set | A | N |

Closed items named in the brief: #56 (won't remove, 2026-10-09) and #80 (flaky test, closed). Neither has work left.

---

## 2. Who does what

**Rule of thumb.** A task is **Tier A** when any of these is true:

1. It has shared mutable state, threads, locks, or channels.
2. It defines or reads an on-disk format, or recovers from a crash.
3. It touches secrets, keys, or credentials.
4. It parses a provider wire protocol or stream.
5. It changes a gate, an ADR, or a seam between modules.
6. It reviews any of the above.
7. The spec leaves a choice open that a wrong guess makes expensive.

Otherwise it is **Tier B**: the spec names the files and the tests, the change is mechanical, and existing tests catch a mistake.

**B+A** is for a Tier B change with a high blast radius, such as step 4. B builds it, and A reviews it before Ricky.

**A lane decides who may edit a file. A tier decides which model runs the task.** A Tier A task inside Cursor's file lane runs on a Cursor cloud agent with a premium model (Opus or GPT-5-class), not on a cheap model. That keeps file ownership stable while the model matches the difficulty.

---

## 3. Lanes and queues

### File lanes (who may edit)

| Lane | Agent | Owns |
|---|---|---|
| **C** | Claude Code on knispo's Mac | `ai_models.rs` and `ai_models/`, `ai_model_tools.rs`, `rhizome_provider_model.rs`, `rhizome_routing/`, new keychain module, `settings.rs` routing section, `AiProviderSettings.tsx` and new `FreeTierSettings.tsx`, `ai_run_target.rs`, `rhizome_distill.rs`, `rhizome_import.rs`, `scripts/live-ui.mjs`, `src/utils/uiAudit.ts`, CLI adapter files for refactor F3 and F4 |
| **K** | Cursor cloud agent, premium model | `rhizome_loop/`, `engines/`, `commands/native_chat.rs`, `session_transcript_index.rs`, new native session log module, the quit path in `lib.rs` |
| **U** | Cursor cloud agents and subagents, cheap model | `ChatHome.tsx`, `AiPanel.tsx`, `aiAgentSession.ts`, new `streamNativeChat.ts`, Settings agent-defaults section (the toggle), approval and activity components, `src/mock-tauri/`, `parked-organs.test.ts` and `leftover-prime-keep.test.ts` (step 4 only), `streamAiModel.ts` and `aiConversationTitle.ts` (step 6) |
| **D** | Cursor, cheap model | Docs: `ARCHITECTURE.md`, `ABSTRACTIONS.md`, `GETTING-STARTED.md`, `YOU-SHOULD-KNOW.md`, `CROSS-MODEL-HANDOFF.md`, ADR supersede docs from the audit |
| **N** | Nightly | CI config, `.husky/`, flaky tests, coverage gate, ADR index, #100 |

**Hot files** are edited by more than one lane: `lib.rs`, `package.json`, `docs/HANDOFF.md`, the remaining-threads plan, `commands/mod.rs`, `model_events.rs`. The rules for them:

- Edit a hot file only in the PR that needs it, and keep the edit minimal.
- Name the hot file in the PR body.
- The second PR rebases after the first merges.
- `HANDOFF.md` changes swap lines. A PR never adds net lines.

**Cross-lane edits.** #116 edits `rhizome_routing/mod.rs` (lane C). A cross-lane edit is allowed only when it is small and listed in the PR body. The owning lane then reviews it.

### Queues (top first)

**Claude (lane C)**

1. Take #118 to green CI and out of draft.
2. Review #116: threads, the 2-second quit bound, the unbounded approval channel, and its edit to `rhizome_routing/`.
3. Step 3a: keychain module, `KeychainKeyStore`, write-verify-remove migration with crash tests, `keyring` ADR. Tier A.
4. Step 3b: routing settings and free-tier UI.
5. Review the 2c PRs as they open. Tier A review.
6. Review step 4 before Ricky (B+A).
7. Step 6 backend: `complete_text`, move the batch callers and the connection test.
8. Step 6a: Anthropic streaming, then delete the old Anthropic call.
9. Refactor F3 and F4 (discovery, auth needles), between harness PRs.
10. #39 design note.

**Cursor premium (lane K)**

1. #116: answer reviews and keep it green.
2. 2c-1: log writer (sequence number, checksum, limits, user-only file mode, credential filter).
3. 2c-2: reader and recovery (`AgentLoop::from_log`, stop at the first bad line, cancelled unfinished turn, no grants).
4. 2c-3: commands (`native_chat_list`, `native_chat_open`), the one-turn rule for two windows, and the process lock.
5. Answer reviews on step 4's backend touches.

**Cursor cheap (lanes U and D)**

1. #115: rebase after #117 and fix any conflicts.
2. Thread 1 skip line, after #116 merges.
3. 5a approval prompt, after #116.
4. 5c loop activity, after #116.
5. Step 4 toggle and picker, after 2c-3 and step 3b.
6. Step 6 frontend: move `api_model` to native and delete `streamAiModel.ts`.
7. #45 follow-up: connection status and a curated native list.
8. Audit items: ADR-0003 supersede, dead config entries, the ui-audit "Changes" screen.

**Nightly (lane N):** #100, then the coverage-gate change after knispo's threshold, then flaky tests as they appear.

### Parallel windows

| Window | Runs at the same time | Why it is safe |
|---|---|---|
| Now | C: #118, review #116 · K: #116 · D: #115 waits for #117 | separate files |
| After #116 merges | C: step 3a · K: 2c-1 · U: 5a, then 5c | C owns keys and routing, K owns loop and engines, U owns UI components |
| After 2c and 3 | U: step 4 · C: review step 4, then step 6 backend | step 4 is UI. Step 6 backend is lane C. |
| After launch | C: 6a · U: step 6 frontend · D: audit items | 6a is lane C. Step 6 frontend waits for 6a only for Anthropic (D12). |

---

## 4. Run rhythm

**Session start (every agent):**

1. `git fetch`. Run `git status --short` and `git log origin/main..HEAD` in your worktree.
2. Read the newest file in `docs/plans/handoffs/`, plus your own last handoff.
3. Check your open PRs once with `gh pr view` (state, checks, comments). Do not poll after that.
4. Take the top item of your queue that has its dependencies merged.

**One worktree per writing agent.** Branch from fresh `origin/main`.

**How much one session takes on:**

| Agent | Session size | Stop and hand off when |
|---|---|---|
| Claude (Opus) | Up to 3 PRs, or 1 Tier A PR plus reviews | Context passes about 60%. Or the queue item is blocked. Or 2 pushes fail for the same cause. |
| Cursor cloud, premium | 1 PR | The PR is open and green, or blocked |
| Cursor cloud, cheap | 1 PR, or up to 3 tiny docs PRs | The same |
| Cursor subagent | 1 task in 1 file area | It reports to its parent. It does not open PRs unless the brief says so. |

**Context budget rules:**

- Read repo docs directly, but only the sections the task needs.
- Search the Rhizome wiki. Never load it whole.
- Do not paste whole files or logs into a brief. Give paths and line numbers.
- Subagent briefs fit on one page. Each brief includes: stage by name, `git commit -- <paths>`, one worktree, never `--no-verify`, the lane's files, and the stop conditions.

**Handoff file** (`docs/plans/handoffs/YYYY-MM-DD-HHMM-<model>-<topic>.md`, frontmatter `session`, `model`, `description`):

1. A branch and PR table: branch, step, last commit, CI state, review state.
2. What landed, in 3 to 6 lines.
3. Next: the next queue item and its dependency state.
4. Blockers and questions for knispo, numbered.
5. Traps found (YSK).
6. A fenced copy-paste block for clerk.bot: doc paths, a 3-line summary, the questions.

Update `HANDOFF.md` only by swapping lines, and stay at or under 900.

**Resume:** the next session reads the newest handoff, re-checks each PR in its table once, and continues from "Next". It does not re-read finished plans.

---

## 5. PR rules

- One step per PR. Title: `<type>: rhizome loop step <N> — <short>`.
- Failing tests first. Push a red commit. Paste the red run and the green run in the PR body.
- Draft until CI is green, then mark ready. Agents never merge. knispo merges.
- Push only through the installed pre-push hook. Never `--no-verify`. If the hook refuses, stop and ask knispo (ADR-0181). Until #100 is fixed, check that a worktree push ran the branch's own hook.
- Rebase onto `main` after each merge that touches your files. Use `--force-with-lease` on your own branch only.
- **Stacked PRs** when a step must split, as 2c does. Each PR bases on the one before it, says "stacked on #N" in its body, and rebases when the base merges. Keep the stack 3 deep or less.
- The PR body ends with the completion block from `AGENTS.md`: QA, tests and coverage, Codacy, PostHog, localization (C18), ADRs, docs, demo-vault dirt.
- Co-Authored-By trailer with the real model.

---

## 6. Running without knispo

| An agent may do this alone | Wait for knispo |
|---|---|
| Branch, commit, push through the hook, open draft PRs | Merges |
| Fix CI failures and merge conflicts on its own PRs | Any product call not in D1 to D13, ADR-0182, or ADR-0183 |
| Answer review comments with code, inside the PR's scope | New dependencies (`keyring` is already approved) |
| Mark a PR ready when CI is green | Anything on knispo's Mac outside the repo: rebuilding `/Applications`, installing tools, his real keychain, running the key migration on his real keys |
| Rebase its own branches | Closing issues (propose it in the handoff instead) |
| Write handoffs and docs in its lane | A threshold or gate change (coverage) |
| Run `pnpm live-ui` and Playwright on its own dev server | A force-push to a branch it does not own |

**CI and review pickup:**

- Claude watches **one** PR per session through Auto-fix. Pick the riskiest open lane-C PR. At session start, check the others once with `gh pr view`.
- Cursor agents subscribe to every PR they opened.
- A comment that asks for work outside the PR's scope goes into the handoff as a question. It is not done in the PR.

---

## 7. Review and QA loop

```
author agent → draft PR → CI green → ready
   → (Tier A or B+A) Claude or Codex technical review
   → Ricky code review → author fixes
   → (user-visible) Bubs QA checklist on a real build
   → Nightly: CI, flaky tests, ADR index
   → clerk.bot paste block → knispo merges
```

| Role | Plugs in where | Input it needs from the author |
|---|---|---|
| Claude (A review) | Before Ricky, on Tier A and B+A PRs: #116, 2c-1 to 2c-3, step 4, 6a | The PR body names the risky parts and the tests that cover them |
| Ricky | Every PR after CI is green | Red and green runs, a short "what to look at" list |
| Bubs | Steps 3b, 4, 5a, 5c, the step 6 frontend, #118 usage | A QA checklist in the PR body (clicks, expected results, quit and restart cases). Bubs may use `pnpm live-ui` once #118 merges. |
| Nightly | CI failures that are not the PR's fault, flaky tests, ADR index, #100, coverage gate | A failing check name and the rerun result |
| clerk.bot | After each session | The copy-paste block from the handoff |

---

## 8. Stop and ask

Stop, write the handoff, and ask knispo when:

1. The pre-push hook refuses.
2. CI fails twice for the same cause after a fix.
3. A fix needs a product call that D1 to D13, ADR-0182, or ADR-0183 does not cover.
4. A fix needs a file in another lane beyond a minimal, listed edit.
5. Code would touch real keys or real user data on knispo's Mac.
6. A test would have to be weakened, skipped, or deleted to pass.
7. Coverage falls below a gate.
8. A rebase conflicts in another lane's file.
9. A review comment asks for out-of-scope work.
10. The session passes its context budget.
11. `HANDOFF.md` would go past 900 lines.
12. Something the plan calls settled turns out false in the code. Report it. Do not work around it.

---

## 9. Questions for knispo

1. **2c model.** D7 gives 2c to Cursor. It is Tier A (persistence, recovery, locks, credential filter). Recommended: keep it in lane K on a premium Cursor model, as 3 stacked PRs, with Claude reviewing each one.
2. **Merge order now.** Recommended: #117 (ADR-0183), then #116 (2b), then rebase and merge #115, then #118.
3. **Merge windows.** Recommended: two windows a day. Agents stack PRs between them, so a long run does not stall on one merge.
4. **Credential filter scope (ADR-0183).** Recommended for v1: exact match on every keychain value, known key prefixes (`sk-`, `gsk_`, `nvapi-`, and the catalog providers' formats), `Authorization` headers, and JSON fields named `api_key`, `token`, `secret`, `password`.
5. **Coverage gate.** The gate shows 86%, but production code is about 79%. Recommended: measure production lines only, set the bar at the measured number rounded down, and raise it later. Decide this before 2c, which is Rust-heavy.
6. **Real-key migration on your Mac.** Recommended: you start the app once after step 3 merges and confirm the 3 keys still work. No agent runs the migration on your real keychain.
7. **Native launch QA.** Recommended: step 4 merges only after Bubs passes a checklist on a real `.app` (toggle, send, tool approval, quit mid-turn, relaunch, reopen, continue). The rebuild needs your yes each time.
8. **#48.** Recommended: close it under ADR-0182. The router is in-process, with no gateway.
9. **Thread 1.** Recommended: record Phase 3 as skipped after #116 merges, because persona is composed in the command layer.
10. **#45 after step 3.** Recommended: a follow-up in lane U for connection status and a curated native list. Step 3 covers keys only.
11. **#39 timing.** Recommended: a design note after step 4, then one read-only graph query tool in the native loop.
12. **Cross-lane edit in #116.** #116 edits `rhizome_routing/mod.rs`. Recommended: allow it, and Claude reviews that part in item 2 of its queue.

---

## Verification

- Every PR and issue number in §1 was read with `gh` on 2026-10-10.
- This file is uncommitted, for knispo to review.
