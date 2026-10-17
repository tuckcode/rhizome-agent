---
session: 2026-10-17T12:05Z
model: Cursor Grok 4.6
description: >-
  Research library scan used invoke without a Tauri bridge. Route through
  callHost, add the mock handler, plain error + Retry, and the generate
  empty state (audit items 4 and 41).
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · pre-macOS UI audit items 4 and 41

Item 4: Research opened a vault and called `@tauri-apps/api/core` `invoke`
directly. In the browser mock that object has no `invoke`, so the generate
log showed `Library scan error: TypeError: Cannot read properties of
undefined (reading 'invoke')`. Other views already use `callHost`. The scan
now goes through `callHost`, and `mock-handlers` serves `rhizome_scan_library`
(plus `rhizome_search` / `rhizome_read_events` so Ask and History do not
hit the same gap). A failed scan is a banner: "Couldn't scan this library."
plus "The vault listing did not finish.", technical text behind Details,
and Retry.

Item 41: A successful or failed scan used to write into the generate event
log, so the empty log box filled the pane. Generate now keeps that log
empty until a run, and shows the centered empty state "Paste a repo URL or
pick a local folder to map it". Depth options keep the value `regular` and
the label Regular, with a one-line description each (Regular = typical
coverage for most repos). Destination and Local use the Phosphor Folder
icon. Format title is sentence case: Architecture map.

Review shots in `docs/review-shots/audit-research/` (Graphite dark + Earth light):

- `*-empty.png`
- `*-depth-open.png`
- `*-error.png`
- `*-error-details.png`
- `*-retry-focus.png`

Regenerate: `pnpm exec vite --port 4178` then
`node scripts/capture-research.mjs http://127.0.0.1:4178/scripts/research-shots.html docs/review-shots/audit-research`.

Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` — 7460 passed, 1 skipped.

Localization: none — English only (C18).
PostHog: no event needed because this is scan recovery and empty-state copy.
