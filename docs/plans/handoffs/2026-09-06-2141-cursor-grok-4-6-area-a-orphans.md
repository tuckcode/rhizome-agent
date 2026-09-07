---
session: 2026-09-06T21:41Z
model: Cursor Grok 4.6
description: >-
  Nightly-style audit area A: deleted orphaned e2e/ (24 unused Playwright
  specs), unused scripts, unused biome.json, leftover mcp-server npm lock,
  and unused verifyFocusable helper. Live tests/smoke and tests/integration
  left in place.
commits:
---

**Origin:** Cursor Grok 4.6 · 2026-09-06 · area A subtraction

# Area A — orphaned e2e + unused scripts

Verified unused, then deleted:

- `e2e/` (24 specs). `playwright.config.ts` `testDir` is `./tests/smoke`;
  `test:e2e` / `playwright:smoke` / `playwright:regression` never load `e2e/`.
- Unused scripts: `serve-demo.mjs`, `wiki-frontmatter-repair.py`,
  `windows-prime-daemon.ps1` (WINDOWS-DEV.md kept), `generate_demo_vault.py`,
  `validate-locales.mjs` (C18; dropped `l10n:validate` from package.json),
  `appimage-launcher-tools.mjs` + `.test.mjs` (not in release packaging).
- Root `biome.json` (no `@biomejs` dependency; ESLint is the lint gate).
- `mcp-server/package-lock.json` (pnpm workspace leftover).
- Unused `verifyFocusable` export in `tests/smoke/helpers.ts`.

Docs: GETTING-STARTED tree now points at `tests/smoke/` only. Dropped
living-doc sentences that named the deleted scripts.
