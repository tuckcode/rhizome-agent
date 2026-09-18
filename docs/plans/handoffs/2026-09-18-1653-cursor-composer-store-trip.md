---
session: 2026-09-18T16:53-05:00
model: Composer (Cursor)
description: >-
  Store-trip work while Atticus was out. Menu-bar Done row, Pi skill
  symlink skip, drop unused Getting Started env aliases. Committed
  locally. Not pushed. Not rebuilt.
commits: local only
---

# Store trip — 2026-09-18 16:53

**Origin:** Cursor Composer · Atticus said skip the 2-second watch and keep going.

Committed locally. Not pushed. Packaged app is still `712024d`.

## Done in the tree

1. **#52 finish row.** When a chat drops off the tray roster, the menu keeps
   `Done: {title}` for 45 seconds and the tooltip says `Rhizome — session finished`
   if nothing else is running. A failed roster read does not invent finishes.
   Tests in `menu_bar_companion.rs`. Do not close #52 — native glance not run.
   No system notification.
2. **C58.** A skill symlink that points at itself no longer fails Pi startup.
   The link on this machine was not deleted. Regression:
   `command_skips_a_skill_symlink_that_points_at_itself`. The three `pi_cli`
   stream tests pass on this machine.
3. **#57 slice.** Getting Started no longer reads `TOLARIA_GETTING_STARTED_REPO_URL`
   or `LAPUTA_GETTING_STARTED_REPO_URL`. Neither was set here.
   `RHIZOME_GETTING_STARTED_REPO_URL` stays.

4. **#13 tray detail.** A running tray row now says what the chat is doing
   (`Working`, `Running a command`, …) and how many helpers, including
   grandchildren. Same words as the menu-bar popover, one line.
5. **#45 refusal label.** An empty assistant turn with `usage.input == 0`
   is no longer “finished without returning a reply”. It says
   `{provider} rejected this request before it ran (no input tokens).`
   A quiet turn that did use input tokens still uses the old placeholder.
6. **Done row click.** Opening a finished chat removes that row. The next
   menu refresh does not put it back.
7. **#57 test names.** Test-only `TOLARIA_*` environment names in the shell
   probe, stdin probes, and one OpenCode fixture are now `RHIZOME_*`.
   Live note tokens and the cache folder were left alone.

## Not this trip

C64 eyes, #46 live, import `1`, #26 install, #23 search, mouse-back winner,
Tiptap bump, C66, #66 merge, rebuild.
