---
session: 2026-10-11-1815
model: Cursor Grok 4.6
description: Rhizome catalog from Settings through the composer; native send after rebuild
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · model lists empty / no chat after rebuild

## What was true

Composer and Settings treated Prime’s daemon catalog as the model list.
After a rebuild that host is often down, so the menu stayed empty and
send stayed gated. The native picker was a static one-model-per-provider
list that ignored Settings-configured models and live `/v1/models`.
Native send also mapped catalog kinds `open_ai` and `open_router` to
`OpenAiCompatible` with no base URL, so those turns failed.

Hermes’s docs (providers.md, desktop.md) keep setup in Settings and the
same catalog in the composer picker, grouped by provider, with `/models`
discovery. That is the shape this slice copies. OAuth / Prime sign-in
was left alone.

## What changed

- Settings and the composer share `seedRhizomeChatModels` /
  `loadRhizomeChatModels`.
- `discover_ai_models` exposes `ai_models::discover_ai_model_ids`.
- Chat sends through the native engine when Prime is not live.
- `provider_kind_from_id` accepts catalog kind ids; `catalog_provider`
  uses a saved Settings provider when one exists.

## C-numbers

None opened. The Prime-empty menu when the daemon is down was the
designed Prime path, not an untracked leftover. Native kind mapping was
the send defect this slice fixes.
