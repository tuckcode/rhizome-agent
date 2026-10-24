---
session: 2026-10-24T18:10:00Z
model: Grok 4.7
description: Second Prime cleanup. Removed unused onboarding.ai locale keys and the dead ChatHome Prime host poll.
---

**Origin:** Grok 4.7 · 2026-10-24 · cloud agent, branch `cursor/prime-frontend-cleanup-b35b`

## What changed

Frontend only. Rust engines, `App.tsx`, and `AiMessage.tsx` were not edited.

- Removed the 19 unused `onboarding.ai.*` keys from every locale file that had them. The locale files are flat keys, so there was no `onboarding.ai` object to delete.
- `resolveEffectiveChatEngine` takes no input and returns `native`. Host fields are gone from `EffectiveChatEngineInput`.
- ChatHome no longer calls `usePrimeHostStatus` or mounts Prime-only chrome that depended on that poll.
- `migrateRemovedHarnessSettings` is locked to leave `agent:prime` and `agent:hermes` conversation targets in place.

## Left in place

`usePrimeHostStatus` still runs from `AiPanel` and `NativeChatModelPicker`. `get_prime_model_allow_list` and `trackPrimeDefaultModelChanged` were already gone from the frontend. The Rust command remains. `AgentActivityBand`, `RlmFamilyBand`, and `ChatPreflightBanner` stay in the tree; ChatHome no longer mounts them.
