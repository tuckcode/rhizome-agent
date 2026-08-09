---
type: ADR
id: "0060"
title: "Network-aware UI gating for remote-dependent features"
status: active
date: 2026-04-13
---

## Context

Some app features require an active internet connection (e.g., cloning the Getting Started vault template from GitHub). Prior to this decision, the UI would attempt the operation and surface a generic error only after failure. Users on first launch in offline environments got a confusing error when trying to use the template.

## Decision

**Introduce a `useNetworkStatus` hook that tracks `navigator.onLine` via `online`/`offline` DOM events, and use it to proactively gate UI surfaces that require a network.** Features that depend on remote access (clone, sync) show an explanatory message and disable their action button when the device is offline, rather than failing silently at execution time.

## Options considered

- **Option A** (chosen): `useNetworkStatus` hook + proactive UI disable — disables the action before the user tries it, with inline copy explaining the offline state.
- **Option B**: Attempt and catch — let the operation run and surface the error in a toast. Simpler, but poor UX for first-launch users who don't know what went wrong.
- **Option C**: Check connectivity with a ping on demand — more accurate but adds latency and complexity; `navigator.onLine` is sufficient for the use case.

## Consequences

- Positive: cleaner first-run experience for offline users; no misleading error messages.
- Positive: `useNetworkStatus` is a reusable hook for future remote-gated features.
- Negative: `navigator.onLine` can return `true` on a captive-portal / no-internet network — the hook reflects OS-level connectivity, not end-to-end reachability. The operation may still fail with a network error, which must still be handled.
- Re-evaluate if the app adds more remote features that need finer-grained reachability checks.
