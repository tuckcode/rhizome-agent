---
session: 2026-09-14T14:02-05:00
model: Grok 4.6 (Cursor)
description: >-
  Mycelium embed is an iframe on loopback, not a Mindwalk browser
  link. MORNING Now restamped. No commit.
commits: none
---

# Mycelium stays in-app — 2026-09-14 14:02

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Loopback `src` was already locked. The leftover was the element: it
must be an **iframe**, not a link that opens a browser.

One assertion in `MyceliumView.test.tsx`.

```bash
npx vitest run src/components/MyceliumView.test.tsx -t "renders Rhizome chrome"
```

**1/1 PASS** (5 skipped in that file). No product edit.

MORNING Now no longer says the leftover is “⌘2 label.” D6 ~15:45.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
