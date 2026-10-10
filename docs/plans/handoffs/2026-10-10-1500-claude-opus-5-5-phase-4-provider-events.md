---
session: 2026-10-10T15:00Z
model: Claude Opus 5.5
description: >-
  Phase 4 step 2: OpenAI-compatible provider output parsed into
  ModelEvent, a send path that runs no tools, /models discovery,
  URL normalize, and create_note as a vault-bounded function.
---

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · Phase 4 provider side, step 2

## What landed

All in `ai_models.rs`, its new submodule `ai_models/openai_stream.rs`, and
`ai_model_tools.rs`. Nothing calls the new functions yet. Chat still uses
Prime.

- `stream_model_events(request, emit)`: POST `{base}/chat/completions`
  with `stream: true`, emits `ModelEvent`, runs no tools. `emit` returning
  false stops the read. A whole JSON completion is accepted too.
- `OpenAiStreamParser`: Cursor's two rules from the #96 review hold.
  Arguments sent whole on the first chunk still go out as
  `ToolCallArgsDelta`. An error after partials is the single terminal
  event.
- HTTP failures map to `ModelErrorKind` routing classes for Phase 4b.
- `discover_ai_model_ids`: `GET {base}/models`, no cache.
- `normalize_base_url`: trim, strip trailing slashes, http(s) only. A LAN
  host is never rewritten to loopback.
- `create_note(args, vault_path, vault_paths)`: the tool body with no
  model request. The old path calls it.
- `HttpLimits::STREAM` (15 s / 600 s) and `DISCOVER` (15 s / 30 s). Tests
  pass short limits through `*_with` functions.

## Old tool-running path (still live)

`run_ai_model_stream` → `send_openai_compatible_message` →
`execute_openai_tool_calls` runs `create_note` inside the model call.
Callers: `ai_run_target.rs`, `commands/ai.rs` (`run_ai_model_stream` and
`test_ai_model_provider`), `rhizome_distill.rs`, `rhizome_import.rs`.
Remove it when the loop switches over.

## Not done

- The send path takes `AiModelStreamRequest`: one user message and a
  system prompt. Multi-turn history with tool results is the next
  contract. It depends on Cursor's history types.
- Anthropic does not stream events yet.
- `aiModelProviderCatalog.json` is unchanged. The LAN example needs a
  Settings field to show it, and Settings is not in this file set.
