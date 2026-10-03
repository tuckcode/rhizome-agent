---
session: 2026-10-03T09:42-05:00
model: Cursor Grok 4.7
description: >-
  Add to Chat list copies Nous reasoning and input modalities into
  models.json. The id is not used as a guess. Not committed. Not in
  the installed app.
commits: none
---

# Nous catalog fields on Add to Chat list

**Origin:** Cursor Grok 4.7 · 2026-10-03.

`ensure_nous_portal` still runs only when Settings uses **Add to Chat list**. Each Nous record now supplies the stored fields.

- A `reasoning` object, or a boolean `true`, is stored as `reasoning: true`. A missing field is stored as `false`.
- `architecture.input_modalities` is stored in Prime's `input`. Prime accepts `text` and `image` only. Video, file, and audio are left out so the file still loads.
- `z-ai/glm-5.3-flash` from the live catalog is `text+image+video` with a reasoning object. The write keeps `text` and `image`, and sets reasoning on.
- The id is not read for either field. The name-guess repair on image send is removed.

Seven tests in `prime_custom_models` passed. The model picker was not opened. The installed app is still the 2026-09-26 build. Prime reads `models.json` on the next model select.

## Still open

- Second stall sample, on a build that contains the `spawn_blocking` change. That change is still uncommitted in `commands/ai.rs` and `commands/git.rs`.
- One live empty-reply capture. Plan: [`docs/plans/2026-10-02-stall-and-empty-reply.md`](../2026-10-02-stall-and-empty-reply.md).
- `import_jsonl` still waits for `1`.
