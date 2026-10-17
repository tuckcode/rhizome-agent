---
session: 2026-10-17T00:12Z
model: Grok 4.6 (Cursor)
description: >-
  Hide unset local chip headings, normalize live provider ids, and
  land the remaining #186 review nits.
commits: this slice
---

# Chip menu review follow-up 2

**Origin:** Grok 4.6 (Cursor) · 2026-10-17

`liveProviderHeadingNames` no longer lists catalog Ollama / LM Studio
unless the user set them up or the host answered. `providersToListLive`
walks `normalizeAiModelProviders`, so `Work-OpenAI` matches the seed
`work-openai`. Colliding display names get a provider prefix. The
selected row uses a ref. Footer keeps the key count muted and only
`Open settings` is the accent link. Review shots live in
`docs/screenshots/pr-186/`.
