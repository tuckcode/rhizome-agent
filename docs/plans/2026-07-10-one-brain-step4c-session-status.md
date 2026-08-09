# One Brain step 4c — session status (2026-07-10)

Picks up from `2026-07-09-one-brain-step4-session-status.md`. Step 4c
(Generate tab on the agent layer) built and committed this session — the
last stage of step 4. Plan approved via plan mode; scope doc's Staging and
Risks sections re-read first as instructed.

## Committed this session (local, push pending full gate run)

```
3a51f90c refactor: generalize unique_slug_path into rhizome_write_location
02e955f0 feat: repo reference classification + depth/cache helpers (step 4c)
5b4086f3 feat: clone-or-update repo cache for agent-layer research (step 4c)
e3c3b5d1 feat: research prompts, wiki frontmatter, write path, history events (step 4c)
da54a5f0 feat: rebuild rhizome_repo_research on the agent layer (One Brain step 4c)
0dfd6e54 feat: drop the Python-CLI availability gate from the Research panel
(+ this docs commit)
```

## What's done

- **Step 4c — Generate**: new `rhizome_repo_research.rs`. Key design point
  discovered during planning: the agent layer's Safe allowlist has **no
  Bash and no web tools**, so remote repos are cloned Rust-side
  (`git clone --depth 1` into `<vault>/.rhizome/repo-cache/<slug>`,
  fetch+reset when cached, `GIT_TERMINAL_PROMPT=0`, shared
  `run_cli_streaming` 120s timeout) and the agent subprocess's cwd is
  pointed at the checkout. Research = 1/2/3 sequential
  `run_ai_agent_stream` rounds (depth fast/regular/deep), raw findings
  carried forward between rounds, then one synthesis call with a per-mode
  instruction line (all 10 Generate modes, unknown → architecture)
  producing the strict `TITLE:`/`CONTEXT:`/`---`/body shape. Rust parses
  and writes the single `ArtifactKind::RepoWiki` file (slug = repo
  identity, deduped); `research-started`/`-finished` events match the JS
  MCP shapes. ADR-0151 records the repo cache, git PATH dep, and
  agent-cwd-outside-vault tradeoff.
- **Dead code removed**: `rhizome_generate_wiki` dispatch arm (zero in-app
  callers), `rhizome_check_availability` command, `rhizome_discovery`
  module, the Generate button's `!cliAvailable` gate, the not-installed
  banner, and the `research.cliNotInstalled` locale key (en.json only —
  other locales never received it). **No Research-panel tab needs the
  Python toolkit anymore.**
- **`unique_slug_path` generalized** into `rhizome_write_location.rs`
  (kind-parametric), distill/import refactored onto it.
- **Live tests verified this session**: `live_ensure_local_repo_clones_then_updates`
  (real network clone of octocat/Hello-World, clone-then-update) and
  `live_repo_research_via_claude_code_writes_a_wiki_page` (real Claude Code
  agent researching a 2-file local fixture into a tempdir vault, 21s) both
  passed. Zero `rhizome-research`/`rhizome-repo-wiki` strings left in
  `src-tauri/src/` (grep-verified; one doc-comment mention only).

## Known gaps / notes for next session

- **`pnpm l10n:validate` fails pre-existing**: 19 locales missing ~69 keys
  each — accumulated staleness from sessions without `LARA_ACCESS_KEY_ID`/
  `SECRET` (this environment has none either). Not caused by 4c (the only
  l10n change here is a deletion, which *reduces* the missing count).
  Needs one translate run with real credentials to clear.
- **MCP handlers still shell Python** for all six verbs — the documented
  MCP-bridge follow-up (see ARCHITECTURE.md's "Not yet wired" section,
  updated this session to list all remaining verbs). `rhizome_grok_import`
  stays deferred with it.
- **No cancel affordance** in the panel — a deep run is 4 sequential agent
  calls with no abort. Pre-existing, deferred per the scope doc.
- **Coverage note**: `rhizome_repo_research.rs` orchestrator + live-git
  lines are uncovered in offline runs, same accepted precedent as
  `rhizome_import.rs`.
- The order-dependent flaky
  `test_canonical_getting_started_path_accepts_cloned_starter_vault` (under
  `--test-threads=1` coverage runs) is still unfixed — see the 07-09 doc.
- Rust coverage on this machine still needs
  `LLVM_COV=/opt/homebrew/opt/llvm/bin/llvm-cov LLVM_PROFDATA=/opt/homebrew/opt/llvm/bin/llvm-profdata`
  (no rustup; homebrew cargo).

## Step 4 is complete

4a (Distill) + 4b (Import) + 4c (Generate) all run through the agent layer
and the write resolver. Next candidates per the architecture doc: the
MCP↔Rust bridge (cuts all six MCP verbs over at once), vault-watcher-driven
incremental search reindex, or the flaky-test session.
