# Step 3 — Absorb Search: scoping

Scopes step 3 of `2026-07-05-one-brain-architecture-decision.md` ("absorb
search — the single highest-leverage move"). No code yet; this surfaces the
architecture decisions and a staged plan for sign-off.

## What we're replacing

`rhizome-search` (Python, `rhizome/search.py`):

- Model **BAAI/bge-small-en-v1.5** (384-dim, ONNX via `fastembed`).
- Hybrid score = **0.7 · vector cosine + 0.3 · BM25** (DuckDB FTS). Default
  vector backend is DuckDB `list_cosine_similarity` over full vectors —
  turbovec is opt-in, so **no turbovec port needed** for parity.
- Indexes `<root>/wiki` when it exists (else flat root) — matches the step-1
  layout decision. Excludes `.rhizome/`, `raw/`, `.obsidian/`, `governance/`.
- `doc_id` = path relative to the wiki dir. Searchable text = frontmatter
  header (`title,type,scope,project,context,tags`) + body.
- **Rebuilds an in-memory DuckDB index on every single query** — fine for a
  one-shot agent CLI, wrong for search-as-you-type. This is the UX win.

## Two Rust search consumers (do not conflate)

1. **In-app keyword quick-search** — `search.rs::search_vault`, naive
   substring match, no index. Its own Tauri command + UI. **Out of step-3
   scope; leave untouched.** (Could later unify onto the new index — a real
   "One Brain" dedup — but that's speculative now. Noted, not planned.)
2. **Research "Ask" tab + external-agent MCP `rhizome_search` verb** — both
   route through `call_rhizome_tool` → shell `rhizome-search` (Python). **This
   is what step 3 replaces.**

## Engine choice — recommendation: tantivy + fastembed-rs

Ladder check on the BM25 half: extending `search.rs` means hand-writing an
inverted index + BM25 + persistence + incremental updates. That's precisely
the clever-code-at-3am tantivy already is. Reimplementing it is more code and
more bugs than taking the crate. **Use tantivy** (the plan names it).

Vector half: **fastembed-rs**, same ONNX BGE-small model as Python fastembed —
the only way to get embedding parity. A different model breaks ranking parity
by construction. Cosine fusion at 0.7/0.3 is a few lines on top.

**Can we defer vectors (BM25-only interim)?** No. The plan's own showcase
parity query is "memory" — a *semantic* match. BM25-only Ask would regress
exactly the demonstrated case. Vectors are not deferrable for the cutover.

## Staging

- **3a — Build + prove (no user-facing change).** Add tantivy + fastembed-rs.
  Build a resident per-vault index (BM25 + vectors + 0.7/0.3 fusion), persisted
  in cache, built once and kept warm by the existing `vault_watcher.rs` (notify
  crate) instead of rebuilt per query. Mirror the Python contract exactly: same
  wiki-dir resolution, same operational-dir exclusions, same searchable-header
  composition, same `doc_id`. **Deliverable = the parity harness** (Rust index
  vs `rhizome-search` on the real vault, ~10 known-good queries incl. "memory";
  target warm query < 100ms). Ships as an internal Tauri command behind nothing
  user-facing yet.
- **3b — Cut over.** Ask tab + MCP `rhizome_search` verb call the Rust index.
  Retire the Python search path; drop its slice of `rhizome_check_availability`.
  Value lands: no subprocess, instant results, the JSON-shape-guessing bug dies.

3a is the real engineering lift; 3b is a wiring flip once parity holds.

## Decisions (locked 2026-07-08)

1. **Index cache location → OS app-cache dir.**
   `dirs::cache_dir()/com.tolaria.app/search/<vault-key>/`, keyed per
   vault/workspace. Out of the vault and out of git. (Diverges from the plan's
   literal `~/.laputa/cache` — deliberate.)
2. **Embedding model lifecycle → lazy-download on first search**, with a
   clear first-run status indicator, cached under the app-cache dir.
3. **Dependency weight → proceed**, flag binary-size impact after 3a lands.
   (tantivy + `ort`/ONNX Runtime: longer build, larger binary — accepted cost
   of absorption.)
4. **Staging → 3a build+parity, then 3b cutover.**

## Risks

- **Ranking parity is approximate, not identical.** tantivy BM25 tokenization
  and DuckDB FTS differ; fusion weights match but base scores won't be
  bit-identical. Parity harness should assert *top-k set overlap / ordering*
  within tolerance, not exact scores.
- **Model download failure** on a locked-down network — 3b cutover must keep a
  graceful degrade (BM25-only, surfaced) rather than a hard fail.
