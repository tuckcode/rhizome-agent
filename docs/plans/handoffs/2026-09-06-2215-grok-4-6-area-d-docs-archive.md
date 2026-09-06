---
session: 2026-09-06T22:15Z
model: Grok 4.6 (Cursor)
description: >-
  Area D subtraction: removed Tolaria public site, Desktop release-notes,
  stale docs/plans/design archive, Pencil mocks, Laputa commands, and C18
  l10n invitation leftovers. No src/ or src-tauri/ product rewrites.
commits: 09fda32
---

# Area D — Tolaria/docs archive

**Origin:** Grok 4.6 · 2026-09-06 · area D cleanup

Verified against the docs+agents research (`bc-6c84937a`) and live tree, then
deleted only what was still dead.

## Removed

- Public VitePress `site/` (Tolaria CNAME, Download Tolaria, refactoringhq/tolaria)
- May–Jun Desktop `release-notes/*.md`
- Stale docs: VISION, architecture-2026-06-30, grok-wiki pair, podcast ref,
  PUBLIC-DOCS-PLAN, research-mode-prompts. `YOU-SHOULD-KNOW.md` is kept
  (living briefing; HANDOFF/NEXT still point at it).
- Design one-shots: opendesign prompt, shell-final-direction, onboarding
  walkthrough, rhizome-default-themes, skills-as-versioned-artifacts
- Desktop MVP/roadmap, `*session-status.md`, finished 2026-07 retooling
  archaeology, plus named ledger/duplication/handoff-classification dumps
- 50 `design/*.pen` files (zero refs outside `design/`)
- `.claude/commands/laputa-done.md`, `laputa-next-task.md`
- Empty `.mcp.json`, Desktop `trademarks.md`, `lara.yaml`
- `package.json` `l10n:*` scripts and `@translated/lara-cli`

## Smallest wiring

- `scripts/build-agent-docs.mjs` no-ops if `site/` is absent; existing
  `src-tauri/resources/agent-docs/` left in place (no src-tauri rewrite)
- `docs:build` is now `pnpm agent-docs`; vitepress dep and deploy-docs
  workflow removed
- `CONTRIBUTING.md` rewritten as a private `tuckcode/rhizome-agent` stub

## Kept

IDENTITY, VAULT_CONTRACT, WINDOWS-DEV, YOU-SHOULD-KNOW, prime-adapter-surface.json,
harness-doctrine/composition, token-routing, automatic-memory-consolidation,
current `docs/plans/handoffs/`, `2026-09-01-session-import-plan.md`, ADR index.

Linux CI clippy on this PR is **C69** (macOS-only dead code). Not an Area D
defect; do not “fix” it by editing `src-tauri/` in the docs-archive PR.
