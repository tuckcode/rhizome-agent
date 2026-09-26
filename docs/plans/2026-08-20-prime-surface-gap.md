# Prime's documented surface vs what Rhizome exposes — 2026-08-20

Written after reading the docs that ship with the installed Prime bundle.
Premise, from Atticus: **Rhizome Agent is the desktop version of Prime Agent
plus what Rhizome adds.** Anything Prime gains should reach the desktop app.
This doc is the gap list that premise implies.

## The docs exist, and they are current

35 markdown files ship with every install:

```
~/.local/lib/node_modules/prime-agent/docs/
```

Upstream `main` (`PrimeIntellect-ai/prime-agent`, public, `packages/coding-agent/docs`)
was diffed against the installed 0.7.4 set on 2026-08-20. **Identical except
two files**, neither harness-related: `acp.md` gained an MCP-servers section,
`mcp-integrations.md` swapped hand-edited settings for a `prime-agent mcp
add/list/remove` CLI. Latest release is v0.7.4 — what is installed. Nothing to
sync; re-diff after the next release rather than assuming drift.

Highest value for this repo, in order: `rpc.md` (1456 lines — the command
surface we speak), `sdk.md` (1123), `long-running-agents.md` (241),
`daemon.md` (166), `extensions.md` (2589, what `xai-oauth.ts` is written
against).

## Correction: three recorded findings were wrong

- **"183 models; no Grok 4.6 in 0.7.4"** (2026-08-19 status). False. 0.7.4's
  built-in catalog has `xai/grok-4.6`. It was invisible because
  `~/.prime/agent/extensions/xai-oauth.ts` calls `registerProvider("xai", {models})`,
  and `applyProviderConfig` does `this.models = this.models.filter(m => m.provider !== providerName)`
  — an extension's model list **replaces** the built-in one for that provider.
  Fixed locally by adding 4.6 to the extension.
- **"`SessionSummary.sessionName` is declared but never sent."** Misread.
  `rpc.md:197` — it "is the display name set via `set_session_name`, or omitted
  if not set." Nothing sets it, so it is always absent. The field works; we
  never call the setter. That is #27's mechanism and #28's likely fix.

- **"`model_catalog` is advertised in `serverCapabilities` but returns
  `Unknown daemon command`."** Half right, and the wrong half is the useful
  one. `model_catalog` really is not a command — it is a *capability flag*, and
  the daemon advertises it truthfully. The command is named
  **`get_model_catalog`**, and it is in `DAEMON_COMMAND_TYPES`. Probed
  unattached it returns `Supervisor cannot route daemon command`, meaning it
  exists but is worker-scoped (see the refusal table below). So the model
  picker is probably not capped at whatever `get_available_models` returns —
  worth an attached probe before the next model-picker change.

## Naming: we use undocumented aliases

| We send | `rpc.md` documents | Routable on the daemon socket? |
|---|---|---|
| `cron_list` | `list_schedules` | **ours only** |
| `cron_cancel` | `cancel_schedule` | **ours only** |
| `heartbeat_manage` | `manage_heartbeat` | both names are in the daemon set |
| — | `observe` / `unobserve` | **neither** |

Our names are the correct ones for this transport. The documented names are the
RPC-mode spelling and mostly do not route here. **Do not "fix" our call sites to
match the docs** — that would break working code in the direction of a
different client's protocol.

## The gap list

Everything below is documented Prime behaviour with no desktop surface.
Ordered by how much of the product premise it recovers.

### 1. ~~Observe another session without attaching~~ — **does not exist here**

**Probed 2026-08-20 against the live daemon socket. It is not routable:**

```
observe          → {"success": false, "error": "Unknown daemon command: observe"}
list_schedules   → Unknown daemon command
list_heartbeats  → Unknown daemon command
```

`rpc.md`'s "Daemon Coordination" table documents the **RPC-mode** client
(`prime-agent --mode rpc`, stdin/stdout), not the daemon socket Rhizome speaks.
The two vocabularies overlap but are not the same, and the doc never says so.
This is the same trap as `model_catalog`, and reading the docs walked straight
into it — the earlier draft of this file recommended building on `observe`.

**The authoritative list is `DAEMON_COMMAND_TYPES` in
`dist/modes/daemon/daemon-supervisor.js` — 98 commands.** Extract it before
planning anything; it is the only source that is neither aspirational nor
stale:

```bash
python3 - <<'EOF'
import re
s = open('~/.local/lib/node_modules/prime-agent/dist/modes/daemon/daemon-supervisor.js', errors='replace').read()
m = re.search(r'DAEMON_COMMAND_TYPES\s*=\s*new Set\(', s)
j = s.index('(', m.end()-1); d = 0
for k in range(j, len(s)):
    d += (s[k]=='(') - (s[k]==')')
    if d == 0: break
print(" ".join(sorted(set(re.findall(r'"([a-zA-Z_]+)"', s[j:k+1])))))
EOF
```

**Two different refusals, two different meanings** — worth knowing before
concluding a command is missing:

| Message | Means |
|---|---|
| `Unknown daemon command: X` | Not in `DAEMON_COMMAND_TYPES`. It does not exist on this transport. |
| `Supervisor cannot route daemon command: X` | It exists, but is worker-scoped — the client must `attach` first. |

`get_model_catalog`, `get_session_tree` and `get_session_header` all return the
*second* message to an unattached client. So the recorded finding that the
model catalog is "advertised but not routable" was half wrong: the name is
`get_model_catalog` (not `model_catalog`), and it is reachable after attach.

**Probed attached, 2026-08-20**, from a throwaway `client-owned` session that
was killed afterwards:

| Command | Models | Providers |
|---|---|---|
| `get_available_models` (what Rhizome calls) | **185** | 4 — `prime-inference` 104, `opencode` 61, `anthropic` 13, `xai` 7 |
| `get_model_catalog` | **1252** | 20+ — `openrouter` 289, `vercel-ai-gateway` 220, `amazon-bedrock` 119, `huggingface` 67, `cloudflare-ai-gateway` 57, `azure-openai-responses` 41, `openai` 41, `github-copilot` 33, `mistral` 31, `fireworks` 23, … |

**The picker is not capped by a bug — the two commands answer different
questions.** `get_available_models` returns what this machine can actually run
*now*: providers with credentials. `get_model_catalog` returns everything Prime
knows how to talk to, credentialled or not, and also carries
`configuredProviders`. Our picker calling the narrower one is correct, and the
2026-08-19 note that the list is "capped by the installed Prime version" was
right about the mechanism (the catalog is baked into the bundle) and wrong to
treat 183 as a ceiling worth working around.

**The opportunity is the other 1067.** A BYO-model product can show what
connecting a provider would unlock — "OpenRouter: 289 models, not connected" —
instead of silently listing only what is already wired. That needs
`get_model_catalog` plus `configuredProviders`, both now known to work, and it
is a far better use of this command than trying to widen the picker.

### 1a. `observe` exists — one layer down, and family-scoped

Prime ships a bundled skill at
`~/.local/lib/node_modules/prime-agent/skills/agent-observe/`:

> "Read-only observation of an agent's parent, siblings, and direct children.
> Use to inspect family status and bounded recent-message previews without
> mutating sessions."

It is a **kernel-side Python skill the model calls**, not a client command:

```python
await agent_observe.list_agents()                       # self, parent, siblings, direct children
await agent_observe.get_agent(target)                   # one agent summary
await agent_observe.recent_messages(target, limit=8)    # bounded previews, limit 1-50
```

That is why `observe` bounced off the socket: the capability lives at the agent
layer, and `rpc.md` documents a third spelling at a third layer. Three layers,
three vocabularies, one word.

**It would not have solved #13 or #27 anyway.** Its own SKILL.md: observation is
"limited to family members in the same worker; root siblings in other workers
are not observable yet." Rhizome's roster is exactly a list of root siblings in
other workers — the one case it excludes.

Where it *is* useful: RLM subagents. A parent session watching its own children
is precisely the family scope this covers, and children are a surface we have
never built (see item 7).

### 1b. What actually delivers "see what another session is doing"

The `list` response already carries per-session live state, and we throw almost
all of it away. Probed shape, one entry:

```
activeSessionId  activity        attachedClients  created     cwd
diagnostics      hasRunningRlmChildren           id           isBashRunning
isCompacting     isRunningTools  isSessionActive  isStreaming  lastActivityAt
lifecycle        messageCount    model            modified     rlmDepth
runtimeKind      sessionActions  sessionFile      sessionId    thinkingLevel
unfinishedActionCount            workerPid        workerState
```

`roster_sessions` (`prime_session_host.rs:1709`) hands the array through, and
the menu-bar roster reads `lastActivityAt` and `messageCount` from it. Nothing
reads `isStreaming`, `isRunningTools`, `isCompacting`, `activity`,
`workerState`, `model`, or `thinkingLevel` — which is exactly the "what is that
session doing right now" that `observe` was wanted for, already arriving on
every poll, for free, with no attach and no new command.

Live per-row status is therefore a **read-more-of-what-we-already-fetch** job,
not a new transport feature. That is the honest replacement for this item.

### 2. Creating scheduled work, not just watching it
**#14 ships read + pause + cancel.** `set_heartbeat` (schedule, prompt,
delivery mode) and `add_schedule` (one-time or cron) have no UI at all, so
scheduled work can only be created from the TUI or CLI and then merely
*managed* from the desktop app. A desktop Prime that cannot create a heartbeat
is a viewer.

`long-running-agents.md` also explains the asymmetry we found by probing and
recorded as a quirk: there are **three** scheduling surfaces — `/heartbeat`
(one user-visible per session), `rlm_heartbeat` (many, agent-created), and
`prime-agent schedule` (one-time/cron). Heartbeats pause; schedules only
cancel. Our merged view is right; the reason is documented.

### 3. Agent-to-agent messaging
`send_message` (with `auto` / `steer` / `follow_up` delivery), plus
`agent_messages_status|pause|resume|clear`. Zero references in our tree. Prime
routes messages between live sessions and retained subagents; receipts come
back `delivered` or `queued`. With #13's roster already listing running
sessions, this is a small step from "see the roster" to "use it".

### 4. Autonomous mode
`/autonomous on|status|off`, gate commands, and limits on continuations,
turns, tokens, and wall-clock. Entirely absent from our tree. This is the
surface most obviously suited to a desktop window that stays open — and the
one where Rhizome's vault could supply the evidence a gate checks.

### 5. Goal pause/resume
We implement set and clear. Prime documents `/goal status|pause|resume` too,
plus budget (`/goal --budget 200000`) and the state record it keeps: token
usage, elapsed time, continuation count. Also worth pinning down in our copy:
"only `goal.complete()` marks successful completion", and creating a goal is
an explicit user/host action the agent must not infer.

### 6. Smaller, cheap
- `set_session_name` — never called. Fixes "all Untitled" (#28) and gives #27
  exact origins. `prime-agent rename` is the CLI equivalent.

  **Probed 2026-08-22 against installed 0.7.4** — real and routable, not just
  documented. It is in the daemon's command list and has a live `case` handler
  in `dist/modes/daemon/daemon-mode.js`: takes `activeSessionId` + `name`,
  trims, rejects empty, calls `setStateSessionName`. `rename_saved_session` and
  `delete_saved_session` are in the same list.

  **This supersedes how #28 and #30 were solved on 2026-08-21.** Both were
  fixed by deriving labels *after the fact* — filtering husks, disambiguating
  identical titles with an id suffix, and showing a session's `cwd` because the
  log carries no client field. All of that stands and is still needed for the
  ~50 sessions already on disk. But for sessions Rhizome creates from now on,
  naming one at creation is a better fix at the source:

  - A named session is never "Untitled", so there is nothing to disambiguate.
  - A Rhizome-set name **is** an origin signal. #30 was closed saying "which
    client wrote it is not derivable", which is true of *reading* an existing
    log and false of *writing* a new one. Rhizome can create the fact it could
    not derive.

  Worth doing before more label-derivation logic gets built on the old
  premise.

  **It also corrects ADR-0165's closing line**, which says deleting a session
  log is "Prime's to offer, not Rhizome's". `delete_saved_session` is routable,
  so Rhizome *could* offer it. The decision not to still stands — archiving is
  reversible and deletion over a store shared with Prime's CLI is not something
  to add casually — but the honest reason is that we choose not to, not that we
  cannot. Not raised to a superseding ADR because the decision is unchanged;
  only its justification was imprecise.
- `export_html` — a real command; no UI.
- `set_steering_mode` / `set_follow_up_mode` — queue behaviour, no UI.
- `set_auto_retry` / `abort_retry` — no UI.
- `get_fork_messages` — would show the branch point before forking.
- `image` — prompting with images; nothing in our chat input.

### 7. Read before building on it
`sdk.md` opens with "Build a custom UI (web, desktop, mobile)" and documents
`createAgentSession`, `SessionManager`, `ModelRegistry`, `AuthStorage`, with
examples under `examples/sdk/`. `rpc.md` explicitly suggests using
`AgentSession` directly rather than a subprocess for Node clients. We are a
Rust client on the daemon socket (ADR-0163), so the SDK is not a drop-in — but
the RLM/subagent model (`rlm.md`, `rlm-runtime.md`) is unread, and children
sessions are a product surface we have never looked at.

## Quantified 2026-08-22

`2026-08-22-prime-harness-coverage.md` counts what this doc describes:
**27 of 105 daemon commands, 25%**. It clusters the 68 unused into product
surfaces rather than a list, and argues the sequencing — Windows hang first,
then a live-daemon test lane, then RLM. Read that one for the numbers and this
one for the reasoning behind each gap.

## What this does not change

Probe-first still applies, and this session is the proof: the docs sent me to
build on a command that does not exist on our transport, and one probe caught
it before any code was written. The docs describe the RPC client contract; our
Rust speaks the daemon socket, and the two diverge in naming, in what is
routable (`observe`, `list_schedules`, `list_heartbeats`), and in envelope shape
(`heartbeats_list` wrapping each job in `{"job": …}` — a shape no doc
mentions). Read the doc, then check `daemon-mode.js` for a `case` handler, then
probe the shape. All three.
