---
session: 2026-10-12T00:40Z
model: Cursor Grok 4.6
description: >-
  #156 review: loop-safe HTML comment strip in the agent-docs
  generator, rebase onto main after #155, and drop Off-means-Prime
  routing claims from five Starlight pages.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-12 · Starlight PR 1 review

## What changed

Rebased `cursor/starlight-site-and-bundle-89d7` onto `origin/main`
(`e1826d0`, #155). Three commits replayed cleanly.

`stripHtmlComments` no longer uses a single-pass `<!-- ... -->`
replace. CodeQL flagged that as incomplete sanitization. It now walks
the string and drops comments until none remain, including an opener
rebuilt by overlapping input. New test in
`scripts/build-agent-docs.test.mjs`.

Removed Off-means-Prime claims from:

- `site/src/content/docs/concepts/ai.md`
- `site/src/content/docs/guides/configure-ai-models.md`
- `site/src/content/docs/concepts/free-models-and-routing.md`
- `site/src/content/docs/troubleshooting/chat-doesnt-answer.md`
- `site/src/content/docs/start/first-launch.md`

Did not write new routing copy. Dropped the stale "re-check when #155
merges" comments. Regenerated the in-app bundle.

Did not edit `docs/HANDOFF.md`. Did not merge.

## C95

`tests/smoke/unified-shell-layout.spec.ts` expects `prime-session-list`
after a rail hover. After #155, ChatHome passes `effectiveEngine`
(`native` when Prime is not live) into `AiPanel`, so the rail portal
does not mount the list. The assertion failed twice here. Not from this
docs PR. CI does not run this smoke. Opened so the next session does
not rediscover it.

## knispo

Same review list as #156. Merge when ready.
