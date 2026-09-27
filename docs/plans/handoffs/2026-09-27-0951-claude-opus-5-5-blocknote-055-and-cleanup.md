---
session: 2026-09-27T09:51-05:00
model: Claude Opus 5.5
description: >-
  BlockNote 0.46.2 -> 0.55.0 and tiptap 3.31.3 landed with the crash-guard
  patches ported; Dependabot pins, Windows C80/C82, the 77 stranded Mac files
  and the rail fold fix are on main. stepack v1 shipped in its own repo. Native
  QA of 0.55 not done. Cursor swarm plan written for everything still open.
---

# 2026-09-27 · BlockNote 0.55, Dependabot cleanup, stepack, swarm plan

**Origin:** Claude Opus 5.5 · 2026-09-27 · Claude Code Mac session "STE-100 skill pack research"

## State

- `origin/main` = the commit that adds this file, on top of `b2c306e`. Nothing unpushed after it.
- `/Applications` is still `d0a55f8`. Everything below is source-only until a rebuild.

## What landed

- **BlockNote 0.55.0 + tiptap 3.31.3** (`2fc0795`..`c13d5b6`). Clears both `@tiptap/core` alerts (GHSA-j95f-988m-3j2f and the `mergeAttributes` one). `pnpm-lock.yaml` has 0 Trivy findings.
  - Highlighting moved to an editor extension. The app keeps its languages through `createTolariaSyntaxHighlighting()`. A code-block patch exports `createBundledShikiHighlighter`.
  - Link clicks: 0.55 dropped `openOnClick`, so the editor passes `links.onClick` returning false (`src/components/richEditorLinkOptions.ts`).
  - The drag-handle menu now needs `portalElement` (`usePortalElement`).
  - Patches: `@blocknote__{core,react,code-block}@0.55.0.patch`. The old `@tiptap__extension-link@3.19.0` patch was dropped, because BlockNote ships its own link now.
  - The core patch edits `src/` (some regression tests import it) and the ES module `dist/`. **The CommonJS dist is not patched, on purpose.**
  - Upstream now covers three old guards: the side-menu missing block, the table block refresh, and the late suggestion emit. Everything else is ported, with 20/20 guard tests.
  - The Tiptap park is lifted. `leftover-tiptap-parked.test.ts` now guards "no `@tiptap/core` below 3.30.5".
- **Dependabot pins** (`dcc96ce`). PRs #70 and #71 closed. #72 and #74 were web-merged by Atticus (no pre-push checks ran). #72 is superseded by `c13d5b6`.
- **Windows** C82 (`93816c6`) and C80 (`a012c95`), by the Windows session.
- **77 stranded Mac files** committed as 8 labelled commits, including `website/assets` that the live landing page referenced but git never had.
- **Rail fold** (`8ed9817`): the pinned rail folds so an open note fits beside Chat.
- **Footer rule:** `voice-ste.md` wins. Keep the full tally, including `Doing: none` (`94d4561`).
- **stepack** v1: `tuckcode/stepack` `0e48633`, 6 skills, modpack-style README.
- **Hermes (Mac):** the `rhizome` MCP is off in `~/.hermes/config.yaml`. The terminal skill is the one route.

## Unverified

- 0.55 in the native app: nothing was clicked. Smoke: 23 passed, 7 flaky, 0 failed.
- The `.codacy.yaml` worktree exclude (`a4eeda6`) does **not** reach Trivy. About 30 old worktrees still fill the scan.

## Findings

- The pre-push hook refuses `git push --delete`. Delete a branch through `gh api -X DELETE`.
- A disk cleaner wiped `~/Library/Caches/ms-playwright`. The hook downloads it again.
- The Gemini free quota blocks the stepack benchmarks: 15/120 done on `gemini-3.5-flash`. `gemini-2.5-flash` is closed to new keys. Atticus pasted the key in chat, so it must be rotated.

## Next

`docs/plans/2026-09-27-cursor-swarm-plan.md` holds every open item and the ask list for every parked idea. Cursor (Grok 4.7) is the lead.
