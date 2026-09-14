---
session: 2026-09-14T14:04-05:00
model: Grok 4.6 (Cursor)
description: >-
  Expanded command rail shows Notes, not Inbox. Inbox stays the
  folder. No commit.
commits: none
---

# Rail Notes label — 2026-09-14 14:04

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Collapsed accessible name was already **Notes**. The leftover was
expanded visible text: the Notebook button must say Notes, not Inbox.

One assertion in `CommandRail.test.tsx`.

```bash
npx vitest run src/components/CommandRail.test.tsx -t "keeps Settings as a gear"
```

**1/1 PASS** (13 skipped in that file). No product edit.

Inbox stays the folder (`Go to Inbox`). Do not rename it.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
