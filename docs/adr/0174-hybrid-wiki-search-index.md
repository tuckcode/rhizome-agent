---
type: ADR
id: "0174"
title: "Hybrid tantivy + fastembed index for wiki search"
status: active
date: 2026-09-27
---

**Origin:** Claude Opus 5.5 (Claude Code desktop) · 2026-09-27 · written after a
Repowise review read ADR-0009 as repo-wide and called the codebase "keyword-only"

## Context

Narrows the scope of [ADR-0009](0009-keyword-only-search.md). Does not
supersede it.

ADR-0009 removed QMD semantic indexing and made note search keyword-only. That
still holds: `search_vault` (`src-tauri/src/search.rs`) scans `.md` files with
`walkdir` and backs the note-list search field.

A second search now exists. One Brain step 3
(`docs/plans/2026-07-08-step3-absorb-search-scope.md`) replaced the Python
`rhizome-search` subprocess (DuckDB + fastembed) with a resident Rust index,
`src-tauri/src/rhizome_search/`. It serves the Research panel / Ask tab
(`RhizomeSearchService`) and the `rhizome-tool search` sidecar
(`rhizome_api::search_standalone`, ADR-0152). It is semantic: vector cosine
over BGE-small-en-v1.5 embeddings, fused with tantivy BM25.

No ADR recorded this. It adds two heavy dependencies (`tantivy`, `fastembed`
with ONNX Runtime), and ADR-0009's title — "remove semantic indexing" — reads
as if the whole app forbids it. An external review (Repowise, 2026-09-27)
made exactly that mistake.

## Decision

**Wiki search (`rhizome_search/`) uses a resident hybrid index: tantivy BM25
fused with fastembed BGE-small vectors, weights 0.7 vector + 0.3 BM25. Note
search (`search_vault`) stays keyword-only per ADR-0009.**

## Options considered

- **Hybrid Rust index** (chosen): no Python subprocess, warm across queries,
  ranking comparable with the Python tool it replaced (9/10 identical top-1,
  ~73% top-10 overlap — `docs/ARCHITECTURE.md` § Rhizome Wiki Search Index).
  Cost: larger binary, longer build, ~130MB model download on first search.
- **Keep the Python `rhizome-search` subprocess**: no new Rust dependencies.
  Cost: Python on every machine, JSON-shape guessing, cold start per call.
- **Keyword-only wiki search (extend ADR-0009)**: zero dependencies. Cost:
  loses the similarity ranking the wiki workflow was built on.

## Consequences

- Two search paths with different rules. Code that touches `search.rs` follows
  ADR-0009; code that touches `rhizome_search/` follows this ADR.
- Index and model cache live under `dirs::cache_dir()/com.tolaria.app/search/
  <vault-key>/` — out of the vault and out of git, so ADR-0002 is unaffected.
- The model downloads lazily. The plan's fallback — degrade to BM25-only when
  the download fails — is not built: `search_standalone_with_embedder` returns
  the embedder error. Offline first use fails.
- The index is not refreshed on vault edits within a session (watcher not
  wired). Known gap, documented in `ARCHITECTURE.md`.
- Only one process may hold the tantivy writer; the sidecar opens reader-only
  first (ADR-0152).
- Re-evaluate if the binary-size cost becomes a release blocker, or if note
  search needs similarity ranking — then decide whether both paths share this
  index.
