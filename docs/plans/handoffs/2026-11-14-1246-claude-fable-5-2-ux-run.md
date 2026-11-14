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

## PR status

| # | Branch | PR | State |
|---|---|---|---|
| 0 | `ux/fable-run-plan` | [#291](https://github.com/tuckcode/rhizome-agent/pull/291) | Open. Local gates green. |
| 1 | `ux/approval-risk` | none yet | Code and tests done in the worktree. Screenshots captured. Not committed, not pushed. |
| 2 to 12 | see the plan | none | Not started |

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

Follow the PR sequence in the plan. PR 2 (one run-status model) is next after PR 1.
