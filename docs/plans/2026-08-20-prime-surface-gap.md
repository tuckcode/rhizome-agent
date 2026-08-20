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

## Correction: two recorded findings were wrong

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

`model_catalog` remains genuinely unroutable: **zero** `case` handlers in the
bundle, and no doc mentions it. That probe finding stands.

## Naming: we use undocumented aliases

| We send | Documented equivalent |
|---|---|
| `cron_list` | `list_schedules` (+ `list_heartbeats`) |
| `cron_cancel` | `cancel_schedule` |
| `heartbeat_manage` | `manage_heartbeat` |

Both sets have real `case` handlers in the bundle, so ours are not wrong — but
they are aliases nobody documents, which is why four sessions had to probe the
shapes by hand. Prefer the documented names for anything new; do not churn
working call sites just to rename them.

## The gap list

Everything below is documented Prime behaviour with no desktop surface.
Ordered by how much of the product premise it recovers.

### 1. Observe another session without attaching — `observe` / `unobserve`
`rpc.md` §Daemon Coordination. Subscribe to another root or subagent session;
the response carries its current messages, and later events arrive wrapped as
`observed_session_event` so they cannot be confused with your own.
`observed_session_closed` ends it.

This is the missing half of **#13** (roster) and **#27** (session sidebar). The
roster today lists sessions; `observe` is how a row shows what that session is
*doing* — live — without stealing it. Attaching is currently the only way to
see another session, and attaching is destructive to whoever holds it (C12's
whole territory).

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

## What this does not change

Probe-first still applies. The docs describe the RPC client contract; our Rust
speaks the daemon socket, and the two have already been shown to diverge in
naming, in what is routable (`model_catalog`), and in envelope shape
(`heartbeats_list` wrapping each job in `{"job": …}` — a shape no doc
mentions). Read the doc, then check `daemon-mode.js` for a `case` handler, then
probe the shape. All three.
