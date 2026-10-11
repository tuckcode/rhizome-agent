---
session: 2026-10-11T05:55Z
model: Grok 4.6
description: >-
  knispo: move Changes out of the Views group and back next to Notes in the
  sidebar. Views are Research, Graph, Mycelium, History with shortcuts 1-4.
commits: cursor/navigation-grouping-d32a
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 05:55 UTC

## What landed

Follow-up on [#143](https://github.com/tuckcode/rhizome-agent/pull/143) after
the Ctrl+Cmd call. Same branch.

- Views on the rail: Research → Graph → Mycelium → History.
  Shortcuts are Ctrl+Cmd+1–4 on Mac and Ctrl+Shift+1–4 elsewhere.
- Changes is next to All Notes in `SidebarTopNav` again. The count badge
  stays, and the accessible name is `Changes, N`.
- `go-changes` stays in the Go menu and ⌘K Navigation group, with no
  view shortcut.

Did not touch `AiPanelChrome.tsx` or ADR-0171.
