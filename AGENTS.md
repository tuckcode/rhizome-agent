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
- Read `docs/HANDOFF.md` — living current-state doc, updated in place each session (not dated). Read it directly; the wiki's search-first rule does not apply to repo docs.
- Check `docs/plans/` for the most recent `*-session-status.md` (sort by date in the filename) — dated detail log behind the handoff summary: what's done, what's blocked, and where to pick up
- Check `docs/adr/` for relevant architecture decisions before structural choices
- Check `docs/ARCHITECTURE.md` and `docs/ABSTRACTIONS.md` for relevant structural information

### Commits & pushes

- origin = git@github.com:knispo/rhizome.git (PUBLIC — AGPL-3.0-or-later). Commit locally, push to origin main when pre-push gates pass.
- **Before pushing, ensure these env vars are set** (required for `cargo llvm-cov`, which the pre-push Rust gate invokes at step 4/6):
  ```
  export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov"
  export LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
  ```
  See `docs/CROSS-MODEL-HANDOFF.md` §13 for the full sequence and `cargo llvm-cov` flags.
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

### TDD (mandatory)

Red → Green → Refactor → Commit. One cycle per commit. For bugs: write failing regression test first, then fix. Exception: pure CSS/layout changes.

**Test quality (Kent Beck's Desiderata):** Isolated · Deterministic · Fast · Behavioral · Structure-insensitive · Specific · Predictive. Fix flaky tests first. Prefer E2E over unit tests for user flows.

### Localization (mandatory for UI copy)

All user-facing UI labels/copy must live in `src/lib/locales/en.json` and be translated into every target listed in `lara.yaml`. When adding or changing interface copy:

```bash
pnpm l10n:translate
```

Use `pnpm l10n:translate:force` only when intentionally regenerating existing translations. Commit `src/lib/locales/*.json`, `lara.yaml`/`lara.lock` changes if produced, and verify placeholders/product names stayed intact.

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
`ignore` for that reason. **Always run `npx tsc --noEmit` after deleting
anything knip flagged**, and check for `declare global` before believing a
file is dead. Ambient-declaration files are knip's most dangerous false
positive.

No CodeScene gate — dropped 2026-07-09 (no free tier at any layer: cloud, `cs` CLI, or local CodeHealth MCP all require a paid account; user won't pay). Boy Scout Rule still applies by judgment: never add `// eslint-disable`, `#[allow(...)]`, or `as any`; leave touched files cleaner than you found them. If hotspot/bus-factor analysis becomes a real need later, evaluate `code-maat` (free, git-history hotspot mining) + SonarQube Community (free, per-file quality rating) as a from-scratch replacement — not a drop-in, needs new plumbing and its own baseline.

### Security scan with Codacy (mandatory)

Use Codacy as a security and static-analysis gate before a task is considered releasable.

- Prefer the Codacy MCP inside Codex to inspect repository/file issues for every touched code file.
- If MCP is unavailable, use the local CLI wrapper, e.g. `.codacy/cli.sh analyze <path> --format sarif`; choose the relevant tool when useful (`eslint`, `opengrep`, `trivy`, `lizard`).
- **Not actually set up yet.** `.codacy/` (gitignored, per-machine) has never been created and no Codacy MCP has been available in any session so far. This isn't a config accident — Codacy required payment for a private repo, and this repo was private until it went public (`git remote -v` → `knispo/rhizome`, AGPL). Free-tier eligibility is worth checking now that that's changed; until someone does, **say so explicitly in the completion comment** ("Codacy: not run — no MCP tool, no `.codacy/` directory in this session") rather than silently skipping the gate.
- **Always fix Critical and High severity findings introduced by your change** before considering the change releasable.
- Review Medium findings. Fix them when they are real defects or security-sensitive; otherwise explain why they are acceptable in the completion comment.
- Never silence a Codacy rule just to pass the scan. Prefer small code changes that remove the finding.

### Check suite (runs on every push)
```bash
pnpm lint && npx tsc --noEmit && pnpm test && pnpm test:coverage  # frontend ≥70%
pnpm test:mcp   # mcp-server/*.test.js — node:test, NOT picked up by vitest
cargo test && cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
```

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
- Localization: any user-facing copy lives in `src/lib/locales/en.json`, `pnpm l10n:translate` was run, and `pnpm l10n:validate` passes. If no copy changed, say “Localization: no UI copy changes”.
- PostHog: meaningful new user actions/events are instrumented with safe metadata; noisy/minor changes explicitly say “PostHog: no event needed because …”.
- Refactoring: any cleanup done on touched files, or "none needed".
- ADRs: any new/updated ADRs, or "none".
- Docs: any updated docs (`ARCHITECTURE.md`, `ABSTRACTIONS.md`, etc.), or "none".
- Demo vault dirt checked: `git status --short -- demo-vault demo-vault-v2` is empty unless fixture changes are intentional.

### ADRs & docs

ADRs live in `docs/adr/`. Create in the same commit as the code. Never edit existing — create a new one that supersedes. Use `/create-adr`. **When:** new dependency, storage strategy, platform target, core abstraction, cross-cutting pattern. **Not for:** bug fixes, styling, refactors.

After any Tauri command, new component/hook, data model change, or new integration: update `docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, and/or `docs/GETTING-STARTED.md` in the same commit.

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

