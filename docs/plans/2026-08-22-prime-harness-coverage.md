# How much of the Prime harness Rhizome actually speaks — 2026-08-22

The quantified companion to `2026-08-20-prime-surface-gap.md`. That doc read
Prime's shipped documentation and listed the capability gaps qualitatively.
This one counts.

**Method, so it can be re-run rather than re-argued.** The daemon's routable
surface is every `case "<name>":` in
`~/.local/lib/node_modules/prime-agent/dist/modes/daemon/daemon-mode.js`
(installed 0.7.4). Ours is every `"type": "<name>"` we send from
`src-tauri/src/**/*.rs`. Both are mechanical greps; neither trusts a doc.

## The number

**28 of 105 daemon commands — 27%.** Excluding the 10 `worker_*` internals a
client never sends: 28 of 95, 29%.

What we speak today:

```
abort  attach  compact  create  cron_cancel  cron_list  detach
extension_ui_response  follow_up  fork  get_available_models  get_commands
get_connection_state  get_messages  get_session_stats  get_state
heartbeat_manage  kill  list  new_session  prompt  set_auto_compaction
set_model  set_session_name  set_thinking_level  steer  switch_session
cancel_rlm_child
```

That set is a complete, working *conversation* client: connect, attach,
prompt, stream, switch model and reasoning level, fork, compact, watch a goal.
`cancel_rlm_child` is the first RLM write. Chat now lists the live session's
roster children (`RlmFamilyBand`); it still does not speak `get_session_tree`
(fork history, #17) or `set_rlm_max_depth`.

## The number needs two corrections, in opposite directions

**It overstates the gap.** Eight of the 67 unused commands are daemon
infrastructure a desktop client should never call — `restart`, `reload`,
`shutdown`, `set_transport`, `prepare_update_restart`, `retry_worker`,
`restore_actions`, `ack_result`. ADR-0163 is explicit that the daemon is not
ours to stop; not calling these is the decision working, not a gap.

**It understates the gap**, and this is the part that matters. What is missing
is not 67 scattered commands. It is a small number of *coherent product
surfaces*, each entirely absent:

| Missing surface | Cmds | What its absence means |
|---|---:|---|
| **RLM / subagents** | 5 left | Chat shows live children from the **`list` roster** and Stop → `cancel_rlm_child`. Still missing `get_session_tree` / `get_context_tree` / `set_rlm_max_depth`. `get_session_tree` is fork history (#17), not the RLM family |
| **Queue & steering** | 12 | We can `steer` and `follow_up` blind. We cannot *see* the queue, edit a queued message, clear it, or set steering/follow-up mode |
| **Session tree / forking** | 6 | We `fork`, but cannot show the branch point first (`get_user_messages_for_forking`) or navigate the tree |
| **Saved sessions** | 6 | `rename_saved_session`, `export_html`, `import_jsonl`. Also `list_saved_sessions` — see the open question below |
| **Agent messaging** | 5 | Agent-to-agent `send_message` and its pause/resume controls |
| **Scheduling writes** | 5 | We watch (`cron_list`) and pause (`heartbeat_manage`). We cannot *create* a schedule or heartbeat |
| **Model surface** | 5 | `get_model_catalog`, `cycle_model`, `set_scoped_models`, `set_service_tier` |
| **Side questions / refine** | 5 | `start_side_question`, `refine` — asking without disturbing the main thread |
| **Bash & tools** | 4 | `execute_bash`, `get_tool_definition` |
| **Introspection** | 3 | `get_system_prompt`, `get_resource_snapshot` |
| **Blocking variants** | 3 | `prompt_and_wait`, `wait_for_idle` — headless/automation shapes |
| Daemon infra | 8 | Deliberately not ours |

## What is solid

The load-bearing part. A daemon client over a socket (ADR-0163), sessions that
outlive the window, reattach on reopen, lazy creation so a vault attach costs
nothing (#28), event normalisation into the shared `AiAgentStreamEvent` shape,
goal/heartbeat watching, and — as of 2026-08-22 — an architecture doc that
describes all of it (C32). None of that is scaffolding to be redone.

Worth saying plainly: the hard part is done. The remaining 67 are additions to
a working client, not a rewrite of one.

## Three things block "smooth", regardless of coverage

1. **No live-daemon test harness.** Every test in `prime_session_host.rs` runs
   against a fake daemon over a `UnixListener`. That is good for command
   ordering and useless for shape. On 2026-08-21 three separate defects were
   invisible to a fully green suite and obvious in a browser within seconds —
   all three because the tests mock the transport wholesale. Every one of the
   67 inherits that blind spot. **This is the highest-leverage infrastructure
   work available**, because it changes the cost of all future commands rather
   than adding one.

2. **The probe tax.** Prime's docs describe the *RPC* client contract; we speak
   the daemon socket. They diverge in naming, in what is routable, and in
   envelope shape — `heartbeats_list` wraps each job in `{"job": …}`, a shape
   no doc mentions. Every new command costs a probe before it costs code. That
   is a fixed tariff on all 68, and it is why `2026-08-20-prime-surface-gap.md`
   ends with "read the doc, then check `daemon-mode.js`, then probe the shape.
   All three."

3. **Windows just landed and is unverified.** #32 shipped a named-pipe client
   on 2026-08-22; review found the roster read can block forever there, because
   the deadline in `read_roster_over` is only checked *between* reads and the
   Windows path has no read timeout. Nothing about the harness is trustworthy
   on Windows until that is fixed and exercised against a real daemon.

## Sequencing

The recent work — #28, #30, C32, C33, #27, #31 — is polish, and it is in good
shape. But it is polish on 25% coverage. If the premise stays *"Rhizome Agent
is the desktop version of Prime Agent plus what Rhizome adds"*, then:

1. **Fix the Windows hang** (#32). Small, and it unblocks a whole machine.
2. **Build the live-daemon test lane.** It is the only item that makes every
   subsequent item cheaper. Probably a `#[ignore]`d integration suite against a
   real daemon on a scratch socket, run deliberately rather than in the push
   gate.
3. **RLM / subagents.** The one gap that is a missing *product* rather than a
   missing button. Start by reading `rlm.md` and `rlm-runtime.md`, which
   `2026-08-20-prime-surface-gap.md` §7 flags as still unread, then probe
   `get_session_tree`.
4. **Queue visibility.** The largest cluster, and the one users feel — steering
   blind is the current experience.

Everything else is incremental and can be pulled forward whenever a specific
need appears.

## Open question worth deciding deliberately

`list_saved_sessions` exists on the daemon, and `prime_sessions.rs` reads
`~/.prime/agent/sessions/*.jsonl` off disk instead. That is not obviously
wrong — the disk reader works with **no daemon running**, which is a real
feature for a history list, and it is where the 400-line scan cap lives that
keeps listing 2,000 sessions at ~50ms. But nobody has compared the two, and
the daemon's version presumably knows things the disk cannot. Worth an
explicit answer rather than an accident.
