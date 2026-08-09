---
type: ADR
id: "0042"
title: "PostHog-based release channels and feature flags"
status: active
date: 2026-04-03
supersedes: "0017"
---
## Context

ADR-0017 introduced canary/stable update channels with localStorage-based feature flags. This worked for local development but lacked remote flag management — promoting a feature from beta to stable required a code change and rebuild.

## Decision

**Replace localStorage feature flags with PostHog-based feature flags, evaluated per release channel (alpha/beta/stable). The release channel is a user-selectable setting; PostHog flag rules determine which features are visible for each channel.**

- **Alpha**: all features always enabled (no PostHog lookup needed, works offline)
- **Beta**: sees features where the PostHog flag targets `release_channel = beta`
- **Stable** (default): sees features where the PostHog flag targets `release_channel = stable`
- Promotion = flipping a PostHog flag on the dashboard. Zero code changes, zero rebuilds.
- `isFeatureEnabled(flagKey)` in `telemetry.ts` is the single evaluation point.
- localStorage overrides (`ff_<name>`) still work for dev/QA testing (checked first).
- Offline: PostHog caches flags in localStorage; alpha always works; first-launch-no-network falls back to hardcoded defaults.

## Options considered

* **Option A**: Keep localStorage-only flags (ADR-0017) — no server dependency, but no remote management.
* **Option B** (chosen): PostHog feature flags — we already use PostHog for analytics, so no new dependency. Remote flag management, per-channel targeting, gradual rollouts via PostHog dashboard.
* **Option C**: Dedicated feature flag service (LaunchDarkly, Unleash) — more powerful but adds a new vendor dependency.

## Consequences

* `release_channel` added to Settings (persisted via Tauri backend, not vault).
* `useTelemetry` passes `release_channel` as a PostHog person property on identify.
* `isFeatureEnabled()` checks channel → PostHog → hardcoded defaults.
* `useFeatureFlag` hook updated to delegate to `isFeatureEnabled` (after localStorage override check).
* ADR-0017 is superseded — the canary update channel remains, but feature gating moves from localStorage to PostHog.
