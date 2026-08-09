# Rhizome Desktop MVP Plan

Goal: turn the local Tolaria clone into a Rhizome-branded desktop shell for the Rhizome markdown vault, focused on UI/app integration only. No autonomous automation yet.

License stance: this desktop fork is AGPL because Tolaria is AGPL. Keep Rhizome core/CLI MIT in the separate `knispo/rhizome` repo.

## What already exists in Tolaria that we should reuse

1. Markdown vault browser/editor.
2. Git-first vault workflow and file watcher.
3. MCP server and WebSocket bridge on ports 9710/9711.
4. External AI setup dialog.
5. Hermes local-agent support already exists in Rust.
6. AI stream event shape already supports text, thinking, tool start, tool done, error, done.
7. Settings panel and app preferences.
8. Multi-vault support.

## What this first pass should build

1. Rebrand the local app shell from Tolaria to Rhizome.
2. Make Rhizome Vault the preferred/default vault.
3. Add a Rhizome settings section.
4. Add Rhizome command/MCP tools that call existing Rhizome CLI commands.
5. Add a small run/event viewer for `.rhizome/events.jsonl` if present.
6. Add a Grok-Wiki import command stub in the UI, but do not implement full importer yet.
7. Keep AI chat secondary. The app is a vault/control surface, not the main chat interface.

## Exact files likely to touch

### Branding/app identity

- `package.json`
  - name: `rhizome-desktop`
  - keep AGPL license
  - scripts mostly unchanged

- `src-tauri/tauri.conf.json`
  - `productName`: `Rhizome`
  - `identifier`: likely `ai.rhizome.desktop` or `app.rhizome.desktop`
  - window title: `Rhizome`
  - deep-link scheme: `rhizome`
  - updater endpoint: disable or replace; do not point to Tolaria updater

- `src/lib/locales/en.json`
  - replace visible Tolaria strings used by app shell/settings/MCP setup

- `src/constants/feedback.ts`
  - update docs/feedback URLs or disable for MVP

### Vault defaults / Rhizome Vault handling

- `src/hooks/useVaultSwitcher.ts`
- `src/hooks/useStartupScreenState.ts`
- `src/components/StartupScreen.tsx`
- `src-tauri/src/vault_list.rs`
- `src/utils/vaultListStore.ts`

Desired behavior:
- Prefer `/Users/dtc/Documents/Rhizome Vault` on this machine if it exists.
- Detect `RHIZOME_VAULT.md`, `.rhizome/`, or known Rhizome folders as a Rhizome vault.
- Hide or de-emphasize `.rhizome/`, `raw/`, and `governance/` in normal browsing.

### Rhizome settings section

- `src/components/SettingsPanel.tsx`
- `src/components/settingsSectionIds.ts`
- `src-tauri/src/settings.rs`
- `src/types.ts`

Add settings fields:
- `rhizome_wiki_root`
- `rhizome_cli_path`
- `rhizome_default_agent`
- `rhizome_show_operational_dirs`
- `rhizome_enable_grok_wiki_import`

Keep these installation-local, not vault frontmatter.

### MCP tools / external agent bridge

- `mcp-server/index.js`
- `mcp-server/tool-service.js`
- `mcp-server/ws-bridge.js`
- `mcp-server/tool-service.test.js`

Add tools:
- `rhizome_search`
- `rhizome_lint`
- `rhizome_graph_summary`
- `rhizome_research_status` or `rhizome_events`
- `rhizome_open_page`

Do not add write-heavy tools in first pass except maybe `rhizome_refresh_vault`.

Implementation rule:
- Shell out only to installed `rhizome-*` CLI commands.
- Validate the vault path stays inside an active vault.
- Return structured JSON plus text.
- Do not pass API keys or full shell env.

### Native command support if needed

- `src-tauri/src/lib.rs`
- `src-tauri/src/mcp.rs`
- possibly new file: `src-tauri/src/rhizome_cli.rs`

Only add Rust if JS MCP cannot safely shell out to Rhizome CLI. Prefer JS MCP first for speed.

### UI commands

- `src/hooks/useAppCommands.ts`
- `src/hooks/useAppCommandAiActions.ts`
- `src/components/CommandPalette.tsx`

Add command palette actions:
- `Rhizome: Search Vault`
- `Rhizome: Run Lint`
- `Rhizome: Show Graph Summary`
- `Rhizome: Open Events`
- `Rhizome: Import Grok-Wiki Output` (stub)

### Run/event viewer

Likely create:
- `src/components/RhizomeEventsPanel.tsx`
- `src/hooks/useRhizomeEvents.ts`

Reads:
- `<vault>/.rhizome/events.jsonl`

First version can be read-only and simple:
- latest event time
- event type
- message/path
- open related page button

## First implementation sequence

1. Create a local branch: `rhizome/mvp-shell`.
2. Disable Tolaria updater endpoint and rebrand app metadata.
3. Update visible shell strings to Rhizome for English only first.
4. Add Rhizome vault detection helper with tests.
5. Add Rhizome settings section shell with no command execution yet.
6. Add MCP read-only `rhizome_search` by shelling out to `rhizome-search`.
7. Add command palette action that calls `rhizome_search` and opens matching note.
8. Add `.rhizome/events.jsonl` read-only viewer.
9. Run minimal tests: targeted Vitest for changed TS, targeted Rust tests if Rust touched, then `pnpm build` if dependencies are installed.

## Things explicitly out of scope for this pass

- Full Open Notebook fork/integration.
- Podcast/research room.
- Autonomous autopilot.
- Full Grok-Wiki importer.
- Hosted sync/accounts.
- Public release/build pipeline.
- Changing Rhizome core repo.

## Key risk

Tolaria is a big, heavily tested app with strict contributor rules. Make small changes. Do not refactor unrelated files. Avoid touching the editor core unless absolutely necessary.

## Product rule

Rhizome Desktop should be the control surface and vault UI. Hermes/Claude/OpenCode can remain the main chat interfaces.
