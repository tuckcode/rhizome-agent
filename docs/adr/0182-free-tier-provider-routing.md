---
type: ADR
id: "0182"
title: "Free-tier provider routing ports OmniRoute rules"
status: active
date: 2026-10-10
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 · Phase 4b of the harness plan; comparison of OmniRoute and freellmapi
**Decisions confirmed:** knispo · 2026-10-10 · the six catalog and key rows below

## Context

[ADR-0180](0180-rhizome-is-its-own-harness.md) makes Rhizome its own
harness. Model routing and provider selection are Rhizome-owned.
[`docs/plans/2026-10-09-rhizome-harness-plan.md`](../plans/2026-10-09-rhizome-harness-plan.md)
sequences that work. Phase 4b is the free-provider catalog and automatic
fallback on fail, 429, or exhausted free quota.

[#48](https://github.com/tuckcode/rhizome-agent/issues/48) already chose
OmniRoute's *goal*, not the TypeScript program. The 2026-10-09 plan left
the first catalog's membership and order open. A 2026-10-10 comparison of
[OmniRoute](https://github.com/diegosouzapw/OmniRoute) and
[freellmapi](https://github.com/tashfeenahmed/freellmapi) is the source
for this ADR.

[#102](https://github.com/tuckcode/rhizome-agent/pull/102) (on `main`)
added the provider event seam: `stream_model_events` emits `ModelEvent`s
and maps HTTP failures to `ModelErrorKind` classes for a later router.
[#105](https://github.com/tuckcode/rhizome-agent/pull/105) (open, Claude)
adds the multi-turn send path and `ProviderModel` (`impl Model`). Phase
4b plugs in as a `Model` / provider-routing layer on that seam.

The loop (`rhizome_loop`) and `stream_model_events` stay untouched.

## Decision

**Option A.** Port OmniRoute's provider entries, free-model rows, and
three-layer cooldown rules into a small Rust module with fixed-priority
fallback. Use freellmapi only as an edge-case checklist. Put both MIT
notices in `THIRD_PARTY_NOTICES`. Do not ship a sidecar.

- Rebuild the catalog and cooldown rules in Rhizome Rust. Do not vendor
  OmniRoute's TypeScript gateway. Do not expose an outward `/v1`.
- Treat OmniRoute's ToS rating as a **gate**, not advisory copy.
- Do **not** copy or scrape freellmapi's hosted catalog at
  `freellmapi.co`. That catalog is not covered by freellmapi's MIT
  router licence.
- A user-run freellmapi (or any other OpenAI-compatible) `base_url`
  stays optional. It is not bundled.
- No new Cargo or npm dependency for this phase.

## Licence

- OmniRoute is MIT (Copyright 2026 diegosouzapw). Ancestors 9router and
  CLIProxyAPI are also MIT. Re-check the licence and pin at copy time.
  Record any copied path in [`docs/vendored-sources.md`](../vendored-sources.md)
  plus a file header (ADR-0180 provenance).
- freellmapi is MIT for the router tree. The hosted catalog at
  `freellmapi.co` is **not** under that licence. Do not copy it. Do not
  scrape it.
- Neither tree is AGPL or GPL. Bundling either Node app would pull
  `sharp` / libvips (LGPL-3.0+). That is a further reason not to ship a
  sidecar.
- Rhizome is AGPL-3.0. MIT donors may be copied with attribution. The
  implementation PR creates `THIRD_PARTY_NOTICES` (repo root) if it is
  still absent, and adds the OmniRoute and freellmapi MIT notices there
  when any rule or row is ported. This ADR copies no code.

## What to port from OmniRoute

Source map (idea and data; rebuild in Rust):

| Piece | Upstream path |
|---|---|
| Free list | `open-sse/config/freeModelCatalog.data.ts` (hand-curated 2026-09-12, about 489 rows, evidence comments, ToS rating, `freeType`, `hardStopGuaranteed`, `trainsOnPrompts`) |
| Registry | `open-sse/config/providerRegistry.ts` → `open-sse/config/providers/registry/<id>/index.ts` |
| Resilience | `docs/architecture/RESILIENCE_GUIDE.md`; `open-sse/services/accountFallback.ts`; `open-sse/config/providerErrorRules.ts`; `src/shared/utils/circuitBreaker.ts` |

Three cooldown layers, in this order:

1. **Provider breaker** on 408 / 500 / 502 / 503 / 504: degraded after 7,
   blocked after 12, 30 s half-open.
2. **Per-key cooldown:** 3 s, doubling; honour `Retry-After` on 429;
   permanent skip for banned, expired, or credits-exhausted keys.
3. **Per-model lockout** on the 429 / 403 / 402 quota family, a 404 for
   that model, and 5xx for the exact target.

Rhizome's own timeouts do not count against the provider breaker.
[#102](https://github.com/tuckcode/rhizome-agent/pull/102) already maps
HTTP failures to `ModelErrorKind` (`RateLimited` with optional
`Retry-After`, `QuotaExhausted`, `Unavailable`, `Auth`, `Rejected`,
`Protocol`). The router chooses on those classes. It does not re-parse
status codes inside `stream_model_events`.

## freellmapi checklist only

Read, do not copy:

- `server/src/lib/fallback-loop.ts`, `error-classify.ts`,
  `services/ratelimit.ts`, `degradation.ts`
- `docs/en/providers/01-supported-platforms.md` (quirks)
- `docs/en/architecture/04-degraded-mode-and-failover.md`

Edge cases the Rust module must cover in tests:

- A 45 s overall retry budget that still performs at least one failover.
- A daily-quota 429 is benched until UTC midnight.
- Some providers return HTTP 200 with an error body.
- NVIDIA NIM needs `parallel_tool_calls=false`.

Skip freellmapi's bandit / learning scorer for v1.

**Do not copy the hosted catalog at `freellmapi.co`.**

## File boundary (implementation PR)

This ADR writes no Rust. The later Phase 4b code PR:

- Adds a small routing module beside the provider adapter (`ai_models`
  / `ProviderModel` from #105). Suggested home:
  `src-tauri/src/ai_models/` or a sibling of `rhizome_provider_model.rs`.
- Implements or wraps `Model` so the loop keeps calling one `Model`.
- Does **not** edit `rhizome_loop/`.
- Does **not** edit `stream_model_events`.
- Adds no Node sidecar and no new dependency.
- Adds `THIRD_PARTY_NOTICES` rows and a `vendored-sources.md` pin if any
  upstream text is copied.

## Options considered

- **Option A** (chosen): port OmniRoute provider entries, free-model
  rows, and the three-layer cooldown into a small Rust module with a
  fixed-priority list. Use freellmapi as a checklist. MIT notices in
  `THIRD_PARTY_NOTICES`. No shipped sidecar.
- **Option B — merged ruleset:** write one authored table that mixes
  OmniRoute and freellmapi rules. Rejected. The merge still ports
  OmniRoute's catalog and cooldown layers, then checks freellmapi's edge
  cases. That is option A with extra merge work and no extra product
  behaviour. It collapses to A.
- **Option C — sidecar:** ship OmniRoute or freellmapi as a Node process
  and point Rhizome at it. Rejected as a shipped organ. The harness plan
  forbids a Node sidecar and already said keep the goal, not the
  program. Bundling either app pulls `sharp` / libvips (LGPL-3.0+). A
  user-run freellmapi `base_url` stays optional.
- **Option D — defer:** wait. Rejected. Phase 4b is already on the plan.
  #102 already classified failures for a router. The 2026-10-10
  comparison settled licence and source. Waiting adds no new fact.

## Decisions

knispo, 2026-10-10. Coding agents treat these as settled. The repo ADR
status values are `proposed | active | superseded | retired` (no
Accepted). Status is `active`.

1. **v1 providers.** Keyed, recurring, ToS ok or caution,
   `hardStopGuaranteed`: Groq, Cerebras, Mistral, Cloudflare Workers AI,
   OpenRouter `:free`, NVIDIA NIM, GitHub Models, LLM7, plus a
   user-supplied OpenAI-compatible endpoint. The listed sequence is the
   v1 membership and the starting priority list. Do not invent a
   different rank.
2. **Exclusions.** ToS avoid; `*-web` scrapers; OAuth subscription
   providers; TLS-stealth; one-time signup credits. One-time signup
   credits stay excluded and may be revisited later.
3. **`trainsOnPrompts`.** Those providers are excluded (off). They are
   not in the v1 catalog.
4. **Keys.** User keys live in the OS keychain via Tauri. One key per
   provider. No multi-key rotation in v1.
5. **Routing.** Fixed priority order with fallback. No learning scorer
   in v1.
6. **Catalog refresh.** A weekly scheduled check, owned by the Nightly
   Audit bot, compares OmniRoute's `FREE_CATALOG_CURATED_AT` /
   `freeModelCatalog` data against Rhizome's pinned copy and opens a
   draft PR only when something changed, same pattern as the weekly
   docs-sync drafts. knispo merges those drafts. This docs PR does not
   add that job.

## Consequences

- Phase 4b implementation follows this ADR. The harness plan's Phase 4b
  section points here and is not rewritten.
- Leftover locks that say there is no OmniRoute *code* in the tree
  (`leftover-omniroute-parked.test.ts`) stay until the implementation
  PR, and only change if that PR copies code. This docs PR does not
  touch them.
- The weekly catalog check is a later bot job, not this PR.
- Usage dashboard, outward gateway, and a shipped sidecar remain out of
  scope.
- Chat stays on Prime until Phase 6.

## Advice

2026-10-10 comparison: option A, port from OmniRoute; freellmapi as a
checklist only. OmniRoute pin read by the harness plan:
`fc5e2bccd4f70fecf5aab94dfb8136c74ab5a21b` (2026-09-30). Re-check at
copy time.

knispo, 2026-10-10, confirmed the six catalog and key rows in
[Decisions](#decisions). Row 6 changed from manual PRs to a weekly
Nightly Audit draft.

[[0180-rhizome-is-its-own-harness]]
[[0181-pr-branches-with-full-gates]]
