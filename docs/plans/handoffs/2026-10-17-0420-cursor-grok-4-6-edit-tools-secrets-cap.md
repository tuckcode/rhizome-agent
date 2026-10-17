---
session: 2026-10-17T04:20Z
model: Cursor Grok 4.6
description: >-
  Rebase #196 onto #195 4753141; mutate tools use the shared secret
  denylist; edit_file refuses files over 2 MiB.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · native edit/write follow-up

#196 is rebased onto `4753141f`. `edit_file` and `write_file` go through
`sandbox::resolve`, so they refuse `.env*`, `.git/`, `*.pem`, and `id_*`
the same way the read tools do. `edit_file` checks size then reads at
most 2 MiB (`take`); a larger file is refused and left untouched.

The approval card did not change; review shots were not recaptured.

Localization: none — English only (C18).
PostHog: no event needed because this is sandbox policy, not a new UI
action.
