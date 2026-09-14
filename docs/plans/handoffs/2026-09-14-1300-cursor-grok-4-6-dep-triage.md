---
session: 2026-09-14T13:00-05:00
model: Grok 4.6 (Cursor)
description: >-
  Astra dependency triage only. No lockfile bump. Compatible
  candidates recorded. Tiptap parked.
commits: none
---

# Astra dep triage — 2026-09-14 13:00

**Origin:** Cursor Grok 4.6 · paper only · no lockfile edit

Workspace pins in `pnpm-workspace.yaml`:

- `js-yaml@3` → **3.15.1** (Astra candidate **3.15.2**)
- `fast-uri` → **3.1.5** (Astra candidate **3.1.6**)

`mcp-server/package.json` repeats both pins. `vault.js` no longer
imports `gray-matter`; that package is unused on the S1 path but
still listed.

**Tiptap / BlockNote:** scanner High on `@tiptap/core` 3.19 / 3.22.
This app goes through BlockNote + an existing patch. Not a one-line
bump. Parked. Do not force one Tiptap core across peers.

**Stop this slice:** no override bump, no lockfile rewrite, no
editor migration. Next safe try (after S1–S4 commit): raise only
`js-yaml@3` and `fast-uri` to the named patch versions, then
`pnpm test:mcp` + a lockfile Trivy rescan.

Did not run Trivy this hour (would need network). Did not claim
Rhizome is an exposed HTTP server because `fast-uri` is transitive.
