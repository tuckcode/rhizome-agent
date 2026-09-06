---
session: 2026-09-06T04:05Z
model: Grok 4.6 (Cursor)
description: >-
  Status bar chrome: Contribute/Docs moved to Settings → About; build/update
  sits next to theme; composer lost the duplicate vault pill and gained the
  agent idle pill. Vault dropdown stays bottom-left. C67/C68 still unbuilt.
---

# Status bar and composer pills

Atticus: finish this chrome, commit, push, continue locally. C67/C68 stay
on paper.

## What shipped

- **Contribute** and **Docs** left the status bar. They live in
  Settings → About (`AboutSettingsSection`), last section after Telemetry.
- **Check for updates / build number** sits next to the theme toggle on the
  right. Outdated still uses `versionUpdate.badgeLabel` ("Update available").
- Bottom-left **vault dropdown** stays. The duplicate composer vault pill is
  gone.
- **Agents idle/working** (`AgentsPill`) sits on the composer next to
  thinking. Pill-mode status bar no longer renders it.

Cmd+K Contribute is unchanged.

## What did not ship

C67 (sessions context menu) and C68 (note lock, default editable) — captured
in `2026-09-06-0338-grok-4-6-lock-and-session-menu.md`.
