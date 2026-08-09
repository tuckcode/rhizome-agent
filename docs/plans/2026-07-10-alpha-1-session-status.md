# Alpha-1 (write hygiene + project metadata) — session status

Picks up `2026-07-10-rhizome-desktop-alpha-roadmap.md`'s Alpha-1 phase.
Scope doc: `2026-07-10-one-brain-post-step4-roadmap.md`'s handoff notes;
plan file: implemented per its own written plan (four tasks, TDD, one
commit each).

## Pushed this session (local; push pending final verification)

```
ef09bd07 feat: post-write search invalidation (Alpha-1 task 4)
bed0bff6 feat: uniform trigger/artifact_path/project fields on all events (Alpha-1 task 3)
f7221fe8 feat: project: field on repo_research (Alpha-1 task 2)
e682e9c2 feat: dual-layout write+scan for flat pre-wiki/ vaults (Alpha-1 task 1)
```

## Critical finding this session

Checked the real `~/Documents/Rhizome Vault` directly (not just docs):
it's flat (`concepts/`, `entities/`, `sources/repos/` at vault root, no
`wiki/` wrapper) — the migration the July 5 architecture doc recommended
("adopt `wiki/`") was decided on paper but never executed. Steps 4a-4c's
writers only ever produced the nested `wiki/...` contract, so pointing
Generate/Distill/Import at the real vault would have started a stray
`wiki/` subtree instead of filing into the vault's existing structure.
This made dual-layout support P0 for Alpha-1, not the "avoid an empty
Library tab" cosmetic framing the drafting docs used.

## Done

- **Task 1 — dual-layout write + scan**: `vault_uses_flat_layout` detects
  a flat vault (no `wiki/` yet, but `RHIZOME_VAULT.md`/`.rhizome/`
  present); `resolve_write_path`/`scan_vault_library` switch to each
  `ArtifactKind::flat_dir()` for vaults already shaped that way.
- **Task 2 — `project:` on repo_research**: parity with Distill/Import,
  threaded through `wiki_frontmatter`/`write_repo_wiki`/
  `run_repo_research_via_agent`/`rhizome_api::repo_research`/dispatch;
  Generate tab got a matching UI field (reuses the shared `projectInput`
  state Import/Distill already use).
- **Task 3 — uniform events**: all four event emitters now carry
  `trigger` (`"manual"` everywhere today) and `artifact_path`
  (vault-relative, new `rhizome_write_location::relative_to_vault`
  helper); `project` added to both research events (previously only on
  distill/import).
- **Task 4 — post-write search invalidation**: `RhizomeSearchService`
  gained a dirty-flag `invalidate(vault_path)`; the next `search` call
  forces a full reindex before serving results. Deliberately **not** a
  "drop the warm handle" design — verified via a control test
  (`search_without_invalidate_does_not_pick_up_a_write_made_after_warming`)
  that dropping-and-reopening a handle doesn't force freshness for a
  vault whose index already has other content (the lazy-build path only
  reindexes a truly empty index).
- Full suite green: 1133 Rust tests (0 failed, 9 ignored — all live/agent
  tests, unchanged from before this session), lint/tsc clean, demo-vault
  clean.

## Known gaps / notes for next session

- **Alpha-2 (project-tree nav) and Alpha-3 (inbox automation) not
  started** — both already scoped in Hermes detail docs
  (`~/.hermes/plans/2026-07-10_230500-project-first-nav-wiki-structure.md`,
  `~/.hermes/plans/2026-07-10_225519-wiki-saves-and-triggers-alpha.md`).
  Alpha-3 directly reuses this session's event schema (`trigger:"inbox"`)
  and search invalidation — no rework needed there.
- **`agent_memory_vault_path` / destination-vault setting still doesn't
  exist** (Alpha-4) — Research still always writes to whatever vault is
  currently open in the main window. Confirmed via `App.tsx` this
  session; unchanged by Alpha-1.
- **The Ask-vs-Library path-prefix gap is separate and still open**:
  Ask results are relative to `wiki_root`, Library items include the
  `wiki/` prefix. Invisible today because the real vault is flat
  (`wiki_root == vault_root` in that case); would surface the moment a
  vault has a `wiki/` dir. Pre-existing, not touched by dual-layout work
  (that's about *which* directory writers pick, not about path-prefix
  consistency between Ask and Library once one exists).
- **MCP bridge (ADR-0152) continues separately, already mid-flight**:
  Phase 0/1a/1b landed in an earlier session (`rhizome_api` façade,
  reader-only tantivy open). Phase 2 (`rhizome-tool` sidecar binary) is
  next there, unrelated to Alpha-1's scope.
- **l10n stale for the new Generate project field**: `en.json` has
  `research.generate.projectPlaceholder`; other locales weren't
  translated (no `LARA_ACCESS_KEY_ID`/`SECRET` in this environment, same
  gap noted in every prior session this month).
