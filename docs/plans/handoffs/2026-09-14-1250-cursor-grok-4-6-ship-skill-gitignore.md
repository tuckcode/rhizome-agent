---
session: 2026-09-14T12:50-05:00
model: Grok 4.6 (Cursor)
description: >-
  rhizome-ship was authored but gitignored. Allow-listed.
  D1/D2 12px + About neighbor tests. No commit.
commits: none
---

# rhizome-ship gitignore + leftover tests — 2026-09-14 12:50

**Origin:** Cursor Grok 4.6 · five-hour burn leftover · no commit

`.cursor/*` swallowed `.cursor/skills/rhizome-ship/SKILL.md`. The skill
existed on disk and BOARD already said Authored. Git could not see it.
NEXT / W11 still said Idea.

## Fix

`.gitignore` now allow-lists `.cursor/skills/rhizome-ship/` the same
way it allow-lists `.cursor/rules/`. Did not un-ignore impeccable or
the rest of `.cursor/`.

Stamped Idea → Authored on `NEXT.md`, `w11-card-status.md`,
`W11-parked-cards.md`. Living-docs Astra line now says received.

## Tests (shipped chrome only)

- `ChatComposerFoot` — status 12px; kbd chips stay 10px
- `ChatPreflightBanner` — title + remedy row 12px
- `AboutSettingsSection` — organic 1774×887 banner; Contribute/Docs
  stay when those actions exist

No product behavior change. No list-import. No #66. No Applications
rebuild. D6 still ~15:45.

## Not done

- Commit / push / rebuild
- Native D1/D2/W4
- Close #41 or #46
