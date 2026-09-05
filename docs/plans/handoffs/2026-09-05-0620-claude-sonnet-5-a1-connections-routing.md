---
session: 2026-09-05T06:20:00-05:00
model: Claude Sonnet 5
description: >-
  A1 completion slice: gave ConnectionsPanel a controlled openView API and
  rerouted the session-footprint chip and status-bar Graph pill through it in
  command-rail mode. Ten-cycle native timing/CPU/RSS remains open.
---

# A1 — Connections routing (rail-caller consolidation)

## Implemented

- `ConnectionsPanel` (`src/components/ConnectionsPanel.tsx`) is now
  `forwardRef`-wrapped and exposes `ConnectionsPanelHandle.openView(view,
  { focusPath? })` via `useImperativeHandle`. Calling it opens the panel to
  the requested view; for `mycelium` with a `focusPath`, it seeds
  `myceliumState.path` and bumps a `myceliumFocusToken` key so
  `SessionActivityHistory` remounts with the new session (its own `path`
  state only reads the retained value once, on mount).
- `App.tsx`: `handleRailSelectGraph` (status-bar Graph pill + full-page
  Graph's `onExit`) and `handleOpenSessionFootprint` (ChatHome's session
  footprint chip) now check `chatCentered` — in command-rail mode they call
  `connectionsPanelRef.current?.openView(...)` instead of toggling the
  classic full-page Graph/Mycelium destination. Classic shell
  (`chatCentered` false) keeps the old full-page toggle unchanged, since
  Connections only renders when `chatCentered` is true.
- Note: the status-bar Graph badge (`GraphBadge` in
  `StatusBarSections.tsx`) only renders when `!pillMode`, and `pillMode =
  commandRailActive` — the same flag `chatCentered` is keyed off. So today
  that particular caller's `chatCentered` branch is unreachable through the
  UI; the routing is still correct plumbing for any future command-rail
  entry point that calls `handleRailSelectGraph`. The footprint chip *is*
  reachable in command-rail mode and is the one this session could verify
  end to end.

## Tests added

- `ConnectionsPanel.test.tsx`: three new tests for `openView` — opens Graph
  from the closed edge, focuses a specific Mycelium session, and re-focuses
  to a second session (needed `waitFor` on the attribute value, not
  `findByTestId`, since the element persists across the second call).
- `App.test.tsx`: `opens the session-footprint chip into Connections, not
  the full-page Mycelium destination` (sets `get_prime_session_host_status`
  with `running: true` + `sessionPath`, clicks
  `prime-session-footprint`, asserts `connections-panel` + the Mycelium tab
  + the focused session in the `Activity session` select) and `routes the
  status-bar Graph pill into Connections in command-rail mode` (documents
  that the badge is absent in this mode rather than exercising a dead
  branch).

## Evidence

- 105 focused tests pass: `App.test.tsx` (46), `ConnectionsPanel.test.tsx`
  (7), `SessionActivityHistory.test.tsx`, `CommandRail.test.tsx`,
  `graph/GraphView.test.tsx`, `ChatHome.test.tsx`, `ChatNotePane.test.tsx`.
- `pnpm lint`, `pnpm typecheck`, `git diff --check`, `pnpm handoff:check`
  all pass. The impeccable design hook ran on every edit and found nothing.
- No native QA run this session — no source change here touches rendering
  in a way native QA would newly need, and the prior handoff's native
  blocker (Codex native controls attach to `/Applications/Rhizome
  Agent.app` by shared bundle ID, not the rebuilt debug bundle) was not
  re-attempted per its own stop condition.

## Native QA — root cause of the attach blocker found, panel switching verified

Atticus asked to retry native QA against the exact debug bundle after
reporting a spinning-wheel hang when switching panels in the installed app.

**Root cause of the multi-session attach blocker (C-worthy, not yet
numbered): the debug bundle and the installed app share the same bundle
identifier (`ai.rhizome.agent`), and `tauri-plugin-single-instance`
(`src-tauri/src/lib.rs:403`) enforces one running instance per identifier.**
Launching the debug `.app` (via `open -n` or its executable directly) while
`/Applications/Rhizome Agent.app` is running does not produce a second
process — it silently hands the launch to the existing instance and the new
process exits immediately with no output. This is not an attachment/selection
quirk in Codex's native controls, as prior handoffs guessed — the debug
process never stays alive to attach to. Every native check for at least two
prior sessions was therefore looking at the installed app regardless of what
bundle was "launched."

**Fix used this session:** quit `/Applications/Rhizome Agent.app`
(Atticus approved first), then launch the debug bundle — it stays running
as its own process (confirmed by executable path, not just app name) and
cua-driver attaches to it cleanly by pid.

**Panel-switching check (what Atticus asked for):** with the exact debug
bundle attached (pid confirmed via its filesystem path), cycled Chat →
Changes → Chat → Graph (via Connections) → Mycelium, then 8 rapid
Graph↔Mycelium toggles. Every switch was visually instant in follow-up
screenshots — no loading spinner, no stale/frozen frame. `ps` before/after
the 8 rapid toggles: CPU 0.4% → 1.4%, RSS 164304 → 163248 KB (flat, no
leak). **Could not reproduce the reported spinning-wheel hang in this
build** — the spinner Atticus saw was on the installed app, not this
session's rebuilt code. Whether it's a defect in the currently-installed
build, or something else, is unproven either way — this only rules out the
uncommitted A1 change as the cause.

**Not measured:** exact acknowledgement/content-ready millisecond timings
and a full ten-cycle protocol per the original A1 packet — this pass was a
qualitative spinner/responsiveness check per Atticus's specific ask, not
the quantitative ten-cycle measurement. That still needs its own pass if
precise numbers are wanted.

Window bounds were never changed (no resize/move performed), so nothing
needed restoring. Debug bundle quit cleanly at the end; Atticus chose to
reopen the installed app themselves rather than have this session do it.

## Still open from the A1 packet

- The ten-cycle Graph → Mycelium → Graph timing/CPU/RSS measurement with
  precise millisecond acknowledgement/content-ready numbers is still not
  done — the qualitative pass above found no spinner/hang, but did not
  time individual switches.
- No commit or push: Atticus requires approval before either.
