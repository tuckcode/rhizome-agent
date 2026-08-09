# Alpha-3 (inbox automation) — session status

Picks up `2026-07-10-rhizome-desktop-alpha-roadmap.md`'s Alpha-3 phase,
the last of the alpha critical path (`0 → 1 → 2 → 3 → 4`, with 4 still
ahead). Alpha-1 and Alpha-2 shipped earlier this session; Alpha-3
completes the "automate intake" third of the strategy. Built per the
approved plan (5 commits, TDD).

## Pushed this session (local; push pending final verification)

```
<hash> feat: inbox automation frontend -- config flag, hook, Settings toggle, toast (Alpha-3 task 4)
<hash> feat: start/stop_inbox_watcher commands + watcher (Alpha-3 task 3)
<hash> feat: inbox_watcher core -- classify, stabilize, process, move (Alpha-3 task 2)
<hash> feat: thread trigger param through distill/import/rhizome_api (Alpha-3 task 1)
```
(plus this docs commit; live-test commit folded into task 5.)

## Done

- **Task 1 — trigger param**: `run_distill_via_agent`/`run_import_via_agent`/
  `rhizome_api::distill`/`import_source` take `trigger: &str` (was
  hardcoded `"manual"`). No behavior change — every existing caller still
  emits `trigger:"manual"`.
- **Task 2 — inbox core** (`inbox_watcher.rs`, target-agnostic):
  `classify_inbox_file`, `wait_for_stable_size` (the stabilization loop is
  the debounce), `process_inbox_file_with` (injectable agent-verb boundary
  so tests avoid a live call), `process_inbox_file` (real dispatch to
  `rhizome_api` with `trigger:"inbox"`), move-to-`raw/processed/` with
  collision dedupe.
- **Task 3 — watcher + commands**: desktop `notify` watch on `raw/inbox/`
  NonRecursive, one thread per drop, `Mutex<HashSet>` dedup of repeat fs
  events, `inbox-processed`/`inbox-error` emit. `start_inbox_watcher`/
  `stop_inbox_watcher` commands + `InboxWatcherState` managed in `lib.rs`.
- **Task 4 — frontend**: `VaultConfig.inbox_automation_enabled`,
  `useInboxWatcher` (start/stop + toast), "Automate wiki inbox" Settings
  switch wired to `VaultConfig` (first per-vault toggle in SettingsPanel).
- **Task 5 — live test + docs**: `#[ignore]`d end-to-end
  (`live_process_inbox_file_distills_a_dropped_note`), ARCHITECTURE.md
  Alpha-3 section, this doc.
- Suite green: 1150 Rust tests (10 ignored — all live/agent, 85.23% line
  coverage), 4863 frontend tests across 456 files (84.92% line coverage),
  lint/`tsc -b`/build clean.

## Deviations from the plan (both deliberate)

- **Reused the organization-workflow Settings section** instead of adding
  a new "Vault" section — the toggle is inbox-related and sits beside the
  existing inbox switches, and that section already had the exact
  non-draft save-callback pattern (`explicitOrganization`) to mirror.
- **The toggle shows for all vaults**, not gated on `isWikiVault` — the
  description clarifies it's for wiki vaults, and gating would mean
  threading another prop through the deep settings form for no real
  benefit (the watcher only acts when files are actually dropped in
  `raw/inbox/`).

## Known gaps / notes for next session

- **No job queue** — one thread per dropped file, `Mutex<HashSet>` only
  de-dupes the *same* file's repeat events. Fine for v1's drop volume;
  revisit if concurrent drops hit agent rate limits.
- **No cancel affordance** for in-flight inbox (or Generate) jobs — a
  wedged agent call runs to the agent layer's own error. Deferred to
  Alpha-5 alongside the Generate cancel gap.
- **l10n stale** for the two new `settings.workflow.inboxAutomation*`
  keys (no LARA creds in this environment).
- **Alpha-4 (destination vault) is next** — `agent_memory_vault_path` so
  Research/inbox writes target a configured Rhizome Vault, not just the
  open one. New global `Settings` field (confirmed absent). Completes the
  solo-usable-alpha critical path. Then Alpha-5 (cancel + MCP sidecar
  Phase 2) and step-6 Memory remain.
