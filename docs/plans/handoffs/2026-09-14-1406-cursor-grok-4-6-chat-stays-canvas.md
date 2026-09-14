---
session: 2026-09-14T14:06-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat canvas stays when Notes is open. BOARD import card waits for 1.
  No commit.
commits: none
---

# Chat stays the canvas — 2026-09-14 14:06

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Notes-left-of-Chat was already locked. The leftover was the canvas:
`chat-center` must still be there when the Notes panel is open.

One assertion in `App.test.tsx`.

```bash
npx vitest run src/App.test.tsx -t "puts compact navigation above the selected note list"
```

**1/1 PASS** (52 skipped in that file). No product edit.

BOARD pile #5 now says type **`1`**. Do not speak `import_jsonl`.
#41 / #46 leftovers named as native, not missing source.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
