---
session: 2026-11-16T19:00-06:00
model: Claude Opus 5.5
description: ADR-0191 step 4, the approval bridge that lets Claude Code ask Rhizome before a tool runs.
---

# Claude Code engine, step 4: approval bridge

**Origin:** Claude Opus 5.5 · 2026-11-16 · cloud session, part of the ADR-0191 build. Stacked on step 3 (`feat/claude-code-safe-invocation`).

## How an ask flows

1. `ai_agents::run_with_approval_broker` starts an `ApprovalBroker` (`claude_code_approval.rs`) on 127.0.0.1 with a fresh 64-hex token, one per turn.
2. The engine runs `claude` with `--permission-prompt-tool mcp__rhizome_approval__approve` instead of `--permission-prompts none`.
3. `rhizome_approval` is its own MCP server (`mcp-server/approval-server.js`). It has one tool and no vault access. `--tools` still lists `mcp__rhizome__*`, which does not match it, so the model never sees it.
4. The MCP config with the token goes in an owner-only temp file, so the token is never in `argv`. The file is deleted when the run ends.
5. `approval-bridge.js` sends one JSON line to the broker. The broker emits `AiAgentStreamEvent::ApprovalRequested`. The existing approval card renders it through `streamAiAgent.ts`. The answer goes back through `reply_ai_agent_approval`.

## Rules

- Reads inside the chat's vaults allow with no card. Reads outside deny with no card. Paths are canonicalized, so `..` and symlinks out of the vault deny.
- Edits and writes inside the vaults ask. Outside, they deny.
- Bash and every other tool ask.
- The card offers Allow once and Deny. There is no session grant.
- Every failure denies: wrong token, bad request, the turn ending, ten minutes with no answer, the broker unreachable, an answer that is not exactly allow or deny.
- If the broker cannot start, the run falls back to step 3's `--permission-prompts none`.

## Threads

Claude Code blocks on stdout while it waits, so the claude run moves to a scoped worker thread. The worker keeps the stream id, so `abort_ai_agent_stream` still finds the child. The calling thread hands every event to `emit`, so callers need no `Send` emitter.

## Open

- The `--permission-prompt-tool` contract is the documented one (`{"behavior":"allow","updatedInput":...}` or `{"behavior":"deny","message":...}`). Probe Q3 and Q10 will confirm it on 2.1.325.
- The card's Bash preview keys on the native tool name `bash`. Claude Code's `Bash` shows its JSON args for now. Polish in step 7 QA.
- Native chat (step 5) will reuse this broker for Claude Code sessions.

## Tested

`cargo test --lib -- claude_ ai_agents` (128 pass), clippy `-D warnings`, rustfmt, `node --test` for all MCP tests (125 pass), the `streamAiAgent` vitest file, `tsc`, eslint. A stdio smoke test ran the bundled `approval-server.js` against a fake broker: it listed only `approve`, allowed Bash and denied Edit.
