---
session: 2026-09-14T13:53-05:00
model: Grok 4.6 (Cursor)
description: >-
  S1 leftover: coffee/coffeescript tags and searchNotes stay data-only.
  No commit.
commits: none
---

# S1 coffee + searchNotes — 2026-09-14 13:53

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

S1 already locked `---javascript` / `---js` on getNote, context, and
tool-service. The leftover was the other executable tags in
`vault.js` (`coffee`, `coffeescript`, `cson`) and the `searchNotes`
entry.

Added three cases in `mcp-server/vault.security.test.js`.

```bash
node --test mcp-server/vault.security.test.js
```

**18/18 PASS.** No product edit. Did not speak `import_jsonl`.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
