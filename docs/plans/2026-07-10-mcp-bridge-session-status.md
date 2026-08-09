# MCP bridge — session status (2026-07-10)

Continues One Brain post-step4 roadmap item 2. Scope + ADR locked; Phase 1a/1b
landed. Push still pending full pre-push suite.

## Committed this session (local)

```
daa7e90c fix: spawn rhizome CLI via execFile argv (no shell join)
e8b2d985 docs: lock MCP Rust sidecar scope and ADR-0152
d32dbe68 feat: reader-only tantivy open for multi-process search (ADR-0152)
307f01fd feat: extract AppHandle-free rhizome_api façade (MCP bridge 1b)
```

## Done

- **Phase 0:** `docs/plans/2026-07-10-mcp-bridge-scope.md`, ADR-0152,
  post-step4 roadmap filed.
- **Shell injection (off-path):** MCP `execFileSync` + argv (33/33 node tests).
- **Phase 1a:** `RhizomeSearchIndex::open_reader` + lock regression test.
- **Phase 1b:** `rhizome_api` façade — `search_with_service`,
  `search_standalone` (reader-first, writer fallback + busy error),
  `distill` / `import_source` / `repo_research`. `call_rhizome_tool` routes
  through it.

## Next (Phase 2)

1. Add `[[bin]] rhizome-tool` CLI over `rhizome_api`.
2. Wire MCP `RHIZOME_TOOL_PATH` for dev cutover of research verbs.
3. Then packaging (Phase 3, macOS first) and full cutover (Phase 4).
4. Still open inside 1b/v1: **port `rhizome_grok_import`** (still Python via
   `call_rhizome_tool` / MCP).

## Verified

- `cargo test --lib rhizome_search` — 16 pass
- `cargo test --lib rhizome_api` — 3 pass
