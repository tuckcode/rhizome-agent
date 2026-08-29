# What Prime's unwired commands actually do

**Origin:** Claude Opus 5 (Claude Code) · 2026-08-29 · re-read from Prime's own documentation after a wrong claim reached a decision document

## Why this exists

`docs/prime-adapter-surface.json` lists 102 daemon commands; Rhizome speaks 37.
Every prior discussion of the remaining 57 — including one earlier the same day
— characterised them **from their names**, because `AGENTS.md` said "the
snapshot is the list" and that read as "do not look further".

The snapshot is a list of names. A name is not a meaning. This document is the
same 57 commands read from Prime's installed documentation at
`~/.local/lib/node_modules/prime-agent/docs/`, which was on this machine the
whole time.

## The correction that prompted it

**`set_scoped_models` is not routing.** Prime's `usage.md`:

> `/scoped-models` — Enable/disable models for Ctrl+P cycling

It filters which models appear in the picker. That is the feature Rhizome
already shipped as the chat-model allow-list (#45 step 1) — the same thing,
not a routing engine.

`docs/design/token-routing-and-compression.md` calls it *"the halfway house if
pulled sooner … so a human can pin scopes without a proxy"*, and
`docs/YOU-SHOULD-KNOW.md` repeats it as *"halfway house already in Prime"*.
Both are wrong, and both were written by agents reading the name.

**What follows from the correction:** Prime has no per-task model routing. An
external router would therefore add a capability rather than duplicate one.
`docs/design/2026-08-29-model-routing-decision.md` argues partly from the
belief that Prime already routes; that part of its reasoning does not hold.
The doctrine objection — a router Rhizome supervises is a second provider path
— stands on its own and is unaffected.

## Read from Prime's docs, not from names

**Heartbeats** — `heartbeat_get`, `heartbeat_update`, `heartbeats_list`.
Richer than the name suggests. `long-running-agents.md` documents three
distinct surfaces: a user heartbeat (`/heartbeat every 10m Check the
deployment and report meaningful changes`, with `status` / `pause` / `resume`
/ `clear`), agent-created RLM heartbeats a session manages programmatically,
and general cron schedules. Delivery defaults to *steering* active work, with
`--follow-up` to wait for the current turn.

That is a real user job — "watch this and tell me when it changes" — and
Rhizome exposes none of it. **#14 (schedules and heartbeats: see, pause,
cancel).**

**Agent-to-agent messaging** — the `agent_messages_*` family. Not internal
plumbing: the daemon routes direct messages between live sessions and retained
subagents. `prime-agent send <agent> "Please verify the latest migration"`.
A session can be told something by another session while it works.

Rhizome shows one session at a time and nothing about the others. This is
arguably the largest capability gap in the list, and it has no issue.

**Steering** — `set_steering_mode`, `set_follow_up_mode`,
`mutate_queued_message`, `resume_queue`. `rpc.md` is precise: a steer is
delivered *after the current assistant turn finishes its tool calls, before
the next LLM call*. A follow-up waits for the turn to end. Two different
behaviours, configurable, and Prime's TUI exposes editing a queued message
before it lands. **#41 (typing while Prime is working — the path exists and is
wired to nothing).**

**Session export** — `export_html`, `export_jsonl`, `import_jsonl`. Documented
in `rpc.md` with an optional `outputPath`. `agent-connection.md` notes these
keep local filesystem semantics deliberately. **#23 (sessions are searchable
knowledge, not opaque logs).**

**Refinement** — `refine`. `usage.md`: *"Refine or roll back session-backed
harness state"*. `extensions.md` shows the lifecycle — `session_before_refine`
fires before a planning LLM call and can skip or replace the planner;
`refine_complete` after; rollbacks bypass planning. So it is a planner over
the agent's own persisted harness state, with rollback.

`docs/IDENTITY.md` already says to adopt its *design* for vault-side work —
the two-stage judge, per-entry versioning, rollback — rather than letting
harness state become the memory store. That instruction was written without
this detail; it holds up well against it.

## Genuinely not for this shell

Not parity-for-its-own-sake, and the reason is the same for all of them: they
exist because a terminal client cannot stream.

`wait_for_idle`, `wait_for_headless_completion`, `prompt_and_wait`,
`execute_bash_and_wait` — blocking variants of things Rhizome already does by
streaming events. Wiring them would add a second way to do what already works.

`acquire_session_input_pause` / `release_session_input_pause`,
`cancel_prompt_admission`, and most of the `abort_*` family — transport-level
mechanics underneath commands Rhizome already speaks.

That is roughly 17 of 57. The other ~40 are capability.

## What this changes about the coverage argument

The doctrine's line — *"Coverage is by user job, not Prime command count"* —
is sound as a rejection of blind parity. It has also been used as a general
reason not to wire commands, in a repo where the owner has asked repeatedly
for more of Prime to be exposed.

Both can be true. The test is whether a command has a job you can state in one
sentence. On that test: heartbeats yes, agent messaging yes, steering yes,
export yes, `wait_for_idle` no.

## Method note

Everything above cites Prime's own documentation, installed on this machine.
No cloning, no dumping the package into context — `grep` over
`~/.local/lib/node_modules/prime-agent/docs/*.md`, one file at a time.
`AGENTS.md` now says this explicitly, because the previous wording did not.
