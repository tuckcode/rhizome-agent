---
session: 2026-09-20T05:48-05:00
model: Cursor Grok 4.6
description: >-
  Lane I install/docs: corrected the false “4f9b4c4 plus planning were
  pushed” claim; wrote PUBLIC-PREVIEW quick start, scope, recovery,
  permissions, telemetry, and license inventory. GitHub re-queried. #66
  not merged. C76 left open. No commit, push, or rebuild.
commits: none
---

# Lane I — install, claims, backlog reconciliation

**Origin:** Cursor Grok 4.6 · 2026-09-20 · swarm Lane I.

Worktree: `.worktrees/lane-i` on `cursor/lane-i-install-docs` at product
checkpoint `4f9b4c4`. Planning files were copied from the shared tree
and remain uncommitted here.

## What changed

1. Living-doc stamps no longer say `4f9b4c4` and planning were pushed
   together. Local product checkpoint is `4f9b4c4` (unpushed).
   `origin/main` is `dc44d84`. Planning is uncommitted. Installed app
   remains `6860762`. C76 stays open for the coordinator.
2. User-facing preview path: [`docs/PUBLIC-PREVIEW.md`](../../PUBLIC-PREVIEW.md).
3. Developer path corrections in `GETTING-STARTED.md`: Node engines,
   port `5202`, C75 hide, Getting Started env alias.
4. README points at the preview path and keeps the AGPL confirmation
   note unresolved.
5. GitHub requery: 17 open issues; draft PRs #66 #67 #68. #66 not
   merged. #67/#68 GETTING-STARTED hide/env lines reused after source
   check; their stale stamps were not reused.
6. Leftover lock: `src/lib/leftover-public-preview-claims.test.ts`.

## Not done

No commit, push, rebuild, or issue-state change. No clean-account
dogfood. No full coverage or Playwright. No legal determination.
