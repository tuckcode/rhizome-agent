---
session: 2026-10-16T20:45Z
model: Grok 4.6 (Cursor)
description: >-
  Expose list_provider_models as list_ai_model_provider_models and feed
  live ids into the native model chip, with a session cache and static fallback.
commits: this slice
---

# Live provider models in the model chip

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Guide only: `5c97daf` on `backup/mac-provider-models-oct11`. That branch was
not merged.

- Tauri command `list_ai_model_provider_models` wraps
  `ai_models::list_provider_models`, registered in `lib.rs`, with a mock
  handler.
- `src/lib/listProviderModels.ts` calls the command for local providers and
  remote providers that hold a key. Cache is per provider for the session.
  Error or no key keeps the seed list.
- `NativeChatModelPicker` loads that list when the menu opens and shows
  `Loading…` on groups still in flight. Touch is limited because #183 also
  edits the picker.

## C-numbers

None.
