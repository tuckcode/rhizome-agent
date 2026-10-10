---
session: 2026-10-10T19:00Z
model: Claude Opus 5.5
description: >-
  Multi-turn send path and ProviderModel, the provider impl of the Rhizome
  loop's Model trait. The loop runs end to end against a local test
  server. Test builds only; rhizome_loop not edited.
---

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · Phase 4 multi-turn path and provider adapter

## What landed

- `ai_models::stream_chat_events_with`: streams caller-built OpenAI
  messages and tool definitions. Runs no tools.
- `src-tauri/src/rhizome_provider_model.rs`: `ProviderModel` implements
  `rhizome_loop::Model`. `openai_messages` maps `ModelView` to OpenAI
  messages (`tool_calls[].id`, `role: "tool"` with `tool_call_id`).
  Test builds only, because `rhizome_loop` is `#[cfg(test)]`.
- `ai_models/test_server.rs`: the local HTTP test server, shared by both
  test modules.

## For Cursor (loop owner)

- `ModelView` does not mark where the current turn starts. The driver
  adds the admitted message to history only at turn end. `ProviderModel`
  tracks the start itself. A `turn_start` field on `ModelView`, or the
  driver adding the user message at turn start, would remove that.
- `ModelView.offered_tools` carries names only. The adapter sends the
  real `create_note` schema and an open object schema for other names.
- `AgentLoop::run_until_idle` drives the model inside a tokio runtime.
  A blocking HTTP client panics when it drops there, so the adapter runs
  the call on a scoped worker thread.

## Not done

- Moving the old tool path's callers to the loop.
- Taking `rhizome_loop` out of test-only builds.
