---
session: 2026-09-06T22:30Z
model: Grok 4.6
description: >-
  Area E subtraction: unused Tauri IPC wrappers, Laputa launch migrate, and
  stale iOS/Tolaria apple leftovers. Domain helpers that still have callers
  stayed. Multi-CLI / ai_models (#56) untouched.
commits: pending
---

# Area E — dead IPC + iOS leftovers

**Origin:** Grok 4.6 · 2026-09-06

Production frontend never invoked the cut commands (grep: only `src-tauri`
wrappers + `mock-tauri` stubs/tests). Live paths kept: `get_conflict_files`,
`clone_git_repo`, `title_sync` / `sync_title_on_open`, `vault::migrate_is_a_to_type`
(via `repair_vault`), tray-built menu bar, `start_mindwalk_sidecar`.

Removed from `generate_handler!` and deleted IPC wrappers:

- `get_prime_session_messages`, `set_prime_auto_compaction`
- `toggle_menu_bar_companion` (tray still calls `toggle_companion_window`)
- `get_conflict_mode`
- `promote_owned_prime_session`, `complete_owned_prime_session`, `shutdown_prime_session_host`
- `which_binary`, `run_mindwalk_open`, `bridge_prime_session`, `bridge_and_open_prime_session`
- `sync_note_title`
- `migrate_is_a_to_type` IPC + `~/Laputa` launch-time migrate/seed
- `batch_archive_notes`
- unregistered `clone_repo` command (`git_clone::clone_git_repo` now calls `crate::git::clone_repo`)

Deleted `src-tauri/gen/apple/` (laputa_iOS) and `src-tauri/capabilities/mobile.json`.
Mock stubs that existed only for those commands went with them.

Left alone: `ai_models` / CLI streams (#56), `session_import/**`, dual search,
sheet engine, inbox watcher, prime_session_host split, docs/site, MCP JS.
`#[allow(dead_code)]` on `event_tx` / `format_empty_turn` unchanged — not
made unused by this cut.
