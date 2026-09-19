# Core Rhizome Functionality — Test Findings (2026-07-05)

Front-to-back verification of whether the app's Research Panel actually does
its job: pulling from agents/CLIs and storing results in the correct
format/structure in the vault. Tested against a disposable copy of the real
`~/Documents/Rhizome Vault` (copied to scratch, tested, deleted — the real
vault was never touched). Notes only — nothing in this doc has been fixed.

## Setup confirmed working

- All 16 `rhizome-*` CLIs resolve correctly via `uv tool list` (repaired
  earlier this session — previously broken/missing).
- Every `claude -p` the app spawns already auto-injects `--mcp-config`
  pointing at the bundled Tolaria MCP server + `--strict-mcp-config` — no
  manual external MCP setup needed by users (verified in
  `claude_invocation.rs:182-236`).

## CONFIRMED BUG — AI Chat's MCP tools are blocked even in Power User mode

Tested live in the actual app (real Rhizome Vault, real AI Chat panel):
asked Claude Code to call `rhizome_search` MCP tool. In **Vault Safe** mode
the agent tried both `rhizome_search` and a `search_notes` fallback, both
silently "blocked," and it quietly fell back to using the already-open
note's content instead — no error surfaced to the user, looked like a
correct answer but wasn't a real search. Switched to **Power User** mode and
retried the identical prompt: still blocked, but this time the agent
reported why — "Tool call was blocked by permissions — you haven't been
granted `rhizome_search` MCP access... approve the
`mcp__tolaria__rhizome_search` permission when prompted, or check your MCP
tool permissions in settings."

Root cause: MCP config injection is correct (confirmed earlier — the tool
is visible to the agent under `mcp__tolaria__rhizome_search`), but tool
*execution* hits Claude Code's own standard permission gate, which needs an
interactive approval prompt or an explicit `--allowedTools`/permission-mode
flag on the `claude -p` invocation. The app's "Power User" toggle
(ADR 0103) is a rhizome-desktop-level concept — it does not appear to also
pass the matching Claude Code permission flag for MCP tools specifically.
Net effect: **the AI Chat panel currently cannot actually search or write
the vault via MCP in either permission mode**, and Vault Safe mode fails
silently (no error shown to the user) rather than explaining why.

Fix shape (not applied): when the app's permission mode is "Power User",
the Claude invocation (`claude_invocation.rs`) needs to also pass
`--allowedTools` (or equivalent) covering the `mcp__tolaria__*` tool names,
so the permission gate doesn't block them. Worth checking whether other
adapters (Codex, OpenCode, etc.) have the same gap.

## CONFIRMED BUG — Library tab misses most real content

`scan_vault_library` / `scan_dir_items` in
[rhizome_commands.rs:219-300](../../src-tauri/src/rhizome_commands.rs) only
reads flat `.md` files one level deep in `sources/repos/`, `sources/documents/`,
`entities/`, `concepts/` — it explicitly skips subdirectories
(`if !path.is_file() { continue }`).

But `sources/repos/<repo-slug>/` is a **directory per repo**, containing
4-5 pages each (`overview.md`, `architecture.md`, `file-map.md`,
`agent-handoff.md`, sometimes `entrypoints.md` or many `page-*.md` files for
grok-imported wikis). This is the CLI toolkit's permanent, documented
convention — confirmed in `~/code/projects/rhizome/docs/REPO_COMPILER.md:30-34`
and `grok_import.py`/`repo_wiki.py`, not incidental.

**Effect: the Library tab currently shows zero "Repo Wiki" entries**, despite
the real vault having fully-generated repo wikis (`rhizome`,
`notasithlord-peerd`, `StevenBlack-hosts`,
`AsyncFuncAI-grok-wiki` — the last one alone has 27 pages).

Fix shape (not applied): `scan_dir_items` for the `sources/repos` category
needs to recurse one level — either list each repo subdirectory as a single
Library entry (using its `index.md`/`overview.md` as representative), or list
every page inside with a `repoSlug/pageName` label. Distill/import-tested
categories (`concepts/`, `entities/`, `sources/documents/`) are flat and
already scan correctly — narrow, well-understood fix.

## CONFIRMED GAP — real content categories never scanned

The real vault has two more top-level folders with genuine content that the
Library scanner never looks at, at all:
- `research/` — deep-research outputs (`rhizome-research`/Generate tab writes
  here as `queries/research-<slug>-<date>.md` per `WRITE_LOCATION.md`, though
  this vault has files directly under `research/` too — inconsistent, worth
  checking which is current).
- `synthesis/` — handoff summaries, architecture snapshots.

Neither maps to a category `scan_vault_library` checks for. Anything living
there is invisible in the Library tab even though it's real, valid content.

## Verified working end-to-end

- **`rhizome-distill`** (Distill tab): ran against the vault copy with
  `--kind concept`. Wrote a correctly-formatted card to `concepts/<slug>.md`
  with proper frontmatter (`card_slug`, `distilled_at`, `kind`, `title`,
  `type: knowledge-card`) and appended a matching `{"type": "distill", "cards":
  1, ...}` line to `.rhizome/events.jsonl`. Both match what the Library
  scanner and History tab (`read_vault_events`) expect. **Works correctly.**
  - Minor cosmetic issue (CLI-side, not app's bug): the card's `title` and H1
    are the raw input text hard-truncated mid-word ("...It uses BlockNot"),
    no ellipsis or word-boundary trim. Would look broken in the Library list
    if surfaced as-is.
- **`rhizome-import-source`** (Import tab): imported a plain text file, wrote
  to `sources/documents/<slug>.md` exactly as the scanner expects. **Works
  correctly.** (My first-pass assumption that `sources/documents/` "didn't
  exist" in the real vault was just because nothing had been imported yet —
  not a path mismatch.)
- **`rhizome-search`** (Ask tab): confirmed earlier this session — real
  query against the real vault returned relevant ranked hits in the
  `{"page": ..., "score": ...}` shape that `parseAskResults()` was fixed to
  parse. **Works correctly** (this was the fix applied earlier in the
  session).

## Not yet tested (out of scope for this pass, needs more setup)

- **`rhizome-research`/Generate tab** end-to-end against a real GitHub repo
  (needs network + a real target repo; the vault already has research
  outputs from prior real runs, which is how the `sources/repos/*` structure
  was discovered, but a fresh live run wasn't executed this session).
- **`rhizome-grok-import`** (bulk wiki import) — needs an actual grok export
  file as input; not available to test with here.
- **Streaming progress** (`rhizome-progress` Tauri event → live event log)
  — implemented and code-reviewed earlier this session but not re-verified
  against a real long-running CLI call in this pass.
- **Auto-open-newest-artifact** — implemented earlier this session, not
  re-verified against a real multi-file-producing run (e.g. a real grok
  import or repo wiki generation) in this pass.
- **`rhizome-memory`** (staleness/contradictions/archive-gravity) — returns 0
  facts against the real vault; this is a separate bi-temporal "Key Facts"
  store that looks unpopulated/unused so far, independent of whether
  search/distill/import work. Worth asking whether this is expected (feature
  not adopted yet) or something that should be wired up.

## Bottom line

The **write paths** (distill, import, search) that the app's Research Panel
actually drives are correct and match the CLI toolkit's real conventions —
Rhizome genuinely is storing agent output in the vault in the right format.
The **read path** (Library tab) has a real, confirmed, narrow bug: it can't
see repo wikis (the single biggest content category by page count) and two
whole folders of real content. That's the highest-value fix once you're back
to shipping code, not a redesign — it's a ~20-30 line change to one function.
