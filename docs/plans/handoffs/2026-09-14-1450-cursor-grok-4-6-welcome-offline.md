---
session: 2026-09-14T14:16-05:00
model: Grok 4.6 (Cursor)
description: >-
  First-run Getting Started stays clickable offline. Default is a local
  folder layout, not a clone. Did not rewrite en.json. No commit.
commits: none
---

# Welcome offline leftover — 2026-09-14 14:16

**Origin:** Cursor Grok 4.6 · decided leftover · no commit

`create_getting_started_vault` already builds a local scaffold unless
`RHIZOME_GETTING_STARTED_REPO_URL` is set. Welcome still disabled that
button offline and said clone later.

The button is enabled offline now. The Download words in `en.json` stay
(C18). Env-override clone can still fail offline; that error stays.

```bash
npx vitest run src/components/WelcomeScreen.test.tsx
```

**27/27 PASS.** Playwright smoke file
`tests/smoke/offline-onboarding-status.spec.ts` updated (not `@smoke`).

Did not commit. Did not push. Did not rebuild. C64 still **NOT RUN**.
App still `476756c`.
