---
session: 2026-10-17T19:00Z
model: Claude Opus 5.5 (Claude Code desktop)
description: >-
  Eight Playwright regression tests failed identically on main. Seven were
  stale against the command-rail shell; one found a real sort bug (separate
  PR). C96 tracks the bare mock vault, where edits to mock notes never save.
commits: this PR
---

# Playwright regression specs

**Origin:** Claude Opus 5.5 · 2026-10-17 · regression-lane fix, found while building board PR C

## What failed and why

The same 8 tests failed on main (`041b3a7e`, and again on `462b1748`) with
`--retries=0`. None of them are in the push-gate smoke lane.

| Spec | Cause | Fix |
|---|---|---|
| `autogit-checkpoints` ×3 | Fresh launch is Chat (ADR-0173). The spec waited for a note list that never opened. Commit moved into the vault·git pill (`pillMode`). | `openAllNotesList`. Commit via `status-vault-trigger` → `vault-menu-commit`. |
| `manual-commit-modal-autogit-off` | Same launch change. The busy and keyboard states it checks exist only on the classic status-bar button. | Runs with `ff_shell_command_rail=false` and opens Notes with the `view-editor-list` command. |
| `editor-mode-modified-ordering` | A narrow list header moves Sort into "More list actions". The raw toggle is `CmdOrCtrl+\`, and the spec pressed Control on macOS. | Opens the overflow menu when present. Platform-aware toggle. **Needs the overflow-sort app fix to pass.** |
| `rich-editor-reload-typing` ×1 | The breadcrumb shows the note title since `e0bc34bc`. The filename is the trigger's `title` attribute. | Asserts the `title` attribute. |
| `vault-switch-clears-stale-editor` | Same launch change, before and after the vault switch. | `openAllNotesList` both times. |
| `windows-save-path-failure` | See C96. The edit was dropped before any save, so Ctrl+S said "Nothing to save". | Runs on the fixture vault. |

`openAllNotesList` (`tests/helpers/fixtureVault.ts`) is the fixture harness's
own "open Notes from the rail, expand Browse, pick All Notes" step, now
exported and shared. `waitForFixtureVaultReady` calls it.

## Open threads

- **C96 — the bare mock vault cannot save edits to its own notes.** The mock's
  active vault is `/Users/mock/demo-vault-v2` (`DEFAULT_MOCK_VAULT_PATH` in
  `src/mock-tauri/mock-handlers.ts`), but every entry in `MOCK_ENTRIES` lives
  under `/Users/mock/Vault`. `canWritePathToVault` then drops each edit in
  `useEditorSave`'s content-change handler, with no message. It only affects
  runs with no vault API (for example `/api/vault/ping` routed to 404). Both
  values date from the bootstrap (`a0df78c6`). A fix moves one root to match
  the other, and must keep `check_vault_exists`, which accepts only paths
  containing `demo-vault-v2`. Not fixed here: it touches every mock-mode test.
- Other specs still assert the breadcrumb text equals a filename
  (`create-note-crash`, `create-note-default-properties`). I did not run them.
  If they fail, they need the same `title`-attribute change.
