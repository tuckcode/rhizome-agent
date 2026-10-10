---
session: 2026-10-10T22:00Z
model: Claude Opus 5.5
description: >-
  Phase 4b backend: RoutingModel over ProviderModel, pinned OmniRoute
  free catalog, three cooldown layers, KeyStore trait. Test builds only.
  The pinned data contradicts ADR-0182's membership claim for 7 of 8
  providers; three decisions wait on knispo.
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

## Decisions for knispo (the PR repeats these)

ADR-0182 decision 1 calls all eight providers "keyed, recurring, ToS ok or
caution, hardStopGuaranteed". The pinned upstream data says otherwise:

| Provider | Upstream at the pin | Routes now? |
|---|---|---|
| Groq | recurring-daily, hardStop true | yes |
| Cerebras | one-time-initial ($5 signup credit, card on file, "hardStopGuaranteed must stay unset") | no, signup credit (decision 2) |
| Mistral | recurring-monthly, hardStop unset | yes |
| Cloudflare Workers AI | recurring-daily, hardStop unset, needs account id | yes, with account id |
| OpenRouter | `auto` (not `:free`), `stealth/ox-alpha`, `liquid/lfm-2.5-2.6b:free` | `liquid/...:free` only |
| NVIDIA NIM | one-time-initial | no, signup credit (decision 2) |
| GitHub Models | absent. Upstream `github` is Copilot OAuth | no rows |
| LLM7 | recurring-daily, hardStop unset | yes |

1. Gate on `hardStopGuaranteed`? Today it is recorded, not gated. Gating
   leaves only Groq.
2. Cerebras and NVIDIA are excluded by decision 2. Keep that, or make an
   exception?
3. GitHub Models needs a free-tier source that is not OmniRoute.

## Not done

- No UI, no keychain impl, no Settings wiring. Chat does not call the router.
- `leftover-omniroute-parked.test.ts` still reads "No OmniRoute code in
  tree". This PR ports data rows and rules, not code. ADR-0182 says that
  lock changes only if code is copied.
- `docs/ARCHITECTURE.md` not updated: the routing module is test-only, like
  `rhizome_loop` and `ProviderModel`, which it also does not list.
