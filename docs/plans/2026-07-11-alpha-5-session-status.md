# Alpha-5 (cancel affordance + global job indicator) — session status

Picks up the Alpha-5 phase from `docs/plans/2026-07-10-rhizome-desktop-alpha-roadmap.md`.
Only the "Cancel Generate/inbox jobs; global job indicator" sub-task this
session — the MCP sidecar (rhizome-tool per ADR-0152) is deferred.

## Pushed this session

```
8447ef9a9 feat: cancel affordance + global job indicator for Research panel (Alpha-5)
(this file not committed yet — present in docs commit + HANDOFF.md update)
```

## Files changed

| File | Change |
|------|--------|
| `src-tauri/src/rhizome_jobs.rs` | **New.** Async job system: `start_rhizome_job` (spawns work with `with_stream_id`), `cancel_rhizome_job` (calls `abort_stream`). |
| `src-tauri/src/lib.rs` | Registers `rhizome_jobs` module + both Tauri commands. |
| `src/hooks/useRhizomeJobs.ts` | **New.** Hook with module-level subscriber pattern (no context needed). `startJob` returns `Promise<JobResult>` for `await`-compatible Research panel code. Shared state for ResearchPanel + StatusBar. |
| `src/components/ResearchPanel.tsx` | 3 write handlers converted from blocking `invoke('call_rhizome_tool')` → `jobs.startJob()`. Cancel buttons (destructive variant) on all three write tabs. |
| `src/components/ResearchPanel.test.tsx` | Mock updates: `crypto.randomUUID`, `rhizome-job-complete-*` events, assertions check `start_rhizome_job` instead of `call_rhizome_tool`. |
| `src/components/status-bar/StatusBarBadges.tsx` | New `RhizomeJobsBadge` component: spinning `Loader2` icon + count, click opens popover with job list + per-row cancel buttons. |
| `src/components/status-bar/StatusBarSections.tsx` | Wires `RhizomeJobsBadge` into the primary section via `useRhizomeJobs()` call. |
| `src/lib/locales/en.json` | Added `research.cancel` key. |
| `src/mock-tauri/mock-handlers.ts` | Mock handlers for `start_rhizome_job` and `cancel_rhizome_job`. |

## Done

- **Rust job system**: `rhizome_jobs.rs` with `start_rhizome_job` (async, returns
  immediately, spawns on `tokio::task::spawn_blocking` with `with_stream_id`) and
  `cancel_rhizome_job` (kills the agent subprocess via `abort_stream`). Progress
  events emitted on both scoped (`rhizome-job-progress-{id}`) and legacy
  (`rhizome-progress`) channels.
- **Research panel cancel**: All three write handlers (Generate/Import/Distill)
  replaced blocking `invoke('call_rhizome_tool')` with `await jobs.startJob(...)`.
  Each tab shows a red Cancel button while `running` is true.
- **Status bar badge**: `RhizomeJobsBadge` shows spinning `Loader2` + count when
  jobs are active. Click opens a dismissible popup listing each job with a Cancel
  button. Uses the module-level shared state so ResearchPanel and StatusBar stay
  in sync without context or prop drilling.
- **Test coverage**: 4895 tests pass (0 failures), lint clean, `tsc --noEmit` clean.
  All Research panel tests updated for the new `start_rhizome_job` contract.

## Known gaps / not done

- **Inbox watcher cancellation**: The `inbox_watcher.rs` spawns `std::thread::spawn`
  threads that aren't wired into the job system. Deferred — the stop-inbox-watcher
  already blocks new files; in-flight processing finishes naturally.
- **MCP sidecar (`rhizome-tool` per ADR-0152)**: Not started this session. The
  cancel affordance was the more contained piece of Alpha-5.
- **Codacy scan**: Not available in this environment (same as Alpha-4 session).
- **l10n**: Only `research.cancel` was added to `en.json`; translation sync
  not run (no LARA creds).

## Next

Alpha-5 remaining (MCP sidecar Phase 2) or Alpha-6 (physical layout, Memory).
