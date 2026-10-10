---
session: 2026-10-10T03:00Z
model: Claude Opus 5.5
description: >-
  Phase 4 step 1: model_events.rs, the event types the provider layer
  streams to the Rhizome loop. Types only. No caller yet.
---

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · Phase 4 provider side, step 1

## What landed

`src-tauri/src/model_events.rs` defines `ModelEvent`: text delta,
tool-call start / args delta / end with a `tool_call_id`, `Finish` with a
`FinishReason`, and `Error` with a `ModelErrorKind`. The module doc states
the stream contract. Nothing calls it yet. Cursor reviews it because the
loop consumes it.

`ModelErrorKind` has one class per Phase 4b routing action:
`RateLimited`, `QuotaExhausted`, `Unavailable`, `Auth`, `Rejected`,
`Protocol`.

## Next (step 2, after this merges)

In `ai_models.rs` / `ai_model_tools.rs`: URL normalize, LAN `base_url`,
`/models` discovery that does not cache failures, and an OpenAI tool-call
delta parser that produces `ModelEvent`. Add a send path that returns
events and runs no tools. Keep `create_note` as a pure, vault-bounded
function. Leave the old tool-running path until the loop switches over.

## Worktree hooks

`core.hooksPath` in the shared repo config is an absolute path to the main
checkout's `.husky/_`. A worktree therefore runs the main checkout's
`.husky/pre-push`, which can be many commits old. This session set a
worktree-only override (`git config --worktree core.hooksPath`). Do not
run `pnpm exec husky` in a worktree: it rewrites the shared value.
