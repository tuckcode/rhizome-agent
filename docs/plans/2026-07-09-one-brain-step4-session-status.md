# One Brain step 4 — session status (2026-07-09)

Picks up from `2026-07-08-one-brain-session-status.md`. CodeScene gate
dropped, then step 4a + 4b done this session. All pushed to `origin main`.

## Pushed this session

```
1ee1aea7 docs: drop CodeScene quality gate mandate (no free tier)
74b5c09c docs: scope One Brain step 4 (rebuild distill/import/generate) with locked decisions
d7b7f4be fix: exclude nested .claude/worktrees/ from project-wide eslint
2769d013 feat: rebuild rhizome_distill on the agent layer (One Brain step 4a)
8e7d852c feat: rebuild rhizome_import_source on the agent layer (One Brain step 4b)
494415d2 style: cargo fmt rhizome_distill.rs and rhizome_import.rs
```

Repo state: clean gate, no CodeScene mandate, both Distill and Import tabs
now run through the agent layer instead of shelling Python.

## What's done

- **CodeScene dropped** (ADR-0149) — no free tier at any layer, confirmed.
  Codacy's local-CLI leg stays documented but still not actually set up in
  this repo (no `.codacy/` dir) — pre-existing gap, not addressed this
  session.
- **Step 4a — Distill**: `rhizome_distill.rs`. Agent produces a strict
  `TITLE:`/`CONTEXT:`/`---`/body response (no stdout-reparse regex), written
  as `ArtifactKind::Concept` via the write resolver. 12 unit tests + 1 live
  (`#[ignore]`, real Claude Code call, verified passing).
- **Step 4b — Import**: `rhizome_import.rs`. Same prompt+write shape, plus
  source acquisition for all three types the UI advertises: local/dropped
  files (markitdown subprocess for non-text, direct read for .md/.txt),
  generic URLs (reqwest → temp file → markitdown), YouTube (yt-dlp
  `--write-auto-sub` → VTT parser). ADR-0150 documents markitdown/yt-dlp as
  new optional PATH-discovered dependencies. 16 unit tests + 4 live
  (`#[ignore]`, all verified passing this session against a tempdir, never
  the real vault).
- Both tabs' `disabled={... || !cliAvailable ...}` gate dropped — they no
  longer need the Python toolkit.
- Full suite green at push time: 1098 Rust tests (7 ignored), frontend
  coverage 88.37%, Rust line coverage 86.55%/87.03% (varies run to run —
  see known flaky test below), clippy/eslint/tsc clean, 25/25 Playwright
  smoke tests.

## Known gaps / notes for next session

- **`vault::getting_started::tests::test_canonical_getting_started_path_accepts_cloned_starter_vault`
  is order-dependent flaky** under `cargo llvm-cov --test-threads=1` — failed
  once, passed on retry, passes standalone every time. Pre-existing, not
  caused by this session's changes (confirmed by rerunning coverage twice).
  Worth a dedicated flaky-test session per AGENTS.md's TDD desiderata
  ("Fix flaky tests first") but out of scope for step 4.
- **Rust coverage requires `LLVM_COV`/`LLVM_PROFDATA` env vars** on this
  machine — `rustup` isn't installed (cargo is homebrew-managed), so
  `cargo llvm-cov` can't find `llvm-tools-preview` on its own. Working
  invocation:
  ```bash
  LLVM_COV=/opt/homebrew/opt/llvm/bin/llvm-cov \
  LLVM_PROFDATA=/opt/homebrew/opt/llvm/bin/llvm-profdata \
  cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean \
    --ignore-filename-regex "lib\.rs|main\.rs|menu\.rs" --fail-under-lines 85 \
    -- --test-threads=1
  ```
  Same env vars needed inline before `git push` for the pre-push hook's Rust
  coverage step. Not fixed permanently (no shell profile touched) — every
  session on this machine needs this until `rustup component add
  llvm-tools-preview` is set up properly, or homebrew llvm's path is baked
  into `.husky/pre-push` itself.
- **`.husky/pre-push`'s CodeScene block is still dead code** — soft-skips
  without `CODESCENE_PAT`, harmless but unremoved. Flagged, not fixed, in
  ADR-0149 as a deliberate follow-up (a separate permission-scoped edit to
  the actual push-gate script, distinct from the AGENTS.md/CI doc cleanup
  done this session).
- **`rhizome_import.rs` has real uncovered lines in normal coverage runs**
  (55.73% file-level) because its `#[ignore]`d live tests cover the real
  subprocess/network paths that don't run by default. Same pattern already
  accepted for `rhizome_distill.rs` (72.78%) — total project coverage still
  clears the 85% gate. Not a regression, just how live-subprocess code
  reads under offline coverage.
- **Resolved: the Ask tab's stale `cliAvailable` gate.** Flagged mid-session
  as a background task (`task_e428c057`) for a bug noticed in passing —
  the Ask tab's button was still gated on Python-CLI availability even
  though `rhizome_search` moved off Python back in step 3b. Landed in a
  separate worktree session as commit `3f4d95bc` on `main`: dropped
  `cliAvailable` from the Ask button, reworded the not-installed banner to
  name only Generate (the one tab still gated — Import/Distill/Ask are all
  correctly ungated as of this session's 4a/4b work), added CLI-independence
  test coverage for Import/Distill/Ask. `pnpm l10n:translate` was skipped
  (no `LARA_ACCESS_KEY_ID`/`SECRET` in that environment either) — `en.json`
  has the new banner string, other locale files are stale for it until
  someone runs the translate step with real credentials.

## Step 4c (not started) — the big one

Rebuild `rhizome_repo_research` + `rhizome_generate_wiki` (the Generate tab)
on the agent layer. Per the step-4 scope doc, this is the biggest remaining
lift:

- Likely needs **multiple sequential agent calls** (a research round, maybe
  more than one depending on `depth`, then a synthesis/wiki-generation
  pass) rather than distill/import's single prompt+write — check whether
  chaining `run_ai_agent_stream` calls composes cleanly or needs a small
  addition to the agent layer.
- Output is `ArtifactKind::RepoWiki`, single file per
  `docs/VAULT_CONTRACT.md` (`wiki/sources/repos/<slug>.md`) — no multi-page
  directory needed, per the step-4 scope doc's resolution of the
  contract-vs-tool-description discrepancy.
- `rhizome_grok_import` stays deferred alongside the MCP-bridge follow-up
  (no in-app UI caller today — confirmed again this session, still true).
- Scope fresh at the start of that session rather than assuming this doc's
  framing still holds — re-read `2026-07-09-one-brain-step4-scope.md`'s
  "Staging" and "Risks" sections first.
