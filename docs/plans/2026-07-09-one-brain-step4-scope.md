# Step 4 — Rebuild research/distill/import on the agent layer: scoping

Scopes step 4 of `2026-07-05-one-brain-architecture-decision.md` ("rebuild
research/distill/import on the agent layer + write resolver"). No code yet;
locks decisions before build starts, same pattern as
`2026-07-08-step3-absorb-search-scope.md`.

## What we're replacing

Two independent, duplicated shell-outs to `rhizome-research` /
`rhizome-import-source` / `rhizome-distill` (and `rhizome-repo-wiki`,
`rhizome-grok-import`):

1. **Rust** — `rhizome_commands.rs::call_rhizome_tool`, backing the in-app
   Research panel (`ResearchPanel.tsx`) via the `call_rhizome_tool` Tauri
   command.
2. **JS** — `mcp-server/index.js`, backing external MCP agents.

Both spawn the Python CLI and reparse plain-text stdout. The doc's motivating
bug (`research.py`'s `FILE_BLOCK_RE` silently drops any `---FILE:---` path
containing a dash — confirmed live in the sibling `rhizome` repo,
`rhizome/research.py:34-36`) lives in this reparse step and dies with it.

## Scope cut: Rust/in-app path only, same as step 3b

Step 3b cut the **in-app** Ask tab over to the Rust search index and
*deliberately deferred* the MCP-facing `rhizome_search` verb, because
`mcp-server/index.js` runs as a separate Node process with no bridge back
into the Tauri/Rust core for a request→response round trip (a WebSocket
bridge exists, `ws-bridge.js`, but it relays UI state, not agent-layer
invocations) — recorded as a known gap in
`2026-07-08-one-brain-session-status.md`.

The same constraint applies here. **Step 4 rebuilds only the Rust side**
(`rhizome_commands.rs`, called by `ResearchPanel.tsx`). The JS
`mcp-server/index.js` handlers keep shelling Python, same documented gap as
`rhizome_search` pre-3b — not re-solved here. Building the MCP↔Rust bridge is
its own follow-up that would fix all four verbs (search included) at once;
duplicating agent-invocation logic into JS now would be built-to-be-thrown-away.

This also resolves what to do with `rhizome_grok_import`: it has **no
ResearchPanel tab** (MCP-only today, confirmed via grep — external agents
call it, nothing in-app does). With the MCP path deferred, there is nothing
in-app to migrate it to. **Deferred alongside the MCP-bridge follow-up.**
This matches the original plan's own step-4 verification line, which lists
"Generate/Import/Distill" — not grok-import.

## Write-resolver design: zero interface changes needed

`rhizome_write_location.rs` (step 1) is unused outside its own tests today.
Mapping the 3 verbs onto it, using `docs/VAULT_CONTRACT.md` as the
authoritative layout (not the older MCP tool description text, which
mentions a `sources/repos/<slug>/` directory the contract doesn't have):

- **Generate** (`rhizome_repo_research` + `rhizome_generate_wiki`) →
  `ArtifactKind::RepoWiki`, single file `wiki/sources/repos/<slug>.md`. The
  contract already specifies a single file, not a directory of pages — no
  resolver change needed.
- **Import** (`rhizome_import_source`) → `ArtifactKind::Document`, single
  file `wiki/sources/documents/<slug>.md`. No resolver change.
- **Distill** (`rhizome_distill`) → `ArtifactKind::Concept`, always. The
  Python CLI's 6-value kind vocabulary (`concept | architecture-pattern |
  workflow | integration | failure-mode | convention`) contains zero literal
  named entities (people/orgs/tools/products — `ArtifactKind::Entity`'s
  actual definition per the contract), so all 6 collapse to `Concept`. The
  specific kind is preserved as a `kind:` frontmatter field, not a new
  top-level `ArtifactKind` or directory.
- **`project` field** (both Import and Distill tabs already collect one in
  the UI) → stored as a `project:` frontmatter field on whatever kind is
  written. `docs/VAULT_CONTRACT.md` has no `projects/<name>/...` subtree —
  not introducing one. No resolver signature change (no `project` param).

Net: `resolve_write_path(vault_path, kind, slug)` and `default_frontmatter`
are used exactly as they exist today. `ArtifactKind` gains no new variants.
Only new code: a `slugify(title) -> String` helper (none exists in the repo
today) and per-verb prompt construction.

## Agent selection

Reuse the existing `settings.default_ai_agent` user setting, falling back to
`AiAgentId::ClaudeCode` — the same fallback already used at
`commands/ai.rs:378`. No new setting.

## Progress events

`ResearchPanel.tsx` listens for a `rhizome-progress` Tauri event (line
126-145) to drive its live log. The agent layer emits a different,
per-request-scoped event name (`ai-agent-stream-<id>`, ADR-0148). Rather than
changing the panel's listener, each verb's wrapper subscribes to its own
agent-layer stream server-side and re-emits translated `rhizome-progress`
events (mapping `TextDelta`/`ToolStart`/`ToolDone` → the existing progress
line shape). Zero frontend changes required for progress/log behavior.

Cancellation: the agent layer already supports `abort_ai_agent_stream` per
ADR-0148. Whether `ResearchPanel.tsx` needs a new cancel affordance (it may
not have one today) is deferred to implementation — check during build,
small either way.

## `.rhizome/events.jsonl` history log

Currently written by the JS MCP handlers (`appendRhizomeEvent`), read by the
Rust-native `rhizome_read_events` (History tab). Since JS keeps shelling
Python for the MCP path, it keeps writing this log for MCP-triggered runs.
The rebuilt Rust path must also append to it for in-app-triggered runs, or
the History tab silently misses everything done through the UI.

## Staging — simplest pattern first, reuse it twice

1. **4a — Distill.** Simplest shape: prompt → single card write, no file
   conversion. Proves prompt-construction + write-resolver + progress-event
   + history-log pattern end to end with the smallest surface.
2. **4b — Import.** Same shape as distill, plus source acquisition (local
   file / dropped file / URL — markitdown conversion stays a subprocess per
   the architecture doc, unaffected by this rebuild).
3. **4c — Generate** (repo research + wiki). Biggest lift: multi-round agent
   research, then a synthesis/wiki-generation pass, both through the agent
   layer, written as one `RepoWiki` file.

Each stage: TDD, retire that verb's Rust shell-out, verify zero Python
processes spawned for that tab (process-table assertion in a smoke test, per
the architecture doc's own step-4 verification), keep the JS MCP handler
unchanged. Full release-readiness checklist (coverage, Codacy, l10n if any
new UI copy, PostHog event, docs) per stage, matching how 3a/3b landed as
separate commits.

## Risks

- **Frontmatter/body quality depends on prompt design**, not a mechanical
  port — the old regex-parse approach is gone, replaced by asking the agent
  to directly produce contract-conformant markdown. Needs real prompt
  iteration per verb, not just plumbing.
- **Multi-round research (Generate)** may need the agent layer to make
  *multiple* sequential `run_ai_agent_stream` calls (research round(s) then
  synthesis) rather than one — check whether the existing agent layer's
  request/response shape composes cleanly for that, or if it needs a small
  addition (chaining, not a new abstraction).
- **Leaving JS MCP handlers on Python is a deliberate, documented gap**, not
  an oversight — matches the step-3b precedent exactly, but means the "one
  door agents use" end state (per the architecture doc's stated destination)
  isn't reached until the MCP-bridge follow-up lands.
