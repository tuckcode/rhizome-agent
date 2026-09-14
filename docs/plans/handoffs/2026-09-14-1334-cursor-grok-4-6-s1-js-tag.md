---
session: 2026-09-14T13:34-05:00
model: Grok 4.6 (Cursor)
description: >-
  MCP S1 also locks ---js as data-only, not only ---javascript.
  vault.security 15/15. No commit.
commits: none
---

# S1 ---js tag — 2026-09-14 13:34

**Origin:** Cursor Grok 4.6 · leftover S1 test · no commit

The existing case used `---javascript`. The parser also lists `js`.
New fixture uses a `---js` fence and asserts the marker stays unset.

`node --test mcp-server/vault.security.test.js` — **15/15**.
Did not close #46. Did not scan HOME.
