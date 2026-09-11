---
session: 2026-09-06T18:16:00-05:00
model: Composer
description: >-
  Wired Claude Code session-import into Settings (vault notes under Imports/);
  Getting Started now builds a local Rhizome scaffold by default instead of
  cloning Tolaria. Prime session-list import and C11 remote starter still open.
---

# Session import UI + first-run scaffold

## Shipped

### 1. Session import — Settings UI on the existing engine

- Tauri commands: `preview_claude_code_session_import`,
  `run_claude_code_session_import`
- Settings → Agents: **Import chat history** (Scan / Import to vault)
- Writes `Imports/claude-code/*.md` with `type: Imported Session`
- Ledger at `<vault>/.rhizome/import-ledger.json` (idempotent re-runs)
- PostHog: `session_import_started` / `session_import_completed`

### 2. Getting Started — local Rhizome scaffold

- Default `create_getting_started_vault` no longer clones Tolaria
- Seeds folders (`inbox`, `projects`, `Imports`, …), Portent types, welcome,
  `views/active-projects.yml`, `imported-session.md` type
- Remote clone only when `RHIZOME_GETTING_STARTED_REPO_URL` (or legacy alias)
  is set

## Blocked / still open

| Item | Why |
|---|---|
| **Prime session-list rows** | `import_jsonl` replaces the active session; route 1 (`new_session` + import per thread) needs Atticus OK on session displacement cost |
| **Cursor / GPT / Hermes adapters** | Only Claude Code scanner exists |
| **Fuzzy-duplicate review sheet** | Count shown; those sessions skipped this pass |
| **First-run “Import chat history?” Welcome step** | Settings entry shipped; C9 Welcome still open |
| **C11 remote starter repo** | Default path fixed locally; constant + env still name Tolaria URL until a Rhizome-owned repo exists |

**Decision needed:** ship Prime list rows via expensive `new_session`+`import_jsonl`
(route 1), write into `~/.prime/agent/sessions/` (route 2, ADR-0163 tension),
or keep vault-only until Prime grows a mint-session import.

## Files

- `src-tauri/src/commands/session_import.rs` (+ `mod.rs` / `lib.rs` handler)
- `src/components/SessionImportSettingsSection.tsx` (+ test)
- `src/components/SettingsPanel.tsx`, `src/App.tsx`, `src/mock-tauri/mock-handlers.ts`
- `src-tauri/src/vault/getting_started.rs`
- `src/lib/locales/en.json` (label: Create Getting Started Vault)
- `docs/NEXT.md`, `docs/HANDOFF.md`

## QA

1. Restart `pnpm tauri dev`
2. Settings → Agents → Scan (needs `~/.claude/projects`) → Import to vault
3. Confirm notes under `Imports/claude-code/` and ledger under `.rhizome/`
4. Re-Scan → new count should be 0
5. Vault menu → Create Getting Started Vault into an empty path → welcome + folders, no Tolaria clone

## Tests

- `cargo test --lib commands::session_import` — pass
- `cargo test --lib create_local_rhizome_scaffold` — pass
- `npx vitest run SessionImportSettingsSection.test.tsx StatusBar.test.tsx` — 71 pass

Daily-drive goal: **not** complete.
