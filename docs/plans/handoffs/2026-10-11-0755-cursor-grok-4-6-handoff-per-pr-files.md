---
session: 2026-10-11T07:55Z
model: Cursor Grok 4.6
description: >-
  Per-PR notes go in docs/plans/handoffs/ only. HANDOFF.md stays an index
  and no longer takes a State or Recent line from each PR.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · stop HANDOFF.md merge conflicts

## What landed

Every PR was appending a State Origin line and a Recent sessions line
near the bottom of `docs/HANDOFF.md`. Whichever PR merged second always
conflicted (#142, #143, #145, #148).

New PRs add one file under `docs/plans/handoffs/` named
`YYYY-MM-DD-HHMM-<agent>-<topic>.md`. They do not edit `HANDOFF.md`.
The index keeps its existing body and now says so at the top.

Agent instructions in `AGENTS.md`, `.claude/commands/handy.md`,
`.cursor/skills/rhizome-ship/SKILL.md`, `.cursor/rules/continual-learning.mdc`,
`docs/CROSS-MODEL-HANDOFF.md`, `docs/GETTING-STARTED.md`,
`docs/YOU-SHOULD-KNOW.md`, and `docs/plans/rhizome-ship-skill.md` now
point at the per-PR file. `pnpm handoff:check` still caps the index at
900 lines, forbids inline `## Session handoff` sections, requires
frontmatter, and now also requires the top pointer.

## Not in this change

No product code. No State or Recent line on `HANDOFF.md` (this file is
the record). knispo merges.
