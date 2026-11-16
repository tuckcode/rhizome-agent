---
session: 2026-11-16T19:30-06:00
model: Claude Opus 5.5
description: ADR-0191 step 5, Claude Code turns in the native chat log, resume, read-only on a lost conversation, SIGINT-first cancel.
---

# Claude Code engine, step 5: sessions

**Origin:** Claude Opus 5.5 · 2026-11-16 · cloud session, part of the ADR-0191 build. Stacked on step 4 (`feat/claude-code-approval-bridge`).

The engine is still hidden. No chat has the `agent:claude_code` target until the step 6 picker makes one, so nothing here changes what users see.

## How a turn runs

1. `resolve_native_target("agent:claude_code")` is the new `NativeChatTarget::ClaudeCode`. `start_named_request` and `open_named_session` build a `ClaudeCodeEngine` (`engines/claude_code.rs`) for it. The saved header target decides the engine on reopen, so a chat is locked to its engine.
2. Native chats now drive a small trait, `ChatEngine` / `ChatControl` (`engines/mod.rs`). `NativeEngine` implements it by delegating, so Rhizome's own loop is unchanged.
3. Each turn calls `ai_agents::run_claude_engine_turn`: the step 3 profile, the step 4 approval broker, plus `--session-id <id>` on the first turn and `--resume <id>` after. The id must parse as a UUID before it goes on the command line.
4. Turns go to the native log through `NativeSessionWriter`, so the ADR-0183 redaction runs on every line: `User`, `Assistant` (flushed before each tool call), `ToolCall`, `ToolResult`, then `TurnEnd`, `Cancelled` or `ModelFailed`.

## The conversation id

- Rhizome picks a UUID and keeps it in a sidecar beside the log: `<session>.claude-code.json` with `session_id`, `started` and `resume_failed`. Session listing only reads `.jsonl`, so the sidecar is not mistaken for a log. Deleting the chat deletes the sidecar; Claude Code's own copy of the conversation is the user's and is left alone.
- Nothing reads `~/.claude/projects/` or any Claude credential.
- If the app quit after Claude made the conversation but before Rhizome saved that, `--session-id` reports "already in use". The engine marks it started and resumes once.

## Read-only

- "No conversation found" on a resume sets `resume_failed`. The turn ends with "Claude Code no longer has this conversation, so this chat is read-only. Start a new chat to keep going." Later sends get the same message without running `claude`.
- A Claude Code log with turns but no sidecar is treated the same way.
- `open_native_session_record` reports both as `read_only` with that message, so the chat opens read-only after a restart.

## Cancel

- `ai_agent_processes::interrupt_stream` sends SIGINT, then SIGTERM, then SIGKILL, 3 seconds apart, on its own thread. Windows kills at once (no SIGINT for a child). The existing `abort_stream` (SIGKILL) is unchanged for the other agents.
- A cancel that arrives before the child is registered keeps retrying for 2 seconds while the turn runs.
- Quit maps to cancel with cause `quit`.
- Approval replies other than Allow once deny, so no session grant reaches Claude Code.

## Frontend

- `nativeSessionTarget.ts`: `CLAUDE_CODE_SESSION_TARGET` and `isClaudeCodeSessionTarget`.
- `resolveNativeChatTarget` keeps `agent:claude_code` instead of swapping in a default model.
- `usesNativeChatStream` takes the open chat's saved target. A chat saved as Claude Code stays on the native stream whatever the composer shows. The external Claude Code agent path is untouched until a chat is saved with that target.

## Open

- A fork of a Claude Code chat has no conversation id, so it opens read-only. Step 7 QA can decide whether a fork should start a fresh conversation instead.
- A denied tool is saved as a `ToolResult` with Claude's deny text, not `ToolDenied`. Polish in step 7.
- A log that rolls over at 100 MiB (`append_or_roll`) is not handled for Claude Code; the save error shows once and the turn continues.
- Probe Q5 (what `--resume` prints for a missing id) and Q8 (SIGINT) will confirm the strings and signals on 2.1.325.

## Tested

`cargo test --lib` (full; 10 tests outside this change fail in the cloud container because it runs as root, which ignores read-only modes, and its PID 1 does not reap zombies: `board` read-only moves, `atomic` and `write_file` read-only files, `provider_keys` failed legacy write, three `shell` process-group tests), clippy `--all-targets -D warnings`, rustfmt, `tsc`, eslint on the changed files, and the full vitest run (9587 pass; the three `SheetEditor` files fail to load here because this worktree borrows `node_modules` from another checkout and Vite denies its wasm path). New tests: 14 engine tests (log contents, sidecar removed on delete, resume across a restart, lost conversation, missing sidecar, already-in-use, cancel, model failure, approvals, no vault, redaction, Allow once only), 3 `interrupt_stream` tests (SIGINT first, escalation to SIGKILL, unknown stream), 4 session-arg tests, 4 native chat routing tests, and frontend routing tests. The local Playwright smoke suite has not run from this cloud session.
