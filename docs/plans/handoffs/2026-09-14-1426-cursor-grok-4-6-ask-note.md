---
session: 2026-09-14T13:50-05:00
model: Grok 4.6 (Cursor)
description: >-
  Right-click Ask the agent about this note keeps Chat and opens that
  note. App wiring lock. No commit.
commits: none
---

# Ask-the-agent App wiring — 2026-09-14 13:50

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

List-menu already passed the entry. ChatHome already opened a handed-in
note. The leftover was App: `handleAskAgentAboutNote` → Chat stays, note
pane opens.

Research hides Notes, so Ask cannot start there. The real path is Notes
open on Chat.

Added one case in `App.test.tsx`.

```bash
npx vitest run src/App.test.tsx -t "Ask the agent about this note"
```

**1/1 PASS** (54 skipped). No product edit.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
