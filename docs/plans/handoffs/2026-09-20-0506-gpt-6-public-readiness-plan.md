---
session: 2026-09-20T05:06-05:00
model: GPT-6 (Codex)
description: >-
  Public-readiness assessment and Cursor swarm plan. Reconciles latest design
  docs, 17 open GitHub issues, three draft PRs, and parked ideas. Typecheck and
  292 focused tests pass. Incomplete reasoning history tracked as C76. Handy
  installed as a Codex skill, shortened for progressive disclosure, and used
  for the final copy-paste handoff.
commits: 4f9b4c4..HEAD
---

# Public-readiness assessment and Cursor plan

Atticus requested an assessment of the updated docs and public daily-driver readiness.
He then requested a plan that preserves prior design work, NEXT, parked ideas, and relevant GitHub issues.
He designated Cursor as the main executor and authorized planning for an agent swarm with ample credits.

## Deliverables

- [Assessment and execution stages](../2026-09-20-public-readiness-plan.md).
- [Cursor swarm brief with paste-ready dispatch](../2026-09-20-cursor-public-readiness-swarm.md).
- [Live issue, design, and parked-idea inventory](../2026-09-20-public-readiness-inventory.md).
- Pointers in HANDOFF, NEXT, and BOARD. C76 records the incomplete-history display gap.
- Local Codex skill `handy` installed at `~/.codex/skills/handy/SKILL.md`.
  Its launch block now routes through the session handoff instead of repeating it.

The proposed swarm has one coordinator and six independent specialist lanes.
Writing lanes use isolated worktrees. Native QA has one owner and one candidate at a time.
The plan prioritizes reliability, vault safety, clean installation, and publication evidence.
Parked features retain their explicit decision gates.

## Evidence

- Local HEAD and local origin/main reference both read `dc44d84`.
- The existing dirty tree contained 22 tracked modifications and the 04:38 pickup.
- `pnpm typecheck`: PASS.
- Focused Vitest: eight files, 292 tests PASS. App, CommandRail, traffic lights,
  StatusBar, AiMessage, normalizeReasoningDisplay, leftover-research-rail, parked-organs.
- Direct function probe: complete history block disappears; incomplete block remains.
- Live GitHub: 17 open issues; draft PRs #66, #67, #68. #49 is closed.
- Source checks: hide keeps Prime warm; MCP graph-summary delegates to graph health,
  while Rust's command path still calls the external CLI.
- Setup mismatch: documented Node 18+ versus installed Vite's Node 20.19+/22.12+ requirement;
  documented browser port 5173 versus configured 5202.

The installed app remains **last documented** as `6860762`.
This session did not independently verify its build identity or perform native QA.
No full gate, clean install, security rescan, or repository-history scan ran.
Temporary logs and GitHub snapshots are named in the assessment.

The source for Handy was the repo-local Claude command
`.claude/commands/handy.md`. Codex's GitHub installer cannot install a local
command, so the command was converted with the Codex skill-creator workflow.
The skill was revised after agent-facing review. It now uses repository
instructions plus the session handoff by default, permits one immediate plan,
and keeps history, inventories, and parked ideas in linked artifacts.
`quick_validate.py` reported `Skill is valid!` after the final revision.

## Boundaries

The rail and reasoning slice landed as `4f9b4c4`. The planning documents follow it.
No swarm started. No rebuild, PR merge, or issue closure occurred.
The plan does not authorize publication, list-import without `1`, Windows shipping, or provider-path removal.
The prior September 14 design package remains a source, with later Signal/pane decisions taking precedence.
