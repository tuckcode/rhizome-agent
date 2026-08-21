# Pickup — frontend UI audit (2026-08-20 night)

The next session's job is **eyes on the running app**, not more harness
plumbing. Atticus wants a punch list of what is broken, half-done, or missing
on the real screens — especially the Prime / chat surface.

This is not "embed Rhizome inside Cursor." Cursor IDE chat can launch the app
and read logs; it cannot see the window. The audit uses **computer-use against
`pnpm tauri dev`**, with the screen unlocked.

## Why this, not candidate 4

Candidate 4 (`thinkingLevel` cache vs live poll) is still the next *code*
change. It is a structural bug that a person may or may not notice on a walk.
The audit is meant to find the *user-visible* remainder first, so we do not
spend another session on an envelope refactor while the panel still looks
unfinished.

After the punch list exists, rank it against the known backlog (below) and
pick one item that a person can see.

## Preconditions

```bash
# Daemon was orphan-file when this was written. Restart it.
prime-agent shutdown --force
prime-agent --mode daemon >/dev/null 2>&1 &
sleep 2
prime-agent status

# App. Screen must be unlocked — cua-driver `desktop_unlocked: false`
# returns black captures while `list_windows` still works, which reads as
# a code failure and is not one.
pnpm tauri dev
```

Prime is **0.7.4**. `xai/grok-4.6` is in
`~/.prime/agent/extensions/xai-oauth.ts` (`maxTokens: 500000`). Confirm it
still shows in the picker; the extension is outside the repo.

## Walk these screens, in this order

For each: screenshot, click the primary mouse path, then any keyboard path.
Score **works / broken / missing / unclear**. One sentence of evidence, not a
feeling.

1. **Chat home / AI panel** — model + thinking strip (#9), scheduled-work
   band (#14), goal, fork/compact/export/switch, prompt / steer / follow-up /
   abort. Does the strip match what the session is actually on? (Check the
   jsonl, never the model's self-report.)
2. **Menu-bar roster** (#13, `34b840e`) — titles should be the user's words,
   not "System instructions: You are working inside Rhizome…". A session
   waiting on the user should not say "Working". C34: all eight activity
   labels are English literals, never localized.
3. **History / session list** — #28 (half empty, all "Untitled"); #27
   (dockable sidebar, design decided, `set_session_name` is the mechanism
   and nothing calls it).
4. **Note list, editor, search** — only as a sanity check that the vault
   side still looks like a product. Core flows already have Playwright smoke.
5. **Settings that touch agents** — #26 (update Prime from inside Rhizome:
   `prime-agent update` exists, the button does not).

Write the scores into a new `docs/plans/YYYY-MM-DD-frontend-ui-audit.md`.
Do not "fix as you go" unless something is a one-line lie on screen (the
roster-title class of bug). The deliverable is the list.

## Known backlog to map against, not to start from

Do not re-derive these. Tick them if the walk confirms they are still
user-visible; drop them if the screen already handles them.

From `docs/plans/2026-08-20-prime-surface-gap.md`:

- #14 cannot **create** scheduled work (`set_heartbeat` / `cron_add`)
- Agent-to-agent messaging (`send_message`) has no UI
- Autonomous mode has no UI
- Goal pause/resume has no UI
- `export_html`, image prompting, `get_fork_messages` have no UI
- Live roster rows already have `isStreaming` / `isCompacting` / `model` /
  `thinkingLevel` on the `list` payload — `34b840e` fixed titles and
  `taskState`; remaining unused fields are a product choice, not a transport
  gap
- `observe` is **not** a daemon command. Do not build on it. Family-scoped
  `agent-observe` skill is for RLM children, not the roster.

From architecture review (verified 2026-08-20):

- **Candidate 4** — `thinkingLevel` served by two pollers; picker label
  goes stale on agent-initiated change. `7c5f7c9` only fixed explicit set.
- **Candidate 5** — write ~120 AiPanel tests *before* extracting handlers.
- **Candidate 2** — last, reduced scope (Prime command table).

Open issues **#26–#29**. Threads **C31–C34**. C33: `npx tsc --noEmit`
typechecks no test file.

## Probe rules that still apply

Docs describe **RPC mode**. Rhizome speaks the **daemon socket**. Extract
`DAEMON_COMMAND_TYPES` from `daemon-supervisor.js` before planning a
command. Two refusals mean different things:

| Message | Means |
|---|---|
| `Unknown daemon command: X` | Not in the set. Does not exist here. |
| `Supervisor cannot route daemon command: X` | Exists, worker-scoped — attach first. |

`get_model_catalog` is the second kind, unattached. Attached probe still
open; do it before the next model-picker change, not during the visual walk
unless the picker itself looks truncated.

## What this session already shipped (do not redo)

Pushed `6ce86d1..34b840e`, all gates green:

| Commit | What |
|---|---|
| `e276738` | Candidate 3 done — 15 envelope sites on `PrimeHost::call` |
| `ad27041` `870aedf` `da02b96` | Prime docs gap + probe corrections |
| `34b840e` | Roster titles + "Waiting for you" |

Deliberate non-conversions of `call` still stand: `abort_turn`,
`switch_session`, `refresh_session_id`, `run_prompt_stream` prompt path,
`connect` / `create_session` / `find_resumable_session`.
