---
session: 2026-09-14T13:56-05:00
model: Grok 4.6 (Cursor)
description: >-
  On top / Beside stays on the notes header, never the traffic-light
  rail. W11 memory-loop summary waits for 1. 3/3. No commit.
commits: none
---

# Note split placement — 2026-09-14 13:56

**Origin:** Cursor Grok 4.6 · leftover shipped-chrome test · no commit

Toggle labels were already locked. Placement was not.

Added one source lock in `src/App.layout-edges.test.ts`:
`ChatNoteSplitToggle` is `Editor` `leadingControl`. Command rail has
neither the component nor the words On top / Beside.

```bash
npx vitest run src/App.layout-edges.test.ts
```

**3/3 PASS.** No product edit.

W11 summary table now matches card 4: list-row import waits for **`1`**.

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
