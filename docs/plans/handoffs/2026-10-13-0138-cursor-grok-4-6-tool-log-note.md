---
session: 2026-10-13T01:38Z
model: Grok 4.6 (Cursor)
description: >-
  T-B1: rewrite raw agent-run dumps at the create_note and promote save
  steps into an H1, the answer, and one collapsed run log.
commits: uncommitted
---

# Tool log note — T-B1

**Origin:** Cursor Grok 4.6 · 2026-10-13 · G-baby blockers brief PR 3.

## What changed

The dump is not built in this repo. Agents pass the terminal log as
`create_note` content (or the user promotes that text). The save step
now rewrites it when it looks like a run log:

- H1 is the title.
- The answer is the body.
- One collapsed `Run log · N tools · duration` block.
- One mono row per tool. No "is running" duplicates.
- Lifecycle lines only on failure.
- `agent` and `mode` go in frontmatter (T-W2).

Ordinary notes are unchanged.

Paths: `src/utils/formatAgentRunNote.ts` (promote),
`mcp-server/format-agent-run-note.js` (MCP create_note),
`src-tauri/src/agent_run_note.rs` (native create_note).

## Tests

- `pnpm exec vitest run src/utils/formatAgentRunNote.test.ts src/utils/promoteChatToVault.test.ts`
- `node --test mcp-server/tool-service.test.js`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib agent_run_note`

## Click-through (Bubs)

Run an agent that uses several tools and open the note it wrote. The
answer is the first thing you see, there is one collapsed run log, and
opening it shows one row per tool.
