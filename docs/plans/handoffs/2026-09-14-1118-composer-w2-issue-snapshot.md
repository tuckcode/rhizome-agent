---
session: 2026-09-14T11:18-05:00
model: Composer 2.5
description: >-
  W2 live gh snapshot: 17 open; close-set still CLOSED; open-issue staleness
  vs HANDOFF/MORNING; PR #66 draft CONFLICTING. No close/reopen/merge.
commits: none
---

# W2 issue evidence — live snapshot — 2026-09-14

**Origin:** Composer 2.5 · W2 lane · read-only `gh` · no issue/PR mutations

## Summary

| Metric | Value |
|---|---|
| Open issues (`gh issue list --state open --limit 60`) | **17** |
| Close-set recheck | **9/9 still CLOSED** |
| PR #66 | **OPEN**, **draft**, **CONFLICTING**, head `cursor/engineering-documentation-updates-bdf2` |

## Close-set confirmation (must stay CLOSED)

Live `gh issue view` on 2026-09-14 ~11:18 CT:

| Issue | State | Title |
|---|---|---|
| #14 | CLOSED | Schedules and heartbeats: see, pause, cancel |
| #17 | CLOSED | Branch navigation within a conversation |
| #18 | CLOSED | Transcript markers for actions that change what Prime remembers |
| #43 | CLOSED | No window-level navigation guard: anything that slips past the link handler strands the app |
| #47 | CLOSED | Pre-public gate: make failure states distinguishable |
| #49 | CLOSED | Sessions should be named by the model, not by whatever text came first |
| #53 | CLOSED | A failure creating the quick-note window silently costs you the menu bar icon |
| #54 | CLOSED | The ws-bridge restarts in a loop — 12 times in one session, several within the same second |
| #55 | CLOSED | Build the starter vault instead of cloning someone else's |

No close, reopen, or merge actions taken this pass.

## Still open — title + body staleness vs HANDOFF / MORNING

One line each. **Do not close** from this snapshot.

| Issue | Line |
|---|---|
| #5 | **Spec: the Prime harness surface** — body **stale**: Aug-15 spec only; HANDOFF/MORNING W5 papers landed (`design/prime-spoken-surface.md`, `design/prime-agent-surface.md`); issue correctly stays open. |
| #13 | **Menu bar dropdown shows what is running** — body **current**: parent #5; no HANDOFF/MORNING claim that acceptance criteria are met. |
| #23 | **Sessions are searchable knowledge, not opaque logs** — body **current**: differentiator ask unchanged; no shipped search-over-transcripts claim in HANDOFF/MORNING. |
| #26 | **Update Prime from inside Rhizome, as one Rhizome Agent update** — body **current**: detection half done (#19); in-app install half still open per HANDOFF handoff trail. |
| #32 | **Prime harness does not run on Windows — named pipes vs Unix sockets** — body **stale**: HANDOFF says closed **in code** (`1922a27`, `326930b`); body still reads as total connect failure; Windows E2E proof still missing (C42). |
| #36 | **Timezone setting: read a vault's timestamps as a chosen zone** — body **current** for the ask; repo spec (`plans/issue-36-timezone-setting.md`) adds locked calls not linked from the issue. |
| #39 | **Make the knowledge graph an agent tool, not a place you visit** — body **stale**: HANDOFF notes `rhizome_graph_*` MCP tools exist; body still frames graph as visit-only destination. |
| #40 | **Decide: is Rhizome a harness, or a client of harnesses?** — body **current**: deliberate `needs-info`; #56 tracks the concrete code tension. |
| #41 | **Typing while Prime is working: steer/queue path wired to nothing** — body **stale**: MORNING/HANDOFF — `AiPanel` passes `onSteer`; composer-disable narrative outdated; `mutate_queued_message` + W4 native evidence still open. |
| #45 | **Model settings: connect providers (OAuth/API key) and curate the model dropdown** — body **current**: connection-state + allow-list gaps still match HANDOFF/MORNING. |
| #46 | **Vault at $HOME clobbers Prime's global settings.json and scopes vault MCP to all of $HOME** — body **stale**: guarded on main (`e90e37c`); W7 defense-in-depth committed locally not pushed; MORNING — close only after live Chat-without-vault verify. |
| #48 | **OmniRoute as a managed local gateway (auto-start, like the Mindwalk sidecar)** — body **current**: discuss/defer; not installed on machine; no HANDOFF ship claim. |
| #50 | **Let the agent see the running app, not screenshots of it** — body **current**: HANDOFF — plan ready, not built; permission-signature pain still accurate. |
| #51 | **Tab to fill in the reply you were going to type** — body **partially stale**: rules-first ghost-text shipped; issue targets model-backed composer Tab replies (HANDOFF Case 2 / parked). |
| #52 | **The menu bar should tell you when the agent is done** — body **partially stale**: running-session list shipped (`menu_bar_companion.rs`); "just finished" notify still missing — spec `plans/issue-52-menu-bar-done.md`. |
| #56 | **Rhizome already has the second provider path the doctrine forbids** — body **current**: `ai_models.rs` / `stream_ai_model` tension documented; ADR-0168 vs code unresolved per HANDOFF. |
| #57 | **Delete the compatibility code that protects users who do not exist** — body **partially stale**: spec `plans/issue-57-ghost-compat.md` narrows safe deletes; `~/.laputa/cache` and Repair-only migrators still live per MORNING. |

## PR #66

```json
{
  "title": "docs: catch living pages up to the daily-drive batch",
  "state": "OPEN",
  "isDraft": true,
  "mergeable": "CONFLICTING",
  "headRefName": "cursor/engineering-documentation-updates-bdf2"
}
```

**Disposition:** hold. Comment/reconcile only. **Not merged** this pass.

## Actions not taken

- Did not close, reopen, or comment on any issue.
- Did not merge or edit PR #66.
- Did not edit BOARD, HANDOFF, NEXT, YOU-SHOULD-KNOW, MORNING, or product code.
