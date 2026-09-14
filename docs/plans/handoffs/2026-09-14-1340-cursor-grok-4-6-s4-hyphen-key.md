---
session: 2026-09-14T13:40-05:00
model: Grok 4.6 (Cursor)
description: >-
  isSensitiveDiagnosticKey also locks api-key and apikey.
  Redaction 19/19. No commit.
commits: none
---

# S4 hyphen/glued key — 2026-09-14 13:40

**Origin:** Cursor Grok 4.6 · leftover S4 test · no commit

Normalize already strips `_` and `-`. Tests now lock `api-key` and
`apikey` as well as snake / camel / ENV.

`npx vitest run src/lib/sensitiveTextRedaction.test.ts` — **19/19**.
Did not inspect real secrets.
