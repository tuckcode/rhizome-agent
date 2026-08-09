---
type: ADR
id: "0016"
title: "Sentry crash reporting + PostHog analytics with consent"
status: active
date: 2026-03-25
---

## Context

As Laputa approaches public release, crash reports and usage analytics are needed to identify bugs and understand feature adoption. However, as a personal knowledge management app that handles sensitive data, user privacy is paramount. Any telemetry must be opt-in with clear consent.

## Decision

**Integrate Sentry for crash reporting and PostHog for product analytics, both gated behind an explicit consent dialog on first launch. Users can toggle each independently in Settings. No telemetry is sent without affirmative consent.**

## Options considered

- **Option A** (chosen): Sentry + PostHog with consent dialog — industry-standard tools, separate crash/analytics toggles, privacy-respecting opt-in. Downside: two external dependencies, two services to manage.
- **Option B**: Self-hosted error tracking — full data control. Downside: operational burden, limited analytics features.
- **Option C**: No telemetry — simplest, most private. Downside: blind to crashes and usage patterns, harder to prioritize features.

## Consequences

- `TelemetryConsentDialog` shows on first launch with accept/decline buttons.
- Accepting generates an `anonymous_id` (no PII) and sets `telemetry_consent: true` in settings.
- `useTelemetry` hook reactively initializes/tears down Sentry and PostHog based on settings.
- Both frontend (`src/lib/telemetry.ts`) and Rust backend (`src-tauri/src/telemetry.rs`) have path scrubbers in `beforeSend` hooks to strip vault paths.
- DSN/keys come from `VITE_SENTRY_DSN` / `VITE_POSTHOG_KEY` env vars.
- `reinit_telemetry` Tauri command toggles Rust-side Sentry at runtime.
- Re-evaluation trigger: if a unified telemetry platform (e.g., OpenTelemetry) could replace both services.
