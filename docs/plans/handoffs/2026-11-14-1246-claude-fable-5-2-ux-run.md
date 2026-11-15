---
session: 2026-11-14T12:46-06:00
model: Claude Fable 5.2 (Claude Code desktop)
description: >-
  Running record of the front-end run from fable-ux-run-brief.md. Lists each
  PR, what changed, what is next, and the decisions that wait for Atticus.
---

# Front-end run: running record

**Origin:** Claude Fable 5.2 · 2026-11-14 · front-end run

The plan is [`../2026-11-14-fable-ux-run-plan.md`](../2026-11-14-fable-ux-run-plan.md). This file is the record. I update it after each PR.

## Open questions for Atticus

1. Graph becomes 2D by default. This reverses ADR-0155 and adds `force-graph`. Not started.
2. Telemetry consent moves behind the welcome screen. Not started.
3. The Language setting leaves Settings. Not started.
4. A destructive command cannot be approved from the collapsed row. Built in PR 1.
5. The welcome line changes. The words are your call. Not started.
6. The Notes list stops covering the open note. Not started.
7. ADR-0192 takes the number after ADR-0191, which PR #288 proposes. If #288 does not merge, the number sequence has a gap.

## Note from Atticus, 2026-11-14: side panels and the note side

Atticus asked for a rethink of the side panels. PR 11 (`ux/notes-dock`) grows to cover all of it. Do the understanding step before the build step.

What he named:

1. **Panel width.** Look at the width of both side panels.
2. **Text on the note side.** The note title, the body preview and the meta line look too much alike. The title must stand apart from the preview.
3. **How the right sidebar opens and closes.** The behaviour is not clear.

What the audit already shows (`docs/review-shots/ux-baseline/earth-note-open.png`):

- The Notes list lies over the open note and cuts its own rows at the right edge.
- A note row has a title at about 14px medium and a preview at about 13px. Both use nearly the same colour. Only the weight tells them apart.
- "Notes" shows twice as a heading.
- The right rail has a panel toggle, Inbox, All Notes, Changes, and then one icon for each recent note with no label.
- The left sessions panel is 240px. Its rows use a mono meta line that is smaller than the note meta line.

First step for PR 11: list each way the right side opens and closes today (rail icons, the panel toggle, the four pane presets of ADR-0173, shortcuts), with a screenshot of each state. Then propose one model. ADR-0170 and ADR-0173 are the recorded decisions for this area.

## Delegation, 2026-11-14

Atticus asked for cheaper models on the easier parts. Use this split:

- **Haiku:** the scale sweep by file (PR 6), fix-list status edits (PR 12), screenshot capture scripts.
- **Sonnet:** component tests, the lint ratchet (PR 5), the chat structure work (PR 4), Settings file split (PR 9).
- **Opus or Fable:** the run-status model (PR 2), the run timeline design (PR 3), first run (PR 7), the graph change (PR 10), the side-panel rethink (PR 11).

Give each agent its own worktree and its own files. No `codex`, `gemini` or `opencode` command is on PATH on this machine, so a ChatGPT model cannot take work from this session today. Atticus can start a ChatGPT session by hand with the brief for one PR.

## PR status

| # | Branch | PR | State |
|---|---|---|---|
| 0 | `ux/fable-run-plan` | [#291](https://github.com/tuckcode/rhizome-agent/pull/291) | Open. Local gates green. |
| 1 | `ux/approval-risk` | [#292](https://github.com/tuckcode/rhizome-agent/pull/292) | Open. Commit `db8d55cc`. Local gates green (3m 25s). |
| 2 | `ux/run-status` | [#302](https://github.com/tuckcode/rhizome-agent/pull/302) | Open. One run status line, the no-response state, the Stop shortcut. ADR-0193. Local gates green. |
| extra | `ux/chat-home` | [https://github.com/tuckcode/rhizome-agent/pull/303](https://github.com/tuckcode/rhizome-agent/pull/303) | Open. New-chat screen with a focal point and recent notes. Not in the first plan. Local gates green. |
| 11 | `docs/right-sidebar-model` | [#299](https://github.com/tuckcode/rhizome-agent/pull/299) | Open. Design decision only. 11b is Codex PR #301. |
| 5 | `ux/type-scale` | [#294](https://github.com/tuckcode/rhizome-agent/pull/294) | Open. Codex (Sol). |
| 3, 4, 6 to 10, 12 | see the plan | none | Not started |

## Where the work is

- Main checkout: branch `ux/fable-run-plan`.
- Worktree for PR 1: `<repo>/../rhizome-worktrees/ux-approval-risk`, branch `ux/approval-risk`, from `origin/main` at `8e704704`.

## PR 1: approval weight follows risk

- `src/lib/approvalRisk.ts`: reads a shell command and returns `routine`, `caution` or `danger` with plain reasons. 61 tests.
- `ToolApprovalCard.tsx`: shows the reasons under the header. A danger card has a danger border, an outline "Allow once" and a filled Deny.
- `AiMessage.tsx` collapsed row: a danger call shows Review, Deny and a tag. It shows no Allow.
- The session grant for a file tool reads "Allow this file for the session".
- PostHog event `tool_approval_replied` with `tool`, `risk`, `choice`, `surface`. It carries no command text and no path.
- `docs/adr/0192-approval-weight-follows-risk.md`.
- Screenshots: `docs/review-shots/approval-risk/`, before and after, both themes.

The plan said that an unknown command is `caution`. I changed that. An unknown command is `routine` and the card makes no claim, so that a harmless command does not get a warning line. ADR-0192 records it.

## Found during the audit, not fixed yet

- **C102, stale smoke assertions.** `tests/smoke/getting-started-template.spec.ts:64` and `tests/smoke/offline-onboarding-status.spec.ts:67` assert the test id `claude-onboarding-screen`. That id is not in `src/`. I did not run the two specs. The first-run PR will run them and repair them.
- **C103, spinner does not spin.** `AiActionCard.tsx` uses the class `ai-spin`. An agent check found no CSS rule for it. PR 3 fixes it.
- **C104, transcript may clear when the Notes panel opens.** In one scripted capture the session showed "This session has no messages" after the Notes panel opened. A manual run kept the transcript. Not confirmed.

## What I would do next

Follow the PR sequence in the plan. PR 2 (one run-status model) is next.

Start PR 2 like this:

1. Make a new worktree from `origin/main`. Do not edit a tree while its push runs, because the gate reads the working tree.
2. Read the run-state map in section 2.1 of the plan. The five displays are the frame pulse (`AiPanel.tsx`), the session dot, the `ChatComposerFoot.tsx` spinner, `ChatRunLiveStatus.tsx`, and the pulses in `AiMessage.tsx`.
3. Write the run-status model test first (`src/lib/chatRunLiveStatus.ts` is the nearest existing code).

## Second session, 2026-11-14 evening to 2026-11-15

- Reviewed Codex PR #298. Found C105, which Codex repaired in #300.
- Merged `main` into PRs #291 to #295 with the GitHub update action.
- Atticus said that the main screen looks bland. The chat-home PR answers that for the new-chat screen. The rest of the shell (session list, top bar, right rail, status bar) still needs the same treatment.
- Atticus named t3code as a comparison. Web pages on it describe little of its interface. Ideas taken from them: a visible permission mode beside the model chip, a per-turn review of changed files, and a per-turn revert.
- Do not run tests or screenshot captures in a second worktree while a push runs. The first push of #302 failed in the smoke lane under that load. Alone, the lane passed 33 of 33.

## Approved next, 2026-11-15

Atticus approved the shell restyle in the direction of PR #303. It was not started, because the session was at 92% of its usage limit. Start it in a new worktree from `origin/main`:

1. Session rows: title 13px weight 500, meta 11px mono (PR #299, section 2.5).
2. Top bar: the session title as the focal text, and the Command Palette as a quieter control.
3. Right rail: labels or tooltips with names, and no anonymous note icons (PR #299, section 2.3).
4. Status bar: one calm line.

Send a screenshot to Atticus before the push.

## What I would do after this

1. Shell character, in the style of the chat-home PR: session rows (decision in #299), the top bar, the right rail.
2. Plan item 3, the run timeline. It can now use `chatRunStatus.ts`.
3. A visible permission mode beside the model chip.

## Session end, 2026-11-14

The session stopped after PR 1 because the usage limit was near. Nothing is uncommitted in either tree. Two tools need one note each:

- `codacy-cli analyze --tool opengrep` fails with `UnicodeDecodeError` unless `PYTHONUTF8=1 LC_ALL=en_US.UTF-8` is set.
- The worktree needed a copy of the ignored `.codacy/` folder from the main checkout.
