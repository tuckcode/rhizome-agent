---
session: 2026-09-14T14:14-05:00
model: Grok 4.6 (Cursor)
description: >-
  C72 leftover: shortcuts sheet now says Notes, Browse closed / open.
  Packaged app still 476756c. No commit.
commits: none
---

# C72 shortcuts sheet — 2026-09-14 14:14

**Origin:** Cursor Grok 4.6 · decided leftover · no commit

The View menu already said ⌘2 **Notes, Browse closed** and ⌘3
**Notes, Browse open**. The Keyboard shortcuts sheet still said
**Editor + notes** / **All panels**.

TDD: failing test first, then the two override strings.

```bash
npx vitest run src/components/KeyboardShortcutsDialog.test.tsx src/hooks/commands/viewCommands.c72.test.ts
```

**6/6 PASS.** Inbox stays the folder. `Go to Inbox` stays.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
