---
session: 2026-09-05T21:45:00-05:00
model: Claude Opus 5
description: >-
  Built the session-import engine (verified on 318 real sessions), unblocked the
  graph tools for agents — they had never once worked — rewrote the vault skill
  so agents discover them, and fixed four UI defects. Right-panel layout agreed
  but not built.
---

# Session import, agent-facing graph, UI fixes

## The two findings that matter most

**1. No agent has ever successfully run a graph query.** The five
`rhizome_graph_*` tools shell out to the bundled `rhizome-tool` binary and fail
closed without `RHIZOME_TOOL_PATH`. The app sets that for the MCP server it
spawns, but the seeded Prime skill tells the agent to run `cli-call.mjs` from a
**bash tool**, which inherits none of that environment. Every graph question
returned "Graph queries need the Rhizome sidecar", since the tools shipped.

Reproduced by running the exact command the skill documents, then confirmed
fixed by supplying the path. Real vault, working:

> 191 notes, 199 links. 102 (53%) connect to nothing, and 67 links point at 43
> notes that were never written.

**2. The agent was never told the graph exists.** The seeded skill listed eight
tools, all note CRUD, and its description named only "search, read, create
note, open note". An agent chooses whether to open a skill from that
description *before* reading the body, so a relationship question never brought
it here. Both fixed; see commits.

**Not yet verified end to end.** The skill file on disk is still the old one —
it regenerates only when the app seeds it, and no build with these changes has
been installed. The remaining test is: rebuild, install, attach a vault, ask a
relationship question, and see whether the agent reaches for the graph unaided.
Nothing so far proves the *behaviour* changed.

## Session import — engine complete, no UI

`src-tauri/src/session_import/`. Everything below is committed and tested.

- **Ledger** is the authority on "already imported" (ADR-0169), because an
  import can land in the vault, the session list, both, or — on a skip —
  neither, and a skip is a decision that must not be re-asked.
- **Dedup**, five source-agnostic rules ending in "ask the user". On 317 real
  sessions it produced **zero** false duplicate prompts.
- **Claude Code adapter**, written against the real format: 23,380 messages
  across 60 files surveyed *before* the parser. Text blocks only — `thinking`
  is not what was said, and tool traffic is both the likeliest place for a
  credential and a reason two exports of one conversation would hash
  differently. Sidechains skipped, or one session imports as several.
- **Selection**: everything goes to the vault; only the most recent few per
  project earn a session-list row. Per project, not a flat total — this machine
  holds 316 sessions across 17 folders, one holding 216, so a flat cap of five
  would take all five from that one folder.
- **Preview then run**, so what is written is exactly what the user was shown.

**End-to-end on real history: 318 notes written, zero failures, and a second
run wrote nothing** — all 318 recognised as already imported.

**Still missing:** Tauri commands and any UI. Nothing in the app can trigger
this yet.

### The constraint that stalls the session-list half

`import_jsonl` **replaces the active session's contents**; it does not mint a
list row per call. Verified against Prime 0.8.0's own docs and installed source
(`daemon.md:27`, `daemon-agent-connection.js:1094`), not the adapter snapshot,
which carries the command's name and never its behaviour. Full analysis and the
three routes are in the plan's Destination section. Atticus's call: cap the
session-list copies (three per project) so the expensive path stays small; the
vault gets everything.

## UI defects fixed

- **Connections resize was inverted** — dragging out narrowed it. `resizeBy`
  already flips the sign for a right-docked panel; Connections flipped it
  again. No test covered drag *direction*, which is why it shipped.
- **Titlebar stole the window drag** — the Prime strip's text was selectable,
  so dragging swept a selection instead of moving the window. `select-none`,
  matching `LinuxTitlebar`. Deliberately not applied to `BreadcrumbBar`, which
  holds a renameable title.
- **Chat/editor split was fixed at half each** with no handle; now draggable
  and remembered.
- **Session list sorted by file mtime**, so a backup or sync silently
  reordered history. Now sorts on the conversation's own date.

## Agreed, not built: the right-hand panel

Atticus's layout, from a marked-up screenshot and the exchange after it:

- **Notes is the heavy half** of the right panel — inbox and note list on top.
- **Graph/Mycelium are a sub-panel below it**, bottom half to bottom quarter,
  with a **resizable divider**; both visible at once.
- **The Connections edge strip goes away entirely.** Reason, his words: "too
  many panels of their own, nothing wide enough with this many".
- Later idea, unresolved: **a matching icon rail on the right**, mirroring the
  left, with rail icons as *toggles* so several surfaces stack in one column.
  My recommendation was to build that, since it is the only option that does
  not get worse as surfaces are added; the cost is ~46px of permanent chrome.

**Note for whoever picks this up:** in the screenshot the right side is the
note *editor*, not the Notes panel — the Notes panel is hidden in that view
mode. Atticus asked "where is my vault notes inbox" for exactly this reason.
The layout above is the answer, and it is unbuilt.

## Still open

- **C40** — `rhizome_graph_summary` answers from a different graph than the app
  (144 notes vs 155). The other four tools read the correct graph. Retiring it
  in favour of `rhizome_graph_health` is the noted move.
- **Mycelium has no agent interface, and that is worth building.** `mindwalk
  build`/`trace`/`analyze` all take an argument and write JSON — already
  tool-shaped. Better first step: Rhizome already reads Prime session logs
  itself (`prime_sessions.rs`), so "which files did this session touch, in what
  order" can be exposed without depending on Mindwalk at all. Graph answers
  *what connects to what*; session history answers *what was done to it and
  when*.
- Session-import Tauri commands and UI.

## Verification

- `pnpm test` 6005 passed · `cargo test --lib` 1788 passed
- lint, typecheck, clippy, fmt clean. Codacy: 0 findings on changed files;
  24 pre-existing dependency advisories, untouched lockfiles.
- Localization: none — English only (C18).
- **Native:** the resize and titlebar fixes are committed but were **not**
  re-verified in a rebuilt app; the last install predates them.
