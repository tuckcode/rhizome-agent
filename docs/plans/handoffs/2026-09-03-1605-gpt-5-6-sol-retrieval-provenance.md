---
session: 2026-09-03T16:05-05:00
model: GPT-5.6 Sol (Codex)
description: >-
  Built #25's trustworthy first slice in the worktree: completed get_note
  calls now become deduplicated, one-click source links beneath the answer;
  browser live-review also verified the click-through and hardened the mock.
commits: (pending — Atticus asked to review before commit)
---

# Retrieval provenance — 2026-09-03

**Origin:** GPT-5.6 Sol (Codex) · 2026-09-03

## What changed

`AiMessage` now derives a compact `From your vault` row from the turn's real
tool actions. It reads the ungrouped action list, so two consecutive
`get_note` calls remain two openable sources even though the existing Tool use
disclosure groups repeated tool names. Repeated reads of the same path appear
once.

The trust boundary is intentionally narrow: an action must be `get_note`, have
status `done`, and carry a path. `search_notes` candidates do not count as
sources; neither do writes, calls still running, failures, or model-written
claims. Clicking a source uses the existing chat note pane. Analytics records
only `source_count`, never a path, title, or note content.

## Evidence

- TDD red/green coverage in `src/components/AiMessage.test.tsx`: multiple
  sources survive tool grouping, click opens the selected path, duplicate
  paths collapse, and unverified actions render no source row.
- Focused turn/replay checks: 56 tests passed.
- Full frontend coverage: 569 files / 5,963 tests passed; 88.13% line coverage.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed.
- Impeccable detector: no findings.
- Codacy Opengrep: 0 findings across the four audited source files. Lizard scores the
  new `RetrievedNoteSources` function CCN 2.
- The local Prime session logs contain real completed `get_note` calls with
  paths, confirming that both live and replayed turns provide the action shape
  this UI consumes.
- Browser live-review at `127.0.0.1:5201` in light and dark themes verified the
  source row, one-click note pane, accessible source label, and loaded neutral
  `release-plan.md` body. The development fixture identifies itself as `Mock
  model`; no Grok OAuth, provider login, or real model request was used.
- The review found and fixed two no-choice reliability defects: every dev-vault
  request now gives up after two seconds and falls back to fixture data, while
  a valid empty note is recognized as loaded instead of spinning forever.
  Absolute tool paths keep their exact click target but show only the filename,
  and the pill uses the repo's reliable trackpad-size floor.
- Follow-up checks: 57 focused unit tests and 2 focused Playwright tests pass,
  including replay → source → loaded note content and honest mock-model copy.

## Sessions rail placement

At an 834px app width, opening the 448px note pane while Sessions occupied a
separate Chat column left only about 71px of the note visible. Atticus chose a
different layout rather than an automatic hide: in Command-Rail mode,
`PrimeSessionList` mounts into the rail's blank middle, below all six
destinations and above the collapse/settings controls. The rail starts compact
and hovering anywhere on it expands the whole rail; `Keep rail open` makes that
state persistent, while `Collapse rail` returns it to hover mode. Either open
state reveals the Sessions list. Dragging the open rail's right edge resizes
its remembered width from 180–360px and pins it before the pointer leaves the
rail. The classic shell retains its old resizable Sessions column.

The focused Playwright flow verifies whole-rail hover expansion plus
hover → Sessions → replay source → hover-only note pane; visible-browser AX
review confirms the Sessions list occupies the requested empty rail region. No
new analytics event was added: this is layout placement, while
`vault_retrieval_source_opened` already records the deliberate source-open
action.

## macOS traffic-light fit

The main native window is configured with macOS overlay traffic lights, and the
command rail, sessions header, vault list, sidebar, Pulse, and editor-only
window each reserve the matching control space. The audit found one browser-only
layout defect: a Mac browser preview received the `mac-chrome` class despite
having no native controls, leaving a needless editor gutter. `main.tsx` now
adds that class only in native Tauri. The native clearance is covered by 155
focused layout tests; direct pixel confirmation still needs a running Orca app.

## Still required

No commit or push was made, per Atticus's instruction. Native click-through
could not run because `orca open --json` returned `runtime_open_timeout`; the
computer-use skill explicitly forbids switching drivers after that failure.
A real vault-backed conversation remains the final acceptance demo before
closing GitHub #25.
