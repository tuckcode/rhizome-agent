---
session: 2026-09-14T13:12-05:00
model: Grok 4.6 (Cursor)
description: >-
  Tightened .cursor ignore so only rhizome-ship is trackable.
  Impeccable stays out. Native Copy-menu allowlist tests added.
commits: none
---

# Cursor ignore + Copy allowlist tests — 2026-09-14 13:12

**Origin:** Cursor Grok 4.6 · D6 hygiene · no commit

`!.cursor/skills/` had un-ignored **every** skill. `git status` showed
`impeccable/` next to `rhizome-ship/`. Added `.cursor/skills/*` then
re-allowed only `rhizome-ship`.

`git add -n .cursor` now lists only
`.cursor/skills/rhizome-ship/SKILL.md`.

Also added two shipped-chrome tests on
`shouldAllowNativeContextMenu`: marked note surface and the latest-reply
marker. **5/5** in `src/utils/nativeContextMenu.test.ts`.
