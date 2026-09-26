---
session: 2026-09-12T15:51Z
model: Grok 4.6 (Cursor)
description: >-
  Rebased PR #61 (Area D Tolaria docs purge) onto origin/main. Kept
  YOU-SHOULD-KNOW.md. Closed Linux clippy C69 on this branch. Did not merge.
commits: pending
---

# Area D rebase onto origin/main

**Origin:** Cursor Grok 4.6 · 2026-09-12 · PR #61

Worked in `~/code/projects/rhizome-agent-pr-61` only. Main working
tree was left dirty.

## Rebase

Onto `origin/main` (`3a21f9f`). Three original commits replayed.

Conflicts in the archive commit:

- `biome.json` — already deleted on main (Area A). Kept deleted.
- `docs/YOU-SHOULD-KNOW.md` — main still points at it. Kept the file.
- `docs/HANDOFF.md` — kept current main State + Recent sessions, added Area D.
- `package.json` — dropped VitePress/`l10n:*`; kept `check:mcp-bundle`.

C69 tracking commit: main already had the Linux clippy C69 line. Kept both
C69 rows (cli-call fixed; clippy then resolved by the follow-up).

## After rebase

- `YOU-SHOULD-KNOW.md` stays (living briefing).
- C69 Linux clippy marked resolved (`menu_bar_capture` / dock reopen cfg-gated).
- AGENTS.md no longer sends people to deleted `*-session-status.md`.
- Frontend design roadmap no longer points at `shell-final-direction.md`.
