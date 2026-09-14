---
session: 2026-09-14T14:47-05:00
model: Grok 4.6 (Cursor)
description: >-
  New chat still works with no vault. prime_session_new_session takes
  no vault path. Do not close #46.
commits: uncommitted
---

# New chat without a vault

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:47 · leftover tests.

ChatHome still shows New chat when `vaultPath` is empty. The Prime
reset is `prime_session_new_session` with no vault argument.

```bash
npx vitest run src/components/ChatHome.test.tsx src/components/AiPanel.test.tsx \
  -t "New chat|new Prime session"
```

**2/2 PASS.** No product edit. Do not close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
