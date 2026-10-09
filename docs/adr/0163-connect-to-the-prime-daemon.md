---
type: ADR
id: "0163"
title: "Connect to the Prime daemon instead of owning an RPC child"
status: active
date: 2026-08-15
---

**Amended 2026-10-09:** [ADR-0179](0179-rhizome-is-its-own-harness.md)
keeps this transport decision. Prime is a supported optional engine.
Rhizome no longer treats this connection as the product identity.

## Context

Rhizome talks to Prime by spawning `prime-agent --mode rpc` as a process-global
child and speaking JSONL over its stdin/stdout (`prime_session_host.rs`). Rhizome
owns that process: when the app exits, the agent dies with it.

Prime has two protocols, and this is the smaller one. Verified against the
installed build (0.7.1), not the docs:

- `dist/modes/rpc/rpc-types.d.ts` declares **48** commands.
- `dist/modes/daemon/daemon-protocol.d.ts` declares roughly three times that.

The difference is not incidental — it is precisely the harness. Session-tree
navigation (`get_session_tree`, `navigate_tree`), side questions
(`start_side_question`), recursion depth (`set_rlm_max_depth`), context
accounting (`get_context_tree`), `get_system_prompt`, `set_scoped_models` and
`cron_*` exist only on the daemon protocol. There is no way to reach them from
RPC mode, and no way to fake it: Prime's own `rpc.md` states that built-in
commands are excluded from `get_commands` and "would not execute if sent via
`prompt`". A slash-command surface built on RPC mode would be a menu that is
one-third inert.

Two further facts settled the lifecycle question, both verified live rather than
reasoned about:

- **Prime already runs as a background service on the dev machine.**
  `prime-agent status` reports a daemon at
  `$TMPDIR/prime-agent-501/daemon.sock`, pid 54409, marked *default background
  service*. Rhizome has never been able to see it.
- **Detaching is Prime's designed behaviour.** Its docs: closing the TUI
  detaches the client; `prime-agent agents` / `attach` / `stop` exist to find and
  rejoin running work.

So Rhizome's current model — own the process, kill it on exit — is not a neutral
default. It actively contradicts how the runtime is built, and it is why none of
Prime's supervisor behaviour (persistent goals, self-scheduled heartbeats,
subagents) has ever been visible in the product.

Related: `docs/plans/2026-08-15-harness-surface-pickup.md`, which framed the gap;
this ADR is the transport half of the answer.

## Decision

**Rhizome connects to Prime's daemon as one client among several. It does not
own Prime's lifetime.**

Closing Rhizome detaches; sessions keep running. Reopening reattaches. The
menu bar surfaces what is running while the main window is closed.

Rhizome does not silently fall back to RPC mode when the installed
`prime-agent` is too old. It detects the gap and offers an update, because a
silent fallback would make "close the app, work continues" quietly untrue with
no explanation, and would double the transport surface every future change has
to handle.

**Vocabulary consequence.** The daemon hosts *workers*, which hold *sessions*.
Rhizome exposes only **session** to the user; **worker** stays inside the
transport layer. This follows Hermes Agent, which faces the identical
product-name collision and resolves it the same way — no `hermes agents`
command exists; the unit a user lists, names and resumes is a session. See
`CONTEXT.md`.

## Options considered

* **Option A** (chosen): Client of the daemon. Full harness surface; work
  survives the window; matches how Prime is built. Downside: rewrites the
  session host, and Rhizome no longer controls the lifetime of a process it
  depends on — orphaned or stale daemons become a real failure mode it must
  handle rather than sidestep.
* **Option B**: Stay on RPC mode. No rewrite, and the process model stays
  simple. Downside: two-thirds of the harness is permanently unreachable, and
  the product's central claim — that Prime is a supervisor rather than a model
  in a chat box — stays unrenderable.
* **Option C**: Both, selecting per capability. Downside: every feature has to
  answer "which transport?", two lifecycle models coexist, and the RPC path
  would be exercised rarely enough to rot. The cost is paid forever to avoid a
  migration paid once.

## Consequences

- `prime_session_host.rs` is rewritten against the daemon socket. The
  process-global `TEST_LOCK` and spawn-once logic it carries are transport
  details that do not survive the move.
- Rhizome gains a failure mode it did not have: a daemon that is absent, stale,
  or a version it cannot speak to. This must be a visible, actionable state —
  not a spinner.
- Update prompting becomes load-bearing rather than a nicety, because the
  minimum supported `prime-agent` version is now a hard requirement.
- The commands listed above become reachable, which is what makes the harness
  surface (controls, command menu, goal, branch navigation) specifiable at all.
- Every ticket in that surface must be demonstrated against a real running
  Prime. This repo has shipped UI that passed its tests and was unreachable in
  the app (`AiAgentsBadge`, and a toggle rendered into a suppressed header);
  a separate process makes that failure mode more likely, not less.
