---
session: 2026-10-10T22:00Z
model: Claude Opus 5.5
description: >-
  Phase 4b backend: RoutingModel over ProviderModel, pinned OmniRoute
  free catalog, three cooldown layers, KeyStore trait, default-on vs
  opt-in providers, strict mode. Test builds only. Provider list follows
  the revised ADR-0182 on #106.
---

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · Phase 4b free-tier routing, backend only

Branch `claude/phase4b-free-routing`, stacked on #105
(`claude/phase4-multiturn-adapter`). Rebase onto `main` after #105 merges.

## What landed

- `src-tauri/src/rhizome_routing/free_catalog.json`: OmniRoute rows for the
  ADR-0182 v1 providers at pin `fc5e2bcc` (curated 2026-09-12). Upstream
  facts are unchanged. The catalog on the current release branch
  (`7510677f`, 2026-10-10) is byte-identical to the pin.
- `catalog.rs`: the gate. It drops non-recurring tiers, ToS other than ok or
  caution, `trainsOnPrompts`, `-web` providers, `stealth/` ids, and
  OpenRouter ids without `:free`.
- `health.rs`: layer 1 breaker (7 degraded, 12 open, 30 s half-open, status
  408/5xx only). Layer 2 key cooldown (Retry-After, else 3 s doubling; 401
  skips the key until it changes). Layer 3 lockout (per-model-quota 429 and
  403 lock the pool; 402, `insufficient_quota`, and "per day" 429 bench the
  pool until UTC midnight; 404, 5xx, bad stream lock the model; 120 s
  doubling to 30 min).
- `mod.rs`: `RoutingModel` implements `Model`. One `ProviderModel`,
  retargeted per attempt, keeps the turn mark. Failover only before the
  first event reaches the loop. 45 s budget, one failover always runs.
  `KeyStore` and `Clock` traits. Fakes in tests.
- `ProviderModel::retarget` and `stream_chat_events_with_params` (tool-only
  body fields, for NIM's `parallel_tool_calls=false`).
- `THIRD_PARTY_NOTICES` (OmniRoute MIT) and two rows in
  `docs/vendored-sources.md`.

## Provider policy (revised ADR-0182, 2026-10-10)

| Provider | Upstream at the pin | Rhizome |
|---|---|---|
| Groq | recurring-daily, hardStop true | default-on |
| Mistral | recurring-monthly, hardStop unset | default-on |
| LLM7 | recurring-daily, hardStop unset | default-on |
| OpenRouter | `auto`, `stealth/ox-alpha`, `liquid/lfm-2.5-2.6b:free` | default-on, `:free` ids only |
| NVIDIA NIM | rows say one-time-initial | default-on. `free_type_override: recurring-uncapped`, because `docs/reference/FREE_TIERS.md` line 346 says the credit pool was removed |
| User endpoint | none | default-on, last |
| Cloudflare Workers AI | recurring-daily, hardStop unset | opt-in, with `billing_warning` |
| Cerebras, GitHub Models | | dropped from the catalog |

- `RoutingOptions { opt_in, strict }`. Strict mode routes only rows with
  `hard_stop` (today Groq only) and the user endpoint. A missing flag means
  "not established" (FREE_TIERS.md methodology), so the default mode does
  not check it.
- The user endpoint stays in strict mode. Its billing is the user's own
  setup, and Rhizome cannot know it.
- Cloudflare's rank is after the default-on providers. The ADR does not
  rank it.

## Open follow-up

- GLM 5.3 is not on OmniRoute's NVIDIA list. Check NVIDIA's own catalog
  separately. It is not in this catalog.
- NIM's ~40 req/min limit is recorded, not enforced client-side. A 429
  from NIM locks the quota pool through layer 3.

## Not done

- No UI, no keychain impl, no Settings wiring. Chat does not call the router.
- `leftover-omniroute-parked.test.ts` still reads "No OmniRoute code in
  tree". This PR ports data rows and rules, not code. ADR-0182 says that
  lock changes only if code is copied.
- `docs/ARCHITECTURE.md` not updated: the routing module is test-only, like
  `rhizome_loop` and `ProviderModel`, which it also does not list.
