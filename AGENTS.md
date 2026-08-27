# AGENTS.md — Rhizome Agent

> **STOP — wrong tree check.**  
> This is **Rhizome Agent** (`ai.rhizome.agent`, repo `tuckcode/rhizome-agent`).  
> It is **not** Rhizome Desktop (`ai.rhizome.desktop`, `knispo/rhizome`).  
> Do not push here to desktop origin. Do not “fix branding back to Desktop.”  
> Direction: chat UI + **Prime Agent** harness. Details: `docs/IDENTITY.md`.

---

# AGENTS.md — (imported Desktop rules; apply only where still relevant)

## 1. Development Process

### Start working on a task

> **Scope.** These rules govern this repo. They are *in addition to* the
> session-start chain in `~/CLAUDE.md`, not instead of it — reading
> `HANDOFF.md` does not replace writing the Obsidian vault session log, and
> vice versa. Where a rule below says "first," it means first *within this
> repo's docs*.

- **If you are not Claude (e.g. Nous Portal, Hermes Agent, or any non-Anthropic model), start with `docs/CROSS-MODEL-HANDOFF.md`** — a short, verified list of traps a prior session already hit in this repo (knip false positives, a release-pipeline contradiction, native-vs-browser QA gaps, naming residues that look fixable but aren't). It exists specifically so the same mistakes aren't repeated by a different model.
- **Check for stranded work before reading the docs.** Run both:

  ```bash
  git status --short
  git log --oneline origin/main..HEAD
  ```

  A previous session may have left work uncommitted or unpushed. That work is invisible to anyone starting from origin, and `HANDOFF.md` will describe a world that is already stale relative to the working tree.

  Uncommitted files are not "someone else's mess" — they are the last session's unfinished commit. Unpushed commits are not "already done" — another clone will not see them. If either is present, finish that first (commit, push, or surface it in your handoff) before starting new work. Demo-vault dirt is the exception already covered below; everything else counts.

  **Why:** this has now bitten three times in about a day. GPT-5.6 Luna's handoff sat uncommitted across a session boundary and was recovered only because a later session happened to run `git status` before wrapping up. The option-2 harness-composition slice plus Grok's C47 work then sat local-only while origin was still at the doctrine commit. The third was the C47 follow-up that skipped Tauri `listen` outside the native app — it was sitting uncommitted in the working tree, and without it `git push` failed the frontend coverage lane and a Playwright smoke on `transformCallback`. This file already warns agents about *creating* unpushed work and checks `git status` only for demo-vault dirt. Nothing told a fresh agent to look for work stranded by a previous session.
- **Prime adapter work: check the snapshot, do not ingest Prime.** `docs/prime-adapter-surface.json` is the last mechanical read of `DAEMON_COMMAND_TYPES` vs the `"type"` strings we send. Before changing the host:

  ```bash
  pnpm prime:surface            # installed package vs snapshot
  pnpm prime:surface:github     # GitHub latest release tag vs snapshot
  ```

  If it drifts, `--update` after you have understood the diff. Do **not** clone `PrimeIntellect-ai/prime-agent`, and do **not** dump `~/.local/lib/node_modules/prime-agent` into context — the snapshot is the list. User-facing "a newer Prime is out" is already `check_prime_update` / `usePrimeUpdate`; this is the adapter check.

- Read `docs/HANDOFF.md` — current state and an index, ~500 lines, meant to be read in full. It holds no session records: those are one file each in `docs/plans/handoffs/`, newest by filename.

  ```bash
  ls docs/plans/handoffs | grep -v archive | tail -1   # the latest handoff
  ```

  Open that one, and any older one whose `description:` frontmatter sounds relevant — that field exists so you can skip the rest. **Write your own session as a new file there** (`YYYY-MM-DD-HHMM-<model>-<topic>.md`, frontmatter with `session`, `model`, `description`), and update `HANDOFF.md` in place rather than pasting into it. `pnpm handoff:check` enforces the shape and runs in pre-commit.

  Restructured 2026-08-21: the file had reached 2156 lines of stacked sessions, and because each session inserted next to whichever heading it was reading, the newest handoff had drifted to third place — "read the latest handoff" pointed at the wrong one. Read it directly; the wiki's search-first rule does not apply to repo docs.
- Check `docs/plans/` for the most recent `*-session-status.md` (sort by date in the filename) — dated detail log behind the handoff summary: what's done, what's blocked, and where to pick up
- Check `docs/adr/` for relevant architecture decisions before structural choices
- Check `docs/ARCHITECTURE.md` and `docs/ABSTRACTIONS.md` for relevant structural information
- Living docs here are multi-agent palimpsests. A heading is not one session's voice. Read the **Origin:** line on the file or section before treating it as "what Claude decided" or "the original plan." "Claude" is also ambiguous in this repo — Claude Code on a subscription, Cursor Claude, and a pasted claude.ai briefing are different sessions. Name the surface, not just the brand. Convention: **ADRs & docs** below.

### Commits & pushes

- origin = `https://github.com/tuckcode/rhizome-agent.git` (**PRIVATE**). Commit locally, push to origin main when pre-push gates pass.
  **⛔ Never add `knispo/rhizome` as a remote in this repo.** That is Rhizome Desktop — a different product with a different bundle id and its own history. See the STOP block at the top of this file and `docs/IDENTITY.md`. (This line said `knispo/rhizome` until 2026-08-09; it was inherited verbatim from the Desktop rules during the fork and directly contradicted both.)
- **The pre-push hook now sets `LLVM_COV` / `LLVM_PROFDATA` itself** on macOS
  (`ensure_llvm_coverage_tooling`), so exporting them by hand is no longer
  required. It only fills them in when they are unset, so an explicit export
  still wins.

  This used to be a manual ritual before every push:
  ```
  export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov"
  export LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
  ```
  Forgetting it failed the Rust lane *after* every other gate had passed,
  costing a full re-run — which is what prompted moving it into the hook on
  2026-08-22. Agents in particular could not win here: shell state does not
  persist between tool calls, so the export had to be repeated in the same
  command as every single push.
  See `docs/CROSS-MODEL-HANDOFF.md` §13 for the full sequence and `cargo llvm-cov` flags.

  **On Windows** those two exports are wrong — there is no `brew`. Install the
  toolchain through rustup instead, once per machine:
  ```
  rustup component add llvm-tools-preview
  ```
  `cargo llvm-cov` finds them itself after that, and no environment variables
  are needed. The hook has no platform branch, so this is the first thing a
  Windows push trips on.

  **On Windows, Prime speaks a named pipe** (`\\.\pipe\prime-agent-daemon`). Setup
  and troubleshooting: **`docs/WINDOWS-DEV.md`**. Chat/sessions/goals need a
  live `prime-agent` daemon on that machine. Everything else works, and
  `pnpm dev` against `mock-tauri` drives the session list without a daemon.
- Commit at natural checkpoints — one TDD cycle (below) for code, otherwise every 20–30 min: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **Every agent must sign its commits with a `Co-Authored-By` trailer** naming the model that actually wrote the change:
  ```
  Co-Authored-By: <Model Name> <noreply@example.com>
  ```
  e.g. `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`, `Co-Authored-By: Hermes <noreply@nousresearch.com>`. Human-authored commits need no trailer.

  **Why:** git's `author` field is `Atticus` on every commit in this repo regardless of who or what wrote it, so it carries no provenance. Without the trailer, the only record of which model did what is `HANDOFF.md`'s prose — written by the agents about themselves. This repo runs several models by design (see `docs/CROSS-MODEL-HANDOFF.md`), and self-reported claims here have a track record of not surviving verification. One trailer turns "who wrote this?" into `git log --pretty='%h %s %(trailers:key=Co-Authored-By,valueonly)'` instead of a document you have to trust.

  Commits before 2026-07-31 are mostly unsigned; the 2026-07-27 session was Hermes and the 2026-07-31 sessions were Claude Opus 5. Don't retro-stamp them — history is pushed or about to be.
- **If you write the words "pre-existing" (or "not introduced by this session" / "unrelated to this change" / "was never..."), open or update a `C`-number in `HANDOFF.md`'s Open threads, in the same commit.** A note buried in a session-status doc is not tracked — it is only findable by a session that happens to reopen that exact file. Don't split the difference with a one-line mention elsewhere in the doc; the C-number entry is the whole fix, because it's the one place a fresh session is guaranteed to look.

  **Why:** a 2026-08-02 sweep of every `docs/plans/*.md` in this repo found the Ask-tab/Library-panel `wiki/`-prefix mismatch logged as "pre-existing, not this session's problem" independently in **three separate sessions** (07-08, 07-10, and again via `ARCHITECTURE.md`), and `pnpm l10n:validate`'s locale gap logged the same way in **three different docs** — each session rediscovering it, none fixing it, none escalating it, because "pre-existing" was treated as a reason to stop looking rather than a reason to make it someone's problem. Tracked now as C17 and C18. Passing gates prove nothing about a bug nobody's gate exercises — the same sweep found `AiAgentsBadge.tsx` sat dead in the tree for months because its own tests imported it directly, so every gate stayed green while it was unreachable from the app. A gate staying green is not evidence of health if nothing routes through the thing it's gating.
- Pre-commit is a lightweight lint gate only. Pre-push runs the full check suite (build + tests + coverage + core Playwright smoke), preferably on three Chunk sidecar lanes for automatic test/coverage work: frontend lint/build/coverage, Rust coverage, and Playwright smoke. The goal is lower wall-clock time than local hooks while keeping each heavy gate isolated; keep local Playwright mainly for authoring, focused reproduction, or sidecar outages.
- **A task is NOT done until it is committed locally and pre-push checks pass locally (`git push --dry-run` style verification, or just running the check suite below manually).** If a hook blocks: read the error, fix it (clippy, tests, build), commit the fix, re-verify. **⛔ NEVER use --no-verify**
- **Commit often, push in batches.** The full suite runs once per *push*, not per commit, and with the Chunk sidecars unavailable it runs serially on the local machine — measured 2026-08-21: **~4.5 minutes**, of which ~2 min is the Playwright smoke lane and ~1.5 min is `cargo llvm-cov`. Pushing after each of eight commits spent ~35 minutes on gates that one push at the end would have covered in under five.

  So: commit at every checkpoint, and push when a piece of work is *finished* — or when the user asks, or when something needs to be off this machine. While iterating, run the specific gate your change touches (`pnpm lint`, `pnpm typecheck`, the relevant `npx vitest run <file>`); that is seconds, and it catches nearly everything the push gate would. Do not batch so far that unpushed work becomes a risk — a day's work sitting only on one laptop is its own problem.

### TDD (mandatory)

Red → Green → Refactor → Commit. One cycle per commit. For bugs: write failing regression test first, then fix. Exception: pure CSS/layout changes.

**Test quality (Kent Beck's Desiderata):** Isolated · Deterministic · Fast · Behavioral · Structure-insensitive · Specific · Predictive. Fix flaky tests first. Prefer E2E over unit tests for user flows.

### Localization — English only for v0

All user-facing UI labels/copy must live in `src/lib/locales/en.json`. That part
is mandatory and is not about translation: copy in `en.json` is how the rest of
the code reads a label, and a string hardcoded in a component is a bug whatever
the language policy is.

**Translating it is out of scope for v0.** Atticus, 2026-08-16: *"If I go public
and there's demand for multiple languages, then I'll consider it. Until then I'm
not worried."* Restated 2026-08-21. `CONTEXT.md` defines v0 as the trusted
circle — nineteen locales is a strangers-first concern.

So: **do not run `pnpm l10n:translate`** (it needs `LARA_ACCESS_KEY_ID` /
`SECRET`, which are set on no machine here anyway), and **do not report
`pnpm l10n:validate` failing.** It fails by design. It has been re-raised as a
finding by at least four separate sessions after the decision was made, which is
attention spent on a settled question. C18.

When localization does come into scope, the facts are in C18 in `HANDOFF.md`.

### Product analytics (mandatory for meaningful features)

New features should almost always emit a PostHog event so we can see whether users actually discover and use them. Skip instrumentation only for very small changes where a dedicated event would create noise. Use clear, stable event names, avoid PII or note content, and include only safe metadata that helps evaluate adoption and failures.

When adding or changing a meaningful user-facing feature, include the event name(s) in the completion comment (commit message / PR description) alongside QA, docs, and code health. If intentionally not instrumenting a feature, explain why in the completion comment.

### Code health (mandatory)

**Dead-code sweep (`pnpm deadcode`, knip).** Not a gate — it is not wired into any hook, because the repo has a standing backlog of findings and a blocking gate nobody can pass is a gate nobody trusts. Run it when you touch a file's neighbours, when you suspect something is orphaned, or before deleting anything. It reports unused files, exports, types, and dependencies; `knip.json` already declares the real entry points (scripts, sidecar lanes, vitepress, mcp-server) so what it prints is mostly true signal. It exists because `AiAgentsBadge.tsx` sat in the tree unreferenced — 395 lines plus a passing test suite — while every gate stayed green: its tests imported it directly, so nothing noticed it was rendered from nowhere. Fix what your change touches; do not mass-delete the backlog in an unrelated commit.

**⚠️ knip cannot see ambient declarations.** A file whose whole job is
`declare global { interface Window { … } }` is imported by nobody *by design*
— TypeScript picks it up from the project include — so knip reports it as an
unused file. `src/types/rhizomeTestBridge.ts` is exactly this: five source
files fail to typecheck without it, and it is listed in `knip.json`'s
`ignore` for that reason, as is `src/types/mockTauriBridge.ts`. **Always run
`pnpm typecheck` after deleting anything knip flagged**, and check for
`declare global` before believing a file is dead. Ambient-declaration files
are knip's most dangerous false positive.

No CodeScene gate — dropped 2026-07-09 because every layer we could use (cloud, `cs` CLI, local CodeHealth MCP) needed a paid account for a **private** repo, and the user won't pay. **Corrected 2026-08-26:** this line used to read "no free tier at any layer," which is false. CodeScene ships a free **Community edition** — it is scoped to *open source projects*, so it does not reach `tuckcode/rhizome-agent` while the repo is private. The conclusion (no gate today) is unchanged; the reason is narrower than the old wording implied. **If this repo ever goes public, re-evaluate — Community edition becomes available at that moment.** Do not re-derive this from the old sentence; check the date on this one. Boy Scout Rule still applies by judgment: never add `// eslint-disable`, `#[allow(...)]`, or `as any`; leave touched files cleaner than you found them. If hotspot/bus-factor analysis becomes a real need later, evaluate `code-maat` (free, git-history hotspot mining) + SonarQube Community (free, per-file quality rating) as a from-scratch replacement — not a drop-in, needs new plumbing and its own baseline.

### Security scan with Codacy (mandatory)

Use Codacy as a security and static-analysis gate before a task is considered releasable.

- **Run the local CLI. It needs no Codacy account and no payment** (corrected
  2026-08-23 — see below):
  ```bash
  codacy-cli analyze --tool trivy                 # vulnerable deps, whole repo
  codacy-cli analyze --tool opengrep <path>        # security patterns
  codacy-cli analyze --tool lizard <path>          # complexity
  codacy-cli analyze --tool trivy --format sarif -o trivy.sarif
  ```
  Per machine, once: `brew install codacy/codacy-cli-v2/codacy-cli-v2` then
  `codacy-cli init` (local mode) and `codacy-cli install`. `.codacy/` is
  gitignored, so every machine and every fresh clone repeats those three
  commands; `.codacy.yaml` at the repo root (tracked) holds the shared
  exclude list.
- **`codacy-cli init` defaults to every language it can find** — Dart, Go,
  Java, and Python runtimes for a TypeScript-and-Rust repo. Trim
  `.codacy/codacy.yaml` to `lizard`, `opengrep`, `trivy` (runtime:
  `python`). Codacy's `eslint` is deliberately excluded: it pins eslint 8,
  ignores plugin rules, and this repo's own `pnpm lint` (eslint 9, flat
  config, typescript-eslint) is strictly stronger. Rust is not covered by
  any Codacy tool — `cargo clippy` is that lane.
- **The MCP server is the part that costs money, and it is optional.**
  `@codacy/codacy-mcp` refuses to start without `CODACY_ACCOUNT_TOKEN`, and
  an account covering a **private** repo (`tuckcode/rhizome-agent`) is paid.
  Its `codacy_cli_analyze` tool just shells out to the same CLI, so the gate
  loses nothing by running the CLI directly. What the token would add is the
  hosted dashboard and trend history — not analysis capability.
- **This gate reported itself unrunnable for months, and that was wrong.** The
  rule used to say the paid-tier blocker applied to the whole gate and told
  agents to write "Codacy: not run" in the completion comment, so every
  session dutifully skipped it. The CLI's own README says it runs "for local
  code analysis without a Codacy account." The first real run (2026-08-23)
  found 95 advisories across the three lockfiles, two of which directly
  contradicted a prior security review's reasoning — C45. A gate nobody can
  run is indistinguishable from a gate that finds nothing, which is exactly
  how it read until someone checked the claim instead of repeating it.
- **Always fix Critical and High severity findings introduced by your change** before considering the change releasable.
- Review Medium findings. Fix them when they are real defects or security-sensitive; otherwise explain why they are acceptable in the completion comment.
- Never silence a Codacy rule just to pass the scan. Prefer small code changes that remove the finding.

### Check suite (runs on every push)
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage  # frontend ≥70%
pnpm test:mcp   # mcp-server/*.test.js — node:test, NOT picked up by vitest
cargo test && cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
cargo clippy --manifest-path=src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check
```

The last two ran on every push all along and were simply missing from this
list — a push that fails on `cargo fmt --check` after every other gate passed
costs a full re-run of the suite. Run them before pushing, not after. Added
2026-08-21 after exactly that happened.

**`pnpm typecheck` is `tsc -b`, and `npx tsc --noEmit` is a no-op.** Measured
2026-08-20: appending `export const X: number = "nope"` to a source file and
running `npx tsc --noEmit` exits **0**. The root `tsconfig.json` declares
`"files": []` and only project references, and `--noEmit` does not follow
references — so the command every session has been running as its typecheck
gate compiles zero files. `tsc -b` catches the same error immediately. This had
been noticed three separate times in `HANDOFF.md` and written down as a
gotcha each time while the documented command stayed wrong; the script exists
so the right command is the easy one.

**`pnpm typecheck` covers test files too, minus a named backlog.** Test files
are excluded from `tsconfig.app.json` and were checked by nothing until
2026-08-21; `tsconfig.test.json` is a third project that includes them, and
the root `tsconfig.json` references it so `tsc -b` picks it up. It is a
ratchet, not a wall: 386 of 533 test files were already clean, so they are
gated now, and the 150 that were not are listed by name in that file's
`exclude`. A new test file is checked from the moment it is written.
`pnpm typecheck:tests:backlog` prints what is still exempt, worst file first
— clearing one means deleting its line from `exclude`. That command is
advisory, not a gate, for the same reason `pnpm deadcode` is. C33.

`pnpm test:mcp` exists because vitest's `include` is
`src/**/*.{test,spec}.{ts,tsx}`, so nothing under `mcp-server/` was ever run
— `tool-service.test.js` sat passing and ungated until 2026-07-31. **Never
run `node --test mcp-server/`**: the directory form imports `index.js`,
which starts the MCP server and hangs forever. Always glob the test files.

Coverage is a release gate, not a vanity metric:
- Frontend coverage must stay ≥70%.
- Rust line coverage must stay ≥85%.
- For bug fixes, add a regression test when practical.
- For new behavior, add targeted coverage close to the changed code; do not rely only on broad E2E coverage.

### UI and native QA

**Phase 1 — Playwright (only for core user flows):**

Write Playwright test in `tests/smoke/<slug>.spec.ts` only if feature touches: vault open, note create/save/delete, search, wikilink navigation, git commit/push, conflict resolution. Tag a test with `@smoke` only if it protects a core pre-push workflow. Do NOT tag cosmetic or mock-heavy checks — keep those in the full regression lane. Prefer `.chunk/run-playwright-smoke.sh` on a Chunk sidecar for the curated smoke lane because local Playwright is expensive; keep `pnpm playwright:smoke` available for focused local reproduction. The curated smoke suite must stay under **5 minutes** when sharded on sidecars; use `pnpm playwright:regression` for the full Playwright pass.

```bash
pnpm dev --port 5201 &
sleep 3
BASE_URL="http://localhost:5201" npx playwright test tests/smoke/<slug>.spec.ts
```

### Phase 2 — Native app QA:

Native QA requires either Accessibility permission for osascript or a real `.app` bundle built with `pnpm tauri build`. See §3 "QA scripts" for the local-script gotcha. Use `computer-use` for native UI interaction (click, hover, drag, scroll, type) and Playwright for deterministic text-input coverage.

```bash
pnpm tauri dev &
sleep 10
# Use computer-use to interact with the native app window
# Focus: click the tray mark → type in the search field → verify results
```

Use computer-use/browser-control style interaction for native UI QA when available: click, hover, drag, select, scroll, and type the way a real user would with the mouse and trackpad. For every UI feature, test the primary mouse-driven path first, then verify any relevant keyboard shortcut or keyboard-first workflow still works. Rhizome is still a keyboard-first app, but QA must not assume users only interact by keyboard.

Use `osascript` for app focus, keyboard shortcuts, and keyboard-specific checks. **⚠️ WKWebView:** `osascript keystroke` can be blocked inside editor content — use computer use for native editor interaction when possible, and rely on Playwright for deterministic text-input coverage. Record the result (✅ or ❌) in the commit message or completion comment.

### Release-readiness checklist

Before pushing, verify the release gates and add a **completion comment** to the commit message or PR description. The comment must include:

- What was implemented (a few lines covering logic and UX/UI).
- QA: what was tested and how (Playwright / native screenshot / osascript).
- Tests/coverage: commands run and final coverage result.
- Coverage commands passed (`pnpm test:coverage` and `cargo llvm-cov ... --fail-under-lines 85`) or the change is docs-only.
- Codacy: MCP/CLI scan summary; confirm no new Critical/High findings.
- Localization: any user-facing copy lives in `src/lib/locales/en.json`. If no copy changed, say “Localization: no UI copy changes”. **Translations are out of scope for v0 (C18) — name the `en.json` keys you added and stop.** Do not run `pnpm l10n:translate`, and do not report `pnpm l10n:validate` failing: it fails by design until localization is in scope, and re-raising it spends the owner's attention on a decision already made twice.
- PostHog: meaningful new user actions/events are instrumented with safe metadata; noisy/minor changes explicitly say “PostHog: no event needed because …”.
- Refactoring: any cleanup done on touched files, or "none needed".
- ADRs: any new/updated ADRs, or "none".
- Docs: any updated docs (`ARCHITECTURE.md`, `ABSTRACTIONS.md`, etc.), or "none".
- Demo vault dirt checked: `git status --short -- demo-vault demo-vault-v2` is empty unless fixture changes are intentional.

### ADRs & docs

ADRs live in `docs/adr/`. Create in the same commit as the code. Never edit existing — create a new one that supersedes. Use `/create-adr`. **When:** new dependency, storage strategy, platform target, core abstraction, cross-cutting pattern. **Not for:** bug fixes, styling, refactors.

After any Tauri command, new component/hook, data model change, or new integration: update `docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, and/or `docs/GETTING-STARTED.md` in the same commit.

**Origin tags on living docs.** This repo is several models and at least two harnesses (Claude Code subscription, Cursor). The chat that wrote a paragraph is not in `rg`. When you add a section to `HANDOFF.md`, `NEXT.md`, or a design note other agents will treat as current, put one visible line under the heading:

```
**Origin:** <model> · <date> · <commit or session id>
```

Do not overwrite someone else's Origin line. Do not attribute a later insert to the file's original author.

**Why:** `docs/NEXT.md` was created by Claude Code (`c0cced2f` / `b8dc8fb`), then Grok inserted harness composition as "decide this first" (`2b5daba`). A later session treated that block as Claude's original plan and looked for RLM / plugin tasks that were never a `NEXT.md` row in either version. Git blame would have said; the file did not.

---

## 2. Product Rules

### Demo vault hygiene (`demo-vault/`, `demo-vault-v2/`)

Default to `demo-vault-v2/` for testing.

- Treat `demo-vault/` and `demo-vault-v2/` as disposable QA fixtures unless the task explicitly changes demo content.
- If you create untracked notes, attachments, or other temporary files there for testing, delete them before the task is complete.
- If you modify tracked demo-vault files only to test or QA behavior, revert those edits before the final commit.
- Before declaring a task done, make sure `git status --short -- demo-vault demo-vault-v2` is empty unless demo fixture changes are part of the task.
- If a fresh run starts and the only local dirt is inside `demo-vault/` or `demo-vault-v2/`, clean those paths first and continue. That case is recoverable QA residue, not a blocker.

### User vault (`~/Laputa/`)

Default to `demo-vault-v2/`. If you must use `~/Laputa/` for testing:
- **Never commit or push** any test notes to the remote vault
- **Delete all test notes from disk** when done — do not leave untitled or temporary notes on the filesystem. Run `cd ~/Laputa && git checkout -- . && git clean -fd` to restore the vault to its last committed state.
- **Rationale:** test notes pollute the local vault over time, making it a collection of nonsensical untitled files. The vault must stay clean on disk, not just on the remote.

### UI components — mandatory rules

**Always use shadcn/ui components.** Never use raw HTML form elements (`<input>`, `<select>`, `<button>`, native `<input type="date">`, etc.) for user-facing UI. Every interactive element must use the shadcn/ui equivalent:

| Need | Use |
|---|---|
| Text input | `Input` from shadcn/ui |
| Dropdown/select | `Select` from shadcn/ui |
| Date picker | `Calendar` + `Popover` from shadcn/ui (NOT native `<input type="date">`) |
| Button | `Button` from shadcn/ui |
| Autocomplete/combobox | Reuse existing combobox components from the app (check `src/components/`) |
| Wikilink picker | Reuse the wikilink autocomplete component already used in the editor and Properties panel |
| Note/type icon field | `IconEditableValue` — a typeahead over Phosphor icon names that also accepts a pasted emoji or image URL. **There is no emoji grid picker in the app.** A standalone `EmojiPicker.tsx` existed but was never imported by anything and was deleted 2026-07-24; the emoji dataset it used still lives in `src/utils/emoji.ts` if one is ever wanted. Do not tell yourself a picker exists — check first. |
| Color picker | Reuse the color swatch picker used for type customization |
| Toggle/switch | `Switch` or `ToggleGroup` from shadcn/ui |
| Dialog/modal | `Dialog` from shadcn/ui |

**When in doubt:** search `src/components/` for an existing component before building new. **Visual language:** all new UI must feel native to Rhizome — if it looks like a browser default, it's wrong.

---

## 3. Reference

### macOS / Tauri gotchas

- `Option+N` → special chars on macOS. Use `e.code` or `Cmd+N`
- Tauri menu accelerators: `MenuItemBuilder::new(label).accelerator("CmdOrCtrl+1")`
- `app.set_menu()` replaces the ENTIRE menu bar — include all submenus
- `mock-tauri.ts` silently swallows Tauri calls — not a substitute for native testing

### QA scripts

The `~/.openclaw/skills/tolaria-qa/scripts/` path is dead — those scripts no longer exist. Use `computer-use` for native app focus, keyboard shortcuts, and screenshot capture. For keyboard-first checks: use Playwright for text input and deterministic assertions; use `osascript` only for app-focus and menu-shortcut verification (note: WKWebView blocks `osascript keystroke` inside editor content).

### Diagrams

Prefer Mermaid (`flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`). ASCII only for spatial wireframe layouts.

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `tuckcode/rhizome-agent` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Learned User Preferences

- Prefers short, direct answers over walls of text; code reviews should stay short and actionable.
- When discussing GitHub issues or work items, pair the number with a brief plain-language description instead of using the number alone.
- Shares strategy docs and harness take/leave recommendations as decision context for joint calls, not as a shipped bill of materials. Intended product shape is option 2 (Rhizome harness, Prime engine); the take/adapt/reject/defer matrix with named incompatibilities is still unwritten.
- Treat token routing/compression (tinyhumans tokenjuice and NVIDIA's router) as discuss/plan material in a design doc, not opportunistic implementation.
- Wants background agent execution to be explicit: active window close should default to stopping work, while explicitly scheduled work may continue if it stays visible and revocable.
- Prefers not to copy-paste session summaries between agents; those belong in `docs/HANDOFF.md` / `docs/NEXT.md`. After a handoff task, pick next work from `docs/NEXT.md`.
- Expects living docs to say which model/session wrote a section. This project is multi-agent; grep is not the whole story.

## Learned Workspace Facts

- Prime mid-turn messaging is tri-state: accepted, no longer running, or transport failure. Follow-ups propagate Prime's `data.queued`; fallback starts a new turn only from the latest idle UI state. C43/C44 record why.
- On macOS, restoring a hidden main window requires unhiding the application first (`app.show()`), then unminimize, show, and focus. `lib.rs::focus_main_window` is the shared path; menu-bar and tray reopen must delegate to it.
- Rhizome is the desk and durable memory; Prime is the engine. Chat first, vault on purpose. Sessions stay left (collapsible), Chat is the default center canvas, and rail Inbox toggles one right Notes panel with compact navigation above its selected list (ADR-0166, shipped). Research and Mycelium should replace Chat as the center canvas, not open as modals; Mycelium is an in-app rebranded view, not a browser launch of Mindwalk. Memory is gated; execution is not.
- The Sessions column filter matches title, cwd/folder, and git branch — not transcript content. Archived rows are included; a hit expands that section. Prime sessions are named at creation (`Rhizome · {vault} · {id-tail}`) via `set_session_name`. Rename from the list speaks `rename_saved_session` (`sessionPath` + `name`) and must not create a session. Unnamed logs still fall back to "Untitled session".
- Rhizome starts Prime's supervisor on connect (`prime-agent --mode daemon --daemon-socket <path>`), the same kick the CLI's `ensureInteractiveDaemonRunning` uses. Do not spawn when `RHIZOME_PRIME_DAEMON_SOCKET` is set. If the host is down, retry `ensure_prime_session_host` on the status poll — a one-shot connect at launch loses the race and freezes the model chip, session switch, and rename.
- Selective harness doctrine (option 2): Rhizome is the product harness; Prime remains the only execution core and keeps receiving Prime updates through a thin versioned adapter. Absorb contracts and artifacts from Hermes/DeepSeek/others, never their runtimes or memory stores. Foreign pieces live in Rhizome (UX, vault, policy) or as Prime skills/MCP/extensions — never forked or patched into Prime. DeepSeek's Cordis plugin system is rejected as a kernel port; take extensibility on Prime's existing seams instead. Hermes Agent is its own runtime (not built on OpenCode); OpenCode is a delegated skill in Hermes. Coverage is by user job, not Prime command count. Ledger: `docs/design/harness-doctrine.md` (ADR-0168). Composition working notes: `docs/design/harness-composition.md` (unratified; `docs/NEXT.md` §1). Prime has no security sandbox; do not invent one in the desktop. Kern (getkern/kern) is Linux/WSL2 only.
- Prime supports `client_owned` sessions that stop after a disconnected-client grace period and can be promoted to `resident`; Rhizome creates new sessions as `client_owned` (ADR-0167 / C47). Idle close detaches; active close defaults to stop, with Keep working as an explicit promote. Quit follows ownership.
- The `docs/grok-wiki-*` files are not live product guidance; Grok wiki is out of scope.
- Keep the Notes panel's navigation and selected note list mounted together; making them exclusive broke Cmd+N, inbox auto-advance, and note selection.
- Titlebar drag is `useDragRegion` only. Do not put `data-tauri-drag-region` on the same surface, and do not call `startDragging()` on mousedown — wait for pointer movement. The first click of a double-click starting a native drag races maximize and snaps the window back to half-height. Native QA only; Playwright cannot see it.
- Closing an open note is the breadcrumb **X** (`editor.toolbar.closeNote` / `breadcrumb-close-note`). The sidebar-looking header control opens Properties, not the note.
- Living index docs are palimpsests. `docs/NEXT.md` was Claude Code `b8dc8fb`, then Grok `2b5daba` inserted harness composition; RLM was never a row. Read **Origin:** lines; `rg` cannot attribute a section.

