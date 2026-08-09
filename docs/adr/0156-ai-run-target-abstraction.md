---
type: ADR
id: "0156"
title: "AiRunTarget: let a direct-API model power Distill and Import (agent-optional)"
status: active
date: 2026-07-17
---

## Context

Distill and Import both build a prompt, ask an AI to structure it, then
parse + write + log the result. Until now the "ask an AI" step went only
through `run_ai_agent_stream` — a locally installed CLI agent (Claude Code,
Codex, opencode, …). A new user who has an API key but no CLI agent
installed could configure a direct-API model (Wave 1/2 landed
`ai_model_providers` in settings and `run_ai_model_stream` in
`ai_models.rs`), yet the two most valuable first-run write verbs still
required a CLI. That is the highest-value new-user crack: the machinery to
call a direct-API model already exists and already emits the *same*
`AiAgentStreamEvent` enum the distill/import callbacks consume, so a
direct-API call slots in behind the agent-stream call with no
event-mapping work.

Three facts make this cheap and safe:

1. `run_ai_model_stream(request, emit)` emits `Init`, one `TextDelta` with
   the full response, then `Done` — structurally identical to what the
   distill/import accumulation closure already handles.
2. Key resolution (override → provider `local_file` → `env`) already lives
   in `ai_models.rs`; nothing new is needed to authenticate.
3. `ai_agents.rs` already has a generic-runner-injection shape
   (`run_shared_agent_stream<F, R>(… runner: R, emit: F)`) for testing an
   agent branch without shelling a real CLI. The new API-model branch
   follows the same shape so its unit test injects a canned completion
   instead of hitting a network endpoint.

## Decision

### 1. New `AiRunTarget` type (new module `src-tauri/src/ai_run_target.rs`)

A new small module owns the abstraction, its string parser, and the shared
"run a prompt against whichever engine" step. It does **not** live inside
`ai_agents.rs` (that file is agent-CLI-specific) or `rhizome_distill.rs`
(distill-specific) because both distill *and* import consume it.

```rust
pub enum AiRunTarget {
    Agent(crate::ai_agents::AiAgentId),
    ApiModel {
        provider: crate::ai_models::AiModelProvider,
        model_id: String,
    },
}
```

`Agent` carries the same `AiAgentId` the CLI path always used. `ApiModel`
carries a fully-resolved provider (cloned from settings) plus the chosen
model id — everything `run_ai_model_stream` needs, so no second settings
lookup happens downstream.

### 2. String parsing that round-trips the frontend target-id format

`src/lib/aiTargets.ts` already produces two id shapes: `agent:<id>` and
`model:<providerId>/<modelId>`. The parser accepts both, **plus** a bare
`<agentId>` for backward compatibility with the legacy `agent` arg (which
sent just `"codex"`, not `"agent:codex"`). This makes the change a strict
superset — every string the old dispatch code accepted still resolves.

- `agent:<id>` / bare `<id>` → `Agent(parse_agent_id(id))`
- `model:<providerId>/<modelId>` → find the provider by id in
  `settings.ai_model_providers`, find the model by id →
  `ApiModel { provider, model_id }`

Parsing is split into a pure inner function taking an explicit provider
slice (`from_arg_with_providers`) and a thin wrapper that loads settings
(`from_arg`) — mirroring `ai_models.rs`'s
`api_key_from_env` / `api_key_from_env_with_lookup` split, so the parser is
unit-testable without touching global settings.

### 3. Explicit, non-silent fallback on parse failure

If a `model:` string names a provider that no longer exists (the user
removed it after it was set as default), or model lookup fails, `from_arg`
returns `None`. `rhizome_api::distill`/`import_source` then fall back to
`AiRunTarget::Agent(resolve_default_agent_id())` — the exact same fallback
the old `agent: Option<…>` signature used. The request still runs on the
default agent; it is never panicked on or silently dropped. This is the
safety net for a stale persisted target string, and is deliberately kept
distinct from the *user-facing* fallback below.

### 4. Frontend contract change: `target` supersedes `agent`

`ResearchPanel.tsx` sends `target: aiTarget.id` (verbatim, e.g.
`"agent:codex"` or `"model:openai/gpt-4o"`) on every Distill/Import job,
replacing the old conditional `agent` arg. The three backend dispatch
sites read `args.get("target").or_else(|| args.get("agent"))`, so any
external MCP caller still passing `agent` keeps working. Nothing sends both.

### 5. Preflight CTA: "Run with your API key" (explicit, per-action, non-persistent)

`preflightAiTarget` already returns `{ state: 'ready' }` for `api_model`
targets and only `blocked` for a missing/unauthenticated CLI agent — that
stays as-is. When the resolved default target is a **blocked agent** AND the
user has **at least one configured `api_model` provider**, the panel offers a
one-click "Run with your API key" CTA next to the existing install-link
alert.

Clicking it sets a **session-local override** (`useState`, not persisted)
to the first configured `api_model` target. That override becomes the
effective target for **Distill and Import only**; it does not touch
`settings.default_ai_target`. The blocked-agent alert's install link
remains available for users who would rather install the CLI.

We chose explicit over silent fallback: a user with a broken/missing agent
sees exactly what will run and opts in, rather than the app quietly
swapping engines behind their back.

### 6. Out of scope, staying agent-only

`rhizome_generate_wiki` (repo research) needs an agentic, multi-file
writing loop that a single direct-API completion cannot perform.
`rhizome_api::repo_research` keeps its `agent: Option<AiAgentId>`
signature unchanged, and the API-key CTA is **not** offered for Generate —
its preflight stays agent-only and shows the install message when blocked.

## Consequences

Easier: an API-key-only user can Distill and Import on first run with no CLI
install. The API-model branch reuses the existing parse/write/event pipeline
and key resolution wholesale — no parallel machinery.

Known limitation: the Anthropic direct-API path in `ai_models.rs` is
**non-streaming** — `run_ai_model_stream` emits a single `TextDelta` with the
full response rather than token-by-token deltas. The Research panel live log
therefore shows one large chunk for Anthropic-backed distills instead of a
progressive stream. This is acceptable for Wave 3 (the card still writes
correctly); revisit if progressive output on the API path becomes a felt
need.

Harder: there are now two engine kinds behind the same two verbs. Analytics
gain an `engine` property on `research_distill` (`'agent'` for CLI, or the
provider kind — `'anthropic'`, `'open_ai'`, … — for API models) so adoption
of each path is visible. Contributors adding a third write verb must decide
explicitly whether it is target-capable (like distill/import) or agent-only
(like repo research).
