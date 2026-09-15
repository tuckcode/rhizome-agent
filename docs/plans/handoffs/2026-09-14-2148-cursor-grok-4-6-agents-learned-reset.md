---
session: 2026-09-14T21:48-05:00
model: Grok 4.6 (Cursor)
description: >-
  Clean-slate AGENTS.md Learned sections. Stricter continual-learning
  guard so future memory stays short and durable. No commit yet.
commits: uncommitted
---

# AGENTS Learned reset — 2026-09-14 21:48

**Origin:** Cursor Grok 4.6 · 2026-09-14 21:48 · Atticus asked for
clean slate + stricter skill rules.

## What changed

- `AGENTS.md` **Learned User Preferences** and **Learned Workspace
  Facts** wiped to `_(none yet)_`.
- New **Continual-learning** guard block above those headings: default
  write-nothing, durable / project-specific / recurring / actionable
  only, ban list for SHA/clock/billing/junk.
- Project rule: [`.cursor/rules/continual-learning.mdc`](../../../.cursor/rules/continual-learning.mdc)
  (`alwaysApply: true`).
- `docs/design/vault-skill-home.md` Learned-memory note aligned: short
  Learned bullets OK under the guard; junk still forbidden.

## Why

Continual-learning kept stuffing mega-bullets into Learned until the
file looked cut off and agents carried stale context. Process rules
(Sections 1–3) were fine; the junk drawer was Learned.

## Next

- Say **commit** (and later **push**) when you want this on origin.
- Next `continual-learning` run should usually answer
  `No high-signal memory updates.` unless something clear and durable
  appears.
- Rebuild is a separate verb; app still `476756c` until rebuild.
