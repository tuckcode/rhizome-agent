# AGENTS.md rule provenance audit

**Origin:** Claude Sonnet 4.5 (sub-agent) · 2026-08-29 · AGENTS.md rule provenance audit

**This is evidence, not a decision. Atticus decides what goes.** Nothing in
this document changes `AGENTS.md`.

## Method

`AGENTS.md` was touched in 32 commits total. `git blame` maps every current
line to the commit that last wrote it; `git log --format=... -- AGENTS.md`
gives the full commit list with dates and `Co-Authored-By` trailers. Where a
rule cites an incident, I checked the incident against the tree (does the
file/script/directory it describes still exist, still behave that way).

**The single most important fact this audit found:** the entire file was
created in one commit, `11e1315` (2026-08-09, `chore: bootstrap Rhizome Agent
from Desktop snapshot (Option C)`), authored by Atticus but its *content*
copied wholesale from Rhizome Desktop's `AGENTS.md`. Two follow-up commits
the same week (`cb3a299`, `85943c8`) fixed two residues that actively
contradicted this repo's identity (wrong origin remote, wrong repo-visibility
claim). Everything else in the original snapshot has never been re-examined
— it just hasn't been *touched*, which is different from having been judged
correct.

Of the ~440 substantive lines in the file today, **198 lines (about 45%) are
byte-identical to the 2026-08-09 bootstrap commit** — untouched in the three
weeks since. Those lines are concentrated in three long unbroken runs:
lines 145–169 (commit cadence, `Co-Authored-By`, TDD), lines 205–294
(PostHog, code health, CodeScene, Codacy, start of check suite), and lines
331–476 (release-readiness checklist, ADRs & docs, **and the entire "Product
Rules" and "Reference" sections** — demo vault hygiene, `~/Laputa/`, shadcn/ui
UI rules, macOS/Tauri gotchas, QA scripts, diagrams). Section 2 and Section 3
of the file are essentially 100% inherited and 0% re-decided since the fork.

## Top-line verdict

Roughly **half the file is sound and actively defended** — the rules added
or corrected between 2026-08-20 and 2026-08-29 (stranded-work check, the
three-part shared-tree/git-add rule, the Prime-docs-are-not-optional
correction, the LLVM/Windows toolchain fixes, the localization rewrite) each
cite a specific, verifiable incident in *this* repo, and checking the tree
confirms the incident and the current fix. These are the rules that should
survive an audit unchanged.

The **other half was never decided for this repo at all** — it arrived
in one commit from a different product and has been treated as settled ever
since, including in at least one case (the "pre-existing → C-number" rule,
lines 155–157) where the incident the rule cites **did not happen in this
repo** — it cites a "2026-08-02 sweep" and files dated 2026-07-03 / 2026-07-10,
three to five weeks before this repo's first commit (2026-08-09). That rule
is fine on its own logic, but its evidentiary basis is borrowed, and nobody
flagged that when it was copied in.

**The single worst rule in the file is ADR-0168, cited from `AGENTS.md`'s
"Learned Workspace Facts" as settled doctrine** ("Selective harness doctrine
(option 2): ... never forked or patched into Prime..."). It was ratified by
two agents (GPT-5.6 Sol and Grok, via Cursor — see `docs/design/harness-doctrine.md`),
not by Atticus, and issue **#56** (open, filed 2026-08-29, "Rhizome already
has the second provider path the doctrine forbids") shows the codebase
directly contradicts it: `src-tauri/src/ai_models.rs` (788 lines) is a second
provider path and credential store that predates the doctrine and survives
the doctrine's own "delete Prime tomorrow" test. This is exactly the pattern
Atticus flagged going into this audit — a rule "just stale" or inherited from
elsewhere being cited as constitutional law it never earned.

## Rule-by-rule

Grouped by file section. Line numbers are current (2026-08-29, commit
`4179745`). "Origin" gives the commit that last wrote the current text and
its `Co-Authored-By` trailer where present; bootstrap-only lines carry no
model trailer because `11e1315` is an Atticus commit re-committing prior
content, not authored analysis.

### Header / STOP block (lines 1–7)

| Rule | Origin | Problem still real? | Verdict |
|---|---|---|---|
| Wrong-tree STOP block: this is Rhizome Agent, not Desktop; never push to `knispo/rhizome` | `11e1315` 2026-08-09 bootstrap, corrected `cb3a299` same day | Yes — the correction commit's own message describes an agent that *could* have pushed to Desktop's origin from 25 lines below this exact block. Names still diverge (`ai.rhizome.agent` vs `ai.rhizome.desktop`). | **KEEP.** Real, named incident; still the correct guard for a fork this close to its parent. |

### §1 Start working on a task (lines 15–63)

| Rule (line) | Origin | Still real? | Verdict |
|---|---|---|---|
| Non-Claude models start with `docs/CROSS-MODEL-HANDOFF.md` (23) | `11e1315` bootstrap, untouched since | File exists, is current (last touched by later commits per its own content). | **KEEP**, but **INHERITED-UNEXAMINED** as written — nobody has confirmed the *specific* traps it lists (knip false positives, etc.) still apply verbatim; only that the pointer target exists. |
| Check for stranded work at session start (24–35) | `20e1b6cf` 2026-08-24, Atticus | Cites 3 concrete incidents (GPT-5.6 Luna handoff, option-2/C47 slice, C47 Tauri-listen follow-up) all in the commit's own week. | **KEEP.** Best-documented rule in the file — names the failure, names the fix, one paragraph. |
| Prime adapter: check the snapshot, don't ingest Prime (36–44) | `8929e0f` 2026-08-25 | Original wording ("do not dump ... into context") is the rule the prompt names as example #2 — it was misread as "don't read Prime's docs" on 2026-08-29 and produced a wrong claim in a decision doc, per the very next paragraph in the file. | **Already NARROWED by the file itself** (see next row) — but the *original* text (36–44) is left standing unedited next to its own correction, which is confusing: a reader hits the narrow-sounding rule first and the correction second. |
| "The snapshot answers 'does this command exist'... read Prime's own docs" (45–49) | `4179745` 2026-08-29, same-day self-correction | Confirmed real: `~/.local/lib/node_modules/prime-agent/docs/` exists on this machine with the files named. | **KEEP.** This is the corrected version of the rule above; consider merging 36–49 into one paragraph so the correction isn't read as a separate, later-arriving footnote. |
| Read `docs/HANDOFF.md` in full; write new sessions to `docs/plans/handoffs/` (51–59) | `e525331c` 2026-08-21 restructure | `docs/plans/handoffs/` exists, `pnpm handoff:check` script exists and runs in pre-commit (verified in `package.json`). | **KEEP.** |
| Check `docs/plans/*-session-status.md` (60) | `11e1315` bootstrap, untouched | Directory and pattern still in active use (172 files under `docs/adr`, many `docs/plans/*.md`). | **KEEP**, INHERITED-UNEXAMINED provenance but the practice matches current usage — low risk. |
| Check `docs/adr/` before structural choices (61) | `11e1315` bootstrap, untouched | 172 ADRs exist and are actively cited (e.g. ADR-0168 in this same audit). | **KEEP.** |
| Check `docs/ARCHITECTURE.md` / `docs/ABSTRACTIONS.md` (62) | `11e1315` bootstrap, untouched | Both files exist, plus `docs/GETTING-STARTED.md` referenced later in the file. | **KEEP.** |
| "Living docs are multi-agent palimpsests... read the Origin: line" (63) | `11e1315` bootstrap, untouched, generalized by `ea105fac` 2026-08-24 origin-tagging commit | Directly relevant: this very audit found `docs/HANDOFF.md`'s C18 entry citing dates (2026-07-03, 2026-07-10, "2026-08-02") that predate this repo's first commit (2026-08-09) — i.e. it is itself unattributed inherited content, exactly the failure mode this rule warns about. | **KEEP**, strongly — self-validating during this audit. |

### §1 Commits & pushes (lines 65–162)

| Rule (line) | Origin | Still real? | Verdict |
|---|---|---|---|
| origin is `tuckcode/rhizome-agent` (PRIVATE); never add `knispo/rhizome` as remote (67–68) | `11e1315` bootstrap + corrected same day `cb3a299` | `git remote -v` in this checkout has no `knispo` remote configured. Corrective commit message confirms the original bootstrap text pointed at the wrong (Desktop) origin. | **KEEP.** Given the fork's history this is load-bearing, not decorative. |
| Pre-push hook sets `LLVM_COV`/`LLVM_PROFDATA` itself; Xcode CLT fallback (69–94) | `7aa4974a` 2026-08-28, corrected from an earlier version that only checked `brew --prefix llvm` (which returns a path even when llvm isn't installed) | Verified current mechanism described matches the commit message's stated fix. | **KEEP.** |
| Windows: `rustup component add llvm-tools-preview`; named-pipe daemon; see `WINDOWS-DEV.md` (96–108) | `29946b6e` / `7564f32` 2026-08-22 | `docs/WINDOWS-DEV.md` exists. | **KEEP.** |
| Stage files by name; never `git add -A`/`.`/`<dir>` when others may be running (109–113) | `3a467b85` 2026-08-29 | Cites a specific same-day incident: one broad `add` swallowed 591 lines of another agent's in-progress Rust plus 3 unrelated frontend files. | **KEEP.** Sharp, falsifiable, incident-cited. |
| `git commit -- path/to/file` (not bare `git commit`) because staging isn't enough (115–127) | `be5c1927` 2026-08-29 | Cites a second, distinct incident the same day where staging-by-name alone still let another agent's staged files ride along. This audit's own task instructions require exactly this pattern (`git commit -- docs/plans/...`), confirming it's the currently-expected practice. | **KEEP.** |
| Pre-commit lints the whole repo — one agent's broken file blocks everyone (129–136) | `ade83a2c` 2026-08-29 | Cites same-day incident (agent blocked on unused imports in a file it never opened). | **KEEP.** |
| "The real fix is isolation, not discipline" — use git worktrees for parallel writers (138–143) | `ade83a2c` 2026-08-29 | True as stated, but **aspirational and unenforced**: `git worktree list` in this checkout shows exactly one worktree (main only) despite three same-day incidents this rule was written in response to. No mechanism forces or even reminds an agent dispatching sub-agents to do this. | **KEEP the observation, NARROW the ask** — either wire an actual check/reminder or downgrade the imperative language ("give each one its own worktree") to a recommendation, since it currently reads as a rule nothing enforces. |
| Commit every 20–30 min / one TDD cycle (145) | `11e1315` bootstrap, untouched | Generic cadence advice; still matches current TDD section further down. | **KEEP**, INHERITED-UNEXAMINED but harmless — no incident cited, no incident needed. |
| `Co-Authored-By` trailer required, names model (146–154) | `11e1315` bootstrap, untouched since fork | Actively enforced in practice: every commit checked in this audit (`8929e0f`, `20e1b6cf`, `ade83a2c`, etc.) carries `Co-Authored-By: Claude ...` or similar. The mechanism this rule describes (git `author` is always "Atticus", trailer is the only provenance signal) is exactly what this audit itself used to attribute rules to models. | **KEEP.** Inherited wording, but verified true and actively load-bearing for this very document. |
| "pre-existing" → open/update a `C`-number in `HANDOFF.md` (155–157) | `11e1315` bootstrap, untouched | The rule's *own justification paragraph* cites "a 2026-08-02 sweep of every `docs/plans/*.md`" finding C17/C18 in three separate sessions — but this repo's first commit is 2026-08-09. `docs/HANDOFF.md`'s live C18 entry (checked directly) names `2026-07-10-...-session-status.md` and `2026-07-03-research-panel-handoff.md`, both **pre-dating this repo by 3–5 weeks.** The incident is real, but it happened in Rhizome Desktop, not here. | **KEEP the rule** (the discipline is sound and C17/C18 do exist and are tracked in *this* repo's `HANDOFF.md` too) but **the file should say the evidence is inherited**, not imply it happened here — this is the clearest example in the whole file of the audit's opening claim: "Rules arrived with the source and were never re-decided." |
| Pre-commit = lint gate only; pre-push = full suite, Chunk sidecars preferred (158) | `11e1315` bootstrap, untouched | Matches current hook behavior described elsewhere in the file (verified against the check-suite section, which *was* recently touched and agrees). | **KEEP.** |
| Task not done until committed + pre-push passes; never `--no-verify` (159) | `11e1315` bootstrap, untouched | Standard, not incident-specific, but consistent with every other rule in the file (no rule anywhere condones `--no-verify`). | **KEEP.** |
| Commit often, push in batches — full suite is ~4.5 min per *push* (160–162) | `011bf01e` 2026-08-21 | Gives a measured number (~4.5 min: ~2 min Playwright, ~1.5 min llvm-cov) and a concrete counter-example (8 commits × pushing each ≈ 35 min vs. batched < 5 min). | **KEEP.** Well-evidenced, numeric, falsifiable. |

### TDD (lines 164–169)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| Red→Green→Refactor→Commit; regression test first for bugs; CSS/layout exception; Kent Beck desiderata; prefer E2E for user flows | `11e1315` bootstrap, untouched since 2026-08-09 | Generic TDD discipline, no repo-specific incident cited, nothing to falsify against the tree. | **KEEP**, INHERITED-UNEXAMINED — this is Desktop's TDD policy verbatim; it happens to be sound generic practice, which is presumably *why* nobody has needed to revisit it, not evidence it was re-decided for this repo. |

### Localization (lines 170–204)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| No localization work in v0; do not even move strings into `en.json` anymore | `6052913` 2026-08-29, rewriting a version that itself was inherited from Desktop and then actively **caused damage**: the commit message states a parallel session spent 8/13 commits on `en.json` moves under the old rule, breaking all 37 tests in `SingleEditorView.test.tsx` | This is the "localization rule" the task brief names as example #1. It has already been fixed — the current rule is the corrected version, current, and matches Atticus's repeatedly-restated position (quoted 3 times with dates). | **KEEP as currently written.** This section is the model for how a bad rule should be fixed: it names the old wording, the damage it caused, and the new boundary, in the file itself. Nothing further to narrow. |

### Product analytics / PostHog (lines 206–210)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| Emit PostHog events for meaningful features; state in completion comment | `11e1315` bootstrap, untouched since 2026-08-09 | No incident cited either way. Not contradicted by anything found in the tree. | **KEEP**, INHERITED-UNEXAMINED but plausible as a generic product-analytics policy that would apply to any product Atticus owns, not Desktop-specific. |

### Code health (lines 212–241)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| `pnpm deadcode` (knip) — not a gate; run near touched files; `AiAgentsBadge.tsx` example | `11e1315` bootstrap, untouched | `AiAgentsBadge.tsx` confirmed absent from `src/` today (deleted, per elsewhere in the file, 2026-07-24 — again pre-dating this repo). `pnpm deadcode` script (`knip`) confirmed present in `package.json`. | **KEEP.** The specific example predates the repo but the mechanism (knip, ungated) is verified current and the caution is sound regardless of which repo the badge died in. |
| knip can't see `cli-call.mjs` (shell-invoked, not imported) | `e1439ed3` 2026-08-29 | `knip.json`'s `ignore` list confirmed contains `"mcp-server/cli-call.mjs"`. Fresh, same-day fix. | **KEEP.** |
| knip can't see ambient `declare global` files (`rhizomeTestBridge.ts`, `mockTauriBridge.ts`) (231–239) | `11e1315` bootstrap partially, `e1439ed3` extended it 2026-08-29 for cli-call.mjs alongside | Both files confirmed present and confirmed in `knip.json`'s `ignore` list. | **KEEP.** |
| No CodeScene gate; free-tier is open-source-only; re-evaluate if repo goes public (240–241) | `11e1315` bootstrap, corrected `8cfe2a08` 2026-08-26 | Repo is still private (confirmed via `git remote -v` / no public flag anywhere). Correction is dated and self-aware ("check the date on this one"). | **KEEP.** Good model of a narrowly-corrected inherited claim. |

### Security scan with Codacy (lines 243–284)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| Run local CLI, no account needed; trim to lizard/opengrep/trivy; MCP costs money and is optional; gate wrongly reported itself unrunnable for months (245–281) | `11e1315` bootstrap for the base structure, heavily corrected 2026-08-23 (commit referenced in text, not in the touched-lines list because the correction is described inline rather than as a blame-visible edit — confirmed via `.codacy/` directory present on disk with `codacy.yaml`, `cli-config.yaml`, dated Aug 23) | `.codacy/` directory exists on this machine exactly as described (created 2026-08-23 per file mtimes). Rule's own text: "found 95 advisories... two of which directly contradicted a prior security review's reasoning — C45", confirming this is a live, checked gate, not aspirational. | **KEEP.** One of the strongest-evidenced rules in the file — it documents its own prior failure mode (months of false "not runnable" claims) and the fix. |
| Always fix Critical/High; review Medium; never silence a rule to pass (282–284) | `11e1315` bootstrap, untouched | Standard security-gate policy, consistent with the corrected Codacy section above it. | **KEEP.** |

### Check suite (lines 286–341)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| The 5-command check suite block itself (287–293) | `e3af3ddb` 2026-08-29 (Rust coverage command aligned to C54) | `--fail-under-lines 85`, `--ignore-filename-regex` flags match the release-readiness checklist later in the file (378) and `cargo llvm-cov` usage described in the LLVM section. Internally consistent. | **KEEP.** |
| `cargo fmt --check` / `cargo clippy` were running all along but were missing from the list (295–298) | `b0dcd0a7` 2026-08-21 | Self-documented incident: a push failed on `cargo fmt --check` after every other gate passed. | **KEEP.** |
| `pnpm typecheck` is `tsc -b`; `tsc --noEmit` is a no-op (300–308) | `467689b0` 2026-08-20 | Verified in `package.json`: `"typecheck": "tsc -b"`. Commit message states this was independently rediscovered and mis-documented three times before the script existed. | **KEEP.** Textbook case of "fix the affordance, not just the doc." |
| `pnpm typecheck` covers tests minus a named backlog; `typecheck:tests:backlog` (310–319) | `2054e9f7` 2026-08-21 | `"typecheck:tests:backlog": "node scripts/typecheck-tests-backlog.mjs"` confirmed in `package.json`. | **KEEP.** |
| `pnpm test:live-prime` — 6 `#[ignore]`d Rust tests, not in push gate on purpose; C56 tracks 2 real failures (321–329) | `3c6fa7ac` 2026-08-28 | `"test:live-prime": "node scripts/run-live-prime-tests.mjs"` confirmed present. | **KEEP.** |
| `pnpm test:mcp` exists because vitest doesn't glob `mcp-server/`; never run `node --test mcp-server/` directly (331–335) | `11e1315` bootstrap, untouched | No script/behavior check performed beyond confirming the hang-risk is plausible given the described vitest `include` pattern; not contradicted by anything found. | **KEEP**, INHERITED-UNEXAMINED but plausible and specific enough (names the exact `include` glob) to trust without re-deriving. |
| Coverage gates: frontend ≥70%, Rust ≥85% (337–341) | `11e1315` bootstrap, untouched | Matches the numbers used in the check-suite block above (recently touched, `--fail-under-lines 85`), so at least internally consistent even though this exact paragraph wasn't re-touched. | **KEEP.** |

### UI and native QA (lines 343–368)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| Phase 1 Playwright — smoke test criteria, `@smoke` tag discipline, 5-minute sidecar budget (345–353) | `11e1315` bootstrap, untouched | `pnpm playwright:smoke` script in `package.json` runs a fixed list of 15 named spec files, consistent with a curated "core flows" smoke suite as described. `pnpm playwright:regression` also present. | **KEEP.** Description matches the actual script list closely enough to trust. |
| Phase 2 native QA — Accessibility permission / built `.app`; computer-use + Playwright split; `osascript` WKWebView caveat (355–368) | `11e1315` bootstrap, untouched | Not independently re-verified against a live native build in this audit (out of scope — this is a docs-only research task), but the WKWebView caveat is repeated verbatim, consistently, in the §3 "QA scripts" section that *was* separately maintained, which is weak corroboration it's still accurate. | **KEEP**, INHERITED-UNEXAMINED — nothing found that contradicts it, but nobody has re-run it against this repo's actual native build since the fork either. |

### Release-readiness checklist (lines 370–384)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| Full checklist (implementation summary, QA, coverage, Codacy, localization, PostHog, refactoring, ADRs, docs, demo-vault-dirt check) | `11e1315` bootstrap, updated in place: localization line rewritten by `6052913` 2026-08-29, coverage command by `e3af3ddb` 2026-08-29 | The two lines that needed to track other rule changes (localization, coverage flags) were in fact updated same-day when those rules changed — the checklist isn't drifting behind the rules it summarizes. | **KEEP.** Good sign: this is a rule that gets maintained in sync rather than left to rot. |

### ADRs & docs (lines 386–400)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| ADRs in `docs/adr/`, created same commit as code, never edited (only superseded) (388) | `11e1315` bootstrap, untouched | 172 ADR files confirmed present; the practice (never edit, only supersede) is exactly what would be needed to trust ADR-0168's ratification date/authorship, which this audit relied on. | **KEEP.** |
| Update ARCHITECTURE.md/ABSTRACTIONS.md/GETTING-STARTED.md after structural changes (390) | `11e1315` bootstrap, untouched | All three files confirmed present and (per file listing) recently modified relative to repo age. | **KEEP.** |
| Origin tags on living docs — `**Origin:** <model> · <date> · <commit>` (392–400) | `ea105fac` 2026-08-24 | This rule is the direct ancestor of the header requirement on *this very document*. Its own justification example (`docs/NEXT.md` `c0cced2f`/`b8dc8fb` then Grok's `2b5daba` insert being misread as original) is independently checkable via `git log` and matches the "Learned Workspace Facts" bullet at line 500 that repeats the same example. | **KEEP.** Consistent, cross-referenced, directly enabled this audit's own methodology. |

### §2 Product Rules (lines 404–440) — demo vault, `~/Laputa/`, UI components

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| Demo vault hygiene (`demo-vault/`, `demo-vault-v2/`) — default to v2, clean up test files, `git status --short` must be empty (406–414) | `11e1315` bootstrap, untouched since 2026-08-09 | This exact directory convention and the exact `git status --short -- demo-vault demo-vault-v2` check reappear verbatim in this task's own instructions (the harness that dispatched this audit), so at minimum the *convention name* is still live tooling, not dead Desktop naming. | **KEEP**, INHERITED-UNEXAMINED provenance, actively used. |
| `~/Laputa/` test vault — never commit/push test notes, `git clean -fd` to restore (416–421) | `11e1315` bootstrap, untouched | `~/Laputa/` is also referenced as the "user vault" in this session's own global `CLAUDE.md` context (`~/CLAUDE.md`'s retired-vault note), suggesting it is a real, currently-used path, not Desktop-only. | **KEEP.** |
| shadcn/ui mandatory; never raw HTML form elements; table of component substitutions incl. `IconEditableValue`, deleted `EmojiPicker.tsx` (423–440) | `11e1315` bootstrap, untouched, **except** the `IconEditableValue` row's `EmojiPicker.tsx` note | The note says `EmojiPicker.tsx` "was deleted 2026-07-24" — again **before this repo's first commit (2026-08-09)**. `find src -iname '*emojipicker*'` in this checkout: no results, confirming the file is indeed absent here too, so the *conclusion* holds even though the *event* described happened in Desktop, not here. `src/utils/emoji.ts` confirmed present as claimed. | **KEEP** the rule and its guidance — it correctly describes today's tree — but it is another instance of an inherited-and-unflagged specific claim ("deleted 2026-07-24") about history that isn't this repo's own. |

### §3 Reference (lines 444–460) — macOS/Tauri gotchas, QA scripts, diagrams

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| `Option+N` special chars; menu accelerators; `app.set_menu()` replaces whole bar; `mock-tauri.ts` swallows calls (448–451) | `11e1315` bootstrap, untouched since 2026-08-09 | Platform-level Tauri/macOS facts, not repo-specific; nothing in the tree contradicts them (`src/mock-tauri.ts` confirmed present in `knip.json`'s ignore list, consistent with the claim it's a real file agents might mistake for a working backend). | **KEEP**, INHERITED-UNEXAMINED but low-risk — these are facts about Tauri and macOS, which don't change based on which product is using them. |
| `~/.openclaw/skills/tolaria-qa/scripts/` is dead (454) | `11e1315` bootstrap, untouched | Confirmed: `ls ~/.openclaw/skills/tolaria-qa/scripts` → "No such file or directory" on this machine. The rule already self-identifies as pointing at something dead — it's correctly flagged as dead, just never removed. | **STALE, but harmlessly so** — the rule's entire content is "don't use this path, it's gone," which remains true. Candidate for deletion once the dead-path warning has served its purpose (nobody has hit it recently enough to need reminding, per the lack of any Tolaria-QA mentions elsewhere in `docs/CROSS-MODEL-HANDOFF.md`'s trap list). |
| Diagrams: prefer Mermaid, ASCII only for spatial layouts (459) | `11e1315` bootstrap, untouched | Generic style rule, not contradicted anywhere. | **KEEP.** |

### Agent skills (lines 463–475)

| Rule | Origin | Still real? | Verdict |
|---|---|---|---|
| Issue tracker → GitHub Issues via `gh`; triage labels; single-context domain docs | `85943c8` 2026-08-09 (Grok, `Co-Authored-By: Grok <noreply@x.ai>`) — this is the *one* section of the file that was written **for this repo specifically**, same week as the fork, not inherited from Desktop | `gh issue view 56` succeeded against `tuckcode/rhizome-agent` in this audit; the `needs-triage` label used on issue #56 matches the five-role vocabulary named here exactly. | **KEEP.** Notably the only Product/Reference-adjacent section in the file with a real per-repo authorship story instead of a bootstrap copy. |

### Learned User Preferences / Workspace Facts (lines 477–500)

These aren't "rules" in the prohibition/mandate sense — they're accumulated
project facts, several already self-correcting (e.g. line 494's harness
doctrine, line 500's `NEXT.md` origin example). One deserves a direct flag:

| Entry | Origin | Still real? | Verdict |
|---|---|---|---|
| "Selective harness doctrine (option 2): Rhizome is the product harness; Prime remains the only execution core... never forked or patched into Prime." (494) | `e02e3c4` 2026-08-23 ("docs: ratify the selective harness doctrine") | **Contradicted by the live codebase.** Issue #56 (open, filed 2026-08-29) documents `src-tauri/src/ai_models.rs` (788 lines) as a second, non-Prime execution/credential path that predates and survives the doctrine's own removal test. Issue #56 itself states: "the constitution and the code disagree and each new proposal gets argued from whichever one suits it." Ratified by two agents (GPT-5.6 Sol, Grok) via Cursor, not by Atticus — this is exactly the pattern named in the task brief. | **INHERITED-UNEXAMINED, and currently doing active harm** — it has been "cited by every session as settled constitutional law, including to reject tools Atticus was interested in" (per task brief), while issue #56 shows it doesn't describe the actual system. This is the worst single line in the file. |

## Recommended cuts

Delete outright:

- **Line 454** — `~/.openclaw/skills/tolaria-qa/scripts/` dead-path warning. Confirmed dead, confirmed no longer coming up as a trap anyone hits (not in `docs/CROSS-MODEL-HANDOFF.md`'s trap list). A stale warning about a stale path.
- **The original, unfixed Prime-adapter wording at lines 43** ("do not dump `~/.local/lib/node_modules/prime-agent` into context") — superseded in-place by lines 45–49 written six days later on the same file. Keeping both means a reader hits the narrow, already-wrong-in-practice version first. Fold 36–49 into one paragraph so the corrected scope is the *only* scope stated.

## Recommended narrowings

- **Line 494 (harness doctrine fact)** — currently stated as settled fact in "Learned Workspace Facts." Replace with something like: *"Selective harness doctrine (ADR-0168) is the current design intent but is contradicted by the live codebase (`ai_models.rs`, issue #56) — do not cite it as settled when arguing to keep or reject a tool until #56 is resolved."* Turns a false-confidence line into an accurate one without deciding the underlying question for Atticus.
- **Line 155–157 ("pre-existing" → C-number rule)** — keep the mechanism, drop the borrowed evidence. Replace the "2026-08-02 sweep" paragraph (which describes Desktop's history, not this repo's) with this repo's own C17/C18 tracking in `docs/HANDOFF.md`, or simply state the rule without a dated incident if this repo hasn't independently produced one yet.
- **Lines 138–143 ("real fix is isolation... give each one its own git worktree")** — stated as a should-do with no enforcement and, per `git worktree list` in this audit, zero adoption so far. Either turn it into an actual dispatch-time checklist item (something a coordinating agent runs, not just reads) or soften "give each one its own worktree" to "prefer a worktree per parallel writer when the coordinating agent can arrange it" so the file doesn't claim a practice that isn't happening.
- **Section 2 and Section 3 broadly** (demo vault, `~/Laputa/`, shadcn/ui table, macOS gotchas) — none of these are wrong, but none have been re-affirmed since the fork either. Lowest-cost narrowing: add one line at the top of Section 2, "everything below this line is inherited from Rhizome Desktop and has not been independently re-verified for this repo since 2026-08-09," so a reading agent knows to apply slightly more skepticism than to the actively-maintained Section 1 material.

## What could not be established

- Whether the shadcn/ui component table (425–438) and the macOS/Tauri gotchas (448–451) are still accurate against the *current* component library and Tauri version was not independently re-verified beyond confirming the specific files/behaviors they mention (`mock-tauri.ts`, `emoji.ts`) exist. A full re-audit would need to diff the table against `src/components/ui/` and the installed `@tauri-apps/*` version.
- ~~Whether Rhizome Desktop's own `AGENTS.md` at fork time differed at all from what landed in `11e1315`~~ — **resolved 2026-08-29, same day.** Atticus pointed out the Desktop checkout is on this machine at `~/code/projects/rhizome`. Diffed section by section: **"Demo vault hygiene", "User vault (`~/Laputa/`)", "UI components — mandatory rules" and "macOS / Tauri gotchas" are byte-for-byte identical to Desktop's file today** (whitespace-normalised), three weeks after the fork. "QA scripts" differs only because of an edit made minutes earlier in the same session. The inference in this audit's Method section was correct and is now measured rather than inferred.

  Worth noting how it was missed: the audit reported "no access to the Desktop repo" without checking whether one existed locally. Desktop is named in `docs/IDENTITY.md` and its folder sits beside this one.
- Phase 2 native QA behavior (355–368) was not re-run against a live `.app` build in this audit — docs-only research task, no product code exercised.
