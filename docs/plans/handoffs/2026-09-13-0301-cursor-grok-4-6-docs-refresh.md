---
session: 2026-09-13T03:01Z
model: Cursor Grok 4.6
description: >-
  Docs automation: living architecture, briefing, Getting Started, and
  cross-model traps catch up to the 2026-09-12 daily-drive batch
  (Packages install, Tab Case 1, On top/Beside, hide-on-close helpers,
  session-switch transcript clear).
commits: pending
---

# Living docs catch-up (2026-09-13)

**Origin:** Cursor Grok 4.6 · 2026-09-13 · cron documentation automation

Verified against source, then updated existing pages. No product code.

Last dedicated living-docs pass was 2026-09-08. The daily-drive batch
after that shipped in code and `BOARD.md`, but the architecture pages
still described the 09-08 shell.

## What was stale

- Chat layout named Beside only as a compact flag. Code:
  `ChatNoteSplitToggle` On top / Beside, `AskChatExcerptMenu`,
  `latestAssistantMessageIndex`, 32px Show Notes hit target.
- Prime chat had no Tab / reply-pill contract. Code: `suggestReply`
  (#51 Case 1 only).
- Session switch mentioned skip-ensure but not the immediate transcript
  clear (`usePrimeSessionSwitcher`).
- Packages hub existed in `ARCHITECTURE.md` but omitted: daemon has no
  install command, 180s CLI, lazy catalog, full-system-access confirm.
- Hide-on-close (C22) did not say helpers stop
  (`release_helpers_for_hidden_window`).
- Settings still implied the model catalog loads with the panel.
  Code: Agents / Packages intersection observers.

## What to read

- Layout + chrome: `docs/ARCHITECTURE.md` §Chat-Centered Layout
- Prime: same file, reply suggestions / packages / hide-on-close
- Pitfalls: `docs/GETTING-STARTED.md` · `docs/CROSS-MODEL-HANDOFF.md` §20–21
- Briefing: `docs/YOU-SHOULD-KNOW.md` §2
