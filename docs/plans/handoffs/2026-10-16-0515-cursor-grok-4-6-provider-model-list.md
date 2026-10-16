---
session: 2026-10-16T05:15Z
model: Grok 4.6 (Cursor)
description: >-
  Ported the backup-branch provider model list onto current main without a
  second command name. discover_ai_models is now async via run_blocking;
  list_provider_models plus the grok-4 fixture test landed in ai_models.
commits: this slice
---

# Provider model list on current main

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Reference: `backup/mac-provider-models-oct11` (read only; 88 commits behind).
That branch added `list_provider_models`, async `list_ai_model_provider_models`,
and a fixture test. Current main already had the same host call as
`discover_ai_models` wrapping `discover_ai_model_ids`, and the composer
already invokes that name.

This slice keeps that name. It adds the saved-key helper and the grok-4 /
grok-3-mini test from the backup, and moves `discover_ai_models` off the UI
thread with `run_blocking`. It does not register
`list_ai_model_provider_models`. ChatHome and NativeChatModelPicker were not
touched.

## C-numbers

None.
