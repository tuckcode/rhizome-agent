# Session status — 2026-08-16g (C29 Cmd+N note list)

Grok 4.6. Picked up the 08-16f ranked item: C29.

## Shipped

C29 — after Cmd+N the new note now stays in the note list.

Verified: `pnpm exec playwright test --config playwright.smoke.config.ts tests/smoke/fix-crash-create-note.spec.ts --retries=0 --repeat-each=6` → 18/18.

Unit: 101 tests in the vault-loader files.

## What was actually wrong

The stashed protected-path work was the right shape and not enough:

- `resetInitialVaultLoadState` cleared `newPaths` on every vaults-arrived effect re-run.
- Restore only re-appended rows still sitting in `entries`. A reset that emptied the list left nothing to put back.
- Vite fixture `mtimeMs` values made Inbox sort fixture notes into year ~58595, so a correctly-seconded new note sank out of the Virtuoso viewport and looked missing even when present.

## Files

- `src/hooks/useVaultLoader.ts`
- `src/hooks/vaultWorkspaceEntries.ts`
- `src/hooks/useVaultLoader.test.ts`
- `src/hooks/vaultWorkspaceEntries.test.ts` (new)
- `vite.config.ts`, `scripts/serve-demo.mjs` (timestamp units)

## Not done

C12 (human PAT rotate), #13/#14, #21. Drop obsolete `stash@{0}` after this commit lands.
