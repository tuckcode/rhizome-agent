# Rhizome Desktop Shell Execution Plan

Goal: make the Tolaria fork feel like an early Rhizome Desktop shell and add one useful Rhizome integration path without building autonomous behavior yet.

Branch: `rhizome/mvp-shell`

Current repo: `/Users/dtc/Documents/Projects/rhizome-desktop`

## Rules

1. Local only. Do not push or publish.
2. Keep Tolaria AGPL license intact.
3. Keep Rhizome core separate and MIT in `/Users/dtc/Documents/Projects/rhizome`.
4. Do not implement autopilot/automation yet.
5. Prefer read-only Rhizome tools first.
6. Avoid large refactors.
7. Verify every touched path with targeted tests or a clear blocker.

## Task 1 — Rebrand app shell metadata

Files:
- `package.json`
- `src-tauri/tauri.conf.json`
- maybe `mcp-server/package.json`

Changes:
- `package.json.name`: `rhizome-desktop`
- Tauri `productName`: `Rhizome`
- Tauri `identifier`: `ai.rhizome.desktop`
- Tauri window title: `Rhizome`
- Tauri deep-link scheme: `rhizome`
- Disable/remove Tolaria updater endpoint for MVP.
- Keep AGPL license.

Acceptance:
- No `refactoringhq.github.io/tolaria` updater endpoint remains in active Tauri config.
- App metadata no longer identifies product as Tolaria.

Verification:
- `python3 -m json.tool package.json >/dev/null`
- `python3 -m json.tool src-tauri/tauri.conf.json >/dev/null`

## Task 2 — Add Rhizome vault detection helper

Files:
- Create `src/utils/rhizomeVault.ts`
- Create `src/utils/rhizomeVault.test.ts`

Function shape:
- `RHIZOME_OPERATIONAL_DIRS = ['.rhizome', 'raw', 'governance']`
- `isRhizomeVaultPath(path: string, entries?: string[]): boolean`
- `rhizomeVaultDisplayLabel(path: string): string`
- `shouldHideRhizomeOperationalPath(relativePath: string, showOperationalDirs: boolean): boolean`

Detection rules:
- A vault is Rhizome-like if it has `RHIZOME_VAULT.md`, `.rhizome`, or known folders like `concepts`, `entities`, `queries`, `sources`, `projects`.
- Do not require all folders. This must work on partial/new vaults.

Acceptance:
- Tests cover marker file, `.rhizome`, known-folder heuristic, and operational-dir hiding.

Verification:
- `pnpm vitest run src/utils/rhizomeVault.test.ts`

## Task 3 — Add MCP rhizome_search tool

Files:
- `mcp-server/tool-service.js`
- `mcp-server/index.js`
- `mcp-server/ws-bridge.js`
- `mcp-server/tool-service.test.js`

Behavior:
- Add read-only MCP tool: `rhizome_search`.
- Args: `{ query: string, limit?: number, vaultPath?: string }`.
- Validate vaultPath is active using existing requestedVaultPath logic.
- Shell out to `rhizome-search <vaultPath> <query> --limit <limit>` only if `rhizome-search` exists on PATH.
- Never pass full user secrets/env. Use a tiny safe env: `PATH`, `HOME`, `USER`, `LANG`, `LC_ALL`, `TERM`, `TMPDIR`.
- Return both raw text and parsed-ish metadata if easy; text-only is acceptable for first pass.

Safer implementation detail:
- Use `node:child_process` `execFile`, not shell string interpolation.
- Timeout after 30 seconds.
- Clamp limit to 1–20.

Acceptance:
- MCP list includes `rhizome_search`.
- Tool service can be unit-tested by injecting a fake runner instead of requiring real rhizome-search.
- If CLI is missing, error is clear: `rhizome-search CLI not found on PATH`.

Verification:
- `cd mcp-server && npm test`

## Task 4 — Add a command palette entry only if cheap

Files likely:
- `src/hooks/useAppCommands.ts`
- `src/components/CommandPalette.tsx`

Behavior:
- Add `Rhizome: Search Vault` if it can reuse existing search UI or toast results cleanly.
- If this touches too much UI, skip this task for the first vertical slice.

Acceptance:
- No awkward custom modal. Prefer not doing it over building bad UI.

## Task 5 — Verify

Commands:
- `git diff --stat`
- JSON checks for changed JSON files.
- `pnpm vitest run src/utils/rhizomeVault.test.ts` if dependencies installed.
- `cd mcp-server && npm test` if dependencies installed.
- If dependencies are missing, run install only if lockfiles support it and it does not explode; otherwise report blocker.

## Explicitly not doing now

- Open Notebook fork.
- Research Room/podcast mode.
- Grok-Wiki importer implementation.
- Rhizome autopilot.
- Desktop distribution/signing.
- GitHub push.
- Huge localization pass.

## Next after this plan

If the vertical slice works:
1. Add `.rhizome/events.jsonl` read-only viewer.
2. Add `rhizome_lint` and `rhizome_graph_summary` MCP tools.
3. Add Grok-Wiki JSON importer.
4. Add Rhizome settings panel.
