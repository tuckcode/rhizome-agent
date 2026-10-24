---
session: 2026-10-24T04:00:00-05:00
model: Claude Opus 5.5
description: ADR-0189 follow-up. Removed the Prime (Chat engine) update check and its "Update now" offer from the composer banner and the status-bar update dialog.
---

**Origin:** Claude Opus 5.5 · 2026-10-24 · Claude Code desktop, branch `claude/gracious-raman-c18808`

## What changed

A build from main `9882784b` showed "Chat engine X is available / Update now"
in the chat composer. The offer updated the outside `prime-agent` CLI, which
Rhizome no longer uses as a chat engine (ADR-0189). This PR removes the path.

- Removed `src/hooks/usePrimeUpdate.ts`, `src/components/ChatEngineUpdateBanner.tsx`, and their tests.
- `src/App.tsx` no longer calls `usePrimeHostStatus(true, resolvedPath)`. That call existed only to feed the update check. Side effect: App no longer starts the Prime host poll (and its `ensure_prime_session_host`) at launch. Components that still mount `usePrimeHostStatus` start it themselves when they target Prime.
- `src/components/ChatHome.tsx`: removed the `chatEngineUpdate` / `onApplyChatEngineUpdate` props and the banner.
- `src/components/VersionUpdateIndicator.tsx`: Rhizome app update only. The Prime section, footer button, and release-page fallback are gone.
- `src/lib/productAnalytics.ts`: removed the `engine_update_*` PostHog helpers. Only `usePrimeUpdate` called them.
- Rust: removed `src-tauri/src/prime_update.rs`, the `check_prime_update` / `apply_prime_update` commands in `commands/system.rs`, and their registration in `lib.rs`. Removed the two mock handlers.
- `src/lib/leftover-issue-26-apply.test.ts` (locked the old apply path) is replaced by `src/lib/primeUpdateRemoved.test.ts` (locks the removal).
- `src/App.test.tsx`: "starts Prime once when Chat first opens" became "does not start Prime when Chat first opens". `leftover-green-update.test.ts` and `parked-organs.test.ts` now assert the indicator has no `primeActions`.
- Docs: `docs/ARCHITECTURE.md`, `docs/agents/prime-adapter.md`.

## Not touched

All other Prime code. Other ADR-0189 follow-ups remove it.
