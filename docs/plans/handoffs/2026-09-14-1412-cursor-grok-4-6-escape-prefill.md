---
session: 2026-09-14T14:12-05:00
model: Grok 4.6 (Cursor)
description: >-
  Escape leaves Chat while a turn runs (no Stop). Mycelium chip title.
  Ask Chat prefill stays in this thread. No commit.
commits: none
---

# Escape / Mycelium title / Ask prefill — 2026-09-14 14:12

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome tests · no commit

Three leftover locks. No product edit.

1. `AiPanel.test.tsx` — Escape while `thinking` still calls `onClose`.
   `stopMessage` is not called. Stop stays click-only.
2. `PrimeSessionSubhead.test.tsx` — CirclesThree chip `title` and name
   are **Mycelium**.
3. `src/utils/aiPromptBridge.test.ts` — `prefillAiComposer` fills this
   thread. It does not queue a send and does not start a new chat.

```bash
npx vitest run src/components/AiPanel.test.tsx src/components/PrimeSessionSubhead.test.tsx src/utils/aiPromptBridge.test.ts
```

**63/63 PASS.**

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
