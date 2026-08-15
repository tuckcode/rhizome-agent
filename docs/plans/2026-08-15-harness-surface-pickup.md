# Pickup — 2026-08-15 (Claude Opus 5) → next session

> ⛔ **Partly superseded (2026-08-15d).** The section "**The slash-command
> surface — the next build**" scopes that work against the RPC transport. That
> scoping is wrong: the commands it names are mostly **daemon-only**, and
> Prime's built-in commands do not execute when sent via `prompt`. See
> `docs/adr/0163-connect-to-the-prime-daemon.md` and issue #5 (spec, 17 tickets
> at #6–#22). The chain it prescribes — `/grill-with-docs` → `/to-spec` →
> `/to-tickets` in one window — **was run, and produced those.**
>
> Everything else below stands: the reframe, the three confused counts, what
> landed, what was verified, the open threads, and the traps. One correction —
> "Prime's own 11 skills" is **right**; a later session's "correction" to 13 was
> wrong. 13 ship; `linear` and `notion` do not load.

Supersedes `2026-08-15-native-loop-handoff-for-claude.md` and
`2026-08-15-claude-review-of-native-loop.md` as "what is true now". Both remain
accurate history.

Everything below is pushed. `origin/main` is current — verify, do not trust:

```bash
git status -sb && git log --oneline -8
```

---

## The reframe that matters more than any commit

**Prime Agent is not a model in a chat box. It is a supervisor.** From
`PrimeIntellect-ai/prime-agent`: RLM treats context as variables and tools as
programmable calls, with **subagents invoked programmatically**, plus
**persistent goals** with token budgets, **heartbeats and schedules** for
self-scheduled re-entry, **daemon-backed continuity**, agent-to-agent
messaging, and a **continual harness** — a memory/refinement system holding
supplemental prompts, memories, skill descriptions and subagent specs, which
`/refine` updates with evidence and can roll back via snapshots.

Rhizome renders roughly none of that. That is the product gap, and it is not
what the scoreboards were measuring.

**Three counts got confused this session. Do not repeat it.**

| Count | What it is | Honest status |
|---|---|---|
| "~16 of ~45 RPC" | JSONL protocol verbs (`prompt`, `compact`, `fork`) | Fine. Wire when a screen needs one. |
| "100 commands" from `get_commands` | Installed skills, **89 of them Atticus's own** from `~/.agents/skills` | Not Prime capability. Not a to-do list. |
| Prime's own surface | 11 bundled skills + the slash commands + RLM | **This is the harness.** Barely started. |

I twice advised *against* the daemon surface as "no frame needs it". That was
wrong — the frames predate anyone reading what Prime is. Do not inherit that
advice.

## Prime's own 11 skills

`agent-message`, `agent-observe`, `attach-image`, `compact`, `edit`, `goal`,
`prime-intellect`, `refine`, `rlm-heartbeat`, `skill-creator`, `websearch`.
Everything else in `get_commands` is user-installed.

## The slash-command surface — the next build

Prime documents these at
`~/.local/lib/node_modules/prime-agent/docs/usage.md`. Rhizome offers **none**.

Harness-relevant: `/goal`, `/heartbeat`, `/heartbeats`, `/autonomous`,
`/rlm-max-depth`, `/refine`.
Session tree: `/fork`, `/clone`, `/tree`, `/resume`, `/name`, `/compact`,
`/context`, `/export`, `/btw`.
Settings: `/model`, `/effort`, `/scoped-models`, `/mcp`.
Skills: `/skill:name`. Extensions can register more.

**Do this as a proper spec, not a slice.** It is multi-session: a completion
palette in the composer, argument hints, which commands are safe to expose,
and what a command that changes harness state should show afterwards.

Per `/ask-matt`: `/grill-with-docs` → `/to-spec` → `/to-tickets`, all in **one
unbroken context window**, then `/implement` per ticket with `/clear` between.
Do not start it on a tired window — that is why this handoff exists.

## Landed today

| Area | What |
|---|---|
| Tool cards | `prime_tool_unwrap` — the vault skill shells out through `ipython`, so cards read `ipython` with no path and no **Open**. Now unwrapped to `get_note wiki/x.md`, one Rust implementation shared by the live stream and replay. |
| Transcript replay | Fixed a defect of mine: replay filtered `tool_use`/`input`; real logs write **`toolCall`/`arguments`**, so every tool card was silently dropped. |
| Fork | `fork(entryId)` wired. Button existed and was permanently disabled. |
| Activity band | `AgentActivityBand` — goal, heartbeats, schedules, thinking level. Renders nothing when nothing runs. |
| C22 | Closed. Two bugs (below). |
| Dogfood UI | Status colour decoupled from the user's brand accent; traffic-light inset; Desktop floating bubble removed. |
| Playwright | Notes-shell pin applied to the 22 bare-`goto` specs that needed it; smoke lane green. |

## Verified live, and what is not

**Verified against the real binary or the running app:** the tool unwrap
(captured off a live `tool_execution_start`, pinned verbatim as a fixture);
`fork` (session id changed, history truncated 263 → 238); the model picker
**end to end** — `set_model` to `anthropic/claude-haiku-4-5` and the next turn
was answered by that model; C22 close/reopen; the subhead and composer deck.

**Not verified:** the activity band with real activity — this session had no
goal or heartbeat, which is exactly the case that renders nothing. Ask Prime to
set a goal or create an rlm heartbeat. And the fork *button* (the RPC is
proven, the click path is not).

## Open

- **C25** — two regression-lane specs fail on stale content expectations,
  independent of the notes-shell pin. Not in the push gate.
- **C24** — dead exports in `primeSessionToMindwalk.ts`; delete on the next
  Mycelium touch.
- **Green flash in the status bar** — diagnosed, not fixed. `syncIconColor`
  falls back to green for any status not in `SYNC_COLORS`, and `'syncing'` is
  not in it, so every 5-minute auto-pull shows a green spinner. Product call:
  should a routine no-op pull announce itself at all? I would say no.
- **Grok 4.6** is not in Prime's catalog (78 models: anthropic 13, opencode 59,
  xai 6). Not ours to add — it arrives with a `prime-agent` update. Never
  hardcode a model.

## Traps this session paid for

- **Editing `src-tauri/` while `tauri dev` runs does not rebuild.** The old
  binary keeps serving and a landed fix looks absent.
- **Killing only the vite port leaves the app binary alive**, so
  `tauri_plugin_single_instance` makes each relaunch hand off and exit 0. Kill
  `target/debug/RhizomeAgent` too.
- **A fixture fix only reaches specs that use the fixture.** Prove a helper
  patch from a caller that *bypasses* it.
- **Verify against the artefact, not your reading of it.** Two defects were
  invisible to passing fixtures: a `model_change` parse that invented a nested
  object no real log contains, and `tool_use` vs `toolCall`.
- **Status colour is not brand colour.** `--primary` follows the user's accent;
  a red accent made a healthy session look like an error.
- **`npx tsc --noEmit` is not the gate.** `tsc -b` is.
- **Push when the gates pass** — see the standing rule correction at the top of
  `docs/HANDOFF.md`. The old "ask first" rule was a dead workaround.
