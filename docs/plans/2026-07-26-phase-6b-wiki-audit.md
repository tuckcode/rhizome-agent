# Phase 6b — Rhizome wiki content audit (2026-07-26)

Deliverable for Phase 6 of `2026-07-25-context-retooling-plan.md`. Distinct
from **6a**, which was the mechanical frontmatter repair (3 cards, already
shipped). This is the content audit: gotchas-vs-obvious, rich references,
and contradiction-checking between cards.

Vault: `~/Documents/Rhizome Vault`. **112 authored markdown files** — the
raw `find` count of 603 is misleading, ~490 of those are cloned repo
material under `.rhizome/repo-cache/`, not authored wiki content.

Vault git tree is clean; nothing here is uncommitted work in progress.

---

## F1 — DuckDB is described as "Rhizome's search backend" in three places; the app no longer uses it *(needs your call)*

Three cards describe the same subject, all asserting DuckDB is the search
backend:

| File | Lines | Claim |
|---|---|---|
| `concepts/search-backend-duckdb.md` | 38 | "Rhizome's **primary search backend**… hybrid BM25 + vector" |
| `governance/search/DUCKDB.md` | 43 | "DuckDB is the **local search layer**" |
| `governance/search/SEARCH_AND_DUCKDB.md` | 37 | "DuckDB is a local, in-memory search index built when you search" |

**I nearly filed this as "the wiki documents a fictional backend." It
isn't that, and the distinction matters.** Verified both sides:

- The Python `rhizome-search` CLI is **real and installed**
  (`~/.local/bin/rhizome-search`), and it genuinely uses DuckDB — confirmed
  `duckdb 1.5.4` in its uv toolchain. The vault's instruction to run
  `rhizome-search <vault> "topic"` works today.
- **But the desktop app no longer uses it.** `src-tauri/Cargo.toml` has
  `tantivy` + `fastembed`, no DuckDB dependency. `rhizome_search/mod.rs`
  opens: *"Resident Rust search index… **replaces** the Python
  `rhizome-search` (DuckDB + fastembed) subprocess."* The only DuckDB
  mentions left in the Rust source are comparative comments explaining that
  the Rust ranking deliberately mirrors DuckDB's behaviour.

So the cards aren't false — they're **scoped wrong**. They present
DuckDB as *Rhizome's* backend when it is now specifically *the standalone
CLI's* backend, and the app it's named after moved to tantivy. An agent
reading these to answer "how does Rhizome search work?" gets a stale
answer that still passes a smell test, which is the hard kind of wrong.

`governance/search/TURBOVEC.md` inherits the same framing ("16x memory
compression vs DuckDB native vectors").

**Recommendation, not applied — this is your architecture to describe:**
collapse the three into one card that says plainly there are two search
paths (Rust/tantivy in-app, Python/DuckDB CLI) and which is authoritative.
I did not merge them myself because picking the survivor means asserting
which path is canonical going forward, and that's a product decision.

## F2 — `governance/search/DUCKDB.md` vs `SEARCH_AND_DUCKDB.md` are near-redundant *(safe cut, pending F1)*

Beyond the three-way overlap, these two sit in the same directory and
cover the same ground at the same altitude — both "here's the pipeline,
here's why it's local, no cloud, no paid tier." Whichever survives F1,
these two should be one file. Folded into F1's recommendation rather than
actioned separately, since the merge target depends on F1's answer.

## F3 — `concepts/common-mistakes-avoidance-patterns.md` duplicates `concepts/local-model/common-mistakes.md` *(safe cut)*

Same title (`# Common Mistakes & Avoidance Patterns`), same three section
headings in the same order (Logic & Flow / Tooling & Execution /
Communication & Analysis). One is 28 lines, the other 40 — the longer adds
numbered prefixes and parenthetical flavour, but the substance is the same
checklist.

Frontmatter differs in a telling way: the `concepts/` copy has full
contract frontmatter (`type: concept`, `state: fleeting`, `last_updated`,
`context:`) while the `local-model/` copy has only `type: Note`. That
suggests the `concepts/` one is the distilled/canonical version and the
`local-model/` one is an earlier raw drop that was never cleaned up.

**Recommendation:** keep `concepts/common-mistakes-avoidance-patterns.md`,
delete the `local-model/` copy — but confirm first, since `local-model/`
may be a deliberate namespace for locally-run-model guidance rather than
an accident (`concepts/local-model/tool-usage.md` sits beside it).

## F4 — Personal content in the shared wiki *(violates the vault's own rule)*

The vault's own separation rule, stated in `~/Documents/Obsidian Vault/CLAUDE.md`:

> Rhizome Vault → shared agent wiki only
> This vault → personal notes, agent session logs, projects

Two files break it:

- **`meta/Nice fonts.md`** — 13 bytes, entire content is a font name
  (`Avenir (book)`). A personal preference note, not shared agent
  knowledge. Belongs in the personal Obsidian vault.
- **`areas/ai-agents/Claude/Memory/Session Logs/2026-06-27 - rhizome
  autopilot repo compiler.md`** — a Claude session log, and the path is a
  near-mirror of the personal vault's own
  `30 - Areas/AI Agents/Claude/Memory/Session Logs/`. This is the exact
  destination the rule assigns to the *other* vault.

Both are small and obviously misfiled. Not moved without your say-so
because moving files between vaults is the kind of thing that should be
deliberate, and the session log may have been placed there intentionally
during a period when the split worked differently.

## F5 — Untracked junk at vault root *(trivial, just flagging)*

`Untitled.canvas`, `Untitled 1.canvas`, `Untitled 2.canvas` — created
2026-07-25 17:32, two of them 2 bytes (empty). Obsidian scratch files.
`.tolaria-rename-txn/` is also present and empty — leftover transaction
directory from the rename.

Harmless, but they're the vault equivalent of the demo-vault dirt rule
`AGENTS.md` already enforces on the repo side.

---

## F6 — "Hermes is the wiki's sole writer" *(found late; resolved)*

**This section corrects an error in the first draft of this audit**, which
claimed "no contradictions between cards." That was wrong. I had checked
the three governance agent files for *emphasis* and missed that they all
assert a writer model the app abandoned:

- `governance/agents/HERMES.md` — Hermes is "the wiki's **sole writer**"
- `governance/agents/CLAUDE.md` — "Claude **searches and reads** the wiki.
  All wiki writes are delegated to Hermes," plus a `hermes chat -q
  "llm-wiki …"` delegation command block
- `governance/agents/OPENCODE.md` — identical wording for OpenCode

This directly contradicted the C5 resolution made hours earlier the same
day, which updated `~/Documents/Obsidian Vault/CLAUDE.md` to say Claude
writes directly via the `tolaria` MCP tools.

**The direct-write model is correct** — it is verified working code
(`rhizome_distill`, `create_note`, `save_capture`, all exercised this
session). The governance files date from 2026-05-31 and describe the
original design.

So the C5 fix was **correct but incomplete**: one location updated, three
others left asserting the opposite. That is exactly the duplication
failure mode this whole retooling pass exists to catch, walked into
during the pass itself — worth recording plainly rather than quietly
fixing, because it shows the failure mode is not a competence problem but
a structural one. When the same rule lives in four files, updating one is
the *default* outcome, not a lapse.

Resolved in vault commit `15cfeee` — all three updated with an explicit
"changed 2026-07-26" note rather than a silent rewrite, so the retired
model stays visible instead of vanishing.

## F3 addendum — `concepts/local-model/` resolved *(deleted)*

Investigated rather than guessed. Findings: nothing in the authored vault
references the directory (the only `local-model` hits are in
`.rhizome/repo-cache/notasithlord-peerd/`, an unrelated project); no local
model is configured (`ai_model_providers: null`,
`default_ai_target: agent:hermes`); and the tool vocabulary in
`tool-usage.md` (`search_files`, `patch`, `write_file`, `terminal`,
`background=true`) matches no agent actually in use here.

So it was not a deliberate namespace — it was an orphan. Both files
deleted in `15cfeee`: `common-mistakes.md` as a true duplicate of the
distilled `concepts/common-mistakes-avoidance-patterns.md`, and
`tool-usage.md` as unreferenced generic agent hygiene already covered by
`governance/agents/`. Recoverable from git history.

## What was NOT found — worth recording

**No *factual* disagreements between knowledge cards.** F6 was a stale
process rule replicated across three files, not two cards giving different
answers about a technical subject. On the knowledge side — the overlapping
Karpathy/LLM-wiki research notes, the concept cards — the differences are
emphasis, not claims.

So the wiki's failure modes, in order: **staleness** (F1, F6),
**duplication** (F2, F3), **misfiling** (F4). No internal disagreement
about facts, which remains the better problem to have.

**Frontmatter is broadly in good shape** post-6a. The 3 cards 6a repaired
were the whole population of that bug, confirmed independently.

## Net assessment

The vault is in better condition than the repo docs were. 112 files, one
genuinely stale subject area (search/DuckDB), one clear duplicate pair, two
misfiled personal files, some scratch junk. No contradictions.

The one finding that actually matters is **F1** — not because it's messy,
but because it's the failure mode that survives review: three consistent,
well-written, confidently-wrong-in-scope cards will outrank a correct
answer in any search, and nothing about them looks stale.
