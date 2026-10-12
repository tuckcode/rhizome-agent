---
session: 2026-10-12T16:01Z
model: Grok 4.7
description: >-
  Docs for the command-rail Views group. Research, Graph, and Mycelium
  are center canvases. History is the pulse list. ADR-0171's Changes-only
  mount does not match App.tsx.
commits: HEAD
---

**Origin:** Cursor Grok 4.7 · 2026-10-12 · documentation automation

## What this records

`docs/ARCHITECTURE.md` and `docs/GETTING-STARTED.md` still said Graph and
Mycelium mount only on Changes. The rail grouping in `src/lib/railViews.ts`
replaced that mount. The living docs now follow `App.tsx`.

ADR-0171 was not edited. A later ADR can supersede it if someone wants the
decision record moved. The code is the source for the layout.
