---
session: 2026-09-14T14:10-05:00
model: Grok 4.6 (Cursor)
description: >-
  ChatHome wires the Agents idle/working pill next to thinking. Skills
  pill stays rhizome-vault. No commit.
commits: none
---

# ChatHome Agents pill — 2026-09-14 14:10

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

The composer deck already hosts an `activity` slot next to thinking
(`ChatComposerDeck.test.tsx`). The leftover was ChatHome itself: it
must pass `<AgentsPill>` and keep `skillsLabel="rhizome-vault"` (not a
vault switcher).

AiPanel is stubbed in `ChatHome.test.tsx`, so this is a source lock.

```bash
npx vitest run src/components/ChatHome.test.tsx
```

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
