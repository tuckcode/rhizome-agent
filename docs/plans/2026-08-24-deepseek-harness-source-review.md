# DeepSeek harness source review — 2026-08-24

## Executive answer

**“DeepSeek harness” should now refer first and concretely to the official
[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
repository and its `dsh` runtime.** DeepSeek does ship a unified agent harness:
an MIT-licensed, plugin-composed TypeScript runtime with Web, headless, ACP, and
JSON-RPC entry paths. This review is pinned to commit
[`b150a551`](https://github.com/deepseek-ai/deepseek-harness/tree/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e),
tagged `dsh-v0.1.1-rc.2`. The project calls itself a **developer preview** and
warns that compatibility-breaking changes are expected, so it is a legitimate
comparison target but not a stable dependency candidate
([README](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/README.md)).

Two adjacent DeepSeek artifacts should be kept separate:

1. **DeepSeek model/API behavior** — thinking-mode tool calls, reasoning
   passback, strict function schemas, and provider-side context caching. These
   are adapter/runtime requirements, not a harness product
   ([Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/),
   [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/),
   [Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)).
2. **DeepSeek-V3.2 training and evaluation machinery** — large-scale synthesized
   agent environments, internal evaluation frameworks, and benchmark context
   management. These are research methods, not the released `dsh` runtime
   ([DeepSeek-V3.2 report](https://arxiv.org/abs/2512.02556)).

For Rhizome, the main conclusion is not “replace Prime with DeepSeek Harness.”
The high-value comparison is architectural: event-sourced replay, explicit
live-versus-durable state, guarded tool execution, provider-neutral message
types, subagent visibility, and layered evaluation. Prime remains the execution
core. Rhizome should borrow contracts and UX patterns at the Prime client
boundary while retaining ownership of desktop UX and durable Markdown memory.

## Scope and method

Primary sources only:

- official DeepSeek Harness repository documentation and package contracts,
  pinned to `b150a551`;
- official DeepSeek API documentation;
- the official DeepSeek-V3.2 technical report and release note.

Community plugins, discussions, tutorials, third-party integrations, and
secondary summaries were excluded from evidence. DeepSeek Harness is changing
quickly, so pinned source links are used wherever possible.

Classification vocabulary:

- **TAKE** — adopt the mechanism or invariant in Rhizome's Prime-facing layer.
- **ADAPT** — preserve the idea but implement it through Prime/Rhizome's existing
  ownership split.
- **REJECT** — conflicts with Prime-first execution, Markdown-first memory, or
  Rhizome's trust posture.
- **DEFER** — potentially useful, but only after Prime exposes the necessary
  capability or Rhizome has evidence of user need.

## What the official DeepSeek Harness actually is

DeepSeek Harness is a composable runtime in which the session log, prompt
assembler, tool registry, agent loop, model adapters, persistence, compaction,
subagents, permissions, SDKs, and UI are all plugins over vendored Cordis.
Profiles layer bundles plus user patches into one plugin tree; the shipped
`web` and `headless` profiles are two compositions of the same runtime
([Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/architecture.md),
[repository layout](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/AGENTS.md)).

Its reusable conceptual spine is:

`inbox → turn → one or more steps → model stream → tool pipeline → durable events → derived next request`

A **step** is one model request and its tool calls. A **turn** drains admitted
input through zero or more steps until nothing more is owed. Follow-ups,
steering, and injected context enter one inbox but target different admission
boundaries. Durable `turn/*`, `step/*`, user, assistant, and tool events are
separate from live `agent/*` coordination events
([turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/architecture.md#turn-flow),
[agent lifecycle](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/agent-lifecycle.md)).

The project is broader than a sample loop. It includes filesystem and shell
policy, persistent terminals, LSP, MCP, skills, planning, goals, jobs,
compaction, subagents, experimental agent teams, Web UI components, TypeScript
and Python SDK projections, and replay/e2e infrastructure
([repository layout](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/AGENTS.md)).

## Dimension-by-dimension analysis

### 1. Agent loop

The default loop is concrete but replaceable. Plugins depend on the public
`Agent` interface rather than the loop implementation. Each agent exposes one
session identity, current provider/model options, a durable session, an inbox,
status, scoped plugin context, cancellation, idle waiting, maintenance, and
three delivery aliases: follow-up, steer, and inject
([Core](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/core.md)).

Important mechanics:

- input admission is explicit and durable rather than an incidental array in
  UI state;
- cancellation has a caller cause and can preserve unclaimed inbox work;
- `whenIdle()` observes whole-agent quiescence, not the result of one prompt;
- a prompt receipt identifies inbox admission, not an eventual assistant
  message;
- plugins intercept pre-step, request, error recovery, and turn stopping
  without patching the loop
  ([Core](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/core.md),
  [Lifecycle](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/agent-lifecycle.md)).

**Verdict — ADAPT.** Prime already owns Rhizome's loop, queue, steering, session
lifecycle, cancellation, and idle state. Rhizome should adopt the semantic
distinctions—admission receipt versus completion, queued versus claimed,
steering versus follow-up, live coordination versus durable transcript—without
introducing another driver.

**Verdict — TAKE.** The desktop boundary should represent mid-turn messages and
stops as explicit typed states. Rhizome's current accepted / no-longer-running /
transport-failure distinction is directionally aligned; queue visibility and
claim/discard events should remain a Prime-surface priority.

**Verdict — REJECT.** Do not embed `dsh-agent-loop`, translate Prime events into
a second authoritative loop, or make Rhizome responsible for turn settlement.

### 2. Tool use and policy

Tools are registered definitions with separate model schema, execution,
canonical value, durable rendered content, timeout/concurrency metadata, and
optional UI presentation. Calls pass through:

`pre-policy → monotonic guards → around-execution wrappers → tool body → post-policy → finalization → immutable result`

Approval failure, a missing approval channel, or an unanswerable approval
request denies the call. Monotonic guards can only deny; listener ordering
cannot turn a denial back into permission. Parallel-safe calls can run in a
bounded rolling pool while exclusive calls form barriers. The durable call is
logged before execution and the normalized outcome after it
([Tools](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/tools.md),
[pipeline diagram](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/tool-execution-pipeline.md)).

Tool definitions also carry provider-neutral render intent for generic,
terminal, diff, search, and read cards. Presentation is derived from arguments
and normalized results rather than guessed from prose in the UI
([Tools](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/tools.md)).

DeepSeek's direct API does not execute tools. It emits function calls; the
caller executes them and returns `tool` messages. Beta strict mode validates a
supported JSON Schema subset
([Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)).

**Verdict — TAKE.** Preserve typed tool-call identity, immutable final outcome,
and tool-owned render intent in the Prime-to-Rhizome event normalization layer.
These produce better desktop cards and make replay trustworthy.

**Verdict — ADAPT.** Approval and sandbox policy must remain Prime-owned.
Rhizome may render Prime's approval request and active permission state, but
must not build a second enforcement path.

**Verdict — TAKE.** Fail closed when an approval cannot be answered, and never
let a later UI/plugin layer broaden an earlier denial.

**Verdict — REJECT.** Do not simulate tool results as ordinary user messages.
DeepSeek's own V3.2 report says this pattern prevents its thinking-mode
reasoning retention from working as intended
([V3.2 §3.2.1](https://arxiv.org/html/2512.02556v1#S3.SS2.SSS1)).

### 3. Reasoning

The harness message vocabulary treats reasoning as a distinct content block,
alongside text, images, tool calls, and tool results. Provider/model identity
and adapter-private replay data travel with assistant messages. The provider
adapter owns exact reasoning-effort choices; the core does not assume a global
enum
([LLM Streaming](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/llm-streaming.md)).

The official DeepSeek adapter supports deployment-level thinking policy and
per-request `off`, `low`, `high`, and `max` effort. The resolved choice is
logged in the request header. For DeepSeek thinking-mode tool calls, historical
`reasoning_content` is passed back while the tool-use sequence continues
([DeepSeek adapter](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/llm/llm-deepseek/README.md),
[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)).

The V3.2 report explains the model-side rule: retain historical reasoning while
only tool messages are appended; discard it when a new user message begins,
while preserving tool-call and tool-result history. The goal is to avoid
re-reasoning from scratch between tool calls
([V3.2 §3.2.1](https://arxiv.org/html/2512.02556v1#S3.SS2.SSS1)).

**Verdict — ADAPT.** Prime should own reasoning effort and provider-specific
reasoning passback. Rhizome should faithfully expose the selected thinking
level, stream declared reasoning blocks when Prime sends them, and retain
provider/model attribution.

**Verdict — REJECT.** Rhizome must not reconstruct, edit, or depend on hidden
chain-of-thought. Reasoning text is operational session material, not durable
knowledge and not a substitute for a user-facing explanation.

**Verdict — TAKE.** Preserve the distinction between reasoning, visible answer,
tool call, and tool result all the way into the transcript renderer; flattening
them destroys adapter and UX semantics.

### 4. Context management

DeepSeek Harness makes the append-only session log the source of truth and
derives model history from a current **surface** over that log. Compaction does
not delete canonical events. It appends a summary plus a surface-replacement
event that shadows a balanced range for future model requests. Tool call/result
pairs cannot be split, and compaction start/summary/end records make interrupted
operations detectable
([Sessions](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/session.md),
[Compaction](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/compaction.md)).

Every model-visible request input is reconstructable from the log. The request
header records system prompt, tool schemas, route capacity, and request
configuration; raw stream chunks are retained for replay and UI fidelity
([Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/architecture.md#session-log),
[Sessions](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/session.md)).

At the provider layer, DeepSeek context caching is automatic and prefix-based.
The API reports cache-hit and cache-miss token counts. Cache entries are
best-effort and ephemeral, usually clearing within hours to days
([Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)).

The V3.2 report also describes test-time context strategies for long search
trajectories: summarize, discard the oldest 75%, or discard all prior tool
history. In its BrowseComp experiment, discard-all outperformed summarization
on efficiency and score, while the report explicitly warns that compute cost
must be part of the comparison
([V3.2 §4.4](https://arxiv.org/html/2512.02556v1#S4.SS4)).

**Verdict — TAKE.** Treat canonical session events and the current
model-visible projection as different questions. Rhizome already distinguishes
Prime's saved log from live daemon state; the same rigor should apply to
post-compaction transcript versus current model context.

**Verdict — ADAPT.** Surface compaction status, replaced ranges, context usage,
and failure to compact when Prime exposes them. Prime remains the only component
allowed to decide what is in its next model request.

**Verdict — ADAPT.** Keep stable prompt/tool prefixes where Prime's protocol
allows it and expose cache-hit telemetry for cost diagnosis, but do not distort
active-note context merely to chase provider cache hits.

**Verdict — REJECT.** Do not implement a separate Rhizome summarizer or
discard policy over Prime transcripts. The paper's test-time strategies are
experimental model-evaluation techniques, not a mandate for desktop ownership.

### 5. Multi-agent behavior

The shipped subagent seam supports multiple named providers: fresh in-process
children, forked children, ACP, Codex, Claude Code, and DSH SDK backends.
Requests declare capabilities such as depth limit, persona, tool filtering,
structured output, and continuability; unsupported combinations fail before a
child starts
([Subagents](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/subagent.md)).

Continuable subagents have durable child sessions and process-local
activations. Parent/child ownership, cold resume, interrupt, settlement, and
child-first teardown are explicit. Subagent descriptors survive compaction in
the append-only log. The Web UI exposes lineage navigation, descendant counts,
activity, duration, token usage, and read-only versus continuable composer
states
([Subagents](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/subagent.md),
[subagent UI](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/client/ui-subagent/README.md)).

Agent Teams are explicitly experimental. They add a durable roster, peer
mailbox, compare-and-set task DAG, advisory write scopes, and a Lead-owned
coordination service
([Agent Teams](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/agent-team.md)).

The V3.2 paper's “multi-agent pipeline” is a **training-data synthesis**
pipeline: question construction, heterogeneous candidate generation, and
verification agents. It is not the product's runtime coordination model
([V3.2 §3.2.3](https://arxiv.org/html/2512.02556v1#S3.SS2.SSS3)).

**Verdict — TAKE.** Rhizome should show Prime subagent lineage, status,
durable-versus-live state, token use, and interruption as first-class UI as soon
as the corresponding Prime daemon surface is integrated.

**Verdict — ADAPT.** Reuse the distinction between a durable child session and
a live activation. In Rhizome terms, a saved subagent transcript is not proof
that work is still running.

**Verdict — DEFER.** Team roster, mailbox, and task-DAG UI should wait for a
Prime-owned equivalent. Building a Rhizome-only team runtime would duplicate
Prime's RLM/subagent system.

**Verdict — REJECT.** Do not cite DeepSeek's training-data multi-agent pipeline
as evidence for a production orchestration API.

### 6. Model routing

DeepSeek Harness routes each request by an explicit provider key and model id.
Adapters own provider-specific protocol, context capacity, reasoning options,
retry policy, and private replay data. Catalog membership is advisory; the
serving adapter remains authoritative for an exact route
([LLM Streaming](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/llm-streaming.md)).

The Web UI supports DeepSeek, catalog providers, custom OpenAI-compatible
providers, and per-session model selection. A session that has sent a request
keeps the provider/model recorded in its log. Credentials are write-only in the
UI and stored by reference outside ordinary settings
([Provider guide](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/user/guide/providers.md)).

This is **provider routing**, not an automatic policy router that selects a
different model from task signals. The agent options name a provider and model;
workflows may receive a deployment-owned subagent provider but scripts cannot
change it
([Core](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/core.md),
[Workflow](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/workflow.md)).

**Verdict — TAKE.** Record and display the physical provider/model that answered
each assistant message, independently of a logical user-selected route.

**Verdict — REJECT.** Rhizome must not create a second provider registry,
credentials store, retry policy, or model selector beside Prime. Prime owns
providers and model state.

**Verdict — DEFER.** Dynamic task-based model routing remains a separate
experiment behind Prime. DeepSeek Harness does not supply evidence for doing it
inside Rhizome.

### 7. Deployment and runtime ownership

The official Web path starts a local Node process and serves a browser UI on
loopback by default. The HTTP host has no TLS, authentication, or origin policy;
binding to all interfaces is an explicit network exposure
([README](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/README.md),
[Web server](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/web-server.md)).

The headless profile creates one persisted agent, submits one task, waits for
quiescence, flushes, prints the last assistant text, and exits. It opens no
port. The JSON-RPC SDK server instead runs newline-delimited JSON-RPC over
stdio, streams durable events and agent status, and owns its agents until
process shutdown
([Headless bundle](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/bundle/headless/README.md),
[SDK server](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/sdk/server/README.md)).

These sources describe process-owned runtimes, not a shared, separately managed
daemon equivalent to Prime's resident service.

**Verdict — REJECT.** Do not start DSH's Web server, headless runner, or SDK
server behind Rhizome. Prime already owns execution and session runtime.

**Verdict — ADAPT.** DSH's separation of runtime events from client projections
is useful for Rhizome's Prime socket client, but runtime lifetime and teardown
must follow Prime's client-owned/resident session model.

**Verdict — REJECT.** Do not infer that closing a UI should leave work running.
DeepSeek's process-owned modes do not resolve Rhizome's foreground-ownership
decision; ADR-0167 remains the governing policy.

### 8. Memory

DeepSeek Harness's core durable state is its session event log. Compaction,
goals, plans, todos, subagent descriptors, and other operational facts are
projections over that log. This is agent continuity, not a durable human
knowledge base
([Sessions](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/session.md),
[Goals](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/goal.md)).

DeepSeek explicitly declined a native vendor memory layer. Its official memory
examples are default-off MCP overlays; storage, account, embeddings, migration,
retry, and crash recovery remain upstream responsibilities. The decision says
there is no memory preset registry, vendor-specific memory plugin, universal
memory service, installation UI, migration layer, health checker, or reconnect
controller
([memory MCP decision](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/.agents/notes/implemented/feature/2026-07-31-third-party-memory-mcp-examples.md)).

Ralph workflows call the shared workspace “long-term memory” across fresh child
rounds, with one bounded structured handoff. The package also admits that
uncommitted conversational reasoning disappears and no independent evaluator
verifies completion
([Ralph](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/workflow/tool-ralph/README.md)).

**Verdict — TAKE.** Preserve the distinction between operational session memory
and durable user knowledge. This strongly supports Rhizome's existing split:
Prime session logs for continuity; Markdown vault for knowledge.

**Verdict — ADAPT.** Use Rhizome's MCP/tools as the explicit bridge from chat or
subagent output into Markdown. Provider-owned memory tools may interoperate, but
they should not become the source of truth.

**Verdict — REJECT.** Never treat a DSH/Prime transcript, compaction summary,
goal record, plan, or hidden reasoning trace as equivalent to a vault note.

**Verdict — REJECT.** Do not add a generic third-party memory registry merely
because DSH demonstrates MCP interoperability. Rhizome already owns the memory
product and its user-legible storage format.

### 9. Evaluation

DeepSeek Harness has a strong product-runtime testing ladder:

- package unit tests and per-file coverage;
- real-API e2e against live models;
- keyless replay snapshots over JSON-RPC, persisted logs, and headless
  scenarios;
- browser snapshots over replayed sessions;
- published-artifact and real-composition tests;
- external verification of world state rather than assertions against the
  agent's self-report
  ([Testing policy](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/testing.md)).

The official V3.2 report is a separate model-evaluation source. It evaluates
thinking-mode function calling on Terminal Bench, SWE-bench, BrowseComp,
`tau²`-Bench, MCP-Universe, MCP-Mark, and Tool-Decathlon. Some MCP evaluations
use DeepSeek's internal environment; the paper does not publish that environment
as the `dsh` product. It also reports excessive self-verification and
context-length overruns as practical weaknesses
([V3.2 §4.1](https://arxiv.org/html/2512.02556v1#S4.SS1)).

**Verdict — TAKE.** Add a Prime live-daemon integration lane that replays
recorded events and separately runs a small number of real-daemon, real-tool
journeys. This is the highest-value lesson for Rhizome's current mocked-daemon
blind spot.

**Verdict — TAKE.** Assert external state—file contents, tool effects, session
roster, and UI projection—not the agent's prose claim that work succeeded.

**Verdict — ADAPT.** Snapshot the assembled Prime-to-Rhizome event projection
and desktop tool cards. Do not snapshot provider prose more broadly than needed.

**Verdict — REJECT.** Do not call DeepSeek's internal benchmark environment a
public reusable harness. The reusable public harness is `deepseek-harness`; the
paper's internal environments are evidence about model behavior only.

### 10. UX implications

The official Web UI makes workspace selection a prerequisite for task input and
offers model settings, session creation, file edits, commands, delegation,
plans, and approval prompts
([Web UI guide](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/user/guide/index.md)).

More distinctive UX patterns are in the package contracts:

- tool definitions provide render intent instead of forcing clients to infer
  cards from text;
- subagent lineage is navigable from the parent conversation and exposes
  durable rows separately from running activity
  ([subagent UI](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/client/ui-subagent/README.md));
- a trajectory view renders a turn-aware event ledger with steps, tools,
  timing, token usage, compaction, and virtualized history without altering
  model context
  ([Trajectory](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/client/ui-trajectory/README.md));
- permission presets combine sandbox and approval labels for display, while
  enforcement remains in the underlying services
  ([Permission Presets](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/permission-presets.md)).

**Verdict — TAKE.** Prefer event-native transcript nodes and tool-owned card
metadata over string heuristics.

**Verdict — TAKE.** Make subagent lineage, live status, queue state, compaction,
model attribution, token usage, and runtime duration observable without placing
them in model context.

**Verdict — ADAPT.** A trajectory/debug view is valuable for advanced users and
for diagnosing Prime integration, but Rhizome's primary surface should remain
chat-first rather than reproducing DSH's full developer console.

**Verdict — REJECT.** Do not require a workspace/vault before chat. DeepSeek
Harness is coding-workspace-first; Rhizome's decided posture is that chat works
without a vault and memory depth appears when one is attached.

## Cross-cutting decision ledger

### TAKE

1. **Durable event stream versus live coordination stream.**
2. **“Model-visible means logged”** for anything Rhizome is expected to replay
   or explain.
3. **Provider/model attribution per assistant response.**
4. **Typed tool identity, immutable outcomes, and tool-owned render intent.**
5. **Fail-closed approvals and monotonic denials.**
6. **Subagent lineage and durable-versus-running status in the desktop UI.**
7. **External-state assertions, replay snapshots, and a real-runtime e2e lane.**
8. **Operational session memory remains distinct from durable human knowledge.**

### ADAPT

1. **Cordis capability seams** → use as guidance for small Prime-facing modules,
   not as a second plugin kernel inside Rhizome.
2. **Inbox/steer/follow-up/inject semantics** → map to Prime's actual daemon
   commands and admission results.
3. **Compaction surface replacements** → visualize Prime state; never compact
   independently.
4. **Thinking retention and reasoning effort** → provider adapter/Prime concern;
   Rhizome renders declared state.
5. **Context-cache-aware stable prefixes** → optimize only where it does not
   weaken vault awareness.
6. **Goals as durable state plus process-local activation** → useful mental
   model for Prime goals and Rhizome's explicit background grants.
7. **MCP namespacing and reconnect visibility** → apply to Rhizome vault tools
   while keeping Markdown authoritative.
8. **Trajectory view** → advanced diagnostics, not the default chat experience.

### REJECT

1. Replacing Prime with DeepSeek Harness.
2. Running a DSH Web/headless/SDK process behind Rhizome.
3. A Rhizome-owned provider registry, credential store, retry layer, or model
   execution path beside Prime.
4. A second tool approval/sandbox enforcement pipeline in the desktop.
5. User-role simulation of tool messages.
6. Transcript, compaction summary, plan, goal, or chain-of-thought as durable
   user memory.
7. Model-written live self-modification in Rhizome. DSH itself says its dynamic
   Cordis sandbox is **not a security boundary** and should be treated like bash
   access
   ([self-modification toolset](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/extensions/tool-cordis/README.md)).
8. Treating DeepSeek's internal training/evaluation environments as a released
   runtime product.
9. Requiring a vault before ordinary chat.

### DEFER

1. Experimental agent-team roster, mailbox, and task DAG until Prime exposes
   an equivalent stable surface.
2. Model-written workflow scripts and Ralph-style fresh-agent loops until
   Prime's RLM/subagent UX is complete and a concrete user need appears.
3. Dynamic task-based model routing; DSH provides explicit routes, not evidence
   for an autonomous desktop router.
4. Third-party memory MCP presets; Rhizome already has a first-party,
   Markdown-native memory destination.
5. Remote E2B-style sandboxes and distributed runtime providers; these are
   Prime execution concerns if they become relevant.

## Recommended comparison language

Use this wording in future harness comparisons:

> **DeepSeek Harness (`dsh`)** is DeepSeek's official developer-preview agent
> runtime: a plugin-composed, event-sourced loop with guarded tools, provider
> adapters, durable sessions, compaction, subagents, Web/headless/SDK clients,
> and layered replay/e2e testing. It is a real unified harness, not a name for
> the DeepSeek API or the internal agent environments described in model
> papers. Rhizome should compare against its contracts and UX patterns, not
> adopt it as a second execution core beside Prime.

When discussing model behavior instead, say **“DeepSeek thinking-mode tool-use
protocol”** or **“DeepSeek-V3.2 agentic training/evaluation pattern.”** Do not
collapse those into “the DeepSeek harness.”

## Highest-signal implications for Rhizome

1. The comparison target changed materially: there is now an official
   `deepseek-harness` product, but it is developer-preview `0.1.1-rc.2`.
2. DSH validates Prime-first architecture rather than undermining it: the best
   mechanisms are runtime contracts that Rhizome should consume and render, not
   own twice.
3. The most transferable invariant is the split between an append-only durable
   event log, a current model-visible projection, and live runtime events.
4. The largest immediate opportunity is testing: recorded-event replay plus a
   real Prime daemon lane that verifies external state would close Rhizome's
   current fake-daemon blind spot.
5. DSH has no native durable human-memory product. Its own official stance is
   generic MCP interoperability with provider-owned storage. That reinforces
   Rhizome's differentiator: explicit promotion into durable Markdown.
6. DeepSeek's model research makes one integration detail non-negotiable:
   thinking-mode tool results must remain true `tool` messages, with reasoning
   continuity owned by the adapter/runtime.
7. Multi-agent UX is worth borrowing now; multi-agent execution is not.
   Rhizome should expose Prime lineage and activity before considering teams or
   workflow engines of its own.

## Primary source index

- [DeepSeek Harness README](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/README.md)
- [DeepSeek Harness architecture](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/architecture.md)
- [Repository/package map and test commands](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/AGENTS.md)
- [Agent lifecycle](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/agent-lifecycle.md)
- [Core agent contract](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/core.md)
- [Tool contract](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/tools.md)
- [Tool execution pipeline](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/tool-execution-pipeline.md)
- [Session model](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/session.md)
- [Compaction](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/compaction.md)
- [LLM streaming and adapters](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/llm-streaming.md)
- [Official DeepSeek adapter](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/llm/llm-deepseek/README.md)
- [Subagents](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/subagent.md)
- [Experimental Agent Teams](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/agent-team.md)
- [Goals](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/goal.md)
- [Workflow engine](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/subsystems/workflow.md)
- [Ralph workflow](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/workflow/tool-ralph/README.md)
- [MCP client](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/mcp/mcp-client/README.md)
- [Third-party memory MCP decision](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/.agents/notes/implemented/feature/2026-07-31-third-party-memory-mcp-examples.md)
- [Testing policy](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/testing.md)
- [Web UI guide](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/user/guide/index.md)
- [Provider/model configuration](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/user/guide/providers.md)
- [SDK server](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/sdk/server/README.md)
- [DeepSeek API Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)
- [DeepSeek API Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)
- [DeepSeek API Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)
- [DeepSeek-V3.2 technical report](https://arxiv.org/abs/2512.02556)
- [DeepSeek-V3.2 release note](https://api-docs.deepseek.com/news/news251201/)
