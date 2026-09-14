# Prime spoken vs unspoken vs never-call

**Status:** #5 skeleton. Snapshot only. Not a new architecture.  
**Source:** [`../prime-adapter-surface.json`](../prime-adapter-surface.json) (Prime **0.9.3**, audited 2026-09-12).  
**Index:** [`prime-agent-surface.md`](prime-agent-surface.md).  
**Rule:** a name in this file is not a ship ticket. Wire a **user job**. Probe the live daemon before sending a new name.

`prime-adapter-surface.json` answers “does this command **name** exist.” It never answers what the command **does**. Refresh with `pnpm prime:surface`. Do not clone Prime.

---

## Counts (0.9.3)

| Bucket | Count | Meaning |
|---|---|---|
| Daemon catalog | **106** | Public `DAEMON_COMMAND_TYPES` |
| **Spoken** | **39** | Rhizome already sends this `type` |
| **Never-call** | **7** | Must not send (ADR-0163 / client safety) |
| **Unspoken** | **60** | Exists; not sent; not forbidden |

Unspoken = catalog − spoken − never-call.

---

## Spoken (39)

Rhizome already talks these. Daily-drive jobs they serve: connect, prompt, stop, steer/queue, model + thinking, sessions, fork/tree, goal/heartbeat, packages reload, client-owned lifecycle.

`abort` · `attach` · `cancel_rlm_child` · `clear_queue` · `compact` · `complete_owned_session` · `create` · `cron_add` · `cron_cancel` · `cron_list` · `detach` · `extension_ui_response` · `follow_up` · `fork` · `get_available_models` · `get_commands` · `get_connection_state` · `get_messages` · `get_queue` · `get_session_stats` · `get_session_tree` · `get_state` · `heartbeat_manage` · `heartbeat_set` · `kill` · `list` · `navigate_tree` · `new_session` · `promote_owned_session` · `prompt` · `reload` · `rename_saved_session` · `resume_queue` · `set_auto_compaction` · `set_model` · `set_session_name` · `set_thinking_level` · `steer` · `switch_session`

`reload` is spoken after Settings → Packages install. Do not send it from Chat.

`steer` / `follow_up` / `get_queue` / `clear_queue` / `resume_queue` are spoken. GitHub **#41**’s “wired to nothing” body is stale — see [`primeTurnMessaging.ts`](../../src/lib/primeTurnMessaging.ts). Remaining queue gap is **unspoken** `mutate_queued_message`.

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

---

## Unspoken (60)

Exists on 0.9.3. Not a backlog. Grouped by existing talk only.

**Session import (blocked on Atticus route):** `import_jsonl` · `export_jsonl` · `export_html` · `list_saved_sessions` · `delete_saved_session`

**RLM / tree remainder (probe-first):** `get_context_tree` · `get_rlm_children` · `get_rlm_max_depth_status` · `set_rlm_max_depth` · `delete_rlm_subagent`

**Queue / steer extras:** `mutate_queued_message` · `abort_and_clear_queue` · `set_follow_up_mode` · `set_steering_mode`

**Side questions / refine (not spec-ready):** `start_side_question` · `abort_side_question` · `refine`

**Agent-to-agent (not spec-ready):** `list_agent_peers` · `agent_messages_clear` · `agent_messages_pause` · `agent_messages_resume` · `agent_messages_status` · `send_message` · `append_custom_message`

**0.9.3 names, no user job yet:** `get_direct_worker_transport` · `roster_subscribe` · `roster_unsubscribe`

**Abort family:** `abort_bash` · `abort_branch_summary` · `abort_compaction` · `abort_retry`

**Session / model extras:** `get_session_context` · `get_session_header` · `get_last_assistant_text` · `get_system_prompt` · `get_user_messages_for_forking` · `get_model_catalog` · `cycle_model` · `cycle_thinking_level` · `set_scoped_models` · `set_service_tier` · `set_session_entry_label` · `set_auto_retry` · `rename` · `reattach`

**Heartbeats extras:** `heartbeat_get` · `heartbeat_update` · `heartbeats_list`

**Input pause / wait:** `acquire_session_input_pause` · `release_session_input_pause` · `cancel_prompt_admission` · `wait_for_idle` · `wait_for_headless_completion` · `prompt_and_wait`

**Bash / tools / resources:** `execute_bash` · `execute_bash_and_wait` · `get_tool_definition` · `get_resource_snapshot` · `replace_acp_mcp_servers` · `restore_next_turn`

---

## How to use this on #5

1. Pick a **user job** from [`prime-agent-surface.md`](prime-agent-surface.md) next-slices, not a name from unspoken.
2. Confirm the name is still in `pnpm prime:surface`.
3. Read Prime’s own doc for that command. Probe.
4. If it is never-call, stop.

**Hard no:** do not vendor Prime. Do not rewrite `prime_session_host.rs` as a second loop.
