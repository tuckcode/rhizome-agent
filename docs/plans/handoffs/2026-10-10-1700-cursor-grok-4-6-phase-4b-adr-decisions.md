---
session: 2026-10-10T09:00Z
model: Grok 4.6 (Cursor)
description: >-
  ADR-0182 active: knispo confirmed the six Phase 4b catalog and
  key rows. Weekly Nightly Audit catalog check. Docs only.
  HANDOFF.md left untouched.
commits:
---

# ADR-0182 — knispo confirmed the six rows

**Origin:** Cursor Grok 4.6 · 2026-10-10 · docs / ADR only

Status is `active`. The repo has no Accepted value
(`proposed | active | superseded | retired`). Same pattern as
ADR-0180 and ADR-0181.

## Settled

1. v1 providers as listed (keyed, recurring, ToS ok/caution,
   `hardStopGuaranteed`), plus a user OpenAI-compatible endpoint.
2. Exclusions as proposed, including one-time signup credits
   (may revisit later).
3. `trainsOnPrompts` providers excluded (off).
4. OS keychain via Tauri; one key per provider; no multi-key rotation.
5. Fixed priority order with fallback; no learning scorer in v1.
6. Weekly Nightly Audit compare of OmniRoute
   `FREE_CATALOG_CURATED_AT` / `freeModelCatalog` against the pin;
   draft PR only on change; knispo merges.

## Files

- `docs/adr/0182-free-tier-provider-routing.md`
- `docs/adr/README.md`
- `docs/plans/2026-10-09-rhizome-harness-plan.md` (pointers only)

`docs/HANDOFF.md` was not edited.
