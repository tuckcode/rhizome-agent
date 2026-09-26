# Prime Agent 0.8.0 × Rhizome — take/leave boundary

Date: 2026-08-24  
Scope: installed Prime Agent 0.8.0, Rhizome's current Prime integration, and the repository decisions that govern it.

## Executive verdict

**Prime should own the entire execution substrate. Rhizome should own product
policy, native presentation, and durable human memory.**

That means:

- Prime owns daemon supervision, workers, the agent loop, provider calls,
  credentials, model catalog and session model state, IPython and tool
  execution, RLM/subagents, queues, session trees and logs, compaction, goals,
  schedules, heartbeats, autonomous continuations, continual-harness refinement,
  and coordinated runtime updates.
- Rhizome is a daemon client and policy shell. It owns the chat/session UX,
  foreground-versus-background consent, vault access and promotion, native
  permission dialogs, transcript presentation, Rhizome-only archive state,
  app navigation, and installation guidance.
- Rhizome should **not** become a second agent runtime or reproduce every Prime
  TUI screen. “Desktop version of Prime Agent” is useful as a fidelity standard,
  but harmful as an ownership rule. The durable rule is: **render Prime's
  user-relevant state faithfully; do not reimplement Prime's machinery.**

Prime's own architecture draws the same seam: the client owns rendering,
keyboard input, and local UI preferences; the supervisor and session own
execution, tools, provider calls, queues, compaction, descendants, schedules,
and transcript writes.[P2][P3]

## Classification legend

- **TAKE AS-IS** — use Prime's implementation and semantics; do not create a
  competing implementation.
- **WRAP** — add a narrow typed adapter, product policy, or Rhizome-specific
  capability around Prime.
- **REIMPLEMENT UX** — recreate the interaction in Rhizome's visual language,
  backed by Prime's state and commands rather than copied TUI code.
- **REJECT** — do not build, or retire when the replacement is proven.
- **DEFER** — valid later work, but not required by the current product.

## Boundary by subsystem

| Subsystem | Classification | Prime owns | Rhizome owns / action |
|---|---|---|---|
| Daemon and workers | **TAKE AS-IS** | Supervisor, sockets/pipes, routing, attachments, leases, worker recovery, process containment, backpressure, journals, coordinated restart.[P3] | **WRAP** the versioned local protocol. Never start a parallel supervisor, call `shutdown` for app quit, expose “worker” in product copy, or infer health from a child-process handle. |
| Sessions | **WRAP** | Session creation, identity, tree, leases, persistence, switching, forking, import/export, naming, and saved-session catalog.[P4][P6] | Session library, grouping, Rhizome-only archive state, and native navigation. Prefer protocol catalog/state where it answers the question; keep direct JSONL parsing contained only where full-fidelity history or daemon-offline access requires it. |
| Agent loop | **TAKE AS-IS** | Provider streams, tool loop, retries, compaction continuations, goal/autonomous continuations, transcript commits.[P2][P7] | Stream/render normalized events and express user intent. **REJECT** a second primary-chat loop in `ai_models.rs` or another direct-provider path. |
| Tools and MCP | **TAKE AS-IS + WRAP** | IPython, kernel lifecycle, tool admission/execution, skills/extensions, generic MCP connections, tool schemas and results.[P8][P9] | Supply Rhizome vault capability through a small Prime-native adapter; enforce vault-relative path policy at Rhizome's tool boundary; render calls/results and “open note” affordances. Do not flatten every capability into a new model tool. |
| Subagents / RLM | **TAKE AS-IS + REIMPLEMENT UX** | Child creation, recursion limits, inheritance, independent sessions, registry, messages, cancellation, recovery and usage attribution.[P5][P6] | A native family/tree view, progress and stop/delete controls, and links into child transcripts. Do not spawn or coordinate a second Rhizome subagent system. |
| Refine / continual harness | **TAKE AS-IS + WRAP** | Session/global harness ledger, refine planning/apply/rollback, prompt rebuild, prompt notes, harness memories, reusable skill descriptions and subagent specs.[P6][P10] | Show status/history/rollback in Rhizome if users need it; provide explicit promotion from harness/chat material into the vault. Never equate harness memory with the user's durable wiki. |
| Model catalog, auth and routing | **TAKE AS-IS + REIMPLEMENT UX** | Built-in/custom provider catalog, auth resolution and refresh, model availability, model/thinking/service-tier state, provider compatibility and routing.[P11][P12] | Render Prime's catalog and connected state, invoke Prime-backed login/setup flows, and set session choices through protocol commands. **REJECT** app-stored provider keys and a competing Rhizome model router for Prime chat. |
| Scheduling and heartbeats | **TAKE AS-IS + REIMPLEMENT UX** | Per-session persisted jobs, due-tick claiming, coalescing, recovery, heartbeat/schedule distinction and dispatch.[P3][P7] | Clear create/manage UI, background-effect disclosure, next-run visibility, and cancellation. A schedule or heartbeat is an explicit background grant, not an excuse to make every session resident. |
| Lifecycle and autonomy | **WRAP** | `client_owned`/`resident` enforcement, reconnect grace, promotion/completion, bounded autonomous policy, quality gates and budgets.[P3][P4][P7] | Foreground-by-default policy, close/quit confirmation, per-operation background grants, visibility and revocation. Use Prime's mechanisms; do not emulate them with best-effort quit handlers. |
| Permissions | **WRAP + REIMPLEMENT UX** | Extension interception and serializable confirm/select/input/editor requests; tool execution under the user's OS identity.[P5][P13] | Vault/path capability policy, native confirmation, tool/package trust disclosure, and fail-closed handling. **REJECT** claims that workers or kernels are security sandboxes: Prime explicitly says they are not.[P2][P3][P5] |
| Memory | **WRAP** | Operational continuity: transcript/tree, compaction, kernel state, goals, harness ledger and subagent artifacts.[P6][P7] | Durable human knowledge in the vault, explicit save/promote, search/open/edit, provenance and access tiers. **REJECT** automatic dual-write or treating `~/.prime` as the second brain.[R1][R3] |
| Transcript | **WRAP** | Authoritative writes and session format.[P2][P6] | Read-only parsing/rendering, full-history scrollback, model/compaction/refinement markers and Rhizome display redaction. Never rewrite Prime logs to suit a Rhizome view. |
| UI | **REIMPLEMENT UX** | Semantic state, commands, events and serializable extension-UI requests.[P5] | All native visual hierarchy and interaction: chat, composer, queue, models, sessions, subagents, schedules, goals, refine, updates and permission dialogs. Do not embed or clone terminal layout. |
| Updates | **TAKE AS-IS engine + REIMPLEMENT UX** | Release manifest, install method, worker checkpoints, update handoff and daemon restart.[P3][P14] | Consent, progress/error presentation and a safe invocation of Prime's updater. **REJECT** Rhizome as an independent Prime downloader or alternate release authority. |
| Packaging | **DEFER** | Prime package/runtime layout, Node ≥22.8, Python/kernel bootstrap, resource packages and updates.[P1][P15] | For circle v0, discover a user-installed Prime and explain setup. Later, bundle a pinned, tested Prime distribution as a sidecar/dependency without forking its runtime or package manager. |

## The operative architecture

```text
Rhizome UI and policy
  ├─ native chat/session/subagent/schedule/update UX
  ├─ foreground/background consent
  ├─ vault permissions + promote/open-note
  └─ read-only transcript presentation
            │
            ▼
thin, capability-gated Prime daemon adapter
            │
            ▼
Prime daemon → worker → AgentSession → provider / IPython / RLM / scheduler
            │
            ├─ ~/.prime/agent/sessions + artifacts  (operational continuity)
            └─ Prime auth/models/settings/packages  (runtime configuration)

Rhizome vault                              (durable human memory)
```

The adapter should model **capabilities and schema revisions**, not merely a
minimum package version. Prime 0.8.0 still uses protocol version 7, but its
schema is revision 22 and individual commands declare capability and minimum
schema requirements.[P4] Rhizome currently accepts any daemon with protocol
`>= 7`, advertises only three client capabilities, and does not retain the
server capability set.[R4] That was sufficient for the 0.7.1 conversation
slice; it is not sufficient for lifecycle, extension UI, queue mutation,
authoritative child rosters, or session-scoped MCP.

## What 0.8.0 changes

### 1. The protocol count is not the roadmap

The installed package is `prime-agent` 0.8.0.[P1] Its exported compatibility
map contains **102 public daemon commands**. A mechanical scan of Rhizome's
current sends still finds **27 unique commands**, about 26%. The older
“27 of 105 / 25%” audit was accurate for its 0.7.4 source but is now stale.[R8]

This count should not become a parity target:

- infrastructure commands such as daemon restart/shutdown are intentionally
  outside Rhizome's product boundary;
- several commands are blocking/headless variants irrelevant to an interactive
  desktop client;
- one coherent user surface may require several commands; and
- some high-value state is already present in snapshots/roster payloads without
  another command.

Coverage should be tracked by user capability—queue control, subagents,
schedules, lifecycle, refine—not by percent of command names.

### 2. Generic MCP is real now, but Rhizome's injected entry is not

Prime 0.8.0 added generic Streamable HTTP and stdio MCP management. Connections
run in the kernel through a pre-imported `mcp` API, are reused per kernel, have
bounded startup/call timeouts, and terminate on kernel shutdown.[P8]

The critical constraint is that **project**
`.prime/agent/settings.json` `mcpServers` entries are ignored for execution so
a repository cannot silently start a process or shadow a user server.[P8]
Rhizome currently writes exactly such a project entry under the vault and calls
it “optional … for future Prime kernel support.”[R5] Under 0.8.0 that entry is
dead by design.

Boundary:

- keep the proven `rhizome-vault` skill/one-shot CLI path as the current
  **WRAP**;
- stop treating the project `mcpServers` write as future wiring;
- do not mutate the user's global Prime MCP settings merely to attach one
  vault;
- evaluate a Prime-native package or a genuinely session-scoped server
  injection only after its ownership and cleanup contract is proven.

### 3. Client-owned sessions now align directly with ADR-0167

The 0.8.0 protocol exposes `resident | client_owned`, requires the
`client_owned_sessions` capability for `complete_owned_session` and
`promote_owned_session`, and lets `cron_add` / `heartbeat_set` promote an owned
session explicitly.[P4] This is a direct protocol expression of ADR-0167's
policy: ordinary chat is foreground-owned; deliberate recurring work can become
resident.[R3]

Implementation must also preserve a stable client identity and recovery context
across reconnects. Prime cancels owned-worker cleanup only when the same stable
client identity reconnects during the grace period.[P3][P4] “Send
`lifecycle: client_owned`” alone is therefore incomplete.

### 4. Export and update assumptions changed underneath Rhizome

Rhizome comments currently say HTML export is CLI-only and “never over the
daemon protocol.”[R6] Prime 0.8.0 declares routable `export_html` and
`export_jsonl` commands.[P4] Keep a CLI fallback only for older supported builds
if product policy requires it; the primary live-session path should use Prime's
protocol.

Rhizome's updater checks GitHub Releases as its source of truth and opens a
release page.[R7] Prime's own stable/beta updater uses its release manifest and
coordinates worker checkpoints before restart.[P3][P14] Rhizome should present
that engine, not maintain a second version feed with different semantics.

### 5. Extension UI is a required client capability, not polish

Prime extensions can block execution for serializable `select`, `confirm`,
`input`, and `editor` interactions; the daemon connection contract explicitly
assigns those requests to the client.[P5][P13] Rhizome currently declines
`extension_ui` and auto-cancels an unexpected request.[R4]

That fail-closed behavior is correct today. For a faithful Prime shell,
implementing native extension UI is **REIMPLEMENT UX**, and it should precede a
broad “supports Prime extensions” claim. Until then, Rhizome supports extension
commands only when they do not need interactive UI.

## Stale and contradictory repository decisions

### ADR-0163 versus ADR-0167

ADR-0163 contains two decisions that were accidentally coupled:

1. **Still correct:** Rhizome is a client of the shared Prime daemon and never
   owns/stops the daemon.
2. **Superseded:** closing Rhizome always detaches while the session keeps
   running.[R2]

ADR-0167 explicitly retains the first and supersedes the second, choosing
client-owned sessions and explicit promotion.[R3] Yet ADR-0163 still says
`status: active`, while its unconditional-survival text remains categorical.
Treat ADR-0163 as **active for transport, superseded for lifecycle**.

The code still implements the superseded policy/mechanism:

- client capabilities omit `client_owned_sessions`;
- every created session is explicitly `resident`;
- quit behavior is controlled by a global
  `keep_sessions_running_on_quit`;
- ordinary shutdown/detach comments still say sessions survive by design.[R4]

The docs are contradictory too. `CONTEXT.md` reflects ADR-0167, but
`ARCHITECTURE.md` and `ABSTRACTIONS.md` still state that closing Rhizome
detaches and the session keeps running.[R1][R9][R10]

**Classification:** ADR-0167 policy is **TAKE/IMPLEMENT**; the global preference
and resident-by-default creation are **REJECT**.

### The old “full harness desktop” premise

The 2026-08-20 gap audit assumed “anything Prime gains should reach the desktop
app,” and the coverage audit used that premise to turn absent protocol commands
into a queue.[R8][R11] The v0 brief and current context are narrower: core chat,
skills/status and the vault memory loop, with broader parity only as product
pulls it.[R1][R12]

The corrected premise is:

> Every Prime capability Rhizome exposes must preserve Prime's semantics and
> state. Rhizome need not expose every Prime capability.

Therefore:

- **REJECT** one-button-per-command parity and the idea that command coverage is
  product completeness.
- **TAKE AS-IS** the underlying Prime capabilities.
- **REIMPLEMENT UX** only for capabilities that strengthen chat, supervision,
  consent, or the vault memory loop.
- **DEFER** niche TUI/package/configuration surfaces until users need them.

### Session-store ownership

ADR-0165 is right that Rhizome archive is a reversible view and must not move or
delete Prime's files.[R13] Its assertion that deletion is “Prime's to offer”
should be read as a policy boundary, not a protocol limitation: Prime now
offers saved-session rename/delete commands.[P4] Rhizome can still choose not to
surface destructive deletion.

The direct JSONL reader remains justified for complete historical scrollback:
Prime's live `get_messages` represents post-compaction working context, while
the event log records what was actually said, including compaction/model-change
markers.[R14] But file-format parsing should remain quarantined in one module,
read-only, optional-field tolerant, and tested against captured real logs.[R15]

### Direct provider and secret storage

The product decision says Prime is the only UI runtime and provider auth lives
under `~/.prime`.[R1][R12] The repository still contains a separate
`ai_models.rs` provider runtime and API-key store used by other inherited
features.[R16] It may remain temporarily for those non-Prime lanes, but it is
**REJECTED as an architectural path for Prime chat**. Moving model routing or
auth into it would bypass Prime's tools, goals, compaction, subagents,
credentials and session state.

## Recommended sequence

1. **Implement ADR-0167 completely.** Advertise `client_owned_sessions`, create
   owned sessions, preserve stable reconnect identity/context, add explicit
   promote/complete operations, remove/migrate the global quit preference, and
   make close/quit UX reflect active versus idle work.
2. **Make protocol negotiation real.** Store `daemon_hello` capabilities,
   schema revision and client id; gate each optional feature by Prime's
   compatibility contract rather than package version alone.
3. **Correct 0.8.0 integration drift.** Remove the dead project MCP assumption,
   use protocol export, and put update presentation in front of Prime's updater
   rather than GitHub release comparison.
4. **Implement native extension UI.** Until then, state the extension limitation
   explicitly.
5. **Add user-pulled surfaces in this order:** visible queue/editing, RLM child
   tree and control, schedule/heartbeat creation, refine history/rollback,
   model/auth catalog. Each is Prime mechanics plus Rhizome UX—not new runtime
   code.
6. **Defer bundling and broad parity.** BYO Prime remains adequate for the
   trusted-circle v0. Bundle only after lifecycle, capability negotiation and
   native extension interactions are stable against real daemons.

## Explicit leave list

Do not build:

- a Rhizome daemon, worker supervisor, scheduler, goal engine, agent loop,
  compactor, RLM runtime, provider registry or auth store for Prime chat;
- a global “all sessions survive quit” preference;
- direct edits/moves/deletes in `~/.prime` to curate Rhizome's UI;
- a claim that process separation, IPython, skills or extensions are a sandbox;
- project-local MCP configuration that Prime intentionally refuses to execute;
- an independent Prime release/update authority;
- a parity backlog whose unit is daemon command count.

## Evidence limits

Local verification on 2026-08-23 reported `prime-agent --version` as **0.8.0**.
`prime-agent status` listed the known daemon sockets as unreachable, so this
audit does **not** claim fresh live 0.8.0 payload shapes. Protocol facts are
from the installed 0.8.0 package's exported types and routable source; runtime
shape claims are limited to the live 0.7.2/0.7.4 probes already recorded in the
repository. The established rule still applies: for a new payload, read the
docs, confirm the installed handler, then probe a live daemon before coding.

## Sources

### Installed Prime Agent 0.8.0

- **[P1] Package identity/runtime requirement:**  
  `~/.local/lib/node_modules/prime-agent/package.json:1-18,79-81`
- **[P2] Architecture ownership and non-sandbox boundary:**  
  `~/.local/lib/node_modules/prime-agent/docs/architecture.md:43-49,86-94`
- **[P3] Daemon, worker, owned-session, scheduling and recovery semantics:**  
  `~/.local/lib/node_modules/prime-agent/docs/daemon.md:23-55,57-95,97-152`
- **[P4] Protocol v7/schema 22, capabilities, lifecycle and command contracts:**  
  `~/.local/lib/node_modules/prime-agent/dist/modes/daemon/daemon-protocol.d.ts:19-55,68-88,215-267,340-762,769-1100,1185-1206`
- **[P5] AgentConnection responsibilities, extension UI and client UI boundary:**  
  `~/.local/lib/node_modules/prime-agent/docs/agent-connection.md:20-38,70-85,103-134`
- **[P6] RLM/subagent and continual-harness ownership:**  
  `~/.local/lib/node_modules/prime-agent/docs/rlm-runtime.md:23-32,62-72,159-214,228-254`
- **[P7] Goals, schedules, heartbeats, autonomy and compaction:**  
  `~/.local/lib/node_modules/prime-agent/docs/long-running-agents.md:43-69,112-239`
- **[P8] Generic MCP behavior and project-setting prohibition:**  
  `~/.local/lib/node_modules/prime-agent/docs/mcp-integrations.md:73-149,174-180`
- **[P9] Skill ownership and security:**  
  `~/.local/lib/node_modules/prime-agent/docs/skills.md:23-45,130-168,229-250`
- **[P10] Refine semantics:**  
  `~/.local/lib/node_modules/prime-agent/skills/refine/SKILL.md:1-42`
- **[P11] Provider auth ownership and precedence:**  
  `~/.local/lib/node_modules/prime-agent/docs/providers.md:14-23,38-120,234-248`
- **[P12] Custom model/provider routing:**  
  `~/.local/lib/node_modules/prime-agent/docs/models.md:1-41,132-166,187-246,248-314`
- **[P13] Extensions, permissions and full-system trust:**  
  `~/.local/lib/node_modules/prime-agent/docs/extensions.md:3-29,55-110`
- **[P14] Prime's update manifest/settings:**  
  `~/.local/lib/node_modules/prime-agent/docs/settings.md:49-65`
- **[P15] Prime package manager and package trust:**  
  `~/.local/lib/node_modules/prime-agent/docs/packages.md:18-44,46-107,149-221`

### Rhizome repository

- **[R1] Current product boundary/glossary:** `CONTEXT.md:7-20,23-62`
- **[R2] Daemon-client decision plus superseded survival policy:**  
  `docs/adr/0163-connect-to-the-prime-daemon.md:8-68,70-101`
- **[R3] Foreground-owned lifecycle decision:**  
  `docs/adr/0167-client-owned-prime-sessions-by-default.md:9-88,107-123`
- **[R4] Current client capabilities, resident creation and quit behavior:**  
  `src-tauri/src/prime_session_host.rs:1-63,1683-1713,1856-1882,2007-2038,2093-2148,2180-2231,2255-2289`
- **[R5] Vault skill and project MCP settings injection:**  
  `src-tauri/src/prime_vault_skill.rs:1-6,19-62,106-183,201-254`
- **[R6] Current CLI-only export assumption:**  
  `src-tauri/src/commands/ai.rs:831-840`; `src-tauri/src/prime_sessions.rs:531-536`
- **[R7] Current independent GitHub release checker:**  
  `src-tauri/src/prime_update.rs:1-19,24-37,93-141`; `src/hooks/usePrimeUpdate.ts:18-27,38-87`
- **[R8] Old command-count/full-desktop premise:**  
  `docs/plans/2026-08-22-prime-harness-coverage.md:1-16,95-114`
- **[R9] Stale lifecycle prose in architecture:** `docs/ARCHITECTURE.md:355-367,387-434`
- **[R10] Stale lifecycle prose in abstractions:** `docs/ABSTRACTIONS.md:997-1031`
- **[R11] Literal “anything Prime gains” premise:**  
  `docs/plans/2026-08-20-prime-surface-gap.md:1-6,275-292`
- **[R12] v0 boundary and deferred parity:**  
  `docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md:8-40,42-67,123-127,148-175`
- **[R13] Rhizome-only archive decision:**  
  `docs/adr/0165-archiving-prime-sessions.md:8-70`
- **[R14] Disk transcript versus live working context:**  
  `docs/plans/2026-08-13-prime-session-list-spec.md:36-58,107-153`
- **[R15] Contained tolerant JSONL parser:** `src-tauri/src/prime_sessions.rs:1-29,35-79,178-278`
- **[R16] Inherited direct-provider runtime remains present:**  
  `src-tauri/src/commands/ai.rs:226-255`; `src-tauri/src/ai_run_target.rs:1-70`
