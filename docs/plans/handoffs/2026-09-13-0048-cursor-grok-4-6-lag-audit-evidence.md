---
session: 2026-09-13T0048Z
model: Cursor Grok 4.6
description: >-
  Lag-audit evidence: what shipped vs still deferred after the session-switch
  clear + startTransition cut and lazy Prime provider status.
commits: pending
---

# Lag audit evidence — shipped vs deferred

**Origin:** Cursor Grok 4.6 · 2026-09-12 · pickup from
[2026-09-07-0308](2026-09-07-0308-composer-lag-audit-pickup.md)

No Instruments run this session. Binary at write time is still the last
`/Applications` stamp **`3a21f9f`**. Rebuild is in the same multitask.

## What already shipped before this cut

| Cut | Where |
|---|---|
| Skip `ensure_prime_session_host` when Chat already has `hostRunning` | `usePrimeSessionSwitcher.ts` |
| Optimistic session-row highlight | same |
| Settings `beenOpen` so closed Settings is not a live tree | `SettingsPanel.tsx` |

## What this session shipped

| Moment | Change | Evidence |
|---|---|---|
| Session switch | Clear transcript immediately (`replaceMessages([])`), then wrap the new transcript in `startTransition`. Host failure restores the previous messages and path. | `usePrimeSessionSwitcher.ts` + `.test.tsx` |
| Open Settings | `PrimeProviderStatusSection` mounts only after the Agents section is visible (`loadModelCatalog` / IntersectionObserver). Stops `get_prime_provider_status` on every Settings open. | `SettingsPanel.tsx` |

## Still deferred

- Chat list virtualization
- Graph-under-Inbox default off (product call)
- Full Settings code-split
- Cold-start Graph delay

Those need a packaged-app timing pass after `/Applications` is this tip, not more source reasoning.
