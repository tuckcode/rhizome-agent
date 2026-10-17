---
session: 2026-10-17T01:48Z
model: Grok 4.6 (Cursor)
description: >-
  PR #183 rebased onto main after #186/#188. Prime catalog stays local;
  native chip keeps live listing; "1 provider" footer is locked.
commits: this rebase
---

# PR #183 rebase onto main

**Origin:** Grok 4.6 (Cursor) · 2026-10-17

Linearize #183 onto current `main` (`15a1e4b`, includes #186 and #188).
GitHub first-parent "39 behind" was merge-commit history; this rewrite is
one commit on main.

`NativeChatModelPicker` still branches on `engine`. Prime chats load
`get_available_prime_models` / `loadPrimeModelCatalog` and write
`set_prime_model`. They do not call `list_ai_model_provider_models`.
Rhizome chats keep #186 live listing.

Footer uses locale singular/plural (`1 provider needs a key` /
`{count} providers need a key`). A leftover plus a chip test lock that
string so a rebase cannot restore `#186`'s `1 providers`.

Mock `save_settings` now keeps `chat_engine` / `native_chat_target` so
the mock app can switch to Rhizome for screenshots.

Did not edit `HANDOFF.md`.
