# Prime spoken vs unspoken vs never-call

**Status:** #5 skeleton. Snapshot only. **Not a finished spec.** Not a new architecture.  
**Origin:** W5 paper pass · Cursor Grok 4.6 · 2026-09-14 · starting `4416411`  
**Source:** [`../prime-adapter-surface.json`](../prime-adapter-surface.json) (Prime **0.9.3**, audited 2026-09-12).  
**Index:** [`prime-agent-surface.md`](prime-agent-surface.md).  
**Siblings:** W4 remainder [`../plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md`](../plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md). W6 import [`../plans/import-jsonl-decision.md`](../plans/import-jsonl-decision.md) — blocked until Atticus says **`1`**.  
**Rule:** a name in this file is not a ship ticket. Wire a **user job**. Probe the live daemon before sending a new name.

`prime-adapter-surface.json` answers “does this command **name** exist.” It never answers what the command **does**. Refresh with `pnpm prime:surface`. Do not clone Prime.

This session read installed Prime docs at `~/.local/lib/node_modules/prime-agent/docs/`. It did **not** probe the live daemon. Unprobed = **unverified**.

---

## Counts (0.9.3)

| Bucket | Count | Meaning |
|---|---|---|
| Daemon catalog | **106** | Public `DAEMON_COMMAND_TYPES` |
| **Spoken** | **39** | Rhizome already sends this `type` |
| **Never-call** | **7** | Must not send (ADR-0163 / client safety) |
| **Unspoken** | **60** | Exists; not sent; not forbidden |

Unspoken = catalog − spoken − never-call.

These numbers are a **dated snapshot**, not a completion percentage and not an implementation queue.

---

## Spoken (39)

Rhizome already talks these. Daily-drive jobs they serve: connect, prompt, stop, steer/queue, model + thinking, sessions, fork/tree, goal/heartbeat, packages reload, client-owned lifecycle.

`abort` · `attach` · `cancel_rlm_child` · `clear_queue` · `compact` · `complete_owned_session` · `create` · `cron_add` · `cron_cancel` · `cron_list` · `detach` · `extension_ui_response` · `follow_up` · `fork` · `get_available_models` · `get_commands` · `get_connection_state` · `get_messages` · `get_queue` · `get_session_stats` · `get_session_tree` · `get_state` · `heartbeat_manage` · `heartbeat_set` · `kill` · `list` · `navigate_tree` · `new_session` · `promote_owned_session` · `prompt` · `reload` · `rename_saved_session` · `resume_queue` · `set_auto_compaction` · `set_model` · `set_session_name` · `set_thinking_level` · `steer` · `switch_session`

`reload` is spoken after Settings → Packages install. Do not send it from Chat.

### Steer / queue — docs vs W4 remainder

`steer` / `follow_up` / `get_queue` / `clear_queue` / `resume_queue` are **spoken**. GitHub **#41**’s “wired to nothing” body is stale — see [`primeTurnMessaging.ts`](../../src/lib/primeTurnMessaging.ts) and the 2026-09-13 #41 comment.

Prime `rpc.md` (installed 0.9.3, unprobed live):

- `steer`: queue while running; delivered after the current assistant turn finishes its tool calls, before the next model call.
- `follow_up`: queue until the agent has no more tool calls or steering messages.

W4 source/unit checks for visible queue + Enter-as-follow-up **passed**. W4 **native** steer/queue is **NOT RUN**. Do not close #41 from this file.

Remaining queue gap is **unspoken** `mutate_queued_message` (no TS call site). Prime `usage.md` describes TUI browse/edit/delete of queued items. `rpc.md` has **no** `mutate_queued_message` section. Daemon semantics **unverified**. Clear-all is not mutate-one.

### Job / evidence / blocker (spoken jobs)

| Job | Spoken names (examples) | Evidence | Blocker |
|---|---|---|---|
| Mid-turn send | `steer`, `follow_up`, `get_queue`, `clear_queue`, `resume_queue` | Source wired; W4 units 2026-09-13 | W4 live glance on `476756c`; #41 stays OPEN |
| Session create / switch | `new_session`, `switch_session`, `create`, `attach` | Host + list | List-import is W6, not these names |
| Client-owned close | `promote_owned_session`, `complete_owned_session`, `detach` | ADR-0167 code | W4 hide/reopen native |
| Extension dialogs | `extension_ui_response` only | Auto-cancel today | Native UI needs option 2 first slice |

---

## Never-call (7)

Do not send. The daemon is not ours to stop or restart (ADR-0163). Worker transport is internal.

| Command | Why |
|---|---|
| `shutdown` | Would stop other clients |
| `restart` | Same lifetime |
| `prepare_update_restart` | Updater / daemon infra |
| `set_transport` | Worker-internal |
| `retry_worker` | Worker-internal |
| `ack_result` | Protocol ack, not a product verb |
| `restore_actions` | Daemon restore, not Chat |

`get_direct_worker_transport` is **unspoken**, not never-call. Still treat it as worker-internal until a user job + probe says otherwise. No `rpc.md` section. Unprobed.

---

## Unspoken (60)

Exists on 0.9.3. **Not a backlog.** Grouped by existing talk only.

### Session import — blocked on Atticus `1`

`import_jsonl` · `export_jsonl` · `export_html` · `list_saved_sessions` · `delete_saved_session`

**Job:** left Sessions rows for imported Claude/Cursor/GPT/Hermes threads.  
**Evidence:** vault half shipped; W6 paper recommends route **1**.  
**Blocker:** Atticus says **`1`**. Do not code list rows. See [`import-jsonl-routes.md`](import-jsonl-routes.md).

Installed meaning used by W6 (docs + source comment, **not live-probed this session**):

- `daemon.md`: import (with new / switch / fork) **replaces the root runtime**; public active-session id stays.
- `importFromJsonl` installed comment: switch runtime state to the imported session. Call includes `activeSessionId`.
- `rpc.md` omits `import_jsonl`. Cancellation, disk overwrite, and “does this mint a list row?” stay **unverified**.

`new_session` is already **spoken**. Route 1 is `new_session` + `import_jsonl` per thread, then restore — only after **`1`**.

### RLM / tree remainder (probe-first)

`get_context_tree` · `get_rlm_children` · `get_rlm_max_depth_status` · `set_rlm_max_depth` · `delete_rlm_subagent`

Spoken already: `get_session_tree`, `navigate_tree`, `cancel_rlm_child`. Do not treat tree remainder as #17 (closed).

### Queue / steer extras

`mutate_queued_message` · `abort_and_clear_queue` · `set_follow_up_mode` · `set_steering_mode`

`rpc.md` documents `set_steering_mode` / `set_follow_up_mode` (`all` vs `one-at-a-time`). Rhizome does not send them. Default behavior **unverified** on this daemon. W4 remainder does not include wiring these.

### Side questions / refine (not spec-ready)

`start_side_question` · `abort_side_question` · `refine`

`usage.md` has `/refine` and `/btw` / `/side`. Not a W5 slice.

### Agent-to-agent (not spec-ready)

`list_agent_peers` · `agent_messages_clear` · `agent_messages_pause` · `agent_messages_resume` · `agent_messages_status` · `send_message` · `append_custom_message`

### 0.9.3 names, no user job yet

`get_direct_worker_transport` · `roster_subscribe` · `roster_unsubscribe`

Name-only. Not in `rpc.md`. Unprobed. Not a ship ticket.

### Abort family

`abort_bash` · `abort_branch_summary` · `abort_compaction` · `abort_retry`

Spoken already: `abort`.

### Session / model extras

`get_session_context` · `get_session_header` · `get_last_assistant_text` · `get_system_prompt` · `get_user_messages_for_forking` · `get_model_catalog` · `cycle_model` · `cycle_thinking_level` · `set_scoped_models` · `set_service_tier` · `set_session_entry_label` · `set_auto_retry` · `rename` · `reattach`

`set_scoped_models`: Prime `usage.md` — `/scoped-models` **enables/disables models for Ctrl+P cycling**. Picker filter. **Not routing.** Unprobed on the daemon.

### Heartbeats extras

`heartbeat_get` · `heartbeat_update` · `heartbeats_list`

Spoken already: `heartbeat_set`, `heartbeat_manage`.

### Input pause / wait

`acquire_session_input_pause` · `release_session_input_pause` · `cancel_prompt_admission` · `wait_for_idle` · `wait_for_headless_completion` · `prompt_and_wait`

### Bash / tools / resources

`execute_bash` · `execute_bash_and_wait` · `get_tool_definition` · `get_resource_snapshot` · `replace_acp_mcp_servers` · `restore_next_turn`

Do not add a Rhizome bash engine. Prime already has one.

---

## How to use this on #5

1. Pick a **user job** from [`prime-agent-surface.md`](prime-agent-surface.md) next-slices, not a name from unspoken.
2. Confirm the name is still in `pnpm prime:surface`.
3. Read Prime’s own doc for that command. Probe. If neither exists, write **unverified**.
4. If it is never-call, stop.
5. If the job is list-import, stop until Atticus says **`1`**.
6. If the job is steer/hide/C64, take W4’s native remainder — do not re-derive it from this count table.

**#5 stays an outline.** Spoken 39 / 106 is not “harness surface complete.”

**Hard no:** do not vendor Prime. Do not rewrite `prime_session_host.rs` as a second loop. Do not treat #56’s `ai_models.rs` path as a Prime command (it is a Rhizome bypass).
