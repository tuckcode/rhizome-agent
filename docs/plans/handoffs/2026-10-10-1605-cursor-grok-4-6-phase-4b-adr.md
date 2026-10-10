---
session: 2026-10-10T08:45Z
model: Grok 4.6 (Cursor)
description: >-
  ADR-0182 proposed: Phase 4b free-tier routing ports OmniRoute
  rules into a Rust Model layer; freellmapi is a checklist only.
  Docs only; no app code. HANDOFF.md left untouched.
commits:
---

# ADR-0182 — Phase 4b free-tier provider routing

**Origin:** Cursor Grok 4.6 · 2026-10-10 · docs / ADR only

Number is 0182. 0180 is identity; 0181 is PR-branch gates.

## Decision

Option A. Port OmniRoute provider entries, free-model rows, and the
three-layer cooldown into a small Rust module with fixed-priority
fallback. Use freellmapi as an edge-case checklist. MIT notices go in
`THIRD_PARTY_NOTICES` at first copy. No shipped sidecar.

Do not copy or scrape the hosted catalog at `freellmapi.co`.

B (merged ruleset) collapses to A. C (sidecar) stays optional
user-run `base_url` only. D (defer) is rejected.

The later code PR must not edit `rhizome_loop` or `stream_model_events`.
#102 is the event seam. #105 (open) is the `ProviderModel` adapter.

## Open for knispo

Six proposed defaults in the ADR: v1 provider list, exclusions,
`trainsOnPrompts` off, keychain keys, fixed priority, manual catalog
refresh. Not decided until he calls them.

## Files

- `docs/adr/0182-free-tier-provider-routing.md`
- `docs/adr/README.md` (index row)
- `docs/plans/2026-10-09-rhizome-harness-plan.md` (Phase 4b pointer only)

`docs/HANDOFF.md` was not edited. This file is the session record.
