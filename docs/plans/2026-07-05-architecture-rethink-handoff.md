# Architecture Rethink — Handoff for Next Session

Session ran out of budget mid-design. This doc exists so the next session can
start the actual design conversation cold, without re-deriving any of this.
Nothing below has been built — it's all context + the open question.

## The core question to design around

As `rhizome-desktop` (private, this repo — the successor) matures past
`rhizome` (public `knispo/rhizome`, the predecessor CLI/MCP toolkit, no
Tolaria/UI code in it at all): **does rhizome-desktop keep shelling out to
the separate Python CLI forever, or does it eventually absorb that logic
(DuckDB search, memory, distill, graph) directly into itself and retire the
CLI dependency?**

Context that motivates the question, not just curiosity: every functional
bug found this session traces back to the shell-out boundary, not to the
logic on either side of it —
- `rhizome-search`'s JSON output shape had to be guessed (fixed this
  session).
- The Library-tab scanner guessed wrong about `sources/repos/<slug>/`
  being flat files, when it's actually a directory per repo (confirmed bug,
  not yet fixed — see `2026-07-05-core-functionality-test-findings.md`).
- `rhizome-research`'s file-path regex silently drops any path with a dash
  (which is every real slugified path) — the CLI *thinks* it wrote a file
  and reports success-looking output, but nothing lands on disk (root cause
  found, fix identified, not applied — lives in the separate `rhizome` repo).
- MCP tools are visible to the agent (`mcp__tolaria__rhizome_search`) but
  blocked by Claude Code's own permission gate in both "Vault Safe" and
  "Power User" mode — the app's permission concept and Claude Code's actual
  permission system aren't wired together.

None of these are bugs in DuckDB, or in the distill/research logic itself —
they're all boundary/contract bugs at the subprocess shell-out layer
(stdout parsing, path assumptions, permission flags not passed through).
That's the pattern worth designing against.

## DuckDB — resolved, not part of the open question

Confirmed this session: DuckDB is necessary and doing real good (verified
live — `rhizome-search` returns genuinely relevant ranked results against
the real vault). It's local, in-memory per query, no cost, no daemon. It
lives entirely inside the separate `rhizome` CLI — rhizome-desktop itself
has zero DuckDB dependency, Rust or JS. **Don't relitigate whether DuckDB
is worth keeping — it is.** The only live question is whether the *access
path* to it (spawn Python CLI, parse text) stays as-is or gets absorbed.

## Reference repos — already surveyed, findings below (don't re-fetch)

14 repos processed 2026-07-05, full writeup in this session's transcript.
Compressed summary, ranked by relevance to the shell-out-vs-absorb question:

- **cachezero** — same shape as Rhizome already (raw → Claude Code compiles
  → `wiki/` folder → MCP). Confirms the nested `wiki/` convention (which our
  vault doesn't follow yet) is a real emerging pattern, not an isolated
  choice.
- **cognee** — unifies vector/graph/session memory behind one `recall()`
  call. Direct reference for merging Rhizome's 3 disconnected CLIs
  (`rhizome-search`, `rhizome-memory`, `rhizome-graph`) into one coherent
  retrieval surface instead of the agent guessing which tool to call.
- **resonant-lattice-memory** — three-tier decay/promotion memory model.
  Reference for actually wiring up `rhizome-memory` (currently returns 0
  facts against the real vault — dormant feature, not broken, just unused).
- **gbrain** — multiple independent "sources" in one backend, per-credential
  scoping. Prior art for the destination-vault-picker feature already
  scoped in `docs/plans/2026-07-05-research-panel-future-ideas.md` (item 2).
- **peerd** — sandboxed per-task "actors" holding no direct credentials.
  Stronger security model than Rhizome's current MCP story — relevant given
  the permission-gate bug found this session.
- **ctx** — indexes past *agent session transcripts* (decisions, failed
  attempts). Rhizome has nothing like this today — a real gap, not an
  overlap with existing tools.
- **graphify** — deterministic AST-based code graph, zero LLM tokens.
  Could front-run `rhizome-research`'s expensive agent-based repo research
  with a cheap structural pass first.
- **openknowledge.ai** — closest direct competitor to rhizome-desktop's own
  editor+AI story. Positioning/UX reference, not architecture.
- **open-notebook**, **OpenWiki**, **searxng**, **kb-prolog** — adjacent,
  lower priority (see full session transcript for detail if needed).
- **ppt-master** — not relevant to this rethink (pptx export tool).

## Also true, from earlier in the same session (don't re-derive)

- Only one real `rhizome` CLI checkout exists (`~/code/projects/rhizome`,
  tracks `github.com/knispo/rhizome`). It's installed via a **frozen `uv
  tool install` copy** — not editable — so fixes to that repo's source
  (like the research.py regex bug) won't take effect until
  `uv tool install --force` is re-run. Worth switching to an editable
  install if actively iterating on that repo.
- Two vaults, different roles: `~/Documents/Rhizome Desktop Vault`
  (personal) vs `~/Documents/Rhizome Vault` (agent/wiki/project memory —
  now the app's default vault, set via the real UI this session).
- Full functional test findings (what works, what's confirmed broken):
  `2026-07-05-core-functionality-test-findings.md`.
- Deferred UI/feature ideas (unified panel, destination-vault picker,
  onboarding vault question): `docs/plans/2026-07-05-research-panel-future-ideas.md`.

## Suggested next-session shape

Use `/grill-with-docs` (installed this session, `mattpocock/skills`) to
actually resolve the shell-out-vs-absorb question — that's what it's for.
Don't re-fetch the 14 reference repos or re-derive the DuckDB answer; start
directly from the open question above.
