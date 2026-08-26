---
session: 2026-08-25T23:48-05:00
model: Grok 4.6 (Cursor)
description: >-
  Unified Notes panel + adaptive collapse, close-note X, and titlebar
  drag fix. Native QA 2026-08-26: double-click holds, X closes the note.
commits: HEAD
---

# Shell harden — stop here 2026-08-25 night

Native QA passed 2026-08-26 in this session: titlebar double-click zooms
and stays; the header X closes the note. This tree is the commit.

## What is true in the working tree

The 16:08 handoff's two right-hand columns is stale. Current map
(ADR-0166 as revised tonight):

```
rail | sessions | CHAT | Notes panel (nav above list)
```

- Rail **Inbox** toggles one right Notes panel. Browse (Inbox / All Notes /
  Archive / types / folders) sits compact above the selected list.
- `viewMode`: `editor-only` hidden, `editor-list` panel open + Browse
  collapsed, `all` panel open + Browse expanded.
- Width-aware collapse: `src/hooks/useShellCompactLayout.ts`. Sessions
  overlay first, then the vault panel.
- Close note: trailing breadcrumb **X** (`breadcrumb-close-note`,
  `editor.toolbar.closeNote`). Same on file preview. The sidebar-looking
  header button is Properties, not close.
- Titlebar: `useDragRegion` only. No `data-tauri-drag-region` on the same
  surface. Drag starts after pointer move so double-click does not race
  maximize. Trap written in `AGENTS.md` and
  `docs/CROSS-MODEL-HANDOFF.md` §19.

## Native QA (2026-08-26)

- Double-click the top bar: zoom holds.
- Open a note, header **X**: note closes, Chat stays.

Pre-push has not been run on this stack.

## Left on purpose

- Green Inbox rail pulse when an agent saves a note (nice-to-have, not
  started).
- Graph / Mycelium still take the canvas (#39 / #11 / #22).
- GitHub #27 / #34 still open pending a live check.

## Do not

- Put `data-tauri-drag-region` back on breadcrumb / chat subhead / file
  preview.
- Treat the properties collapse icon as "close the note."
- Run `pnpm l10n:translate`.
- Close GitHub issues without a live Prime / native check.
